import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import {
  artifactDirectory,
  artifactFile,
  completeArtifactWork,
  copyArtifactTree,
  ensureArtifactDirectory,
  excludedArtifactPath,
  insideArtifactRoot,
  readArtifactFile,
  requireApplicationReady,
  runDeliveryCommand,
} from "./release-files.mjs";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "website-release-files-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
const put = async (root, name, value = "synthetic") => {
  const filename = path.join(root, name);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, value);
  return filename;
};

test("artifact paths are explicit and reads never follow linked ancestors", async (t) => {
  const root = await fixture(t);
  const directory = await ensureArtifactDirectory(
    path.join(root, "owned/nested"),
  );
  const filename = await put(directory, "entry.txt", "known bytes");
  assert.equal(await artifactDirectory(directory), directory);
  assert.equal(await artifactFile(filename), filename);
  assert.equal((await readArtifactFile(filename)).toString(), "known bytes");
  assert.equal(insideArtifactRoot(root, filename), true);
  assert.equal(insideArtifactRoot(directory, root), false);
  for (const value of ["", "relative", null, "//remote/path", root + "\n"])
    await assert.rejects(artifactDirectory(value), /explicit absolute local/);
  await assert.rejects(artifactDirectory(filename), /non-directory/);
  await assert.rejects(artifactFile(directory), /regular file/);
  const alias = path.join(root, "alias");
  await symlink(directory, alias, "junction");
  await assert.rejects(
    readArtifactFile(path.join(alias, "entry.txt")),
    /links/,
  );
  await assert.rejects(
    ensureArtifactDirectory(path.join(alias, "new")),
    /links/,
  );
  assert.deepEqual(await readdir(directory), ["entry.txt"]);
});

test("only explicit schema-one true readiness metadata activates delivery operations", async (t) => {
  const root = await fixture(t);
  for (const marker of [
    { schemaVersion: 1, applicationReady: false },
    { schemaVersion: 2, applicationReady: true },
    { schemaVersion: 1, applicationReady: "true" },
    null,
  ]) {
    await put(root, ".github/bootstrap-policy.json", JSON.stringify(marker));
    await assert.rejects(requireApplicationReady(root), /non-runnable/);
  }
  await put(
    root,
    ".github/bootstrap-policy.json",
    JSON.stringify({ schemaVersion: 1, applicationReady: true }),
  );
  assert.equal(await requireApplicationReady(root), root);
  let ran = false;
  await runDeliveryCommand(false, path.join(root, "nonexistent"), async () => {
    ran = true;
  });
  assert.equal(ran, false);
});

test("the artifact policy excludes state, credentials, caches and test sources case-insensitively", () => {
  for (const filename of [
    ".env",
    "nested/.ENV.EXAMPLE",
    ".AWS/config",
    ".ssh/config",
    "server/data/state.json",
    ".next/cache/value",
    "private.key",
    "private.p12",
    "credentials.json",
    "node_modules/pkg/tests/data",
    "file.spec.ts",
    "file.stories.tsx",
    "file.snap",
    "state.sqlite3-wal",
    "state.db-shm",
    "id_ed25519",
  ])
    assert.equal(excludedArtifactPath(filename), true, filename);
  for (const filename of [
    "node_modules/next/server.js",
    "public/fonts/OFL.txt",
    "src/entry.js",
  ])
    assert.equal(excludedArtifactPath(filename), false, filename);
});

