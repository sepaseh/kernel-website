// Owned synthetic Docker smoke; importing this module performs no operations.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertWebsiteBuilderAvailable,
  assertWebsiteResourcesAvailable,
  cleanupWebsiteDocker,
  websiteSmokeBuilder,
} from "./docker-smoke-cleanup.mjs";
import {
  artifactFile,
  completeArtifactWork,
  ensureArtifactDirectory,
  readArtifactFile,
} from "./release-files.mjs";
import { readyRunnerRoot, resolveApiFixture } from "./runner-inputs.mjs";
import { runVerificationCli, startOwnedProcess } from "./runner-process.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const outputLimit = 1024 * 1024;
const localHost =
  process.platform === "win32"
    ? "npipe:////./pipe/dockerDesktopLinuxEngine"
    : "unix:///var/run/docker.sock";
const systemDocker =
  process.platform === "win32"
    ? String.raw`C:\Program Files\Docker\Docker\resources\bin\docker.exe`
    : "/usr/bin/docker";

const dockerEnvironment = (fixture) => ({
  DOCKER_CONFIG: path.join(fixture, "docker-config"),
  PATH:
    process.platform === "win32"
      ? String.raw`C:\Program Files\Docker\Docker\resources\bin;C:\Windows\System32;C:\Windows`
      : "/usr/bin:/bin",
  ...(process.platform === "win32"
    ? { SystemRoot: String.raw`C:\Windows` }
    : {}),
  TEMP: fixture,
  TMP: fixture,
});

/** Run and drain one owned Docker/tool child with bounded output and lifetime. */
export async function runDockerProcess({
  allowFailure = false,
  capture = false,
  signal,
  timeoutMs = 900_000,
  ...configuration
}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 900_000)
    throw new Error("Docker operations require a bounded execution deadline.");
  const deadline = AbortSignal.timeout(timeoutMs);
  const operationSignal = signal
    ? AbortSignal.any([signal, deadline])
    : deadline;
  const owned = startOwnedProcess({
    ...configuration,
    signal: operationSignal,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  let stderr = "";
  let captureFailure;
  const collect = async (stream) => {
    if (!stream) return "";
    const chunks = [];
    let bytes = 0;
    for await (const chunk of stream) {
      bytes += chunk.length;
      if (bytes > outputLimit) {
        captureFailure = new Error(
          "Docker output exceeded its bounded capture limit.",
        );
        await owned.stop();
        throw captureFailure;
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
  };
  const errors = collect(owned.child.stderr).then((value) => {
    stderr = value;
    return value;
  });
  try {
    const [, output] = await completeArtifactWork([
      owned.completion,
      collect(owned.child.stdout),
      errors,
    ]);
    return output;
  } catch (cause) {
    if (
      allowFailure &&
      !operationSignal.aborted &&
      !captureFailure &&
      Number.isInteger(owned.child.exitCode) &&
      owned.child.exitCode !== 0
    )
      return "";
    const error = new Error("Owned local Docker/tool operation failed.", {
      cause,
    });
    error.exitCode = owned.child.exitCode;
    error.stderr = stderr;
    throw error;
  }
}

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const value = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(value)));
    });
  });

function requestOptions(options) {
  if (!options || typeof options !== "object" || Array.isArray(options))
    throw new Error("Synthetic request options must be an explicit object.");
  const allowed = new Set(["body", "signal", "method", "headers"]);
  if (
    Object.getOwnPropertySymbols(options).length ||
    Object.getOwnPropertyNames(options).some((key) => !allowed.has(key))
  )
    throw new Error(
      "Synthetic requests reject transport and TLS option overrides.",
    );
  return options;
}

