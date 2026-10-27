import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { prepareStandalone } from "./prepare-standalone.mjs";

async function fixture(t, ready = true) {
  const root = await mkdtemp(path.join(os.tmpdir(), "website-standalone-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (name, value) => {
    const filename = path.join(root, name);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, value);
  };
  await Promise.all([
    put(
      ".github/bootstrap-policy.json",
      JSON.stringify({ schemaVersion: 1, applicationReady: ready }),
    ),
    put(".next/BUILD_ID", "synthetic"),
    put(".next/standalone/server.js", "// Synthetic fixture; not executed."),
    put("public/fonts/font.woff2", "font"),
    put(".next/static/chunks/entry.js", "script"),
  ]);
  return { root, put };
}

test("standalone preparation copies current assets without executing server code or bundling private state", async (t) => {
  const { root, put } = await fixture(t);
  await put("public/.env.local", "SYNTHETIC_ONLY=excluded");
  await put("public/private.key", "synthetic excluded key");
  const server = await prepareStandalone(root);
  assert.equal(server, path.join(root, ".next/standalone/server.js"));
  assert.equal(
    await readFile(
      path.join(root, ".next/standalone/public/fonts/font.woff2"),
      "utf8",
    ),
    "font",
  );
  assert.equal(
    await readFile(
      path.join(root, ".next/standalone/.next/static/chunks/entry.js"),
      "utf8",
    ),
    "script",
  );
  await assert.rejects(
    readFile(path.join(root, ".next/standalone/public/.env.local")),
    /ENOENT/,
  );
  await put("public/fonts/font.woff2", "updated");
  await prepareStandalone(root);
  assert.equal(
    await readFile(
      path.join(root, ".next/standalone/public/fonts/font.woff2"),
      "utf8",
    ),
    "updated",
  );
});

test("standalone preparation refuses false snapshots, missing build files and linked output ancestors", async (t) => {
  const { root, put } = await fixture(t, false);
  await assert.rejects(prepareStandalone(root), /non-runnable/);
  await put(
    ".github/bootstrap-policy.json",
    JSON.stringify({ schemaVersion: 1, applicationReady: true }),
  );
  await rm(path.join(root, ".next/BUILD_ID"));
  await assert.rejects(prepareStandalone(root), /ENOENT/);
  await put(".next/BUILD_ID", "synthetic");
  const actual = path.join(root, "owned-output");
  await mkdir(actual);
  await symlink(actual, path.join(root, ".next/standalone/public"), "junction");
  await assert.rejects(prepareStandalone(root), /links/);
});

test("public aliases cannot import standalone output into its own prepared assets", async (t) => {
  const { root } = await fixture(t);
  const standalone = path.join(root, ".next/standalone");
  await symlink(standalone, path.join(root, "public/assets"), "junction");
  await assert.rejects(
    prepareStandalone(root),
    /outside its source tree|overlap/,
  );
  await assert.rejects(
    readFile(path.join(standalone, "public/assets")),
    /ENOENT/,
  );
  assert.equal(
    await readFile(path.join(standalone, "server.js"), "utf8"),
    "// Synthetic fixture; not executed.",
  );
});
