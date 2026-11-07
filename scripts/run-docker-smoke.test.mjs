import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { EventEmitter } from "node:events";
import {
  access,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { cleanupWebsiteDocker } from "./docker-smoke-cleanup.mjs";
import {
  createDockerFixtureRequest,
  runDockerProcess,
  runDockerSmoke,
} from "./run-docker-smoke.mjs";

test("synthetic TLS uses only a claimed Compose volume and a root networkless certificate helper", async (context) => {
  const { root, options, state } = await syntheticSmoke(context);
  const result = await runDockerSmoke(root, options);
  assert.deepEqual(state.override.services.gateway.volumes, [
    {
      type: "volume",
      source: "fixture-tls",
      target: "/etc/kernel/tls",
      read_only: true,
      volume: { nocopy: true },
    },
  ]);
  assert.deepEqual(state.override.services["fixture-certificate"].volumes, [
    {
      type: "volume",
      source: "fixture-tls",
      target: "/tls",
      volume: { nocopy: true },
    },
  ]);
  assert.equal(
    state.override.volumes["fixture-tls"].name,
    state.project + "_fixture-tls",
  );
  assert.deepEqual(Object.keys(state.override.volumes), ["fixture-tls"]);
  assert.deepEqual(
    state.volumePreflights.sort((left, right) => left.localeCompare(right)),
    ["name=^" + state.project + "_fixture-tls$"],
  );
  assert.equal(state.volumes.size, 0);
  assert.equal(state.certificateName, `${state.project}-certificate`);
  assert.ok(state.cleanup.includes("compose"));
  assert.ok(
    result.verified.includes(
      "generated certificate trust and hostname verification",
    ),
  );
  assert.equal(
    state.calls.some((call) => call[0] === "run"),
    false,
  );
  assert.equal(
    state.calls.some((call) => call[0] === "volume" && call[1] === "rm"),
    false,
  );
  await assert.rejects(access(state.fixture), { code: "ENOENT" });
});

test("unowned named-volume collisions are refused before adoption and helper failures drain owned volumes", async (context) => {
  for (const volumeCollision of ["fixture-tls"]) {
    const { root, options, state } = await syntheticSmoke(context, {
      volumeCollision,
    });
    await assert.rejects(
      runDockerSmoke(root, options),
      /fixture volume already exists/,
    );
    assert.equal(
      state.calls.some((call) => call[0] === "compose"),
      false,
    );
    assert.equal(
      state.calls.some((call) => call[0] === "buildx" && call[1] === "create"),
      false,
    );
    assert.equal(
      state.calls.some((call) => call[0] === "volume" && call[1] === "rm"),
      false,
    );
    await assert.rejects(access(state.fixture), { code: "ENOENT" });
  }
  const { root, options, state } = await syntheticSmoke(context, {
    certificateFailure: true,
  });
  await assert.rejects(
    runDockerSmoke(root, options),
    /certificate helper failed/,
  );
  assert.equal(state.volumes.size, 0);
  assert.equal(state.certificate, undefined);
  assert.ok(state.cleanup.includes("certificate"));
  assert.ok(
    state.cleanup.indexOf("certificate") < state.cleanup.indexOf("compose"),
  );
  assert.ok(state.cleanup.includes("compose"));
  assert.equal(state.builder, false);
  await assert.rejects(access(state.fixture), { code: "ENOENT" });
});

test("generated fixture trust keeps certificate and hostname verification enabled", async (context) => {
  const root = await fixture(context);
  const certificate = Buffer.from("owned generated public CA");
  const calls = [];
  context.mock.method(https, "request", (url, options, respond) => {
    calls.push({ url, options });
    const outgoing = new EventEmitter();
    outgoing.end = () =>
      queueMicrotask(() => {
        const response = new EventEmitter();
        response.statusCode = 200;
        response.headers = { "content-type": "text/plain" };
        respond(response);
        response.emit("data", Buffer.from("owned response"));
        response.emit("end");
      });
    return outgoing;
  });
  const request = await createDockerFixtureRequest(root, certificate);
  const response = await request("https://www.kernel.test:9443/login", {
    method: "GET",
  });
  assert.equal(response.status, 200);
  assert.equal(response.text, "owned response");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.ca, certificate);
  assert.equal(calls[0].options.rejectUnauthorized, true);
  assert.equal(calls[0].options.agent, false);
  assert.equal(calls[0].options.checkServerIdentity, undefined);
  assert.equal(calls[0].options.servername, undefined);
  calls[0].options.lookup(
    "www.kernel.test",
    { all: false },
    (error, address, family) => {
      assert.equal(error, null);
      assert.equal(address, "127.0.0.1");
      assert.equal(family, 4);
    },
  );
  calls[0].options.lookup(
    "www.kernel.test",
    { all: true },
    (error, addresses) => {
      assert.equal(error, null);
      assert.deepEqual(addresses, [{ address: "127.0.0.1", family: 4 }]);
    },
  );
  for (const options of [
    { rejectUnauthorized: false },
    { ca: Buffer.from("unowned replacement CA") },
    { checkServerIdentity: () => undefined },
    { servername: "other.kernel.test" },
    { agent: {} },
    { lookup: () => {} },
    { socketPath: "unowned socket" },
    null,
    [],
    { [Symbol("unowned")]: true },
  ])
    await assert.rejects(
      request("https://www.kernel.test:9443/login", options),
      /options|overrides/,
    );
  await assert.rejects(request("https://other.kernel.test:9443/login"), {
    code: "ERR_ASSERTION",
  });
  assert.equal(calls.length, 1);
});

