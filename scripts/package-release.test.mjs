import assert from "node:assert/strict";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { packageRelease, parseReleaseArguments } from "./package-release.mjs";

async function fixture(context) {
  const temporary = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "kernel-package-release-")),
  );
  context.after(() => rm(temporary, { recursive: true, force: true }));
  const repository = path.join(temporary, "repository");
  const put = async (file, value = "synthetic fixture") => {
    const target = path.join(repository, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, value);
  };
  await put(
    ".github/bootstrap-policy.json",
    JSON.stringify({ schemaVersion: 1, applicationReady: true }),
  );
  await put(
    "package.json",
    JSON.stringify({ name: "kernel-website", private: true }),
  );
  await put(
    "package-lock.json",
    JSON.stringify({
      lockfileVersion: 3,
      packages: { "": { name: "kernel-website" } },
    }),
  );
  for (const file of [
    "src/index.ts",
    "drizzle/0000_init.sql",
    "drizzle/meta/_journal.json",
    "src/shared/contracts/index.ts",
    "src/i18n/catalog-data/locales/en.ts",
    "scripts/healthcheck.mjs",
    "scripts/release-files.mjs",
    "scripts/validate-deployment-env.mjs",
    ".next/standalone/server.js",
    ".next/standalone/node_modules/next/package.json",
    ".next/static/chunks/main.js",
    "public/fonts/font.woff2",
    "unrelated-output/index.html",
    "unrelated-output/assets/app.js",
  ])
    await put(file);
  for (const filename of [
    "healthcheck.mjs",
    "release-files.mjs",
    "validate-deployment-env.mjs",
  ])
    await copyFile(
      new URL(`./${filename}`, import.meta.url),
      path.join(repository, "scripts", filename),
    );
  await put(".next/BUILD_ID", "fixture-build");
  return { temporary, repository, put };
}

async function inventory(root, prefix = "") {
  const result = [];
  for (const entry of await readdir(path.join(root, prefix), {
    withFileTypes: true,
  })) {
    const relative = path.posix.join(prefix, entry.name);
    result.push(relative);
    if (entry.isDirectory()) result.push(...(await inventory(root, relative)));
  }
  return result;
}

test("accepts both explicit release arguments and rejects traversal or ambiguous flags", () => {
  assert.equal(
    parseReleaseArguments(["--release=2026-10-23.abc_123"]),
    "2026-10-23.abc_123",
  );
  assert.equal(parseReleaseArguments(["--release", "abc123"]), "abc123");
  for (const args of [
    [],
    ["--release"],
    ["--other=x"],
    ["--release=a", "--release=b"],
    ["--release=../escape"],
    ["--release=/absolute"],
    ["--release=a/b"],
    ["--release=a\\b"],
    ["--release=a..b"],
    ["--release="],
  ])
    assert.throws(() => parseReleaseArguments(args));
});

test("packages standalone assets and a release marker without env, state, source apps or tests", async (context) => {
  const { repository, put } = await fixture(context);
  for (const file of [
    ".env.local",
    "server/data/kernel.sqlite",
    ".next/standalone/.env",
    ".next/standalone/.ENV.PRODUCTION",
    ".next/standalone/.env.production",
    ".next/standalone/.next/cache/image",
    "public/.env.example",
    ".next/standalone/private.key",
    ".next/standalone/catalogs.test.ts",
  ])
    await put(file);
  const { directory, release } = await packageRelease({
    repositoryRoot: repository,
    releaseId: "fixture-1",
  });
  assert.equal(release.platform, process.platform);
  assert.equal(release.arch, process.arch);
  assert.equal(release.nodeVersion, process.versions.node);
  assert.equal(release.websiteBuildId, "fixture-build");
  assert.equal(release.runtimeDependenciesBundled, true);
  for (const file of [
    "scripts/healthcheck.mjs",
    "scripts/release-files.mjs",
    "scripts/validate-deployment-env.mjs",
    ".github/bootstrap-policy.json",
    "website/server.js",
    "website/node_modules/next/package.json",
    "website/.next/static/chunks/main.js",
    "website/public/fonts/font.woff2",
  ])
    await access(path.join(directory, file));
  const files = await inventory(directory);
  assert.ok(
    !files.some((file) =>
      /\.env|\.sqlite|\.key$|\.test\.|(?:^|\/)test\/|\/cache\//i.test(file),
    ),
  );
  assert.ok(
    !files.some((file) => file.startsWith("api/") || file.startsWith("admin/")),
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(directory, "release.json"), "utf8")),
    release,
  );
});

