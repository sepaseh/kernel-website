import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { commandEnvironment } from "./deployment.test-support.mjs";

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
    /key_mode=\$\(stat -c '%a' \/etc\/kernel\/tls\/privkey\.pem\)/,
  );
  assert.ok(
    validator.indexOf("[ -r /etc/kernel/tls/privkey.pem ]") <
      validator.indexOf("key_mode="),
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
