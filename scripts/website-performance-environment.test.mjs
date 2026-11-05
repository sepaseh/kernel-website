import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  assertCleanWebsiteEnvironment,
  websitePerformanceEnvironment,
} from "./website-performance-environment.mjs";

async function fixture(t) {
  const root = await realpath(
    await mkdtemp(path.join(tmpdir(), "website-performance-environment-test-")),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, ".next"));
  return { root };
}

test("performance child environments allowlist runtime essentials and require explicit loopback ports", () => {
  const inherited = {
    PATH: "path",
    SystemRoot: "system",
    TEMP: "temp",
    TMP: "tmp",
    API_BASE_URL: "https://owner.test",
    DATABASE_URL: "private",
    NEXT_PUBLIC_COLLECTOR: "private",
    WEBSITE_INDEXING_ENABLED: "true",
    NODE_OPTIONS: "--require=private",
  };
  const env = websitePerformanceEnvironment("http://127.0.0.1:3198", inherited);
  assert.equal(env.API_BASE_URL, "http://127.0.0.1:3198");
  assert.equal(env.WEBSITE_INDEXING_ENABLED, "false");
  assert.equal(env.KERNEL_SYNTHETIC_ENV, "1");
  assert.equal(env.SystemRoot, "system");
  for (const key of ["NODE_OPTIONS", "DATABASE_URL", "NEXT_PUBLIC_COLLECTOR"])
    assert.equal(env[key], undefined);
  assert.equal(
    websitePerformanceEnvironment("http://127.0.0.1:3198", {}).PATH,
    "",
  );
  for (const origin of [
    "invalid",
    "https://127.0.0.1:3198",
    "http://127.0.0.1",
    "http://127.0.0.1:0",
    "http://127.0.0.1:3100/path",
    "http://user@127.0.0.1:3100",
    "http://127.0.0.1:3100?q=1",
    "http://127.0.0.1:3100/#x",
    "http://localhost:3100",
  ])
    assert.throws(
      () => websitePerformanceEnvironment(origin, {}),
      /isolated IPv4/,
    );
});

test("dotenv preflight checks presence only and rejects linked or invalid website directories", async (t) => {
  const { root } = await fixture(t);
  assert.doesNotThrow(() => assertCleanWebsiteEnvironment(root));
  await writeFile(
    path.join(root, ".env.example"),
    "SYNTHETIC_EXAMPLE=not-read\n",
  );
  assert.doesNotThrow(() => assertCleanWebsiteEnvironment(root));
  await writeFile(
    path.join(root, ".env.production.local"),
    "SYNTHETIC_ONLY=not-read\n",
  );
  assert.throws(
    () => assertCleanWebsiteEnvironment(root),
    /No file was read or changed/,
  );
  const alias = path.join(root, "alias");
  await symlink(path.join(root, ".next"), alias, "junction");
  assert.throws(() => assertCleanWebsiteEnvironment(alias), /unlinked owned/);
  assert.throws(
    () => assertCleanWebsiteEnvironment(path.join(root, "performance-file")),
    /ENOENT/,
  );
});
