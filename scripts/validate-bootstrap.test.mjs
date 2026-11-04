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
  comparePublicationPaths,
  completePublicationWork,
  inspectBootstrap,
  ordinaryPath,
  publicationInventories,
  publicationReadiness,
  readPublishedFile,
  validateBootstrapPolicy,
} from "./validate-bootstrap.mjs";

const currentMarker = JSON.parse(
  await readFile(
    new URL("../.github/bootstrap-policy.json", import.meta.url),
    "utf8",
  ),
);
const publicationPhase = currentMarker.phase;
const applicationReady = publicationReadiness[publicationPhase];
const publicationFiles = publicationInventories[publicationPhase];

const policy = () => ({
  schemaVersion: 1,
  phase: publicationPhase,
  applicationReady,
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

test("publication accepts only the reviewed phase inventory and matching readiness", () => {
  assert.equal(validateBootstrapPolicy(policy()).size, publicationFiles.length);
  for (const change of [
    { schemaVersion: 2 },
    { phase: "unreviewed-phase" },
    { applicationReady: !applicationReady },
    { maximumChangedFiles: 101 },
    { allowedFiles: [] },
    { allowedFiles: undefined },
    { foreign: true },
    ...[
      "runtime-unreviewed/page.tsx",
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

test("catalog inventories admit only the ten JSON resources", () => {
  const prefix = "src/i18n/catalog-data/locales/";
  const expected = [
    "ar",
    "de",
    "en",
    "es",
    "fa",
    "fr",
    "it",
    "pt",
    "ru",
    "tr",
  ].map((code) => prefix + code + ".json");
  for (const files of Object.values(publicationInventories))
    assert.deepEqual(
      files.filter((file) => file.startsWith(prefix)),
      expected,
    );
  assert.throws(
    () =>
      validateBootstrapPolicy({
        ...policy(),
        allowedFiles: publicationFiles.map((file) =>
          file === prefix + "en.json" ? prefix + "en.ts" : file,
        ),
      }),
    /inventory must match/,
  );
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
    phase: publicationPhase,
    applicationReady,
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
    "runtime-unreviewed/page.tsx",
    "server/data/existing.sqlite",
    "private-results/result.json",
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
  await put("src/i18n/catalog-data/locales/en.json", "{");
  await assert.rejects(inspectBootstrap(root), SyntaxError);
  await put("src/i18n/catalog-data/locales/en.json", "{}");
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
  await assert.rejects(
    ordinaryPath(path.join(linked, "missing-child.md")),
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

test("publication ordering is ordinal and independent of locale or numeric collation", () => {
  const paths = ["a10", "a2", "_path", "z", "A", "a", "\uE000", "\u{10000}"];
  assert.deepEqual(paths.sort(comparePublicationPaths), [
    "A",
    "_path",
    "a",
    "a10",
    "a2",
    "z",
    "\u{10000}",
    "\uE000",
  ]);
  assert.equal(comparePublicationPaths("same", "same"), 0);
});

test("independent publication operations drain and retain every failure", async () => {
  const first = new Error("first publication failure");
  const second = new Error("second publication failure");
  await assert.rejects(
    completePublicationWork([Promise.reject(first)]),
    (error) => error === first,
  );
  await assert.rejects(
    completePublicationWork([Promise.reject(first), Promise.reject(second)]),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [first, second]);
      return true;
    },
  );
  assert.deepEqual(
    await completePublicationWork([
      Promise.resolve("left"),
      Promise.resolve("right"),
    ]),
    ["left", "right"],
  );
});

test("reviewed cumulative stages cannot mix inventories or activate before application composition", () => {
  for (const [phase, files] of Object.entries(publicationInventories)) {
    const declaration = {
      ...policy(),
      phase,
      applicationReady: publicationReadiness[phase],
      allowedFiles: [...files],
    };
    assert.equal(validateBootstrapPolicy(declaration).size, files.length);
    assert.throws(() =>
      validateBootstrapPolicy({
        ...declaration,
        applicationReady: !declaration.applicationReady,
      }),
    );
    if (!declaration.applicationReady)
      assert.equal(
        files.some((file) => file.startsWith("src/app/")),
        false,
      );
    const foreign = publicationInventories.operations.find(
      (file) => !files.includes(file),
    );
    if (foreign)
      assert.throws(() =>
        validateBootstrapPolicy({
          ...declaration,
          allowedFiles: [...files, foreign],
        }),
      );
  }
});