test("artifact copying resolves owned dependency links but refuses escape, loops, overwrite and input overlap", async (t) => {
  const root = await fixture(t);
  const source = path.join(root, "source");
  const destination = path.join(root, "output");
  await put(source, "dependency/index.js", "export const synthetic = true;");
  await put(source, "private/.env.local", "SYNTHETIC_ONLY=excluded");
  await symlink(
    path.join(source, "dependency"),
    path.join(source, "linked"),
    "junction",
  );
  await copyArtifactTree({ source, destination, sourceRoot: source });
  assert.equal(
    await readFile(path.join(destination, "linked/index.js"), "utf8"),
    "export const synthetic = true;",
  );
  await assert.rejects(
    readFile(path.join(destination, "private/.env.local")),
    /ENOENT/,
  );
  await assert.rejects(
    copyArtifactTree({ source, destination, sourceRoot: source }),
    /EEXIST/,
  );
  await copyArtifactTree({
    source,
    destination,
    sourceRoot: source,
    overwrite: true,
  });
  await assert.rejects(
    copyArtifactTree({
      source,
      destination: path.join(source, "child"),
      sourceRoot: source,
    }),
    /overlap/,
  );
  await assert.rejects(
    copyArtifactTree({
      source,
      destination,
      sourceRoot: source,
      overwrite: "false",
    }),
    /copy options/,
  );
  const outside = path.join(root, "outside");
  await put(outside, "unrelated.txt", "unrelated");
  await symlink(outside, path.join(source, "escape"), "junction");
  await assert.rejects(
    copyArtifactTree({
      source,
      destination: path.join(root, "escaped"),
      sourceRoot: source,
    }),
    /outside its source tree/,
  );
  await rm(path.join(source, "escape"));
  await symlink(source, path.join(source, "loop"), "junction");
  await assert.rejects(
    copyArtifactTree({
      source,
      destination: path.join(root, "looped"),
      sourceRoot: source,
    }),
    /circular/,
  );
});

test("core CLIs refuse false snapshots before build, environment or output access", async (t) => {
  const root = await fixture(t);
  const filenames = [
    "release-files.mjs",
    "package-release.mjs",
    "prepare-standalone.mjs",
  ];
  for (const filename of filenames) {
    await mkdir(path.join(root, "scripts"), { recursive: true });
    await copyFile(
      new URL(`./${filename}`, import.meta.url),
      path.join(root, "scripts", filename),
    );
  }
  await put(
    root,
    ".github/bootstrap-policy.json",
    JSON.stringify({ schemaVersion: 1, applicationReady: false }),
  );
  for (const filename of filenames) {
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts", filename)],
      { encoding: "utf8", timeout: 10_000, windowsHide: true },
    );
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /non-runnable/);
  }
  const unsupported = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {runDeliveryCommand} from ${JSON.stringify(pathToFileURL(path.join(root, "scripts/release-files.mjs")).href)}; await runDeliveryCommand(undefined, ${JSON.stringify(root)}, async()=>{});`,
    ],
    { encoding: "utf8", timeout: 10_000, windowsHide: true },
  );
  assert.equal(unsupported.status, 1);
  assert.match(unsupported.stderr, /Node.js 24/);
  assert.equal((await readdir(root)).includes("dist"), false);
});

test("parallel artifact work waits for every owner and preserves all failures", async () => {
  assert.deepEqual(
    await completeArtifactWork([
      Promise.resolve("first"),
      Promise.resolve("second"),
    ]),
    ["first", "second"],
  );
  const first = new Error("first synthetic failure");
  const second = new Error("second synthetic failure");
  await assert.rejects(
    completeArtifactWork([Promise.reject(first), Promise.reject(second)]),
    (error) =>
      error instanceof AggregateError &&
      error.errors[0] === first &&
      error.errors[1] === second,
  );
});

test("copy separation rejects reverse and physical overlap before creating recursive output", async (t) => {
  const root = await fixture(t);
  const source = path.join(root, "source");
  await put(source, "entry.txt", "preserve original");
  await assert.rejects(
    copyArtifactTree({ source, destination: root, sourceRoot: root }),
    /overlap/,
  );
  const alias = path.join(root, "source-alias");
  await symlink(source, alias, "junction");
  const nestedOutput = path.join(source, "nested-output");
  await assert.rejects(
    copyArtifactTree({
      source: alias,
      destination: nestedOutput,
      sourceRoot: root,
    }),
    /overlap/,
  );
  await assert.rejects(readFile(nestedOutput), /ENOENT/);
  await symlink(root, path.join(source, "parent"), "junction");
  const output = path.join(root, "output");
  await assert.rejects(
    copyArtifactTree({ source, destination: output, sourceRoot: root }),
    /overlap/,
  );
  await assert.rejects(readFile(path.join(output, "parent")), /ENOENT/);
  assert.equal(
    await readFile(path.join(source, "entry.txt"), "utf8"),
    "preserve original",
  );
});
