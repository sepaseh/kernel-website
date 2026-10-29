import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { once } from "node:events";
import { EventEmitter } from "node:events";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { apiFixtureRevision } from "../../scripts/runner-inputs.mjs";
import {
  createDockerFixtureRequest,
  runDockerProcess,
  runDockerSmoke,
} from "./smoke.mjs";

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
  assert.equal(
    state.override.volumes["fixture-data"].name,
    state.project + "_fixture-data",
  );
  assert.deepEqual(
    state.volumePreflights.sort((left, right) => left.localeCompare(right)),
    [
      "name=^" + state.project + "_fixture-data$",
      "name=^" + state.project + "_fixture-tls$",
    ],
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
  for (const volumeCollision of ["fixture-tls", "fixture-data"]) {
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

test(
  "CSP transitions remain sequential while independent assets drain together",
  { timeout: 5000 },
  async (context) => {
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
  },
);

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
      maxRetries: 5,
      retryDelay: 100,
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
  const state = {
    calls: [],
    builder: false,
    images: new Set(),
    volumes: new Set(),
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
      return {
        directory: path.join(root, "public-api"),
        revision: apiFixtureRevision,
      };
    },
    exportApi: async (_api, directory, environment) => {
      state.fixture = directory;
      assert.equal(environment.DOCKER_HOST, undefined);
      assert.equal(environment.PRIVATE_KEY, undefined);
      assert.equal(environment.HOME, undefined);
      assert.equal(environment.USERPROFILE, undefined);
      assert.equal(
        environment.DOCKER_CONFIG,
        path.join(directory, "docker-config"),
      );
      const exported = path.join(directory, "api");
      await mkdir(exported);
      return exported;
    },
    docker: async (configuration) => {
      const { args, signal, env } = configuration;
      state.fixture ??= env.TEMP;
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
      if (operation[0] === "container" && operation[1] === "ls")
        return state.certificate &&
          operation.at(-1) === `name=^/${state.certificate}$`
          ? "owned-certificate"
          : "";
      if (operation[0] === "container" && operation[1] === "rm") {
        assert.deepEqual(operation, [
          "container",
          "rm",
          "--force",
          state.certificate,
        ]);
        state.certificate = undefined;
        state.cleanup.push("certificate");
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
        if (operation.includes("up"))
          state.volumes.add(state.project + "_fixture-data");
        if (operation.includes("build")) {
          state.images.add(`${state.project}/website:${state.release}`);
          state.images.add(`${state.project}/gateway:${state.release}`);
          assert.equal(env.BUILDX_BUILDER, state.builderName);
        }
        if (operation.includes("down")) {
          assert.equal(
            state.certificate,
            undefined,
            "The interrupted certificate container still holds its TLS volume.",
          );
          state.volumes.clear();
          state.cleanup.push("compose");
          assert.equal(signal, undefined);
        }
      }
      return "";
    },
    request: async (address) => {
      const url = new URL(address);
      assert.equal(url.hostname, "www.kernel.test");
      if (controls.controller) controls.controller.abort();
      if (controls.requestFailure) throw new Error("Owned response failed");
      if (url.protocol === "http:") return { status: 308 };
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
          text: '<script src="/_next/a.js"></script><link href="/font.woff2"><link href="/_next/a.js"><link href="https://invalid.test/ignore.css">',
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
      `const before=process.listenerCount('SIGINT');await import(${JSON.stringify(new URL("./smoke.mjs", import.meta.url).href)});if(process.listenerCount('SIGINT')!==before)process.exitCode=1`,
    ],
    {
      cwd: root,
      env: processEnvironment(),
      timeout: 10_000,
      windowsHide: true,
    },
  );
  assert.equal(imported.status, 0, imported.stderr?.toString());
});

