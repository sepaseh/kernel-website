import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
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

async function fixture(t, withBuildDirectory = true) {
  const parent = await realpath(tmpdir());
  const root = await realpath(
    await mkdtemp(path.join(parent, "website-performance-environment-test-")),
  );
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.equal(await realpath(root), root);
    await rm(root, { recursive: true, force: true });
  });
  if (withBuildDirectory) await mkdir(path.join(root, ".next"));
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

test("dotenv preflight permits absent build directories and preserves standalone files on success and rejection", async (t) => {
  const { root } = await fixture(t, false);
  assert.doesNotThrow(() => assertCleanWebsiteEnvironment(root));
  await mkdir(path.join(root, ".next"));
  assert.doesNotThrow(() => assertCleanWebsiteEnvironment(root));
  const standalone = path.join(root, ".next/standalone");
  await mkdir(path.join(standalone, "node_modules"), { recursive: true });
  await writeFile(path.join(standalone, "server.js"), "synthetic server");
  await writeFile(
    path.join(standalone, "node_modules/dependency.js"),
    "synthetic dependency",
  );
  await writeFile(path.join(standalone, ".env.example"), "SYNTHETIC_EXAMPLE=1");
  assert.doesNotThrow(() => assertCleanWebsiteEnvironment(root));
  await mkdir(path.join(standalone, ".env.local"));
  assert.throws(
    () => assertCleanWebsiteEnvironment(root),
    /No file was read or changed/,
  );
  assert.equal(
    await readFile(path.join(standalone, "server.js"), "utf8"),
    "synthetic server",
  );
  assert.equal(
    await readFile(path.join(standalone, "node_modules/dependency.js"), "utf8"),
    "synthetic dependency",
  );
  assert.ok((await stat(path.join(standalone, ".env.example"))).isFile());
});

test("dotenv preflight rejects standalone dotenv names without opening or removing entries", async (t) => {
  const { root } = await fixture(t);
  const standalone = path.join(root, ".next/standalone");
  await mkdir(standalone);
  await writeFile(path.join(standalone, "server.js"), "synthetic server");
  for (const name of [
    ".env",
    ".ENV.local",
    ".env.production.local",
    ".env.example.local",
    ".Env.Example",
  ]) {
    const entry = path.join(standalone, name);
    await writeFile(entry, "SYNTHETIC_ONLY=not-read");
    assert.throws(
      () => assertCleanWebsiteEnvironment(root),
      /No file was read or changed/,
    );
    assert.ok((await stat(entry)).isFile());
    await rm(entry);
  }
  assert.equal(
    await readFile(path.join(standalone, "server.js"), "utf8"),
    "synthetic server",
  );
});

test("dotenv preflight checks linked and nondirectory ancestors before reading directory entries", async (t) => {
  for (const target of [".next", ".next/standalone"]) {
    const { root } = await fixture(t, false);
    await mkdir(path.join(root, "owned-target"));
    await writeFile(path.join(root, ".env.local"), "SYNTHETIC_ONLY=not-read");
    if (target.includes("/")) await mkdir(path.join(root, ".next"));
    const entry = path.join(root, target);
    await symlink(path.join(root, "owned-target"), entry, "junction");
    assert.throws(() => assertCleanWebsiteEnvironment(root), /unlinked owned/);
    await rm(entry);
    await writeFile(entry, "synthetic nondirectory");
    assert.throws(
      () => assertCleanWebsiteEnvironment(root),
      /must be a directory/,
    );
  }

  const { root } = await fixture(t);
  const linked = path.join(root, "linked");
  await symlink(path.join(root, ".next"), linked, "junction");
  assert.throws(
    () => assertCleanWebsiteEnvironment(path.join(linked, "missing")),
    /unlinked owned/,
  );
  const filename = path.join(root, "file");
  await writeFile(filename, "synthetic nondirectory");
  assert.throws(
    () => assertCleanWebsiteEnvironment(path.join(filename, "missing")),
    /must be a directory/,
  );
});