async function fixtureRequest(address, certificate, options = {}) {
  const { body, signal, method, headers } = requestOptions(options);
  const url = new URL(address);
  assert.equal(url.hostname, "www.kernel.test");
  assert.ok(["http:", "https:"].includes(url.protocol));
  const deadline = new AbortController();
  const totalTimer = setTimeout(
    () =>
      deadline.abort(
        new Error("Loopback fixture request exceeded its total deadline."),
      ),
    15_000,
  );
  totalTimer.unref?.();
  try {
    const requestSignal = signal
      ? AbortSignal.any([signal, deadline.signal])
      : deadline.signal;
    return await new Promise((resolve, reject) => {
      const outgoing = (url.protocol === "https:" ? https : http).request(
        url,
        {
          method,
          headers,
          agent: false,
          ...(url.protocol === "https:"
            ? { ca: certificate, rejectUnauthorized: true }
            : {}),
          signal: requestSignal,
          timeout: 15_000,
          lookup: (_host, flags, callback) =>
            flags.all
              ? callback(null, [{ address: "127.0.0.1", family: 4 }])
              : callback(null, "127.0.0.1", 4),
        },
        (response) => {
          const chunks = [];
          let bytes = 0;
          response.on("data", (chunk) => {
            bytes += chunk.length;
            if (bytes > 8 * outputLimit)
              response.destroy(new Error("Synthetic response is too large."));
            else chunks.push(chunk);
          });
          response.once("error", reject);
          response.once("end", () =>
            resolve({
              status: response.statusCode,
              headers: response.headers,
              text: Buffer.concat(chunks).toString("utf8"),
            }),
          );
        },
      );
      outgoing.once("error", reject);
      outgoing.once("timeout", () =>
        outgoing.destroy(new Error("Loopback fixture request timed out.")),
      );
      outgoing.end(body);
    });
  } finally {
    clearTimeout(totalTimer);
  }
}

/** Trust only the generated fixture certificate and retain normal TLS hostname checks. */
export async function createDockerFixtureRequest(root, certificate) {
  await readyRunnerRoot(root);
  if (
    !Buffer.isBuffer(certificate) ||
    certificate.length === 0 ||
    certificate.length > 64 * 1024
  )
    throw new Error(
      "Synthetic TLS trust requires a bounded public certificate buffer.",
    );
  return (address, options) => fixtureRequest(address, certificate, options);
}

const fixtureDockerfile = [
  "FROM node:24.18.0-bookworm-slim AS synthetic-api",
  "WORKDIR /app",
  "COPY --chown=node:node website-api-fixture.mjs ./website-api-fixture.mjs",
  "USER node",
  'CMD ["node", "website-api-fixture.mjs"]',
  "",
].join("\n");

async function prepareFixtureContext(root, api, fixture) {
  const entry = await artifactFile(
    path.join(root, "scripts/website-api-fixture.mjs"),
  );
  if (api?.directory !== root || api?.entry !== entry)
    throw new Error(
      "Docker smoke must use this website's fixed local fixture.",
    );
  const source = await readArtifactFile(entry);
  const context = path.join(fixture, "api");
  await mkdir(context);
  await writeFile(path.join(context, "website-api-fixture.mjs"), source, {
    flag: "wx",
  });
  await writeFile(path.join(context, "Dockerfile"), fixtureDockerfile, {
    flag: "wx",
  });
  return context;
}

async function writeComposeFixture({ fixture, images, origin, project }) {
  const envFile = path.join(fixture, "compose.env");
  const override = path.join(fixture, "fixture.json");
  const health =
    "const r=await fetch('http://127.0.0.1:3000/health',{redirect:'error'});" +
    "if(!r.ok||(await r.json()).status!=='ok')process.exitCode=1";
  await writeFile(
    override,
    JSON.stringify({
      services: {
        "fixture-api": {
          image: images[0],
          environment: {
            NODE_ENV: "test",
            KERNEL_SYNTHETIC_ENV: "1",
            WEBSITE_FIXTURE_CONTAINER: "1",
            HOST: "0.0.0.0",
            PORT: "3000",
            WEBSITE_URL: origin,
          },
          healthcheck: {
            test: ["CMD", "node", "--input-type=module", "-e", health],
            interval: "2s",
            timeout: "5s",
            retries: 30,
          },
        },
        website: {
          image: images[1],
          depends_on: { "fixture-api": { condition: "service_healthy" } },
        },
        gateway: {
          image: images[2],
          volumes: [
            {
              type: "volume",
              source: "fixture-tls",
              target: "/etc/kernel/tls",
              read_only: true,
              volume: { nocopy: true },
            },
          ],
        },
        "fixture-certificate": {
          image: images[2],
          profiles: ["certificate"],
          user: "0:0",
          network_mode: "none",
          read_only: true,
          entrypoint: ["sh", "-eu", "-c"],
          command: [
            [
              "umask 077",
              "chown 0:101 /tls",
              "chmod 0750 /tls",
              "openssl req -x509 -newkey rsa:2048 -noenc -keyout /tls/privkey.pem -out /tls/fullchain.pem -days 1 -subj /CN=www.kernel.test -addext subjectAltName=DNS:www.kernel.test -addext basicConstraints=critical,CA:TRUE",
              "chown 0:101 /tls/privkey.pem /tls/fullchain.pem",
              "chmod 0640 /tls/privkey.pem",
              "chmod 0644 /tls/fullchain.pem",
              "cat /tls/fullchain.pem",
            ].join("\n"),
          ],
          volumes: [
            {
              type: "volume",
              source: "fixture-tls",
              target: "/tls",
              volume: { nocopy: true },
            },
          ],
        },
      },
      volumes: {
        "fixture-tls": { name: project + "_fixture-tls" },
      },
    }),
    { flag: "wx" },
  );
  return { envFile, override };
}

