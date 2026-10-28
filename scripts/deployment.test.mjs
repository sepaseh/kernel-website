import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

import { parseDocument } from "yaml";

import { checkHealth } from "./healthcheck.mjs";
import { renderDeploymentTemplate } from "./render-deployment.mjs";
import {
  validateDeploymentEnv,
  validateOrigin,
} from "./validate-deployment-env.mjs";

const commandEnvironment = () =>
  Object.fromEntries(
    ["SystemRoot", "WINDIR", "PATH", "Path"].flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]]],
    ),
  );

async function markedCliFixture(directory, ready = true) {
  await mkdir(path.join(directory, "scripts"));
  await mkdir(path.join(directory, ".github"));
  await writeFile(
    path.join(directory, ".github/bootstrap-policy.json"),
    JSON.stringify({ schemaVersion: 1, applicationReady: ready }),
  );
  await Promise.all(
    [
      "render-deployment.mjs",
      "validate-deployment-env.mjs",
      "healthcheck.mjs",
      "release-files.mjs",
    ].map((name) =>
      copyFile(
        new URL(`./${name}`, import.meta.url),
        path.join(directory, "scripts", name),
      ),
    ),
  );
}

async function temporaryFixture(context) {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await realpath(
    await mkdtemp(path.join(temporaryRoot, "kernel-render-fixture-")),
  );
  context.after(async () => {
    assert.equal(path.dirname(directory), temporaryRoot);
    assert.ok(path.basename(directory).startsWith("kernel-render-fixture-"));
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  });
  return directory;
}

test("website SEO stays backward-compatible and accepts explicit canonical origins", () => {
  const base = { NODE_ENV: "production", API_BASE_URL: "http://api:3000" };
  for (const values of [
    {},
    { WEBSITE_URL: "" },
    { WEBSITE_INDEXING_ENABLED: "false" },
    { WEBSITE_URL: "https://WWW.Kernel.test:443/" },
    {
      WEBSITE_URL: "https://127.kernel.test",
      WEBSITE_INDEXING_ENABLED: "true",
    },
    { WEBSITE_URL: "http://localhost:3001", WEBSITE_INDEXING_ENABLED: "false" },
    { WEBSITE_URL: "http://preview.localhost:3001/" },
    { WEBSITE_URL: "http://127.12.34.56:3001" },
    { WEBSITE_URL: "http://127.1:3001" },
    { WEBSITE_URL: "http://[::1]:3001" },
    { WEBSITE_URL: "http://[::ffff:127.0.0.1]:3001" },
    {
      WEBSITE_URL: "https://www.kernel.test",
      WEBSITE_INDEXING_ENABLED: "true",
    },
  ])
    assert.doesNotThrow(() =>
      validateDeploymentEnv("website", { ...base, ...values }),
    );
});

test("website CSP defaults to report-only, accepts enforcement and rejects invalid rollout modes", () => {
  const base = { NODE_ENV: "production", API_BASE_URL: "http://api:3000" };
  for (const WEBSITE_CSP_MODE of [undefined, "report-only", "enforce"])
    assert.doesNotThrow(() =>
      validateDeploymentEnv("website", { ...base, WEBSITE_CSP_MODE }),
    );
  for (const WEBSITE_CSP_MODE of [
    "",
    "off",
    "ENFORCE",
    "enforced",
    " report-only ",
  ])
    assert.throws(
      () => validateDeploymentEnv("website", { ...base, WEBSITE_CSP_MODE }),
      /WEBSITE_CSP_MODE/,
    );
});