test("refuses overwriting an existing release", async (context) => {
  const { repository } = await fixture(context);
  const options = { repositoryRoot: repository, releaseId: "immutable" };
  const { directory } = await packageRelease(options);
  const before = await readFile(path.join(directory, "release.json"), "utf8");
  await assert.rejects(packageRelease(options), { code: "EEXIST" });
  assert.equal(
    await readFile(path.join(directory, "release.json"), "utf8"),
    before,
  );
});

test("packages a prepared standalone build using the current public and static assets", async (context) => {
  const { repository, put } = await fixture(context);
  await put(
    ".next/standalone/public/fonts/font.woff2",
    "stale prepared public asset",
  );
  await put(
    ".next/standalone/.next/static/chunks/main.js",
    "stale prepared static asset",
  );
  const { directory } = await packageRelease({
    repositoryRoot: repository,
    releaseId: "prepared",
  });
  for (const file of ["public/fonts/font.woff2", ".next/static/chunks/main.js"])
    assert.equal(
      await readFile(path.join(directory, "website", file), "utf8"),
      "synthetic fixture",
    );
});

test("missing Next standalone output fails before creating a release", async (context) => {
  const { repository } = await fixture(context);
  await rm(path.join(repository, ".next/standalone/server.js"));
  await assert.rejects(
    packageRelease({ repositoryRoot: repository, releaseId: "missing" }),
  );
  await assert.rejects(access(path.join(repository, "dist/releases/missing")), {
    code: "ENOENT",
  });
});

test("rejects standalone links that escape the traced tree", async (context) => {
  const { repository, put } = await fixture(context);
  await put("outside/runtime.js");
  await symlink(
    path.join(repository, "outside"),
    path.join(repository, ".next/standalone/escaped"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(
    packageRelease({ repositoryRoot: repository, releaseId: "link" }),
    /outside its source tree/,
  );
});

test("rejects a top-level standalone junction outside the repository", async (context) => {
  const { repository, temporary } = await fixture(context);
  const standalone = path.join(repository, ".next/standalone");
  const outside = path.join(temporary, "outside-standalone");
  await rename(standalone, outside);
  await symlink(
    outside,
    standalone,
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(
    packageRelease({ repositoryRoot: repository, releaseId: "outside" }),
    /links|inside the repository/,
  );
  await assert.rejects(access(path.join(repository, "dist/releases/outside")), {
    code: "ENOENT",
  });
});

test("copies safe internal dependency links as self-contained directories", async (context) => {
  const { repository, put } = await fixture(context);
  const standalone = path.join(repository, ".next/standalone");
  await put(
    ".next/standalone/dependencies/shared/index.js",
    "export const value = 1;",
  );
  await symlink(
    path.join(standalone, "dependencies/shared"),
    path.join(standalone, "node_modules/shared"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const { directory } = await packageRelease({
    repositoryRoot: repository,
    releaseId: "internal-link",
  });
  assert.equal(
    await readFile(
      path.join(directory, "website/node_modules/shared/index.js"),
      "utf8",
    ),
    "export const value = 1;",
  );
});

test("rejects an output symlink before creating directories outside the repository", async (context) => {
  const { repository, temporary } = await fixture(context);
  const outside = path.join(temporary, "outside");
  await mkdir(outside);
  await symlink(
    outside,
    path.join(repository, "dist"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(
    packageRelease({ repositoryRoot: repository, releaseId: "escaped" }),
    /links|inside the repository/,
  );
  assert.deepEqual(await readdir(outside), []);
});

test("a non-runnable source refuses packaging before it creates release outputs", async (context) => {
  const { repository, put } = await fixture(context);
  await put(
    ".github/bootstrap-policy.json",
    JSON.stringify({ schemaVersion: 1, applicationReady: false }),
  );
  await assert.rejects(
    packageRelease({ repositoryRoot: repository, releaseId: "blocked" }),
    /non-runnable/,
  );
  await assert.rejects(access(path.join(repository, "dist")), {
    code: "ENOENT",
  });
});
