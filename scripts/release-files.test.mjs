import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import filesystem from "node:fs/promises";
import {
  chmod,
  copyFile,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
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
  const root = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "website-release-files-")),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
const put = async (root, name, value = "synthetic") => {
  const filename = path.join(root, name);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, value);
  return filename;
};

async function withFileOperations(context, operations, action) {
  try {
    for (const [name, implementation] of Object.entries(operations))
      context.mock.method(filesystem, name, implementation);
    syncBuiltinESMExports();
    await action();
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
  }
}

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

test("overwrite copying replaces a destination link swapped after validation without altering its target", async (t) => {
  const root = await fixture(t);
  const sourceRoot = path.join(root, "source");
  const content = "streamed replacement bytes\n".repeat(20_000);
  const source = await put(sourceRoot, "entry.txt", content);
  const destination = await put(root, "output/entry.txt", "previous bytes");
  const outside = await put(root, "outside.txt", "preserve outside bytes");
  await chmod(source, 0o751);
  const sourceMode = (await lstat(source)).mode & 0o777;
  const originalCopyFile = filesystem.copyFile;
  const originalOpen = filesystem.open;
  let swapped = false;
  const swapDestination = async () => {
    if (swapped) return;
    await rm(destination);
    // Windows file symlinks require privileges; a hard link exposes the same overwrite target.
    if (process.platform === "win32") await link(outside, destination);
    else await symlink(outside, destination, "file");
    swapped = true;
  };

  await withFileOperations(
    t,
    {
      copyFile: async (from, to, flags) => {
        if (to === destination) await swapDestination();
        return originalCopyFile(from, to, flags);
      },
      open: async (filename, flags, ...options) => {
        if (
          flags === "wx" &&
          path.dirname(filename) === path.dirname(destination) &&
          path.basename(filename).startsWith(".kernel-copy-") &&
          filename.endsWith(".partial")
        )
          await swapDestination();
        return originalOpen(filename, flags, ...options);
      },
    },
    () =>
      copyArtifactTree({ source, destination, sourceRoot, overwrite: true }),
  );

  assert.equal(swapped, true, "the owned destination swap was exercised");
  assert.equal(await readFile(outside, "utf8"), "preserve outside bytes");
  assert.equal((await lstat(destination)).isSymbolicLink(), false);
  assert.notEqual((await lstat(destination)).ino, (await lstat(outside)).ino);
  assert.equal(await readFile(destination, "utf8"), content);
  assert.equal((await lstat(destination)).mode & 0o777, sourceMode);
  if (process.platform !== "win32") assert.equal(sourceMode, 0o751);
  assert.deepEqual(await readdir(path.dirname(destination)), ["entry.txt"]);
});

test("overwrite staging cleans its owned file after a failed rename and preserves the existing destination", async (t) => {
  const root = await fixture(t);
  const sourceRoot = path.join(root, "source");
  const source = await put(sourceRoot, "entry.txt", "replacement bytes");
  await chmod(source, 0o444);
  const destination = await put(root, "output/entry.txt", "previous bytes");
  const originalRename = filesystem.rename;
  let staged;
  const failure = Object.assign(new Error("Synthetic rename failure"), {
    code: "EACCES",
  });

  await withFileOperations(
    t,
    {
      rename: async (from, to) => {
        if (to === destination) {
          staged = from;
          throw failure;
        }
        return originalRename(from, to);
      },
    },
    () =>
      assert.rejects(
        copyArtifactTree({ source, destination, sourceRoot, overwrite: true }),
        (error) => error === failure,
      ),
  );

  assert.equal(typeof staged, "string");
  await assert.rejects(lstat(staged), { code: "ENOENT" });
  assert.equal(await readFile(destination, "utf8"), "previous bytes");
  assert.deepEqual(await readdir(path.dirname(destination)), ["entry.txt"]);
});

test("failed staging writes close both handles and remove only the owned temporary file", async (t) => {
  const root = await fixture(t);
  const sourceRoot = path.join(root, "source");
  const source = await put(sourceRoot, "entry.txt", "replacement bytes");
  const destination = await put(root, "output/entry.txt", "previous bytes");
  const originalOpen = filesystem.open;
  const handles = [];
  const failure = new Error("Synthetic staged write failure");

  await withFileOperations(
    t,
    {
      open: async (filename, flags, ...options) => {
        const handle = await originalOpen(filename, flags, ...options);
        handles.push(handle);
        if (flags === "wx")
          t.mock.method(handle, "writeFile", async () => {
            throw failure;
          });
        return handle;
      },
    },
    () =>
      assert.rejects(
        copyArtifactTree({ source, destination, sourceRoot, overwrite: true }),
        (error) => error === failure,
      ),
  );

  assert.equal(handles.length, 2);
  assert.ok(handles.every((handle) => handle.fd === -1));
  assert.equal(await readFile(destination, "utf8"), "previous bytes");
  assert.deepEqual(await readdir(path.dirname(destination)), ["entry.txt"]);
});

test("failure to open the source removes the claimed stage and closes its handle", async (t) => {
  const root = await fixture(t);
  const sourceRoot = path.join(root, "source");
  const source = await put(sourceRoot, "entry.txt", "replacement bytes");
  const destination = await put(root, "output/entry.txt", "previous bytes");
  const originalOpen = filesystem.open;
  let output;
  const failure = new Error("Synthetic source open failure");

  await withFileOperations(
    t,
    {
      open: async (filename, flags, ...options) => {
        if (filename === source && flags === "r") throw failure;
        const handle = await originalOpen(filename, flags, ...options);
        if (flags === "wx") output = handle;
        return handle;
      },
    },
    () =>
      assert.rejects(
        copyArtifactTree({ source, destination, sourceRoot, overwrite: true }),
        (error) => error === failure,
      ),
  );

  assert.equal(output.fd, -1);
  assert.equal(await readFile(destination, "utf8"), "previous bytes");
  assert.deepEqual(await readdir(path.dirname(destination)), ["entry.txt"]);
});

test("a staging collision belongs to its creator and is never removed by failed overwrite copying", async (t) => {
  const root = await fixture(t);
  const sourceRoot = path.join(root, "source");
  const source = await put(sourceRoot, "entry.txt", "replacement bytes");
  const destination = await put(root, "output/entry.txt", "previous bytes");
  const originalOpen = filesystem.open;
  let collision;

  await withFileOperations(
    t,
    {
      open: async (filename, flags, ...options) => {
        if (
          flags === "wx" &&
          path.dirname(filename) === path.dirname(destination) &&
          path.basename(filename).startsWith(".kernel-copy-") &&
          filename.endsWith(".partial")
        ) {
          collision = filename;
          await writeFile(filename, "preserve another creator's file");
        }
        return originalOpen(filename, flags, ...options);
      },
    },
    () =>
      assert.rejects(
        copyArtifactTree({ source, destination, sourceRoot, overwrite: true }),
        { code: "EEXIST" },
      ),
  );

  assert.equal(typeof collision, "string");
  assert.equal(
    await readFile(collision, "utf8"),
    "preserve another creator's file",
  );
  assert.equal(await readFile(destination, "utf8"), "previous bytes");
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