test("fixture trust requires readiness and only a bounded public certificate", async (context) => {
  const root = await fixture(context);
  for (const certificate of [
    undefined,
    "public string",
    Buffer.alloc(0),
    Buffer.alloc(64 * 1024 + 1),
  ])
    await assert.rejects(
      createDockerFixtureRequest(root, certificate),
      /bounded public certificate/,
    );
  const falseRoot = await fixture(context, false);
  await assert.rejects(
    createDockerFixtureRequest(falseRoot, Buffer.from("unused")),
    /applicationReady/,
  );
});

test("fixture requests enforce a total deadline despite incoming chunks and preserve caller cancellation", async (context) => {
  const root = await fixture(context);
  const timers = new Map();
  context.mock.method(globalThis, "setTimeout", (callback, milliseconds) => {
    assert.equal(milliseconds, 15_000);
    const timer = {};
    timers.set(timer, callback);
    return timer;
  });
  context.mock.method(globalThis, "clearTimeout", (timer) =>
    timers.delete(timer),
  );
  const requests = [];
  context.mock.method(https, "request", (_url, options, respond) => {
    const outgoing = new EventEmitter();
    const response = new EventEmitter();
    response.statusCode = 200;
    response.headers = {};
    outgoing.end = () => {
      respond(response);
      response.emit("data", Buffer.from("first chunk"));
    };
    outgoing.destroy = (error) => {
      outgoing.emit("error", error);
      response.emit("error", error);
    };
    options.signal.addEventListener(
      "abort",
      () =>
        outgoing.destroy(
          new Error("request aborted", { cause: options.signal.reason }),
        ),
      { once: true },
    );
    requests.push({ options, response, outgoing });
    return outgoing;
  });
  const request = await createDockerFixtureRequest(
    root,
    Buffer.from("owned public CA"),
  );
  const caller = new AbortController();
  const first = request("https://www.kernel.test:9443/login", {
    signal: caller.signal,
  });
  requests[0].response.emit("data", Buffer.from("later chunk"));
  assert.equal(timers.size, 1);
  timers.values().next().value();
  await assert.rejects(first, (error) =>
    /total deadline/.test(error.cause.message),
  );
  assert.equal(timers.size, 0);
  assert.equal(caller.signal.aborted, false);
  assert.equal(requests[0].options.signal.aborted, true);

  const second = request("https://www.kernel.test:9443/login", {
    signal: caller.signal,
  });
  const cancelled = new Error("controlled caller cancellation");
  caller.abort(cancelled);
  await assert.rejects(second, (error) => error.cause === cancelled);
  assert.equal(timers.size, 0);

  const third = request("https://www.kernel.test:9443/login");
  assert.equal(timers.size, 1);
  requests[2].response.emit("end");
  assert.equal((await third).text, "first chunk");
  assert.equal(timers.size, 0);

  const fourth = request("https://www.kernel.test:9443/login");
  assert.equal(timers.size, 1);
  const failure = new Error("controlled request failure");
  requests[3].outgoing.emit("error", failure);
  await assert.rejects(fourth, (error) => error === failure);
  assert.equal(timers.size, 0);

  await assert.rejects(
    request("https://www.kernel.test:9443/login", { signal: {} }),
    { code: "ERR_INVALID_ARG_TYPE" },
  );
  assert.equal(timers.size, 0);
});

test("CSP transitions remain sequential while independent assets drain together", async (context) => {
  const { root, options, state } = await syntheticSmoke(context);
  const original = options.request;
  const completedModes = [];
  let pending = [];
  const modes = [];
  options.request = async (address, requestOptions) => {
    const url = new URL(address);
    if (url.pathname === "/login" && url.protocol === "https:") {
      assert.equal(pending.length, 0);
      modes.push(state.mode);
      return original(address, requestOptions);
    }
    if (url.pathname === "/_next/a.js" || url.pathname === "/font.woff2") {
      const mode = state.mode;
      return new Promise((resolve) => {
        pending.push(resolve);
        if (pending.length === 2) {
          const batch = pending;
          pending = [];
          completedModes.push(mode);
          batch.forEach((finish) => finish({ status: 200 }));
        }
      });
    }
    return original(address, requestOptions);
  };
  await runDockerSmoke(root, options);
  assert.deepEqual(modes, ["report-only", "enforce"]);
  assert.deepEqual(completedModes, ["report-only", "enforce"]);
  assert.deepEqual(pending, []);
});