test("website SEO rejects accidental indexing and malformed canonical origins", () => {
  const base = { NODE_ENV: "production", API_BASE_URL: "http://api:3000" };
  for (const values of [
    { WEBSITE_INDEXING_ENABLED: "true" },
    { WEBSITE_URL: "", WEBSITE_INDEXING_ENABLED: "true" },
    { WEBSITE_INDEXING_ENABLED: "" },
    { WEBSITE_INDEXING_ENABLED: "TRUE" },
    { WEBSITE_INDEXING_ENABLED: "1" },
    { WEBSITE_INDEXING_ENABLED: " true " },
    { WEBSITE_URL: "http://www.kernel.test" },
    { WEBSITE_URL: "https://www.kernel.test/page" },
    { WEBSITE_URL: "https://www.kernel.test/?" },
    { WEBSITE_URL: "https://www.kernel.test/#" },
    { WEBSITE_URL: "https://www.kernel.test?q=1" },
    { WEBSITE_URL: "https://user:password@www.kernel.test" },
    { WEBSITE_URL: "https://www.kernel.test\\other" },
    { WEBSITE_URL: " https://www.kernel.test" },
    { WEBSITE_URL: "https://www.kernel.test\n" },
    { WEBSITE_URL: "https://www.kernel.test\u0000" },
    { WEBSITE_URL: "https://www.kernel.test\u007f" },
    { WEBSITE_URL: "https://www.kernel.test\uFEFF" },
    { WEBSITE_URL: "http://127.kernel.test" },
    { WEBSITE_URL: "file:///tmp/site" },
    ...[
      "localhost",
      "preview.localhost.",
      "127.12.34.56",
      "127.1",
      "[::1]",
      "[::ffff:127.0.0.1]",
    ].flatMap((hostname) =>
      ["http", "https"].map((scheme) => ({
        WEBSITE_URL: `${scheme}://${hostname}:3001`,
        WEBSITE_INDEXING_ENABLED: "true",
      })),
    ),
  ])
    assert.throws(() =>
      validateDeploymentEnv("website", { ...base, ...values }),
    );
  assert.throws(() =>
    validateDeploymentEnv("website", {
      ...base,
      NODE_ENV: "development",
      WEBSITE_URL: "https://www.kernel.test",
      WEBSITE_INDEXING_ENABLED: "true",
    }),
  );
});

test("public origins cannot inject nginx fields, credentials or non-origin URL parts", () => {
  for (const invalid of [
    "https://user:private@kernel.test",
    "https://kernel.test/extra",
    "https://kernel.test?q=1",
    "https://kernel.test#hash",
    "https://kernel.test/",
    "https://kernel.test\n;return 200;",
    "file:///tmp/file",
  ]) {
    assert.throws(() => validateOrigin(invalid));
  }
});

const publicValues = {
  WEBSITE_HOST: "kernel.test",
  TLS_CERTIFICATE: "/etc/kernel/tls/fullchain.pem",
  TLS_CERTIFICATE_KEY: "/etc/kernel/tls/privkey.pem",
  RELEASE_ID: "qa-0123456789",
};

test("configuration rendering preserves nginx variables and only exposes approved fields", () => {
  assert.equal(
    renderDeploymentTemplate(
      "server_name ${WEBSITE_HOST}; proxy_set_header Host $host; try_files $uri $uri/ /index.html;",
      publicValues,
    ),
    "server_name kernel.test; proxy_set_header Host $host; try_files $uri $uri/ /index.html;",
  );
  for (const [name, value] of [
    ["WEBSITE_HOST", "kernel.test; return 200;"],
    ["WEBSITE_HOST", "kernel.test\n"],
    ["WEBSITE_HOST", "https://kernel.test"],
    ["WEBSITE_HOST", "bad..kernel.test"],
    ["WEBSITE_HOST", "-bad.kernel.test"],
    ["WEBSITE_HOST", `${"a".repeat(64)}.kernel.test`],
    ["TLS_CERTIFICATE", "/etc/kernel/../private.key"],
    ["RELEASE_ID", "../release"],
    ["HTTPS_PORT", "0"],
    ["HTTPS_PORT", "65536"],
  ]) {
    assert.throws(() =>
      renderDeploymentTemplate(`\${${name}}`, {
        ...publicValues,
        [name]: value,
      }),
    );
  }
  assert.throws(() =>
    renderDeploymentTemplate("${BETTER_AUTH_SECRET}", {
      BETTER_AUTH_SECRET: "synthetic-only-not-used-by-website",
    }),
  );
  assert.throws(() => renderDeploymentTemplate("${WEBSITE_HOST}", {}));
  for (const field of [
    "ADMIN_HOST",
    "API_HOST",
    "PUBLIC_ASSET_ORIGIN",
    "BETTER_AUTH_SECRET",
  ])
    assert.throws(
      () =>
        renderDeploymentTemplate(`\${${field}}`, { [field]: "synthetic-only" }),
      /Unknown public template field/,
    );
});

