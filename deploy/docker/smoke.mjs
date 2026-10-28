// Owned synthetic Docker smoke; importing this module performs no operations.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
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
} from "../../scripts/docker-smoke-cleanup.mjs";
import {
  artifactFile,
  completeArtifactWork,
  ensureArtifactDirectory,
} from "../../scripts/release-files.mjs";
import {
  readyRunnerRoot,
  resolveApiFixture,
} from "../../scripts/runner-inputs.mjs";
import {
  runVerificationCli,
  startOwnedProcess,
} from "../../scripts/runner-process.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const outputLimit = 1024 * 1024;
const localHost =
  process.platform === "win32"
    ? "npipe:////./pipe/dockerDesktopLinuxEngine"
    : "unix:///var/run/docker.sock";
const systemGit =
  process.platform === "win32"
    ? String.raw`C:\Program Files\Git\cmd\git.exe`
    : "/usr/bin/git";
const systemTar =
  process.platform === "win32"
    ? String.raw`C:\Windows\System32\tar.exe`
    : "/usr/bin/tar";
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
  return new Promise((resolve, reject) => {
    const outgoing = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method,
        headers,
        agent: false,
        ...(url.protocol === "https:"
          ? { ca: certificate, rejectUnauthorized: true }
          : {}),
        signal,
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

const apiDockerfile = [
  "FROM node:24.18.0-bookworm-slim AS synthetic-api",
  "WORKDIR /app",
  "COPY package.json package-lock.json ./",
  "ENV NODE_ENV=production",
  "RUN npm ci --omit=dev --ignore-scripts",
  "COPY src ./src",
  "COPY drizzle ./drizzle",
  "RUN mkdir -p /var/lib/kernel-api && chown node:node /var/lib/kernel-api",
  "USER node",
  'CMD ["node", "src/index.ts"]',
  "",
].join("\n");

async function exportApiContext(api, fixture, environment, signal) {
  const context = path.join(fixture, "api");
  await mkdir(context);
  const archive = path.join(fixture, "api-source.tar");
  // Only immutable tracked input enters the build context, never ignored state.
  await runDockerProcess({
    command: await artifactFile(systemGit),
    args: [
      "--no-optional-locks",
      "--no-replace-objects",
      "-C",
      api.directory,
      "-c",
      "core.fsmonitor=false",
      "archive",
      "--format=tar",
      `--output=${archive}`,
      api.revision,
      "--",
      "package.json",
      "package-lock.json",
      "src",
      "drizzle",
    ],
    cwd: fixture,
    env: environment,
    signal,
  });
  await runDockerProcess({
    command: await artifactFile(systemTar),
    args: ["-xf", archive, "-C", context],
    cwd: fixture,
    env: environment,
    signal,
  });
  await writeFile(path.join(context, "Dockerfile"), apiDockerfile, {
    flag: "wx",
  });
  return context;
}

async function writeComposeFixture({
  fixture,
  images,
  origin,
  httpsPort,
  project,
}) {
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
            HOST: "0.0.0.0",
            PORT: "3000",
            BETTER_AUTH_URL: `https://api.kernel.test:${httpsPort}`,
            BETTER_AUTH_SECRET: randomBytes(48).toString("base64url"),
            SERVER_ALLOWED_ORIGINS: origin,
            SERVER_SEED_DEVELOPMENT_DATA: "true",
            OTP_FIXED_CODE: "123456",
            DATABASE_URL: "file:/var/lib/kernel-api/test.sqlite",
            LOCAL_STORAGE_PATH: "/var/lib/kernel-api/uploads",
            STORAGE_DRIVER: "local",
            LOG_LEVEL: "error",
          },
          volumes: ["fixture-data:/var/lib/kernel-api"],
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
        "fixture-data": { name: project + "_fixture-data" },
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
    [...new Set(assets)].map(async (asset) =>
      assert.equal((await request(new URL(asset, origin))).status, 200),
    ),
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

async function startDeployment(compose) {
  await compose(["config", "--quiet"]);
  await compose(["build"]);
  const encoded = await compose(
    ["run", "--rm", "-T", "--no-deps", "fixture-certificate"],
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
    ["fixture-data", "fixture-tls"].map(async (name) => {
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
  const api = await (options.resolveApi ?? resolveApiFixture)(
    directory,
    options.inherited ?? process.env,
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
  const environment = dockerEnvironment(fixture);
  let builderAttempted = false;
  let composeOwned = false;
  let compose;
  let failure;
  let result;
  let cleaning = false;
  const docker = async (args, operation = {}) => {
    if (!cleaning) signal?.throwIfAborted();
    return (options.docker ?? runDockerProcess)({
      command: await (options.dockerFile ?? artifactFile)(systemDocker),
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
    await mkdir(environment.DOCKER_CONFIG);
    const apiContext = await (options.exportApi ?? exportApiContext)(
      api,
      fixture,
      environment,
      signal,
    );
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
      httpsPort,
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
    const certificate = await startDeployment(compose);
    const trustedRequest =
      options.request ??
      (await createDockerFixtureRequest(directory, certificate));
    const request = (address, requestOptions = {}) =>
      trustedRequest(address, {
        ...requestOptions,
        signal,
      });
    assert.equal(
      (await request(`http://www.kernel.test:${httpPort}/login`)).status,
      308,
    );
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
      apiRevision: api.revision,
      verified: [
        "TLS redirect",
        "generated certificate trust and hostname verification",
        "standalone public/static/fonts",
        "runtime report-only/enforce",
        "noindex",
        "real API session cookies",
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