test("missing or oversized generated public CA fails before making fixture requests", async (context) => {
  for (const certificate of [Buffer.alloc(0), Buffer.alloc(64 * 1024 + 1)]) {
    const { root, options, state } = await syntheticSmoke(context, {
      certificate,
    });
    delete options.request;
    await assert.rejects(
      runDockerSmoke(root, options),
      /public TLS certificate.*bounded/,
    );
    await assert.rejects(access(state.fixture), { code: "ENOENT" });
    assert.equal(state.builder, false);
  }
});

async function fixture(context, ready = true) {
  const parent = path.resolve(os.tmpdir());
  const root = await mkdtemp(path.join(parent, "website-docker-owner-test-"));
  context.after(async () => {
    assert.equal(path.dirname(root), parent);
    await rm(root, {
      recursive: true,
      force: true,
    });
  });
  await mkdir(path.join(root, ".github"));
  await writeFile(
    path.join(root, ".github/bootstrap-policy.json"),
    JSON.stringify({ schemaVersion: 1, applicationReady: ready }),
  );
  return root;
}

const processEnvironment = () => ({
  ...(process.platform === "win32"
    ? { SystemRoot: String.raw`C:\Windows` }
    : {}),
});
const nodeOperation = (cwd, source, options = {}) => ({
  args: ["--input-type=module", "-e", source],
  command: process.execPath,
  cwd,
  env: processEnvironment(),
  capture: true,
  ...options,
});