test("native nginx templates render with the documented public field contract", async () => {
  await Promise.all(
    ["kernel.conf.template", "bootstrap.conf.template"].map(async (name) => {
      const file = new URL(`../deploy/native/nginx/${name}`, import.meta.url);
      const rendered = renderDeploymentTemplate(
        await readFile(file, "utf8"),
        publicValues,
      );
      assert.ok(rendered.includes("kernel.test"));
      assert.equal(/\$\{[A-Z][A-Z0-9_]*\}/.test(rendered), false);
      assert.ok(
        rendered.includes("$request_uri") || name === "bootstrap.conf.template",
      );
    }),
  );
});

test("renderer CLI refuses overwrites unless explicitly requested", async () => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await realpath(
    await mkdtemp(path.join(temporaryRoot, "kernel-render-fixture-")),
  );
  try {
    await markedCliFixture(directory);
    const template = path.join(directory, "nginx.template");
    const env = path.join(directory, "public.env");
    const output = path.join(directory, "nginx.conf");
    await writeFile(template, "server_name ${WEBSITE_HOST};");
    await writeFile(env, "WEBSITE_HOST=kernel.test\n");
    const command = path.join(directory, "scripts/render-deployment.mjs");
    const args = [
      command,
      "--template",
      template,
      "--public-values-file",
      env,
      "--output",
      output,
    ];
    const environment = commandEnvironment();
    const run = (arguments_ = args) =>
      spawnSync(process.execPath, arguments_, {
        env: environment,
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
      });
    assert.equal(run().status, 0);
    await writeFile(output, "keep this output");
    assert.equal(run().status, 1);
    assert.equal(await readFile(output, "utf8"), "keep this output");
    assert.equal(run([...args, "--force"]).status, 0);
    assert.equal(await readFile(output, "utf8"), "server_name kernel.test;");
  } finally {
    assert.equal(path.dirname(directory), temporaryRoot);
    assert.ok(path.basename(directory).startsWith("kernel-render-fixture-"));
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
});

test("renderer CLI refuses paths outside its owned repository before reading or overwriting", async (context) => {
  const directory = await temporaryFixture(context);
  const root = path.join(directory, "website");
  await mkdir(root);
  await markedCliFixture(root);
  const template = path.join(root, "nginx.template");
  const environment = path.join(root, "public.env");
  const output = path.join(root, "nginx.conf");
  const outside = path.join(directory, "outside.conf");
  await writeFile(template, "server_name ${WEBSITE_HOST};");
  await writeFile(environment, "WEBSITE_HOST=kernel.test\n");
  await writeFile(outside, "preserve owned outside sentinel");
  const command = path.join(root, "scripts/render-deployment.mjs");
  const driveRelative =
    process.platform === "win32"
      ? `${path.parse(root).root.slice(0, 2)}drive-relative.conf`
      : "C:drive-relative.conf";
  const run = (templatePath, environmentPath, outputPath) =>
    spawnSync(
      process.execPath,
      [
        command,
        "--template",
        templatePath,
        "--public-values-file",
        environmentPath,
        "--output",
        outputPath,
        "--force",
      ],
      {
        cwd: root,
        env: commandEnvironment(),
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
      },
    );
  for (const args of [
    [template, environment, outside],
    [template, environment, "../outside.conf"],
    [template, environment, "generated/../nginx.conf"],
    [template, environment, "generated/%2e%2e/nginx.conf"],
    [template, environment, "generated/%252e%252e/nginx.conf"],
    [template, environment, "generated/nginx.conf:stream"],
    [template, environment, "generated/line\nbreak.conf"],
    [template, environment, driveRelative],
    [template, environment, root],
    [template, environment, path.join(directory, "website-sibling/out.conf")],
    [outside, environment, output],
    [template, outside, output],
    [path.join(directory, "missing-template"), environment, output],
    [template, path.join(directory, "missing-public-values"), output],
    ["inputs/%2e%2e/nginx.template", environment, output],
    [template, "inputs/%2fpublic.env", output],
  ]) {
    const result = run(...args);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /owned repository/);
    assert.doesNotMatch(result.stderr, /ENOENT/);
    assert.equal(
      await readFile(outside, "utf8"),
      "preserve owned outside sentinel",
    );
  }
  await assert.rejects(readFile(output), { code: "ENOENT" });
});

