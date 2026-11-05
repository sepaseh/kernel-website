import assert from "node:assert/strict";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { prepareStandalone } from "./prepare-standalone.mjs";

async function fixture(t, ready = true) {
  const root = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "website-standalone-")),
  );
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

test("preparation removes deleted assets while preserving the standalone server and dependencies", async (t) => {
  const { root, put } = await fixture(t);
  await put("public/deleted/nested.txt", "obsolete public asset");
  await put(".next/static/deleted/nested.js", "obsolete static asset");
  await put(
    ".next/standalone/node_modules/dependency/index.js",
    "owned dependency",
  );
  await put(".next/standalone/.next/server/route.js", "owned server route");
  await prepareStandalone(root);
  await rm(path.join(root, "public/deleted"), { recursive: true });
  await rm(path.join(root, ".next/static/deleted"), { recursive: true });
  await put("public/current.txt", "current public asset");
  await put(".next/static/current.js", "current static asset");

  await prepareStandalone(root);

  for (const name of ["public/deleted", ".next/static/deleted"])
    await assert.rejects(lstat(path.join(root, ".next/standalone", name)), {
      code: "ENOENT",
    });
  for (const [name, expected] of [
    ["server.js", "// Synthetic fixture; not executed."],
    ["node_modules/dependency/index.js", "owned dependency"],
    [".next/server/route.js", "owned server route"],
    ["public/current.txt", "current public asset"],
    [".next/static/current.js", "current static asset"],
  ])
    assert.equal(
      await readFile(path.join(root, ".next/standalone", name), "utf8"),
      expected,
    );
});

test("all asset destinations and ancestors are validated before any previous copy is removed", async (t) => {
  for (const name of ["public", ".next", ".next/static"])
    for (const kind of ["linked", "file"])
      await t.test(`${name} ${kind}`, async (context) => {
        const { root, put } = await fixture(context);
        const standalone = path.join(root, ".next/standalone");
        const actual = path.join(root, "unrelated");
        await put("unrelated/sentinel.txt", "preserve unrelated bytes");
        const other = name === "public" ? ".next/static" : "public";
        await put(
          `.next/standalone/${other}/previous.txt`,
          "preserve previous copy",
        );
        const invalid = path.join(standalone, name);
        await mkdir(path.dirname(invalid), { recursive: true });
        if (kind === "linked") await symlink(actual, invalid, "junction");
        else await writeFile(invalid, "preserve non-directory bytes");

        await assert.rejects(prepareStandalone(root), /links|non-directory/);

        assert.equal(
          await readFile(path.join(actual, "sentinel.txt"), "utf8"),
          "preserve unrelated bytes",
        );
        assert.equal(
          await readFile(path.join(standalone, other, "previous.txt"), "utf8"),
          "preserve previous copy",
        );
        if (kind === "file")
          assert.equal(
            await readFile(invalid, "utf8"),
            "preserve non-directory bytes",
          );
      });
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