async function syntheticSmoke(context, controls = {}) {
  const root = await fixture(context);
  const entry = path.join(root, "scripts/website-api-fixture.mjs");
  await mkdir(path.dirname(entry));
  await writeFile(entry, "// Owned website HTTP fixture for orchestration.\n");
  const state = {
    calls: [],
    builder: false,
    images: new Set(),
    volumes: new Set(),
    containers: new Set(),
    networks: new Set(),
    cleanup: [],
  };
  const options = {
    inherited: {
      KERNEL_SYNTHETIC_ENV: "1",
      DOCKER_HOST: "tcp://forbidden",
      PRIVATE_KEY: "not-forwarded",
    },
    dockerFile: async (filename) => filename,
    resolveApi: async (_directory, environment) => {
      assert.equal(environment.KERNEL_SYNTHETIC_ENV, "1");
      return { directory: root, entry };
    },
    docker: async (configuration) => {
      const { args, signal, env } = configuration;
      state.fixture ??= env.TEMP;
      state.configurationRoot ??= path.dirname(env.DOCKER_CONFIG);
      assert.equal(env.DOCKER_HOST, undefined);
      assert.equal(env.PRIVATE_KEY, undefined);
      assert.equal(env.HOME, undefined);
      assert.equal(env.USERPROFILE, undefined);
      assert.equal(
        env.DOCKER_CONFIG,
        path.join(state.configurationRoot, "docker-config"),
      );
      assert.notEqual(state.configurationRoot, state.fixture);
      assert.ok(
        path
          .basename(state.configurationRoot)
          .startsWith("kernel-website-docker-config-"),
      );
      if (env.TEMP !== state.fixture)
        assert.equal(env.TEMP, state.configurationRoot);
      assert.match(args[1], /^(?:npipe:|unix:)/);
      assert.equal(env.DOCKER_HOST, undefined);
      const operation = args.slice(2);
      state.calls.push(operation);
      if (operation[0] === "version" && controls.versionFailure)
        throw new Error("Owned engine unavailable");
      if (operation[0] === "buildx" && operation[1] === "inspect") {
        if (state.builder) return "owned builder";
        const missing = new Error("missing");
        missing.exitCode = 1;
        missing.stderr = `ERROR: no builder "${operation[2]}" found`;
        throw missing;
      }
      if (operation[0] === "buildx" && operation[1] === "create") {
        state.builder = true;
        state.builderName = operation[3];
        if (controls.createFailure)
          throw new Error("Owned builder startup failed");
      }
      if (operation[0] === "buildx" && operation[1] === "rm") {
        state.builder = false;
        state.cleanup.push("builder");
      }
      if (operation[0] === "buildx" && operation[1] === "build")
        state.images.add(operation[operation.indexOf("--tag") + 1]);
      if (operation[0] === "image" && operation[1] === "ls")
        return state.images.has(operation.at(-1).slice("reference=".length))
          ? "owned-image"
          : "";
      if (operation[0] === "image" && operation[1] === "rm") {
        state.images.delete(operation.at(-1));
        state.cleanup.push("image");
      }
      if (operation[0] === "container" && operation[1] === "ls") {
        if (operation.at(-1).startsWith("label="))
          return [...state.containers].join("\n");
        return state.certificate &&
          operation.at(-1) === `name=^/${state.certificate}$`
          ? "owned-certificate"
          : "";
      }
      if (operation[0] === "container" && operation[1] === "rm") {
        if (operation.at(-1) === state.certificate) {
          assert.deepEqual(operation, [
            "container",
            "rm",
            "--force",
            state.certificate,
          ]);
          state.certificate = undefined;
          state.cleanup.push("certificate");
        } else {
          for (const id of operation.slice(3)) {
            assert.ok(state.containers.has(id));
            state.containers.delete(id);
          }
        }
      }
      if (operation[0] === "network" && operation[1] === "ls")
        return [...state.networks].join("\n");
      if (operation[0] === "network" && operation[1] === "rm") {
        for (const id of operation.slice(2)) state.networks.delete(id);
      }
      if (
        operation[0] === "volume" &&
        operation[1] === "ls" &&
        operation.at(-1).startsWith("label=")
      )
        return [...state.volumes].join("\n");
      if (operation[0] === "volume" && operation[1] === "rm") {
        for (const name of operation.slice(2)) state.volumes.delete(name);
      }
      if (
        operation[0] === "volume" &&
        operation[1] === "ls" &&
        operation.at(-1).startsWith("name=^")
      ) {
        state.volumePreflights ??= [];
        state.volumePreflights.push(operation.at(-1));
        if (
          controls.volumeCollision &&
          operation.at(-1).endsWith("_" + controls.volumeCollision + "$")
        )
          return "foreign-volume";
      }
      if (operation[0] === "compose") {
        const envFile = operation[operation.indexOf("--env-file") + 1];
        const values = await readFile(envFile, "utf8");
        state.mode = values.match(/^WEBSITE_CSP_MODE=(.+)$/m)[1];
        state.release = values.match(/^RELEASE_ID=(.+)$/m)[1];
        state.deploymentOrigin = values.match(/^WEBSITE_URL=(.+)$/m)[1];
        state.project = operation[operation.indexOf("--project-name") + 1];
        const overridePath = operation[operation.lastIndexOf("-f") + 1];
        state.override = JSON.parse(await readFile(overridePath, "utf8"));
        if (operation.includes("run")) {
          assert.deepEqual(operation.slice(-7), [
            "run",
            "--rm",
            "-T",
            "--no-deps",
            "--name",
            `${state.project}-certificate`,
            "fixture-certificate",
          ]);
          assert.equal(configuration.capture, true);
          const helper = state.override.services["fixture-certificate"];
          assert.equal(helper.user, "0:0");
          assert.equal(helper.network_mode, "none");
          assert.equal(helper.read_only, true);
          assert.deepEqual(helper.profiles, ["certificate"]);
          assert.deepEqual(helper.entrypoint, ["sh", "-eu", "-c"]);
          const script = helper.command[0];
          assert.match(script, /umask 077/);
          assert.match(script, /chown 0:101 \/tls/);
          assert.match(script, /chmod 0750 \/tls/);
          assert.match(script, /chmod 0640 \/tls\/privkey\.pem/);
          assert.match(script, /chmod 0644 \/tls\/fullchain\.pem/);
          assert.match(script, /cat \/tls\/fullchain\.pem$/);
          assert.doesNotMatch(script, /cat \/tls\/privkey\.pem/);
          state.volumes.add(state.project + "_fixture-tls");
          state.certificateName = operation[operation.indexOf("--name") + 1];
          state.certificate = state.certificateName;
          if (controls.certificateFailure)
            throw new Error("Owned certificate helper failed");
          state.certificate = undefined;
          return (
            controls.certificate ?? "owned synthetic public certificate"
          ).toString("utf8");
        }
        if (operation.includes("build")) {
          state.images.add(`${state.project}/website:${state.release}`);
          state.images.add(`${state.project}/gateway:${state.release}`);
          assert.equal(env.BUILDX_BUILDER, state.builderName);
        }
        if (operation.includes("up")) {
          state.containers.add("a".repeat(12));
          state.networks.add("b".repeat(12));
        }
        if (operation.includes("down")) {
          assert.equal(
            state.certificate,
            undefined,
            "The interrupted certificate container still holds its TLS volume.",
          );
          state.volumes.clear();
          state.containers.clear();
          state.networks.clear();
          state.cleanup.push("compose");
          assert.equal(signal, undefined);
        }
      }
      return "";
    },
    request: async (address) => {
      const url = new URL(address);
      assert.equal(url.hostname, "www.kernel.test");
      if (url.protocol === "https:") state.origin ??= url.origin;
      if (controls.controller) controls.controller.abort();
      if (controls.requestFailure) throw new Error("Owned response failed");
      if (url.protocol === "http:")
        return {
          status: 308,
          headers: { location: `${state.deploymentOrigin}/login` },
        };
      if (url.pathname === "/login")
        return {
          status: 200,
          headers: {
            [state.mode === "enforce"
              ? "content-security-policy"
              : "content-security-policy-report-only"]:
              "script-src 'nonce-owned'",
            "x-robots-tag": "noindex",
          },
          text: '<script src="/_next/a.js"></script><link href="/font.woff2"><link href="/styles/site.css"><link href="/_next/a.js"><link href="https://invalid.test/ignore.css">',
        };
      if (url.pathname === "/styles/site.css")
        return {
          status: 200,
          text: '@font-face{src:url("../fonts/css-only.woff2")}',
        };
      if (url.pathname === "/api/auth/login")
        return {
          status: 200,
          text: "{}",
          headers: {
            "set-cookie": ["ordinary=value", "session=owned; Secure; HttpOnly"],
          },
        };
      if (url.pathname === "/api/account/me")
        return {
          status: 200,
          headers: { "cache-control": "no-store" },
        };
      if (url.pathname === "/_kernel/release")
        return {
          status: 200,
          text: JSON.stringify({ release: state.release }),
        };
      return { status: 200 };
    },
    ...controls.options,
  };
  context.after(async () => {
    if (state.configurationRoot)
      await assert.rejects(access(state.configurationRoot), { code: "ENOENT" });
  });
  return { root, options, state };
}

