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

import {
  inspectBootstrap,
  ordinaryPath,
  publicationFiles,
  readPublishedFile,
  validateBootstrapPolicy,
} from "./validate-bootstrap.mjs";

const policy = () => ({
  schemaVersion: 1,
  phase: "governance",
  applicationReady: false,
  maximumChangedFiles: 100,
  allowedFiles: [...publicationFiles],
});
async function fixture(t) {
  const parent = path.resolve(os.tmpdir());
  const root = await mkdtemp(
    path.join(parent, "website-governance-publication-"),
  );
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(
      path.basename(root).startsWith("website-governance-publication-"),
    );
    await rm(root, { recursive: true, force: true });
  });
  const put = async (name, value) => {
    const target = path.join(root, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, value);
  };
  for (const name of publicationFiles)
    await put(
      name,
      name.endsWith(".json")
        ? "{}"
        : name.endsWith(".mjs")
          ? "export {};\n"
          : "Owned English guidance.\n",
    );
  await put(".github/bootstrap-policy.json", JSON.stringify(policy()));
  return { root, put };
}

test("publication accepts only the reviewed governance inventory with readiness false and a 100-entry limit", () => {
  assert.equal(validateBootstrapPolicy(policy()).size, publicationFiles.length);
  for (const change of [
    { schemaVersion: 2 },
    { phase: "operations" },
    { applicationReady: true },
    { maximumChangedFiles: 101 },
    { allowedFiles: [] },
    { allowedFiles: undefined },
    { foreign: true },
    ...[
      "src/app/page.tsx",
      ".env.local",
      "deploy/native/website.env.example",
      "scripts/unreviewed.mjs",
      "../outside.md",
      "docs/*.md",
      "docs/readme.fa.md",
    ].map((file) => ({ allowedFiles: [...publicationFiles, file] })),
    { allowedFiles: publicationFiles.slice(1) },
    { allowedFiles: [...publicationFiles, publicationFiles[0]] },
  ])
    assert.throws(() => validateBootstrapPolicy({ ...policy(), ...change }));
});

test("snapshot checks every file without executing authored JavaScript", async (t) => {
  const { root, put } = await fixture(t);
  const sentinel = path.join(root, "not-created");
  await put(
    "scripts/run-audit.mjs",
    `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(sentinel)},'must not execute');`,
  );
  for (const name of [".git", "node_modules", "coverage"])
    await mkdir(path.join(root, name));
  assert.deepEqual(await inspectBootstrap(root), {
    phase: "governance",
    applicationReady: false,
    files: publicationFiles.length,
  });
  await assert.rejects(readFile(sentinel), { code: "ENOENT" });
  assert.equal(
    await readPublishedFile(root, "README.md"),
    "Owned English guidance.\n",
  );
  await assert.rejects(readPublishedFile(root, ".env.local"), /Unpublished/);
});

test("snapshot rejects unexpected private files, directories and invalid ignored outputs before reading contents", async (t) => {
  const { root, put } = await fixture(t);
  for (const name of [
    ".env.local",
    "credentials.key",
    "src/app/page.tsx",
    "server/data/existing.sqlite",
    "test-results/result.json",
  ]) {
    await put(name, "private sentinel contents must not be parsed");
    await assert.rejects(inspectBootstrap(root), /Unexpected publication/);
    const top = name.split("/")[0];
    await rm(path.join(root, top), { recursive: true });
  }
  await put("coverage", "not a directory");
  await assert.rejects(inspectBootstrap(root), /ordinary directory/);
});

test("snapshot rejects malformed JSON, malformed JavaScript and missing declarations", async (t) => {
  const { root, put } = await fixture(t);
  await put("package.json", "{");
  await assert.rejects(inspectBootstrap(root), SyntaxError);
  await put("package.json", "{}");
  await put("scripts/run-audit.mjs", "export const = ;");
  await assert.rejects(inspectBootstrap(root), /Invalid JavaScript/);
  await put("scripts/run-audit.mjs", "export {};");
  await rm(path.join(root, "README.md"));
  await assert.rejects(inspectBootstrap(root), /Missing declared/);
});

test("snapshot refuses directory aliases, linked ancestors and non-file reads", async (t) => {
  const { root } = await fixture(t);
  await assert.rejects(ordinaryPath(path.join(root, "docs")), /path type/);
  const linked = path.join(root, "linked-docs");
  await symlink(path.join(root, "docs"), linked, "junction");
  await assert.rejects(
    ordinaryPath(path.join(linked, "testing.md")),
    /symbolic links/,
  );
  await assert.rejects(inspectBootstrap(root), /symbolic links/);
  await rm(linked);
  await rm(path.join(root, "README.md"));
  await symlink(
    path.join(root, "docs"),
    path.join(root, "README.md"),
    "junction",
  );
  await assert.rejects(inspectBootstrap(root), /symbolic links/);
});
