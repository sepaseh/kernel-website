import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseEnv } from "node:util";

import {
  commandEnvironment,
  markedCliFixture,
  publicValues,
  temporaryFixture,
} from "./deployment.test-support.mjs";
import { renderDeploymentTemplate } from "./render-deployment.mjs";

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
    ["HTTPS_PORT", "0443"],
    ["HTTPS_PORT", "1e3"],
    ["HTTPS_PORT", "443\n"],
    ["HTTPS_PORT", "65536"],
    ["HTTPS_PORT", "9".repeat(100)],
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
    ["kernel-website.conf.template", "acme-bootstrap.conf.template"].map(
      async (name) => {
        const file = new URL(`../deploy/native/nginx/${name}`, import.meta.url);
        const rendered = renderDeploymentTemplate(
          await readFile(file, "utf8"),
          publicValues,
        );
        assert.ok(rendered.includes("kernel.test"));
        assert.equal(/\$\{[A-Z][A-Z0-9_]*\}/.test(rendered), false);
        assert.ok(
          rendered.includes("$request_uri") ||
            name === "acme-bootstrap.conf.template",
        );
      },
    ),
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

test("renderer CLI refuses a false phase before reading inputs or creating output", async (context) => {
  const directory = await temporaryFixture(context);
  await markedCliFixture(directory, false);
  const output = path.join(directory, "not-created/nginx.conf");
  const result = spawnSync(
    process.execPath,
    [
      path.join(directory, "scripts/render-deployment.mjs"),
      "--template",
      path.join(directory, "missing-template"),
      "--public-values-file",
      path.join(directory, "missing-public-env"),
      "--output",
      output,
    ],
    {
      env: commandEnvironment(),
      encoding: "utf8",
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
  await assert.rejects(readFile(output), { code: "ENOENT" });
});

test("native public Nginx example renders with the documented hostname", async () => {
  const hosts = parseEnv(
    await readFile(
      new URL("../deploy/native/nginx.env.example", import.meta.url),
      "utf8",
    ),
  );
  const template = await readFile(
    new URL(
      "../deploy/native/nginx/kernel-website.conf.template",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(
    renderDeploymentTemplate(template, hosts).includes("www.example.com"),
  );
});
