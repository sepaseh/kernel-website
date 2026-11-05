import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmod,
  mkdir,
  readFile,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  commandEnvironment,
  temporaryFixture,
} from "./deployment.test-support.mjs";

test("gateway validator parses and restricts certificate key permissions", async () => {
  const bash =
    process.platform === "win32"
      ? "C:/Program Files/Git/bin/bash.exe"
      : "/bin/bash";
  const filename = new URL(
    "../deploy/docker/validate-gateway-env.sh",
    import.meta.url,
  );
  const checked = spawnSync(
    bash,
    ["--noprofile", "--norc", "-n", fileURLToPath(filename)],
    {
      env: commandEnvironment(),
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(checked.error, undefined);
  assert.equal(checked.status, 0, checked.stderr);
  const validator = await readFile(
    new URL("../deploy/docker/validate-gateway-env.sh", import.meta.url),
    "utf8",
  );
  assert.match(validator, /400\|440\|600\|640\)/);
  assert.match(
    validator,
    /key_mode=\$\(stat -L -c '%a' \/etc\/kernel\/tls\/privkey\.pem\)/,
  );
  assert.ok(
    validator.indexOf("[ -r /etc/kernel/tls/privkey.pem ]") <
      validator.indexOf("key_mode="),
  );
});

test(
  "gateway validator checks actual Linux permissions for regular and symlinked keys",
  { skip: process.platform !== "linux" },
  async (context) => {
    const directory = await temporaryFixture(context);
    const tls = path.join(directory, "tls");
    await mkdir(tls);
    await writeFile(path.join(tls, "fullchain.pem"), "synthetic certificate");
    const target = path.join(tls, "archive-key.pem");
    await writeFile(target, "synthetic private key fixture");
    const validator = await readFile(
      new URL("../deploy/docker/validate-gateway-env.sh", import.meta.url),
      "utf8",
    );
    const script = path.join(directory, "validate-gateway-env.sh");
    await writeFile(script, validator.replaceAll("/etc/kernel/tls/", "./tls/"));
    const key = path.join(tls, "privkey.pem");

    for (const linked of [false, true]) {
      if (linked) await symlink("archive-key.pem", key);
      else await writeFile(key, "synthetic private key fixture");

      for (const [mode, expectedStatus] of [
        [0o400, 0],
        [0o440, 0],
        [0o600, 0],
        [0o640, 0],
        [0o644, 1],
        [0o660, 1],
        [0o666, 1],
        [0o777, 1],
      ]) {
        await chmod(linked ? target : key, mode);
        const result = spawnSync("/bin/sh", [script], {
          cwd: directory,
          env: {
            ...commandEnvironment(),
            HTTPS_PORT: "8443",
            RELEASE_ID: "synthetic-release",
            WEBSITE_HOST: "www.kernel.test",
          },
          encoding: "utf8",
        });
        assert.equal(result.error, undefined);
        assert.equal(
          result.status,
          expectedStatus,
          `${linked ? "Symlinked" : "Regular"} key mode ${mode.toString(8)}: ${result.stderr}`,
        );
        if (expectedStatus === 0) assert.equal(result.stderr, "");
        else
          assert.match(result.stderr, /deny group writes and all other-user/);
      }
      await unlink(key);
    }
  },
);

test("gateway templates preserve browser authority for the same-origin proxy integration", async () => {
  for (const filename of [
    "../deploy/docker/nginx.conf.template",
    "../deploy/native/nginx/kernel-website.conf.template",
  ]) {
    const template = await readFile(new URL(filename, import.meta.url), "utf8");
    const authorityHeaders = template
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) =>
        /^proxy_set_header (?:Host|X-Forwarded-Host) /.test(line),
      );
    assert.deepEqual(authorityHeaders, [
      "proxy_set_header Host $http_host;",
      "proxy_set_header X-Forwarded-Host $http_host;",
    ]);
  }
});

test("native HTTP gateway retains the bootstrap ACME webroot before redirecting other paths", async () => {
  const template = await readFile(
    new URL(
      "../deploy/native/nginx/kernel-website.conf.template",
      import.meta.url,
    ),
    "utf8",
  );
  const bootstrap = await readFile(
    new URL(
      "../deploy/native/nginx/acme-bootstrap.conf.template",
      import.meta.url,
    ),
    "utf8",
  );
  const httpServer = template.match(
    /^server \{\r?\n {4}listen 80;\r?\n([\s\S]*?)^\}/m,
  )?.[1];
  assert.ok(httpServer, "The hostname's HTTP server must remain present.");
  assert.doesNotMatch(httpServer, /^ {4}return /m);
  for (const configuration of [bootstrap, httpServer])
    assert.match(
      configuration,
      /location \/\.well-known\/acme-challenge\/ \{\s*root \/var\/www\/acme;\s*\}/,
    );
  assert.match(
    httpServer,
    /location \/ \{\s*return 308 https:\/\/\$host:\$\{HTTPS_PORT\}\$request_uri;\s*\}/,
  );
});

test("gateway configuration rejects invalid domains and ports before certificate access", () => {
  const bash =
    process.platform === "win32"
      ? "C:/Program Files/Git/bin/bash.exe"
      : "/bin/bash";
  const validator = fileURLToPath(
    new URL("../deploy/docker/validate-gateway-env.sh", import.meta.url),
  );
  for (const [name, value] of [
    ["WEBSITE_HOST", "bad..kernel.test"],
    ["WEBSITE_HOST", "www.kernel.test\n"],
    ["WEBSITE_HOST", "-bad.kernel.test"],
    ["WEBSITE_HOST", `${"a".repeat(64)}.kernel.test`],
    ["HTTPS_PORT", "0"],
    ["HTTPS_PORT", "0443"],
    ["HTTPS_PORT", "65536"],
    ["HTTPS_PORT", "443\n"],
    ["HTTPS_PORT", "9".repeat(100)],
  ]) {
    const result = spawnSync(bash, ["--noprofile", "--norc", validator], {
      env: {
        ...commandEnvironment(),
        HTTPS_PORT: "443",
        RELEASE_ID: "owned-release",
        WEBSITE_HOST: "www.kernel.test",
        [name]: value,
      },
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(name), result.stderr);
    assert.doesNotMatch(result.stderr, /Missing mounted|integer expression/);
  }
});