test("renderer resolves relative and absolute repository paths and creates nested output", async (context) => {
  const directory = await temporaryFixture(context);
  const root = path.join(directory, "website");
  await mkdir(root);
  await markedCliFixture(root);
  await mkdir(path.join(root, "inputs"));
  await writeFile(
    path.join(root, "inputs/nginx.template"),
    "server_name ${WEBSITE_HOST};",
  );
  await writeFile(
    path.join(root, "inputs/public.env"),
    "WEBSITE_HOST=kernel.test\n",
  );
  const absolutePaths = [
    path.join(root, "inputs/nginx.template"),
    path.join(root, "inputs/public.env"),
    path.join(root, "generated/absolute/nginx.conf"),
  ].map((filename) =>
    process.platform === "win32" ? filename.toUpperCase() : filename,
  );
  for (const [templatePath, environmentPath, outputPath] of [
    [
      "inputs/nginx.template",
      "./inputs/public.env",
      "generated/nested/nginx.conf",
    ],
    absolutePaths,
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, "scripts/render-deployment.mjs"),
        "--template",
        templatePath,
        "--public-values-file",
        environmentPath,
        "--output",
        outputPath,
      ],
      {
        cwd: directory,
        env: commandEnvironment(),
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
  }
  for (const name of ["nested", "absolute"])
    assert.equal(
      await readFile(path.join(root, "generated", name, "nginx.conf"), "utf8"),
      "server_name kernel.test;",
    );
  await assert.rejects(
    readFile(path.join(directory, "generated/nested/nginx.conf")),
    {
      code: "ENOENT",
    },
  );
});

test("renderer refuses linked inputs and outputs without changing owned targets", async (context) => {
  const directory = await temporaryFixture(context);
  await markedCliFixture(directory);
  const template = path.join(directory, "nginx.template");
  const environment = path.join(directory, "public.env");
  const output = path.join(directory, "nginx.conf");
  await writeFile(template, "server_name ${WEBSITE_HOST};");
  await writeFile(environment, "WEBSITE_HOST=kernel.test\n");
  const command = path.join(directory, "scripts/render-deployment.mjs");
  const run = (templatePath, environmentPath, outputPath) =>
    spawnSync(
      process.execPath,
      [
        command,
        "--template",
        templatePath,
        "--public-values-file",
        environmentPath,
        "--output",
        outputPath,
        "--force",
      ],
      {
        env: commandEnvironment(),
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
      },
    );
  const actual = path.join(directory, "actual");
  await mkdir(actual);
  const actualTemplate = path.join(actual, "nginx.template");
  const actualEnvironment = path.join(actual, "public.env");
  const actualOutput = path.join(actual, "nginx.conf");
  await writeFile(actualTemplate, "server_name ${WEBSITE_HOST};");
  await writeFile(actualEnvironment, "WEBSITE_HOST=kernel.test\n");
  await writeFile(actualOutput, "preserve output");
  const alias = path.join(directory, "alias");
  await symlink(actual, alias, "junction");
  for (const args of [
    [path.join(alias, "nginx.template"), environment, output],
    [template, path.join(alias, "public.env"), output],
    [template, environment, path.join(alias, "nginx.conf")],
  ]) {
    const result = run(...args);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
  }
  assert.equal(await readFile(actualOutput, "utf8"), "preserve output");
  await assert.rejects(readFile(output), { code: "ENOENT" });
});

