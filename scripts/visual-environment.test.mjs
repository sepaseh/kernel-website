import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  acquireVisualLock,
  assertReviewedVisualBaseline,
  assertVisualMode,
  assertVisualPortsAvailable,
  markVisualBaselinePending,
  visualEnvironment,
} from "./visual-environment.mjs";

async function fixture(t) {
  const root = await mkdtemp(
    path.join(tmpdir(), "website-visual-environment-"),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
const metadata = () => ({
  platform: "win32",
  playwright: "synthetic-version",
  browserVersion: "synthetic-browser",
  review: {
    status: "reviewed",
    reviewer: "Synthetic reviewer",
    reviewedAt: "2026-10-27T00:00:00.000Z",
  },
});

test("baseline regeneration atomically clears review while preserving collection metadata", async (t) => {
  const root = await fixture(t);
  const filename = path.join(root, "nested/metadata.json");
  await markVisualBaselinePending(filename, metadata());
  const result = JSON.parse(await readFile(filename, "utf8"));
  assert.equal(result.platform, "win32");
  assert.equal(result.browserVersion, "synthetic-browser");
  assert.deepEqual(result.review, {
    status: "pending",
    reviewer: null,
    reviewedAt: null,
  });
  await markVisualBaselinePending(filename, {
    ...metadata(),
    browserVersion: "replacement",
  });
  assert.equal(
    JSON.parse(await readFile(filename, "utf8")).browserVersion,
    "replacement",
  );
  assert.deepEqual(await readdir(path.dirname(filename)), ["metadata.json"]);
  for (const invalid of [null, [], "metadata"])
    await assert.rejects(
      markVisualBaselinePending(filename, invalid),
      /metadata must be an object/,
    );
});

test("metadata and lock output reject linked parents or non-file destinations", async (t) => {
  const root = await fixture(t);
  const actual = path.join(root, "actual");
  await mkdir(actual);
  const alias = path.join(root, "alias");
  await symlink(actual, alias, "junction");
  await assert.rejects(
    markVisualBaselinePending(path.join(alias, "metadata.json"), metadata()),
    /unlinked directory/,
  );
  await assert.rejects(acquireVisualLock(alias), /unlinked directory/);
  assert.deepEqual(await readdir(actual), []);
  const invalid = path.join(root, "directory.json");
  await mkdir(invalid);
  await assert.rejects(
    markVisualBaselinePending(invalid, metadata()),
    /unlinked regular file/,
  );
  const ordinaryFile = path.join(root, "file");
  await writeFile(ordinaryFile, "synthetic");
  await assert.rejects(acquireVisualLock(ordinaryFile), /unlinked directory/);
  await assert.rejects(acquireVisualLock(""), /must be explicit/);
});

test("concurrent locks have one owner and release is idempotent", async (t) => {
  const root = await fixture(t);
  const directory = path.join(root, "results");
  const results = await Promise.allSettled([
    acquireVisualLock(directory),
    acquireVisualLock(directory),
  ]);
  const owners = results.filter((item) => item.status === "fulfilled");
  const failures = results.filter((item) => item.status === "rejected");
  assert.equal(owners.length, 1);
  assert.equal(failures.length, 1);
  assert.match(failures[0].reason.message, /Another visual run/);
  assert.equal(
    await readFile(path.join(directory, ".visual-run.lock"), "utf8"),
    `${process.pid}\n`,
  );
  const release = owners[0].value;
  assert.equal(release(), release());
  await release();
  await release();
  await assert.rejects(
    readFile(path.join(directory, ".visual-run.lock")),
    /ENOENT/,
  );
  const next = await acquireVisualLock(directory);
  await next();
});

test("release preserves a replacement lock and tolerates an already removed owned lock", async (t) => {
  const root = await fixture(t);
  const release = await acquireVisualLock(root);
  const filename = path.join(root, ".visual-run.lock");
  await rename(filename, path.join(root, "previous-owner.lock"));
  await writeFile(filename, "different synthetic owner\n");
  await assert.rejects(release(), /ownership changed/);
  assert.equal(await readFile(filename, "utf8"), "different synthetic owner\n");
  await unlink(filename);
  const missing = await acquireVisualLock(root);
  await unlink(filename);
  await missing();
});

test("visual modes require supported platforms and forbid CI baseline updates", () => {
  for (const platform of ["win32", "linux"]) {
    assert.doesNotThrow(() =>
      assertVisualMode({ update: false, ci: true, platform }),
    );
    assert.doesNotThrow(() =>
      assertVisualMode({ update: true, ci: false, platform }),
    );
  }
  assert.throws(
    () => assertVisualMode({ update: true, ci: true, platform: "win32" }),
    /forbidden in CI/,
  );
  assert.throws(
    () => assertVisualMode({ update: false, ci: false, platform: "darwin" }),
    /No visual baseline workflow/,
  );
  for (const invalid of [null, {}, { update: "false", ci: false }])
    assert.throws(
      () => assertVisualMode(invalid),
      /explicit update and CI booleans/,
    );
});

test("reviewed baselines require real metadata shape and exact expected engine identity", () => {
  const expected = { platform: "win32", playwright: "synthetic-version" };
  assert.doesNotThrow(() => assertReviewedVisualBaseline(metadata(), expected));
  assert.doesNotThrow(() =>
    assertReviewedVisualBaseline(metadata(), {
      ...expected,
      browserVersion: "synthetic-browser",
    }),
  );
  for (const invalid of [
    null,
    { ...metadata(), platform: "linux" },
    { ...metadata(), playwright: "different" },
    { ...metadata(), review: { ...metadata().review, status: "pending" } },
    { ...metadata(), review: { ...metadata().review, reviewer: " " } },
    { ...metadata(), review: { ...metadata().review, reviewedAt: "invalid" } },
    { ...metadata(), review: { ...metadata().review, reviewedAt: 0 } },
  ])
    assert.throws(
      () => assertReviewedVisualBaseline(invalid, expected),
      /metadata mismatch/,
    );
  for (const browserVersion of ["different", "", 4])
    assert.throws(
      () =>
        assertReviewedVisualBaseline(metadata(), {
          ...expected,
          browserVersion,
        }),
      /Chromium/,
    );
  for (const invalid of [
    undefined,
    {},
    { platform: "darwin", playwright: "version" },
  ])
    assert.throws(
      () => assertReviewedVisualBaseline(metadata(), invalid),
      /must be explicit/,
    );
});

test("visual subprocesses receive synthetic flags and an explicit environment allowlist", () => {
  const env = visualEnvironment({
    PATH: "path",
    TEMP: "temp",
    TMP: "tmp",
    SystemRoot: "system",
    KERNEL_API_DIRECTORY: "fixture",
    CI: "1",
    WEBSITE_SKIP_BUILD: "1",
    NODE_OPTIONS: "--require=private",
    DATABASE_URL: "private",
    TOKEN: "private",
  });
  assert.equal(env.KERNEL_SYNTHETIC_ENV, "1");
  assert.equal(env.KERNEL_API_DIRECTORY, "fixture");
  assert.equal(env.WEBSITE_SKIP_BUILD, "0");
  assert.equal(env.CI, "1");
  for (const key of ["NODE_OPTIONS", "DATABASE_URL", "TOKEN"])
    assert.equal(env[key], undefined);
  assert.equal(visualEnvironment({}).PATH, "");
  assert.equal(visualEnvironment({}).CI, "");
  assert.equal(visualEnvironment({ PATH: 4, TEMP: false }).TEMP, undefined);
});

test("port checks bind only validated IPv4 loopback TCP ports and close owned listeners", async (t) => {
  await assertVisualPortsAvailable([0, 0]);
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error_) => (error_ ? reject(error_) : resolve())),
      ),
  );
  const address = server.address();
  assert.equal(typeof address, "object");
  await assert.rejects(
    assertVisualPortsAvailable([address.port]),
    /already in use or unavailable/,
  );
  for (const invalid of [null, ["socket-path"], [-1], [65536], [0.5]])
    await assert.rejects(
      assertVisualPortsAvailable(invalid),
      /integer TCP ports/,
    );
});
