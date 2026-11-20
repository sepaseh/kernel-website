import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, cp, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { parseDocument } from "yaml";

import {
  commandEnvironment,
  markedCliFixture,
  publicValues,
  temporaryFixture,
} from "./deployment.test-support.mjs";
import { renderDeploymentTemplate } from "./render-deployment.mjs";

test("Docker and native templates retain explicit runtime, TLS and proxy boundaries", async () => {
  const composeDocument = parseDocument(
    await readFile(
      new URL("../deploy/docker/compose.yaml", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(composeDocument.errors, []);
  const compose = composeDocument.toJS();
  assert.deepEqual(
    Object.keys(compose.services).sort((left, right) =>
      left.localeCompare(right),
    ),
    ["gateway", "website"],
  );
  assert.equal(
    compose.services.website.environment.WEBSITE_INDEXING_ENABLED,
    "${WEBSITE_INDEXING_ENABLED:-false}",
  );
  assert.equal(
    compose.services.website.environment.WEBSITE_CSP_MODE,
    "${WEBSITE_CSP_MODE-report-only}",
  );
  assert.deepEqual(compose.services.website.healthcheck.test, [
    "CMD",
    "node",
    "scripts/healthcheck.mjs",
    "website",
    "http://127.0.0.1:3001/login",
  ]);
  assert.equal(compose.services.gateway.volumes[0].read_only, true);
  assert.equal(
    compose.services.gateway.volumes[0].bind.create_host_path,
    false,
  );
  assert.equal(compose.services.website.ports, undefined);
  for (const service of Object.values(compose.services))
    assert.deepEqual(service.logging, {
      driver: "json-file",
      options: { "max-size": "10m", "max-file": "3" },
    });
  const dockerfile = await readFile(
    new URL("../deploy/docker/Dockerfile", import.meta.url),
    "utf8",
  );
  const nodeVersion = (
    await readFile(new URL("../.nvmrc", import.meta.url), "utf8")
  ).trim();
  assert.deepEqual(
    dockerfile.split(/\r?\n/).filter((line) => line.startsWith("FROM node:")),
    [
      `FROM node:${nodeVersion}-bookworm-slim AS dependencies`,
      `FROM node:${nodeVersion}-bookworm-slim AS website`,
    ],
  );
  const phaseGuard = dockerfile.indexOf(
    "await requireApplicationReady(process.cwd())",
  );
  const markerCopy = dockerfile.indexOf("COPY .github/bootstrap-policy.json");
  assert.ok(markerCopy >= 0 && phaseGuard > markerCopy);
  assert.ok(phaseGuard < dockerfile.indexOf("RUN npm ci"));
  assert.ok(phaseGuard < dockerfile.indexOf("RUN npm run build"));
  assert.match(dockerfile, /USER node/);
  const unit = await readFile(
    new URL("../deploy/native/systemd/kernel-website.service", import.meta.url),
    "utf8",
  );
  const preflight = unit.indexOf(
    "ExecStartPre=/usr/bin/node /srv/kernel-website/current/scripts/validate-deployment-env.mjs website",
  );
  assert.ok(
    preflight >= 0 && preflight < unit.indexOf("ExecStart=/usr/bin/node"),
  );
  for (const setting of [
    "NoNewPrivileges=true",
    "ProtectSystem=strict",
    "PrivateTmp=true",
    "UMask=0077",
  ])
    assert.ok(unit.includes(setting));
  await Promise.all(
    [
      new URL(
        "../deploy/native/nginx/kernel-website.conf.template",
        import.meta.url,
      ),
      new URL("../deploy/docker/nginx.conf.template", import.meta.url),
    ].map(async (filename) => {
      const template = await readFile(filename, "utf8");
      const rendered = renderDeploymentTemplate(template, {
        ...publicValues,
        HTTPS_PORT: "9443",
      });
      assert.match(rendered, /proxy_set_header\s+Host\s+\$http_host;/);
      assert.match(
        rendered,
        /proxy_set_header\s+X-Forwarded-Host\s+\$http_host;/,
      );
      assert.match(rendered, /proxy_set_header\s+X-Forwarded-Port\s+9443;/);
      assert.doesNotMatch(
        rendered,
        /proxy_set_header\s+(?:Host|X-Forwarded-Host)\s+\$host;/,
      );
      assert.ok(
        rendered.includes("proxy_set_header X-Forwarded-For $remote_addr;"),
      );
      assert.ok(rendered.includes('proxy_set_header Forwarded "";'));
      assert.ok(rendered.includes("proxy_cache off;"));
      assert.ok(rendered.includes("ssl_protocols TLSv1.2 TLSv1.3;"));
      assert.equal(/\$\{[A-Z][A-Z0-9_]*\}/.test(rendered), false);
    }),
  );
});

test("the gateway runs without root with owned writable state and unprivileged internal listeners", async () => {
  const dockerfile = await readFile(
    new URL("../deploy/docker/Dockerfile", import.meta.url),
    "utf8",
  );
  const logical = dockerfile.replace(/\\\r?\n\s*/g, " ");
  const gateway = logical.split("FROM nginx:1.30.6-trixie AS gateway")[1];
  assert.ok(gateway);
  assert.match(gateway, /^USER nginx$/m);
  assert.match(gateway, /test "\$\(id -u nginx\)" = 101/);
  assert.match(gateway, /test "\$\(id -g nginx\)" = 101/);
  assert.match(
    gateway,
    /chown -R nginx:nginx \/var\/cache\/nginx \/etc\/nginx\/conf\.d/,
  );
  assert.match(gateway, /pid \/var\/cache\/nginx\/nginx\.pid/);
  assert.match(gateway, /\/\^user\[\[:space:\]\]\//);
  assert.match(gateway, /^EXPOSE 8080 8443$/m);
  assert.match(logical, /^RUN npm ci --ignore-scripts$/m);
  assert.doesNotMatch(logical, /^RUN npm ci\s*$/m);

  const template = await readFile(
    new URL("../deploy/docker/nginx.conf.template", import.meta.url),
    "utf8",
  );
  const listens = [...template.matchAll(/listen\s+(?:\[::\]:)?(\d+)/g)].map(
    (match) => Number(match[1]),
  );
  assert.deepEqual(
    [...new Set(listens)].sort((left, right) => left - right),
    [8080, 8443],
  );
  for (const owner of ["client_body", "proxy", "fastcgi", "uwsgi", "scgi"])
    assert.ok(template.includes(`${owner}_temp_path /var/cache/nginx/`));
  const compose = parseDocument(
    await readFile(
      new URL("../deploy/docker/compose.yaml", import.meta.url),
      "utf8",
    ),
  ).toJS();
  assert.deepEqual(compose.services.gateway.ports, [
    "${BIND_ADDRESS:-0.0.0.0}:${HTTP_PORT:-80}:8080",
    "${BIND_ADDRESS:-0.0.0.0}:${HTTPS_PORT:-443}:8443",
  ]);
  const [probeMode, probe] = compose.services.gateway.healthcheck.test;
  assert.equal(probeMode, "CMD-SHELL");
  assert.match(probe, /curl --fail --silent --show-error --max-time 4/);
  assert.match(probe, /--noproxy '\*'/);
  assert.match(probe, /--resolve "\$\$\{WEBSITE_HOST\}:8443:127\.0\.0\.1"/);
  assert.match(probe, /--cacert \/etc\/kernel\/tls\/fullchain\.pem/);
  assert.match(probe, /https:\/\/\$\$\{WEBSITE_HOST\}:8443\/_kernel\/release/);
  assert.match(probe, /RELEASE_ID/);
  assert.doesNotMatch(probe, /--insecure|--location/);
  assert.equal(compose.services.gateway.volumes[0].read_only, true);
  const rendered = renderDeploymentTemplate(template, {
    ...publicValues,
    HTTPS_PORT: "9443",
  });
  assert.ok(rendered.includes("return 308 https://$host:9443$request_uri;"));
  assert.ok(rendered.includes("proxy_set_header X-Forwarded-Port 9443;"));
});

test("the Docker build guard executes only the public readiness policy before install/build", async (context) => {
  const directory = await temporaryFixture(context);
  await markedCliFixture(directory, false);
  const dockerfile = await readFile(
    new URL("../deploy/docker/Dockerfile", import.meta.url),
    "utf8",
  );
  const prefix = "RUN node --input-type=module -e ";
  const guardLine = dockerfile
    .replace(/\\\r?\n\s*/g, " ")
    .split("\n")
    .find((line) => line.startsWith(prefix));
  assert.ok(guardLine);
  const guard = JSON.parse(guardLine.slice(prefix.length));
  const run = () =>
    spawnSync(process.execPath, ["--input-type=module", "-e", guard], {
      cwd: directory,
      env: commandEnvironment(),
      encoding: "utf8",
      windowsHide: true,
    });
  const refused = run();
  assert.equal(refused.error, undefined);
  assert.equal(refused.status, 1);
  assert.match(
    refused.stderr,
    /applicationReady|non-runnable|runnable application/i,
  );
  await writeFile(
    path.join(directory, ".github/bootstrap-policy.json"),
    JSON.stringify({ schemaVersion: 1, applicationReady: true }),
  );
  assert.equal(run().status, 0);
});

test("Docker context admits complete public proof inputs and excludes private siblings", async () => {
  const { allowedFiles } = JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  const lines = (
    await readFile(new URL("../.dockerignore", import.meta.url), "utf8")
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const escape = (value) => value.replaceAll("[", "[[]");
  const parents = [
    ...new Set(
      allowedFiles.flatMap((filename) =>
        filename
          .split("/")
          .slice(0, -1)
          .map((_, index, parts) => parts.slice(0, index + 1).join("/")),
      ),
    ),
  ].sort(
    (left, right) =>
      left.split("/").length - right.split("/").length ||
      (left < right ? -1 : Number(left > right)),
  );
  const terminalRoots = [
    ".git",
    "node_modules",
    ".next",
    "coverage",
    "dist",
    "test-results",
    "playwright-report",
    ".lighthouseci",
  ];
  const terminalDenies = terminalRoots.flatMap((directory) => [
    directory,
    `${directory}/**`,
  ]);
  assert.deepEqual(lines, [
    "**",
    ...parents.flatMap((parent) => [
      `!${escape(parent)}`,
      `${escape(parent)}/**`,
    ]),
    ...allowedFiles.toSorted().map((filename) => `!${escape(filename)}`),
    ...terminalDenies,
    ".agents/settings.local.json",
  ]);
  // This deliberately restricted policy has only literal paths and descendant denies.
  // Check inherited parent matches as well as direct file exceptions.
  const excluded = (filename) => {
    let result = false;
    for (const line of lines) {
      const include = line.startsWith("!");
      const pattern = (include ? line.slice(1) : line).replaceAll("[[]", "[");
      const match =
        pattern === "**" ||
        (pattern.endsWith("/**")
          ? filename.startsWith(pattern.slice(0, -2))
          : filename === pattern || filename.startsWith(pattern + "/"));
      if (match) result = !include;
    }
    return result;
  };
  for (const filename of allowedFiles)
    assert.equal(excluded(filename), false, filename);
  for (const filename of [
    ".env",
    ".env.production",
    ".agents/settings.local.json",
    ".agents/private/credentials.json",
    ".github/credentials.txt",
    "docs/private-notes.md",
    "node_modules/next/package.json",
    "coverage/private.json",
    "coverage/pr2-ci-linux/python-hashed/lib64/never-open",
    "src/private.key",
    "src/app/[postId]/private.txt",
    "src/app/p/page.tsx",
    "deploy/docker/Dockerfile.dockerignore",
  ])
    assert.equal(excluded(filename), true, filename);
  await assert.rejects(
    stat(new URL("../deploy/docker/Dockerfile.dockerignore", import.meta.url)),
    { code: "ENOENT" },
  );
});

test("Docker build copies the complete filtered source and uses explicit synthetic build inputs", async (context) => {
  const directory = await temporaryFixture(context);
  await markedCliFixture(directory, false);
  const dockerfile = await readFile(
    new URL("../deploy/docker/Dockerfile", import.meta.url),
    "utf8",
  );
  const buildStage = dockerfile
    .split("FROM dependencies AS build")[1]
    .split(/^FROM /m)[0];
  assert.match(buildStage, /^COPY \. \.$/m);
  for (const value of [
    "API_BASE_URL=http://127.0.0.1:3100",
    "HOSTNAME=127.0.0.1",
    "PORT=3010",
    "WEBSITE_URL=http://127.0.0.1:3010",
    "WEBSITE_INDEXING_ENABLED=false",
    "KERNEL_SYNTHETIC_ENV=1",
  ])
    assert.ok(buildStage.includes(value));
  assert.ok(
    buildStage.indexOf("COPY . .") < buildStage.indexOf("RUN npm run build"),
  );
  await cp(new URL("./", import.meta.url), path.join(directory, "scripts"), {
    recursive: true,
    force: true,
  });
  const imported = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "await import(process.argv[1]);",
      pathToFileURL(path.join(directory, "scripts/application-checks.mjs"))
        .href,
    ],
    {
      cwd: directory,
      env: commandEnvironment(),
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(imported.error, undefined);
  assert.equal(imported.status, 0, imported.stderr);
});

test("gateway health checks verify the release body and propagate transport failures", async (context) => {
  const directory = await temporaryFixture(context);
  const curl = path.join(directory, "owned-curl");
  const argumentsFile = path.join(directory, "arguments.txt");
  await writeFile(
    curl,
    `#!/bin/sh
printf '%s\\n' "$@" > "$PROBE_ARGUMENTS"
printf '%s' "$PROBE_BODY"
exit "$PROBE_STATUS"
`,
  );
  await chmod(curl, 0o700);
  const compose = parseDocument(
    await readFile(
      new URL("../deploy/docker/compose.yaml", import.meta.url),
      "utf8",
    ),
  ).toJS();
  const [, configured] = compose.services.gateway.healthcheck.test;
  const command = configured
    .replace(
      "curl ",
      "'" + curl.replaceAll("\\", "/").replaceAll("'", "'\\''") + "' ",
    )
    .replaceAll("$$", "$");
  const bash =
    process.platform === "win32"
      ? "C:/Program Files/Git/bin/bash.exe"
      : "/bin/bash";
  for (const [body, status, expected] of [
    ['{"release":"owned-release"}', "0", 0],
    ['{"release":"stale-release"}', "0", 1],
    ['{"release":"owned-release"}', "22", 22],
    ["", "7", 7],
  ]) {
    const result = spawnSync(bash, ["--noprofile", "--norc", "-c", command], {
      cwd: directory,
      env: {
        ...commandEnvironment(),
        WEBSITE_HOST: "www.kernel.test",
        RELEASE_ID: "owned-release",
        PROBE_ARGUMENTS: argumentsFile.replaceAll("\\", "/"),
        PROBE_BODY: body,
        PROBE_STATUS: status,
      },
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, expected, result.stderr);
  }
  const args = (await readFile(argumentsFile, "utf8")).trim().split(/\r?\n/);
  assert.ok(args.includes("www.kernel.test:8443:127.0.0.1"));
  assert.ok(args.includes("/etc/kernel/tls/fullchain.pem"));
  assert.equal(args.at(-1), "https://www.kernel.test:8443/_kernel/release");
});
