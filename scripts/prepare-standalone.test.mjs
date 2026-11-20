import assert from "node:assert/strict";
import fsPromises, {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
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

async function postcssFixture(t) {
  const data = await fixture(t);
  await data.put(
    "package-lock.json",
    JSON.stringify({
      packages: { "node_modules/postcss": { version: "8.5.32" } },
    }),
  );
  const aliases = [];
  for (const [tree, text] of [
    ["", "full producer package"],
    [".next/standalone/", "smaller traced package"],
  ]) {
    const target = path.join(data.root, tree, "node_modules/postcss");
    const alias = path.join(
      data.root,
      tree,
      ".next/node_modules/postcss-0123456789abcdef",
    );
    await data.put(
      `${tree}node_modules/postcss/package.json`,
      JSON.stringify({ name: "postcss", version: "8.5.32" }),
    );
    await data.put(`${tree}node_modules/postcss/index.js`, text);
    await mkdir(path.dirname(alias), { recursive: true });
    await symlink(target, alias, "junction");
    aliases.push({ alias, target, text });
  }
  return { ...data, aliases };
}

test("preparation materializes each exact PostCSS alias from its own locked ordinary package", async (t) => {
  const { root, aliases } = await postcssFixture(t);
  await prepareStandalone(root);
  for (const { alias, target, text } of aliases) {
    assert.equal((await lstat(alias)).isSymbolicLink(), false);
    assert.equal(await readFile(path.join(alias, "index.js"), "utf8"), text);
    assert.equal(await readFile(path.join(target, "index.js"), "utf8"), text);
  }
  await prepareStandalone(root);
  for (const { alias } of aliases)
    assert.equal((await lstat(alias)).isDirectory(), true);
});

for (const missingTarget of [false, true])
  test(`PostCSS preflight preserves both aliases when the second alias ${missingTarget ? "cannot be resolved" : "resolves to another package"}`, async (t) => {
    const { root, put, aliases } = await postcssFixture(t);
    const secondAlias = aliases[1].alias;
    const previousAsset = ".next/standalone/public/previous.txt";
    await put(previousAsset, "preserve old assets");
    const failure = Object.assign(new Error("synthetic resolution failure"), {
      code: "ENOENT",
    });
    const original = fsPromises.realpath;
    const lookup = t.mock.method(
      fsPromises,
      "realpath",
      (filename, options) => {
        if (filename !== secondAlias) return original(filename, options);
        return missingTarget
          ? Promise.reject(failure)
          : Promise.resolve(aliases[0].target);
      },
    );
    syncBuiltinESMExports();
    try {
      await assert.rejects(
        prepareStandalone(root),
        missingTarget ? (error) => error === failure : /exact package/,
      );
    } finally {
      lookup.mock.restore();
      syncBuiltinESMExports();
    }
    for (const { alias } of aliases)
      assert.equal((await lstat(alias)).isSymbolicLink(), true);
    assert.equal(
      await readFile(path.join(root, previousAsset), "utf8"),
      "preserve old assets",
    );
  });

for (const invalid of ["target", "name", "version", "nested link", "size"])
  test(`PostCSS ${invalid} preflight rejects before replacing either alias or existing assets`, async (t) => {
    const { root, put, aliases } = await postcssFixture(t);
    const { alias, target } = aliases[1];
    await put(".next/standalone/public/previous.txt", "preserve old assets");
    if (invalid === "target") {
      await mkdir(path.join(root, "unrelated"));
      await unlink(alias);
      await symlink(path.join(root, "unrelated"), alias, "junction");
    } else if (invalid === "nested link") {
      await symlink(aliases[0].target, path.join(target, "nested"), "junction");
    } else if (invalid === "size") {
      await writeFile(
        path.join(target, "oversized.bin"),
        Buffer.alloc(16 * 1024 * 1024 + 1),
      );
    } else {
      await writeFile(
        path.join(target, "package.json"),
        JSON.stringify({
          name: invalid === "name" ? "other-package" : "postcss",
          version: invalid === "version" ? "8.5.31" : "8.5.32",
        }),
      );
    }
    await assert.rejects(
      prepareStandalone(root),
      /exact package|contain links|root lock|byte budget/,
    );
    for (const entry of aliases) {
      assert.equal((await lstat(entry.alias)).isSymbolicLink(), true);
      assert.equal(
        await readFile(path.join(entry.target, "index.js"), "utf8"),
        entry.text,
      );
    }
    assert.equal(
      await readFile(
        path.join(root, ".next/standalone/public/previous.txt"),
        "utf8",
      ),
      "preserve old assets",
    );
  });

test("PostCSS preflight includes the root in the second tree's entry budget", async (t) => {
  const { root, put, aliases } = await postcssFixture(t);
  const { target } = aliases[1];
  const previousAsset = ".next/standalone/public/previous.txt";
  const entryLimit = 4096;
  await put(previousAsset, "preserve old assets");
  const existingEntries = (await readdir(target)).length;
  for (let index = existingEntries; index < entryLimit; index++)
    await writeFile(path.join(target, `fixture-${index}.txt`), "");

  await assert.rejects(
    prepareStandalone(root),
    /PostCSS package exceeds its entry budget/,
  );
  for (const { alias } of aliases)
    assert.equal((await lstat(alias)).isSymbolicLink(), true);
  assert.equal(
    await readFile(path.join(root, previousAsset), "utf8"),
    "preserve old assets",
  );

  await unlink(path.join(target, `fixture-${entryLimit - 1}.txt`));
  await prepareStandalone(root);
  for (const { alias } of aliases)
    assert.equal((await lstat(alias)).isSymbolicLink(), false);
  assert.equal((await readdir(aliases[1].alias)).length, entryLimit - 1);
});

test("PostCSS cleanup gives Node bounded retries for removing each owned stage", async (t) => {
  const { root, aliases } = await postcssFixture(t);
  const original = fsPromises.rm;
  const removal = t.mock.method(fsPromises, "rm", original);
  syncBuiltinESMExports();
  try {
    await prepareStandalone(root);
  } finally {
    removal.mock.restore();
    syncBuiltinESMExports();
  }
  const stageRemovals = removal.mock.calls.filter(({ arguments: [filename] }) =>
    path.basename(filename).startsWith(".kernel-postcss-"),
  );
  assert.equal(stageRemovals.length, aliases.length);
  for (const [
    index,
    {
      arguments: [stage, options],
    },
  ] of stageRemovals.entries()) {
    assert.equal(path.dirname(stage), path.dirname(aliases[index].alias));
    assert.deepEqual(options, { recursive: true, maxRetries: 3 });
    await assert.rejects(lstat(stage), { code: "ENOENT" });
  }
});

test("a failed staged PostCSS copy preserves the junction and target and removes only its own stage", async (t) => {
  const { root, aliases } = await postcssFixture(t);
  const failure = new Error("synthetic copy failure");
  const original = fsPromises.copyFile;
  const copying = t.mock.method(
    fsPromises,
    "copyFile",
    (source, destination, flags) =>
      destination.includes(".kernel-postcss-")
        ? Promise.reject(failure)
        : original(source, destination, flags),
  );
  syncBuiltinESMExports();
  try {
    await assert.rejects(prepareStandalone(root), (error) => error === failure);
  } finally {
    copying.mock.restore();
    syncBuiltinESMExports();
  }
  for (const { alias, target, text } of aliases) {
    assert.equal((await lstat(alias)).isSymbolicLink(), true);
    assert.equal(path.relative(target, await readlink(alias)), "");
    assert.equal(await readFile(path.join(target, "index.js"), "utf8"), text);
    assert.ok(
      !(await readdir(path.dirname(alias))).some((name) =>
        name.startsWith(".kernel-postcss-"),
      ),
    );
  }
});

for (const rollbackFails of [false, true])
  test(`a failed PostCSS publication ${rollbackFails ? "retains its backup if rollback fails" : "restores the original alias and allows a retry"}`, async (t) => {
    const { root, aliases } = await postcssFixture(t);
    const { alias, target } = aliases[0];
    const identity = await lstat(alias, { bigint: true });
    const link = await readlink(alias);
    const publicationFailure = new Error("synthetic publication failure");
    const rollbackFailure = new Error("synthetic rollback failure");
    const original = fsPromises.rename;
    const renaming = t.mock.method(fsPromises, "rename", (from, to) => {
      if (to === alias && path.basename(from) === "package")
        return Promise.reject(publicationFailure);
      if (rollbackFails && to === alias && path.basename(from) === "original")
        return Promise.reject(rollbackFailure);
      return original(from, to);
    });
    syncBuiltinESMExports();

    try {
      await assert.rejects(prepareStandalone(root), (error) => {
        if (!rollbackFails) return error === publicationFailure;
        assert.ok(error instanceof AggregateError);
        assert.equal(error.cause, publicationFailure);
        assert.deepEqual(error.errors, [publicationFailure, rollbackFailure]);
        return true;
      });
    } finally {
      renaming.mock.restore();
      syncBuiltinESMExports();
    }

    const parent = path.dirname(alias);
    const stages = (await readdir(parent)).filter((name) =>
      name.startsWith(".kernel-postcss-"),
    );
    assert.equal(
      await readFile(path.join(target, "index.js"), "utf8"),
      aliases[0].text,
    );
    assert.equal((await lstat(aliases[1].alias)).isSymbolicLink(), true);
    if (rollbackFails) {
      await assert.rejects(lstat(alias), { code: "ENOENT" });
      assert.equal(stages.length, 1);
      assert.equal(
        await readlink(path.join(parent, stages[0], "original")),
        link,
      );
      await assert.rejects(prepareStandalone(root), /requires a clean build/);
      return;
    }

    assert.deepEqual(stages, []);
    const restored = await lstat(alias, { bigint: true });
    assert.equal(restored.ino, identity.ino);
    assert.equal(await readlink(alias), link);

    await prepareStandalone(root);
    for (const entry of aliases) {
      assert.equal((await lstat(entry.alias)).isDirectory(), true);
      assert.equal(
        await readFile(path.join(entry.alias, "index.js"), "utf8"),
        entry.text,
      );
    }
  });

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