async function verifyCspMode(request, compose, values, envFile, origin, mode) {
  await writeFile(
    envFile,
    values
      .map((value) =>
        value.startsWith("WEBSITE_CSP_MODE=")
          ? "WEBSITE_CSP_MODE=" + mode
          : value,
      )
      .join("\n") + "\n",
  );
  await compose(["up", "-d", "--wait", "--wait-timeout", "120"]);
  const page = await request(origin + "/login");
  assert.equal(page.status, 200);
  const header =
    mode === "enforce"
      ? "content-security-policy"
      : "content-security-policy-report-only";
  assert.match(page.headers[header], /nonce-/);
  const oppositeHeader =
    mode === "enforce"
      ? "content-security-policy-report-only"
      : "content-security-policy";
  assert.equal(page.headers[oppositeHeader], undefined);
  assert.match(page.headers["x-robots-tag"], /noindex/);
  const assets = [
    ...page.text.matchAll(
      /(?:href|src)="([^" ]+(?:\.js|\.css|\.woff2)[^" ]*)"/g,
    ),
  ]
    .map((item) => item[1])
    .filter((value) => value.startsWith("/"));
  assert.ok(assets.length > 0);
  await completeArtifactWork(
    [...new Set(assets)].map(async (asset) => {
      const assetUrl = new URL(asset, origin);
      assert.equal(assetUrl.origin, origin);
      const response = await request(assetUrl);
      assert.equal(response.status, 200);
      if (assetUrl.pathname.endsWith(".css"))
        await completeArtifactWork(
          [...response.text.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)]
            .map((match) => match[1])
            .filter((value) => /\.woff2?(?:[?#]|$)/i.test(value))
            .map(async (font) => {
              const fontUrl = new URL(font, assetUrl);
              assert.equal(fontUrl.origin, origin);
              assert.equal((await request(fontUrl)).status, 200);
            }),
        );
    }),
  );
}

async function verifyDeployment(request, compose, values, envFile, origin) {
  // Both phases mutate the same Compose service: drain all checks before changing mode.
  await verifyCspMode(request, compose, values, envFile, origin, "report-only");
  await verifyCspMode(request, compose, values, envFile, origin, "enforce");
  const login = await request(`${origin}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: origin },
    body: JSON.stringify({
      identifier: "09123456789",
      password: "password123",
    }),
  });
  assert.equal(login.status, 200);
  assert.equal(JSON.parse(login.text).access_token, undefined);
  const cookies = login.headers["set-cookie"] ?? [];
  assert.ok(
    cookies.some(
      (cookie) => /;\s*secure(?:;|$)/i.test(cookie) && /httponly/i.test(cookie),
    ),
  );
  const account = await request(`${origin}/api/account/me`, {
    headers: {
      Cookie: cookies.map((cookie) => cookie.split(";", 1)[0]).join("; "),
    },
  });
  assert.equal(account.status, 200);
  assert.match(account.headers["cache-control"], /no-store/);
}

async function startDeployment(compose, project) {
  await compose(["config", "--quiet"]);
  await compose(["build"]);
  const encoded = await compose(
    [
      "run",
      "--rm",
      "-T",
      "--no-deps",
      "--name",
      `${project}-certificate`,
      "fixture-certificate",
    ],
    { capture: true },
  );
  const certificate = Buffer.from(encoded, "utf8");
  if (certificate.length === 0 || certificate.length > 64 * 1024)
    throw new Error(
      "The generated public TLS certificate must be nonempty and bounded.",
    );
  await compose(["up", "-d", "--wait", "--wait-timeout", "180"]);
  return certificate;
}

async function assertFixtureVolumesAvailable(docker, project) {
  await completeArtifactWork(
    ["fixture-tls"].map(async (name) => {
      const found = await docker(
        [
          "volume",
          "ls",
          "--quiet",
          "--filter",
          "name=^" + project + "_" + name + "$",
        ],
        { capture: true },
      );
      assert.equal(
        found.trim(),
        "",
        "A generated fixture volume already exists; refusing to reuse it.",
      );
    }),
  );
}

/** Verify disposable Docker resources without operator state or target traffic. */
export async function runDockerSmoke(root = repository, options = {}) {
  const directory = await readyRunnerRoot(root);
  const signal = options.signal;
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new TypeError("Docker smoke cancellation requires an AbortSignal.");
  signal?.throwIfAborted();
  const inherited = options.inherited ?? process.env;
  if (inherited?.KERNEL_SYNTHETIC_ENV !== "1")
    throw new Error("Docker smoke requires KERNEL_SYNTHETIC_ENV=1.");
  const selectedDocker =
    options.dockerCli ?? inherited.WEBSITE_DOCKER_CLI ?? systemDocker;
  if (
    typeof selectedDocker !== "string" ||
    !path.isAbsolute(selectedDocker) ||
    /^[\\/]{2}/.test(selectedDocker) ||
    /[\0\r\n]/.test(selectedDocker)
  )
    throw new Error("Docker CLI must be an explicit absolute local file path.");
  const dockerCli = await (options.dockerFile ?? artifactFile)(selectedDocker);
  const api = await (options.resolveApi ?? resolveApiFixture)(
    directory,
    inherited,
  );
  signal?.throwIfAborted();
  const parent = path.resolve(os.tmpdir());
  const fixture = await mkdtemp(path.join(parent, "kernel-website-docker-"));
  const project = `kernel-website-test-${randomBytes(6).toString("hex")}`;
  const builder = websiteSmokeBuilder(project);
  const release = `smoke-${randomBytes(6).toString("hex")}`;
  const images = ["api", "website", "gateway"].map(
    (name) => `${project}/${name}:${release}`,
  );
  let environment;
  let configurationRoot;
  let builderAttempted = false;
  let composeOwned = false;
  let compose;
  let failure;
  let result;
  let cleaning = false;
  const docker = async (args, operation = {}) => {
    if (!cleaning) signal?.throwIfAborted();
    return (options.docker ?? runDockerProcess)({
      command: dockerCli,
      args: ["--host", localHost, ...args],
      cwd: directory,
      env: operation.build
        ? { ...environment, BUILDX_BUILDER: builder }
        : environment,
      ...operation,
      signal: cleaning ? undefined : signal,
    });
  };
  try {
    configurationRoot = await mkdtemp(
      path.join(parent, "kernel-website-docker-config-"),
    );
    environment = {
      ...dockerEnvironment(fixture),
      DOCKER_CONFIG: path.join(configurationRoot, "docker-config"),
    };
    await mkdir(environment.DOCKER_CONFIG);
    const apiContext = await (options.prepareFixture ?? prepareFixtureContext)(
      directory,
      api,
      fixture,
    );
    const fixtureSha256 = createHash("sha256")
      .update(
        await readArtifactFile(
          path.join(apiContext, "website-api-fixture.mjs"),
        ),
      )
      .digest("hex");
    await docker(["version", "--format", "{{.Server.Version}}"], {
      capture: true,
    });
    await assertWebsiteBuilderAvailable(docker, project);
    await assertWebsiteResourcesAvailable(docker, project, images);
    await assertFixtureVolumesAvailable(docker, project);
    const [httpsPort, httpPort] = await Promise.all([
      (options.port ?? freePort)(),
      (options.port ?? freePort)(),
    ]);
    assert.notEqual(httpsPort, httpPort);
    const origin = `https://www.kernel.test:${httpsPort}`;
    const tls = path.join(fixture, "tls");
    await mkdir(tls);
    const { envFile, override } = await writeComposeFixture({
      fixture,
      images,
      origin,
      project,
    });
    const values = [
      `RELEASE_ID=${release}`,
      `IMAGE_PREFIX=${project}`,
      "WEBSITE_HOST=www.kernel.test",
      "API_BASE_URL=http://fixture-api:3000",
      `WEBSITE_URL=${origin}`,
      "WEBSITE_INDEXING_ENABLED=false",
      "WEBSITE_CSP_MODE=report-only",
      "BIND_ADDRESS=127.0.0.1",
      `HTTP_PORT=${httpPort}`,
      `HTTPS_PORT=${httpsPort}`,
      `TLS_CERT_DIRECTORY=${JSON.stringify(tls.replaceAll("\\", "/"))}`,
    ];
    await writeFile(envFile, values.join("\n") + "\n", { flag: "wx" });
    compose = (args, operation = {}) =>
      docker(
        [
          "compose",
          "--project-name",
          project,
          "--env-file",
          envFile,
          "-f",
          path.join(directory, "deploy/docker/compose.yaml"),
          "-f",
          override,
          ...args,
        ],
        { ...operation, build: args[0] === "build" },
      );
    builderAttempted = true;
    await docker([
      "buildx",
      "create",
      "--name",
      builder,
      "--driver",
      "docker-container",
      "--driver-opt",
      "default-load=true",
      localHost,
    ]);
    composeOwned = true;
    await docker([
      "buildx",
      "build",
      "--builder",
      builder,
      "--load",
      "--file",
      path.join(apiContext, "Dockerfile"),
      "--tag",
      images[0],
      apiContext,
    ]);
    const certificate = await startDeployment(compose, project);
    const trustedRequest =
      options.request ??
      (await createDockerFixtureRequest(directory, certificate));
    const request = (address, requestOptions = {}) =>
      trustedRequest(address, {
        ...requestOptions,
        signal,
      });
    const redirect = await request(`http://www.kernel.test:${httpPort}/login`);
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.location, `${origin}/login`);
    await verifyDeployment(request, compose, values, envFile, origin);
    const marker = await request(`${origin}/_kernel/release`);
    assert.equal(JSON.parse(marker.text).release, release);
    const reportDirectory = await ensureArtifactDirectory(
      path.join(directory, "test-results/deployment"),
    );
    const report = path.join(reportDirectory, `docker-${release}.json`);
    result = {
      project,
      builder,
      release,
      fixtureSource: "scripts/website-api-fixture.mjs",
      fixtureSha256,
      verified: [
        "TLS redirect",
        "generated certificate trust and hostname verification",
        "standalone public/static/fonts",
        "runtime report-only/enforce",
        "noindex",
        "website proxy session cookies against the owned HTTP fixture",
        "release marker",
      ],
    };
    await writeFile(report, JSON.stringify(result, null, 2) + "\n", {
      flag: "wx",
    });
    result = { ...result, report };
  } catch (error) {
    failure = error;
  } finally {
    cleaning = true;
    if (environment)
      environment = {
        ...environment,
        TEMP: configurationRoot,
        TMP: configurationRoot,
      };
    try {
      await (options.cleanup ?? cleanupWebsiteDocker)({
        project,
        images: builderAttempted ? images : [],
        builderAttempted,
        docker,
        compose: composeOwned ? compose : undefined,
        fixture,
        parent,
      });
    } catch (error) {
      failure = failure
        ? new AggregateError(
            [failure, error],
            "Website Docker smoke and owned cleanup failed.",
          )
        : error;
    }
    if (configurationRoot)
      try {
        await cleanupWebsiteDocker({
          project,
          images: [],
          builderAttempted: false,
          fixture: configurationRoot,
          parent,
        });
      } catch (error) {
        failure = failure
          ? new AggregateError(
              [failure, error],
              "Website Docker smoke and isolated configuration cleanup failed.",
            )
          : error;
      }
  }
  if (failure) throw failure;
  return result;
}

await runVerificationCli(import.meta.main, repository, async ({ signal }) => {
  if (process.argv.length !== 2)
    throw new Error("Docker smoke takes no arguments.");
  const result = await runDockerSmoke(repository, { signal });
  console.log(`Disposable Docker smoke passed: ${result.report}`);
});