test("Docker smoke rejects invalid cancellation and requires the explicit pinned API", async (context) => {
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
    /KERNEL_API_DIRECTORY/,
  );
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
  await assert.rejects(
    runDockerProcess(
      nodeOperation(root, "setInterval(()=>{},1000)", {
        timeoutMs: 100,
      }),
    ),
    /operation failed/,
  );
  await assert.rejects(
    runDockerProcess(
      nodeOperation(
        root,
        "process.stdout.write(Buffer.alloc(2*1024*1024));setInterval(()=>{},1000)",
      ),
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

  assert.equal(result.apiRevision, apiFixtureRevision);
  assert.equal(state.images.size, 0);
  assert.equal(state.builder, false);
  assert.ok(state.cleanup.includes("compose"));
  assert.ok(state.cleanup.includes("builder"));
  assert.equal(
    state.override.services["fixture-api"].environment.BETTER_AUTH_SECRET
      .length,
    64,
  );
  assert.deepEqual(
    state.override.services["fixture-api"].healthcheck.test.slice(0, 4),
    ["CMD", "node", "--input-type=module", "-e"],
  );
  assert.equal(
    (await readFile(result.report, "utf8")).includes(apiFixtureRevision),
    true,
  );
  await assert.rejects(access(state.fixture), { code: "ENOENT" });
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

test("Docker smoke cleans state when export, port or report preparation fails", async (context) => {
  const first = await syntheticSmoke(context, {
    options: {
      exportApi: async (_api, directory) => {
        first.state.fixture = directory;
        throw new Error("Owned source export failed");
      },
    },
  });
  await assert.rejects(
    runDockerSmoke(first.root, first.options),
    /source export/,
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

test("Docker API context exports tracked selected source and never copies ignored checkout state", async (context) => {
  const { root, options, state } = await syntheticSmoke(context);
  const api = path.join(root, "public-api");
  await mkdir(path.join(api, "src"), { recursive: true });
  await mkdir(path.join(api, "drizzle"));
  await writeFile(
    path.join(api, "package.json"),
    '{"name":"synthetic-public-api","type":"module"}',
  );
  await writeFile(path.join(api, "package-lock.json"), '{"lockfileVersion":3}');
  await writeFile(
    path.join(api, "src/index.ts"),
    'console.log("synthetic public entry");',
  );
  await writeFile(path.join(api, "drizzle/0000.sql"), "SELECT 1;");
  await writeFile(
    path.join(api, ".env.local"),
    "PRIVATE_SYNTHETIC_SENTINEL=must-not-enter-context",
  );
  const git =
    process.platform === "win32"
      ? String.raw`C:\Program Files\Git\cmd\git.exe`
      : "/usr/bin/git";
  const runGit = (...args) =>
    execFileSync(git, ["-C", api, ...args], {
      env: processEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    }).trim();
  runGit("init", "--quiet");
  runGit("add", "--", "package.json", "package-lock.json", "src", "drizzle");
  const tree = runGit("write-tree");
  options.resolveApi = async () => ({ directory: api, revision: tree });
  delete options.exportApi;
  const execute = options.docker;
  options.docker = async (configuration) => {
    if (configuration.args.slice(2, 4).join(" ") === "buildx build") {
      const file = configuration.args[configuration.args.indexOf("--file") + 1];
      const exported = path.dirname(file);
      const dockerfile = await readFile(file, "utf8");
      assert.match(dockerfile, /COPY src \.\/src/);
      assert.match(dockerfile, /COPY drizzle \.\/drizzle/);
      assert.match(dockerfile, /node.*,.*src\/index\.ts/);
      assert.equal(
        await readFile(path.join(exported, "src/index.ts"), "utf8"),
        'console.log("synthetic public entry");',
      );
      await assert.rejects(access(path.join(exported, ".env.local")), {
        code: "ENOENT",
      });
      await assert.rejects(access(path.join(exported, ".git")), {
        code: "ENOENT",
      });
    }
    return execute(configuration);
  };

  await runDockerSmoke(root, options);
  assert.equal(
    await readFile(path.join(api, ".env.local"), "utf8"),
    "PRIVATE_SYNTHETIC_SENTINEL=must-not-enter-context",
  );
  await assert.rejects(access(state.fixture), { code: "ENOENT" });
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