test("false-phase delivery CLIs fail before inputs, output creation or health probes", async (context) => {
  const directory = await temporaryFixture(context);
  await markedCliFixture(directory, false);
  const output = path.join(directory, "not-created/nginx.conf");
  const server = http.createServer((_request, response) => {
    response.setHeader("content-type", "text/html");
    response.end("<html>Owned fixture</html>");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    for (const args of [
      [
        "render-deployment.mjs",
        "--template",
        path.join(directory, "missing-template"),
        "--public-values-file",
        path.join(directory, "missing-public-env"),
        "--output",
        output,
      ],
      ["validate-deployment-env.mjs", "website"],
      [
        "healthcheck.mjs",
        "website",
        `http://127.0.0.1:${server.address().port}/owned-fixture`,
      ],
    ]) {
      const result = spawnSync(
        process.execPath,
        [path.join(directory, "scripts", args[0]), ...args.slice(1)],
        {
          env: commandEnvironment(),
          encoding: "utf8",
          timeout: 10_000,
          windowsHide: true,
        },
      );
      assert.equal(result.error, undefined);
      assert.equal(result.status, 1, result.stderr);
      assert.match(
        result.stderr,
        /applicationReady|non-runnable|runnable application/i,
      );
      assert.doesNotMatch(
        result.stderr,
        /ENOENT|fetch failed|API_BASE_URL is required/,
      );
    }
    await assert.rejects(readFile(output), { code: "ENOENT" });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("public examples satisfy website-only validation without using operator environment", async () => {
  await Promise.all(
    [
      new URL("../.env.example", import.meta.url),
      new URL("../deploy/docker/.env.example", import.meta.url),
      new URL("../deploy/native/website.env.example", import.meta.url),
    ].map(async (filename) => {
      const values = parseEnv(await readFile(filename, "utf8"));
      validateDeploymentEnv("website", { NODE_ENV: "production", ...values });
    }),
  );
  const hosts = parseEnv(
    await readFile(
      new URL("../deploy/native/hosts.env.example", import.meta.url),
      "utf8",
    ),
  );
  const template = await readFile(
    new URL("../deploy/native/nginx/kernel.conf.template", import.meta.url),
    "utf8",
  );
  assert.ok(
    renderDeploymentTemplate(template, hosts).includes("www.example.com"),
  );
});

test("future Docker and native templates retain explicit runtime, TLS and proxy boundaries", async () => {
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
  const dockerfile = await readFile(
    new URL("../deploy/docker/Dockerfile", import.meta.url),
    "utf8",
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
      new URL("../deploy/native/nginx/kernel.conf.template", import.meta.url),
      new URL("../deploy/docker/nginx.conf.template", import.meta.url),
    ].map(async (filename) => {
      const template = await readFile(filename, "utf8");
      const rendered = renderDeploymentTemplate(template, {
        ...publicValues,
        HTTPS_PORT: "9443",
      });
      assert.match(rendered, /proxy_set_header\s+Host\s+\$host;/);
      assert.match(rendered, /proxy_set_header\s+X-Forwarded-Host\s+\$host;/);
      assert.match(rendered, /proxy_set_header\s+X-Forwarded-Port\s+9443;/);
      assert.doesNotMatch(rendered, /\$http_host\b/);
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
  assert.deepEqual(compose.services.gateway.healthcheck.test, [
    "CMD",
    "nginx",
    "-t",
  ]);
  assert.equal(compose.services.gateway.volumes[0].read_only, true);
  const rendered = renderDeploymentTemplate(template, {
    ...publicValues,
    HTTPS_PORT: "9443",
  });
  assert.ok(rendered.includes("return 308 https://$host:9443$request_uri;"));
  assert.ok(rendered.includes("proxy_set_header X-Forwarded-Port 9443;"));

  const validator = await readFile(
    new URL("../deploy/docker/15-validate-configuration.sh", import.meta.url),
    "utf8",
  );
  assert.match(validator, /400\|440\|600\|640\)/);
  assert.match(
    validator,
    /key_mode=\$\(stat -c '%a' \/etc\/kernel\/tls\/privkey\.pem\)/,
  );
  assert.ok(
    validator.indexOf("[ -r /etc/kernel/tls/privkey.pem ]") <
      validator.indexOf("key_mode="),
  );
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
      timeout: 10_000,
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

test("Docker shell templates parse and the website entrypoint enforces readiness before exec", async (context) => {
  const directory = await temporaryFixture(context);
  await markedCliFixture(directory, false);
  const bash =
    process.platform === "win32"
      ? "C:/Program Files/Git/bin/bash.exe"
      : "/bin/bash";
  const entrypoint = path.join(directory, "website-entrypoint.sh");
  await copyFile(
    new URL("../deploy/docker/website-entrypoint.sh", import.meta.url),
    entrypoint,
  );
  for (const filename of [
    entrypoint,
    new URL("../deploy/docker/15-validate-configuration.sh", import.meta.url),
  ]) {
    const checked = spawnSync(
      bash,
      [
        "--noprofile",
        "--norc",
        "-n",
        filename instanceof URL ? fileURLToPath(filename) : filename,
      ],
      {
        env: commandEnvironment(),
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
      },
    );
    assert.equal(checked.error, undefined);
    assert.equal(checked.status, 0, checked.stderr);
  }
  const marker = path.join(directory, "executed.txt");
  const result = spawnSync(
    bash,
    [
      "--noprofile",
      "--norc",
      entrypoint,
      process.execPath,
      "-e",
      "require('node:fs').writeFileSync(process.argv[1], 'must not execute')",
      marker,
    ],
    {
      cwd: directory,
      env: commandEnvironment(),
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /applicationReady|non-runnable|runnable application/i,
  );
  await assert.rejects(readFile(marker), { code: "ENOENT" });
});

test("Docker build copies the actual application-helper closure and uses explicit synthetic build inputs", async (context) => {
  const directory = await temporaryFixture(context);
  await markedCliFixture(directory, false);
  const dockerfile = await readFile(
    new URL("../deploy/docker/Dockerfile", import.meta.url),
    "utf8",
  );
  const buildStage = dockerfile
    .split("FROM dependencies AS build")[1]
    .split("FROM node:24.18.0-bookworm-slim AS website")[0];
  assert.match(buildStage, /^COPY scripts \.\/scripts$/m);
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
    buildStage.indexOf("COPY scripts ./scripts") <
      buildStage.indexOf("RUN npm run build"),
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
      timeout: 10_000,
      windowsHide: true,
    },
  );
  assert.equal(imported.error, undefined);
  assert.equal(imported.status, 0, imported.stderr);
});

test("readiness probes check actual response semantics and do not follow redirects", async () => {
  const websiteContentTypes = new Map([
    ["/html-uppercase", "TeXt/HtMl ; Charset=UTF-8"],
    ["/mime-parameter", "application/json; note=text/html"],
    ["/mime-suffix", "text/html-other"],
    ["/mime-prefix", "application/not-text/html"],
    ["/mime-xhtml", "application/xhtml+xml"],
    ["/mime-missing", undefined],
  ]);
  const server = http.createServer((request, response) => {
    if (request.url === "/api") {
      response.setHeader("content-type", "application/json");
      response.end('{"status":"ok"}');
    } else if (request.url === "/website") {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end("<!doctype html><html><body>Ready</body></html>");
    } else if (websiteContentTypes.has(request.url)) {
      const contentType = websiteContentTypes.get(request.url);
      if (contentType !== undefined)
        response.setHeader("content-type", contentType);
      response.end("<!doctype html><html><body>Ready</body></html>");
    } else if (request.url === "/redirect") {
      response.writeHead(302, { location: "/website" });
      response.end();
    } else if (request.url === "/bad-json") {
      response.setHeader("content-type", "application/json");
      response.end('{"status":"starting"}');
    } else {
      response.writeHead(503);
      response.end("not ready");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    await checkHealth("api", `${base}/api`);
    await checkHealth("website", `${base}/website`);
    await checkHealth("website", `${base}/html-uppercase`);
    await Promise.all(
      [
        ["api", "/bad-json"],
        ["website", "/api"],
        ["api", "/error"],
        ["website", "/redirect"],
        ["website", "/mime-parameter"],
        ["website", "/mime-suffix"],
        ["website", "/mime-prefix"],
        ["website", "/mime-xhtml"],
        ["website", "/mime-missing"],
      ].map(([mode, target]) =>
        assert.rejects(() => checkHealth(mode, base + target)),
      ),
    );
    await assert.rejects(() => checkHealth("unknown", base));
    await assert.rejects(() => checkHealth("api", "file:///tmp/file"));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