test("Docker smoke imports are inert and a false marker precedes option reads", async (context) => {
  const root = await fixture(context, false);
  let read = false;
  await assert.rejects(
    runDockerSmoke(root, {
      get inherited() {
        read = true;
        throw new Error("must not read");
      },
    }),
    /applicationReady/,
  );
  assert.equal(read, false);
  const imported = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const before=process.listenerCount('SIGINT');await import(${JSON.stringify(new URL("./run-docker-smoke.mjs", import.meta.url).href)});if(process.listenerCount('SIGINT')!==before)process.exitCode=1`,
    ],
    {
      cwd: root,
      env: processEnvironment(),
      windowsHide: true,
    },
  );
  assert.equal(imported.status, 0, imported.stderr?.toString());
});

test("Docker smoke rejects invalid cancellation and requires a synthetic marker and local fixture", async (context) => {
  const root = await fixture(context);
  await assert.rejects(runDockerSmoke(root, { signal: "bad" }), /AbortSignal/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runDockerSmoke(root, { signal: controller.signal }),
    /abort/i,
  );
  await assert.rejects(
    runDockerSmoke(root, { inherited: {} }),
    /KERNEL_SYNTHETIC_ENV/,
  );
  await assert.rejects(
    runDockerSmoke(root, { inherited: { KERNEL_SYNTHETIC_ENV: "1" } }),
    { code: "ENOENT" },
  );
});

test("Docker smoke accepts an explicitly validated CLI without ambient engine or context settings", async (context) => {
  for (const publicSetting of [false, true]) {
    const { root, options, state } = await syntheticSmoke(context);
    const cli = path.join(root, "installed", "docker");
    await mkdir(path.dirname(cli));
    await writeFile(
      cli,
      "// Owned fake CLI; the injected Docker callback never executes it.",
    );
    delete options.dockerFile;
    if (publicSetting) options.inherited.WEBSITE_DOCKER_CLI = cli;
    else {
      options.dockerCli = cli;
      options.inherited.WEBSITE_DOCKER_CLI = "ignored-relative-cli";
    }
    const execute = options.docker;
    options.docker = async (configuration) => {
      assert.equal(configuration.command, cli);
      return execute(configuration);
    };
    await runDockerSmoke(root, options);
    assert.equal(state.builder, false);
  }
});

test("Docker CLI selection rejects relative, remote, missing and linked paths before engine use", async (context) => {
  for (const dockerCli of [
    "docker",
    "../docker",
    "//remote/share/docker",
    42,
    "bad\0path",
  ])
    await assert.rejects(
      runDockerSmoke(await fixture(context), {
        dockerCli,
        inherited: { KERNEL_SYNTHETIC_ENV: "1" },
        dockerFile() {
          throw Error("Unexpected installed-tool inspection");
        },
      }),
      /explicit absolute local file path/,
    );
  const { root, options } = await syntheticSmoke(context);
  const directory = path.join(root, "installed");
  await mkdir(directory);
  await writeFile(path.join(directory, "docker"), "// Owned fake CLI");
  const linked = path.join(root, "linked-cli");
  await symlink(directory, linked, "junction");
  delete options.dockerFile;
  options.dockerCli = path.join(linked, "docker");
  await assert.rejects(runDockerSmoke(root, options), /links/);
  options.dockerCli = path.join(root, "missing-docker");
  await assert.rejects(runDockerSmoke(root, options), { code: "ENOENT" });
});

test("owned tool transport captures output, exit details and optional diagnostics", async (context) => {
  const root = await fixture(context);
  assert.equal(
    await runDockerProcess(
      nodeOperation(root, "process.stdout.write('owned output')"),
    ),
    "owned output",
  );
  await assert.rejects(
    runDockerProcess(
      nodeOperation(
        root,
        "process.stderr.write('owned error');process.exitCode=7",
      ),
    ),
    (error) => {
      assert.equal(error.exitCode, 7);
      assert.equal(error.stderr, "owned error");
      return true;
    },
  );
  assert.equal(
    await runDockerProcess(
      nodeOperation(root, "process.exitCode=1", { allowFailure: true }),
    ),
    "",
  );
  await runDockerProcess(nodeOperation(root, "", { capture: false }));
});

test("owned tool transport refuses bad deadlines and drains cancellation, overflow and spawn errors", async (context) => {
  const root = await fixture(context);
  await assert.rejects(
    runDockerProcess(nodeOperation(root, "", { timeoutMs: 0 })),
    /deadline/,
  );
  const deadline = new AbortController();
  const clock = context.mock.method(
    AbortSignal,
    "timeout",
    () => deadline.signal,
  );
  try {
    const operation = runDockerProcess(
      nodeOperation(
        root,
        "import{createServer}from'node:net';createServer(()=>{}).listen(0,'127.0.0.1');",
      ),
    );
    deadline.abort(new DOMException("Owned deadline reached", "TimeoutError"));
    await assert.rejects(operation, /operation failed/);
    assert.equal(clock.mock.callCount(), 1);
  } finally {
    clock.mock.restore();
  }
  await assert.rejects(
    runDockerProcess(
      nodeOperation(root, "process.stdout.write(Buffer.alloc(2*1024*1024));"),
    ),
    /operation failed/,
  );
  await assert.rejects(
    runDockerProcess(
      nodeOperation(root, "", {
        command: path.join(root, "missing-owned-command"),
      }),
    ),
    /operation failed/,
  );
});

test("Docker smoke verifies both CSP modes, cookie/API/assets and owned image cleanup", async (context) => {
  const { root, options, state } = await syntheticSmoke(context);
  const result = await runDockerSmoke(root, options);

  assert.equal(result.fixtureSource, "scripts/website-api-fixture.mjs");
  assert.equal(
    result.fixtureSha256,
    createHash("sha256")
      .update(await readFile(path.join(root, result.fixtureSource)))
      .digest("hex"),
  );
  assert.equal(state.images.size, 0);
  assert.equal(state.builder, false);
  assert.ok(state.cleanup.includes("compose"));
  assert.ok(state.cleanup.includes("builder"));
  assert.deepEqual(state.override.services["fixture-api"].environment, {
    NODE_ENV: "test",
    KERNEL_SYNTHETIC_ENV: "1",
    WEBSITE_FIXTURE_CONTAINER: "1",
    HOST: "0.0.0.0",
    PORT: "3000",
    WEBSITE_URL: state.origin,
  });
  assert.equal(state.override.services["fixture-api"].volumes, undefined);
  assert.deepEqual(
    state.override.services["fixture-api"].healthcheck.test.slice(0, 4),
    ["CMD", "node", "--input-type=module", "-e"],
  );
  assert.equal(
    (await readFile(result.report, "utf8")).includes(result.fixtureSha256),
    true,
  );
  await assert.rejects(access(state.fixture), { code: "ENOENT" });
});

test("Docker smoke rejects the opposite CSP header in either mode and cleans owned state", async (context) => {
  for (const mode of ["report-only", "enforce"]) {
    const { root, options, state } = await syntheticSmoke(context);
    const request = options.request;
    options.request = async (address, requestOptions) => {
      const response = await request(address, requestOptions);
      if (
        new URL(address).pathname === "/login" &&
        response.status === 200 &&
        state.mode === mode
      )
        response.headers[
          mode === "enforce"
            ? "content-security-policy-report-only"
            : "content-security-policy"
        ] = "script-src 'nonce-unexpected'";
      return response;
    };
    await assert.rejects(runDockerSmoke(root, options), {
      code: "ERR_ASSERTION",
    });
    assert.equal(state.images.size, 0);
    assert.equal(state.builder, false);
  }
});

test("Docker smoke fetches CSS-only fonts through the stylesheet's owned origin and rejects missing or external fonts", async (context) => {
  for (const failure of [undefined, "missing", "external"]) {
    const { root, options, state } = await syntheticSmoke(context);
    const request = options.request;
    const fonts = [];
    options.request = async (address, requestOptions) => {
      const url = new URL(address);
      assert.equal(url.hostname, "www.kernel.test");
      if (url.pathname === "/fonts/css-only.woff2") {
        fonts.push(url.href);
        if (failure === "missing") return { status: 404 };
      }
      if (url.pathname === "/styles/site.css" && failure === "external")
        return {
          status: 200,
          text: '@font-face{src:url("https://unowned.test/font.woff2")}',
        };
      return request(address, requestOptions);
    };
    if (failure)
      await assert.rejects(runDockerSmoke(root, options), {
        code: "ERR_ASSERTION",
      });
    else {
      await runDockerSmoke(root, options);
      assert.equal(fonts.length, 2);
      assert.ok(
        fonts.every((font) => font === `${state.origin}/fonts/css-only.woff2`),
      );
    }
    assert.equal(state.images.size, 0);
    assert.equal(state.builder, false);
  }
});

test("Docker smoke requires the exact HTTPS redirect destination", async (context) => {
  for (const destination of [
    undefined,
    "http://www.kernel.test/login",
    "https://unowned.test/login",
    "/login",
  ]) {
    const { root, options, state } = await syntheticSmoke(context);
    const request = options.request;
    options.request = async (address, requestOptions) =>
      new URL(address).protocol === "http:"
        ? { status: 308, headers: { location: destination } }
        : request(address, requestOptions);
    await assert.rejects(runDockerSmoke(root, options), {
      code: "ERR_ASSERTION",
    });
    assert.equal(state.images.size, 0);
    assert.equal(state.builder, false);
  }
});

test("a replaced deployment fixture cannot redirect Docker configuration or prevent owned engine cleanup", async (context) => {
  const { root, options, state } = await syntheticSmoke(context);
  const target = await mkdtemp(
    path.join(os.tmpdir(), "website-unowned-fixture-"),
  );
  const marker = path.join(target, "preserved.txt");
  await writeFile(marker, "preserve unrelated target");
  let saved;
  context.after(async () => {
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    await rm(target, { recursive: true, force: true });
    if (saved) {
      assert.equal(path.dirname(saved), path.resolve(os.tmpdir()));
      assert.ok(path.basename(saved).startsWith("kernel-website-docker-"));
      await rm(saved, { recursive: true, force: true });
      await rm(state.fixture, { recursive: true, force: true });
    }
  });
  const request = options.request;
  options.request = async (address, requestOptions) => {
    if (
      new URL(address).protocol === "https:" &&
      new URL(address).pathname === "/login"
    ) {
      saved = state.fixture + "-saved";
      await rename(state.fixture, saved);
      await symlink(target, state.fixture, "junction");
      throw Error("deployment fixture replaced");
    }
    return request(address, requestOptions);
  };
  await assert.rejects(runDockerSmoke(root, options), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.errors[0].message, /fixture replaced/);
    assert.match(
      error.errors[1].errors[0].cause.message,
      /unlinked temporary directory/,
    );
    return true;
  });
  assert.equal(state.images.size, 0);
  assert.equal(state.builder, false);
  assert.equal(state.volumes.size, 0);
  assert.equal(state.containers.size, 0);
  assert.equal(state.networks.size, 0);
  assert.equal(state.cleanup.includes("compose"), false);
  assert.equal(await readFile(marker, "utf8"), "preserve unrelated target");
});

test("Docker smoke cleans fresh state after early engine or partial builder failure", async (context) => {
  for (const failure of ["versionFailure", "createFailure"]) {
    const { root, options, state } = await syntheticSmoke(context, {
      [failure]: true,
    });
    await assert.rejects(
      runDockerSmoke(root, options),
      /Owned (?:engine|builder)/,
    );
    assert.equal(state.builder, false);
    await assert.rejects(access(state.fixture), { code: "ENOENT" });
  }
});

test("Docker smoke cancellation preserves uncancelled owned cleanup and aggregates failures", async (context) => {
  const controller = new AbortController();
  const { root, options, state } = await syntheticSmoke(context, {
    controller,
    options: { signal: controller.signal },
  });
  await assert.rejects(runDockerSmoke(root, options), /abort/i);
  assert.ok(state.cleanup.includes("compose"));
  assert.equal(state.builder, false);
  await assert.rejects(access(state.fixture), { code: "ENOENT" });

  const second = await syntheticSmoke(context, { requestFailure: true });
  second.options.cleanup = async (cleanup) => {
    await rm(cleanup.fixture, { recursive: true, force: true });
    throw new Error("Owned cleanup failed");
  };
  await assert.rejects(runDockerSmoke(second.root, second.options), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.errors[0].message, /Owned response failed/);
    assert.match(error.errors[1].message, /Owned cleanup failed/);
    return true;
  });
});

test("Docker smoke cleans state when fixture copy, port or report preparation fails", async (context) => {
  const first = await syntheticSmoke(context, {
    options: {
      prepareFixture: async (_root, _api, directory) => {
        first.state.fixture = directory;
        throw new Error("Owned fixture copy failed");
      },
    },
  });
  await assert.rejects(
    runDockerSmoke(first.root, first.options),
    /fixture copy/,
  );
  await assert.rejects(access(first.state.fixture), { code: "ENOENT" });

  const second = await syntheticSmoke(context, {
    options: { port: async () => 9001 },
  });
  await assert.rejects(runDockerSmoke(second.root, second.options), {
    code: "ERR_ASSERTION",
  });
  await assert.rejects(access(second.state.fixture), { code: "ENOENT" });

  const third = await syntheticSmoke(context);
  await writeFile(
    path.join(third.root, "test-results"),
    "unrelated existing file",
  );
  await assert.rejects(
    runDockerSmoke(third.root, third.options),
    /directories/,
  );
  assert.equal(
    await readFile(path.join(third.root, "test-results"), "utf8"),
    "unrelated existing file",
  );
  await assert.rejects(access(third.state.fixture), { code: "ENOENT" });
});

test("Docker fixture context copies only the fixed unlinked website responder into independent files", async (context) => {
  const { root, options, state } = await syntheticSmoke(context);
  const entry = path.join(root, "scripts/website-api-fixture.mjs");
  await writeFile(path.join(root, "package.json"), '{"name":"website-only"}');
  await writeFile(path.join(root, "scripts/unrelated.mjs"), "// not copied");
  const execute = options.docker;
  options.docker = async (configuration) => {
    if (configuration.args.slice(2, 4).join(" ") === "buildx build") {
      const file = configuration.args[configuration.args.indexOf("--file") + 1];
      const copied = path.dirname(file);
      assert.deepEqual((await readdir(copied)).sort(), [
        "Dockerfile",
        "website-api-fixture.mjs",
      ]);
      const dockerfile = await readFile(file, "utf8");
      assert.match(dockerfile, /^FROM node:24\.18\.0-bookworm-slim /);
      assert.match(
        dockerfile,
        /COPY --chown=node:node website-api-fixture\.mjs \.\/website-api-fixture\.mjs/,
      );
      assert.match(dockerfile, /CMD \["node", "website-api-fixture\.mjs"\]/);
      assert.doesNotMatch(
        dockerfile,
        /npm|package\.json|src\/|drizzle|DATABASE/,
      );
      const original = await open(entry, "r");
      let destination;
      try {
        destination = await open(
          path.join(copied, "website-api-fixture.mjs"),
          "r",
        );
        assert.deepEqual(
          await destination.readFile(),
          await original.readFile(),
        );
        const originalIdentity = await original.stat({ bigint: true });
        const destinationIdentity = await destination.stat({ bigint: true });
        assert.equal(destinationIdentity.isFile(), true);
        assert.notEqual(destinationIdentity.ino, originalIdentity.ino);
      } finally {
        await Promise.all([original.close(), destination?.close()]);
      }
    }
    return execute(configuration);
  };

  await runDockerSmoke(root, options);
  assert.equal(
    await readFile(path.join(root, "scripts/unrelated.mjs"), "utf8"),
    "// not copied",
  );
  await assert.rejects(access(state.fixture), { code: "ENOENT" });

  for (const change of [
    (directory) => ({ directory: path.join(directory, "other"), entry }),
    (directory) => ({
      directory,
      entry: path.join(directory, "scripts/unrelated.mjs"),
    }),
  ]) {
    const guarded = await syntheticSmoke(context);
    guarded.options.resolveApi = async () => change(guarded.root);
    guarded.options.cleanup = async (operation) => {
      guarded.state.fixture = operation.fixture;
      await cleanupWebsiteDocker(operation);
    };
    await assert.rejects(
      runDockerSmoke(guarded.root, guarded.options),
      /fixed local fixture/,
    );
    assert.equal(guarded.state.calls.length, 0);
    await assert.rejects(access(guarded.state.fixture), { code: "ENOENT" });
  }

  const linked = await syntheticSmoke(context);
  const scripts = path.join(linked.root, "scripts");
  const source = path.join(linked.root, "fixture-source");
  assert.equal(path.dirname(scripts), linked.root);
  assert.equal(path.dirname(source), linked.root);
  await rename(scripts, source);
  await symlink(source, scripts, "junction");
  delete linked.options.resolveApi;
  await assert.rejects(runDockerSmoke(linked.root, linked.options), /links/);
  assert.equal(linked.state.calls.length, 0);
});

test("default Docker request transport contacts only its owned loopback fixtures and cleans network failure", async (context) => {
  const first = http.createServer((_request, response) => {
    response.writeHead(308);
    response.end("owned redirect");
  });
  const second = http.createServer((_request, response) =>
    response.end("owned non-TLS fixture"),
  );
  const servers = [first, second];
  for (const server of servers) {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
  }
  try {
    const ports = [second.address().port, first.address().port];
    const { root, options, state } = await syntheticSmoke(context, {
      options: { port: async () => ports.shift() },
    });
    delete options.request;
    await assert.rejects(runDockerSmoke(root, options));
    await assert.rejects(access(state.fixture), { code: "ENOENT" });
    assert.equal(state.builder, false);
  } finally {
    for (const server of servers) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
});
