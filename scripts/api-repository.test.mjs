import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { apiRepository } from "./api-repository.mjs";

const environment = (directory) => ({
  KERNEL_API_DIRECTORY: directory,
  KERNEL_SYNTHETIC_ENV: "1",
});
async function fixture(t) {
  const root = await realpath(
    await mkdtemp(path.join(tmpdir(), "website-api-location-")),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "fixture");
  await mkdir(path.join(directory, "src"), { recursive: true });
  await writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({ name: "kernel-api" }),
  );
  await writeFile(
    path.join(directory, "src/index.ts"),
    "// Synthetic path fixture; never executed.\n",
  );
  return { root, directory };
}

test("API selection requires an explicit absolute synthetic fixture instead of a sibling fallback", () => {
  for (const input of [
    {},
    { KERNEL_API_DIRECTORY: "../kernel-api" },
    { KERNEL_SYNTHETIC_ENV: "1" },
    environment(""),
    environment("relative/fixture"),
    environment("//server/fixture"),
    { ...environment(path.resolve("missing")), KERNEL_SYNTHETIC_ENV: "0" },
  ])
    assert.throws(
      () => apiRepository(input),
      /explicit clean synthetic kernel-api fixture/,
    );
});

test("API selection accepts only the declared synthetic package and source entry", async (t) => {
  const { directory } = await fixture(t);
  await writeFile(
    path.join(directory, ".env.example"),
    "SYNTHETIC_EXAMPLE=not-loaded\n",
  );
  assert.equal(apiRepository(environment(directory)), directory);
  for (const manifest of [{ name: "unrelated" }, null, {}, ["kernel-api"]]) {
    await writeFile(
      path.join(directory, "package.json"),
      JSON.stringify(manifest),
    );
    assert.throws(
      () => apiRepository(environment(directory)),
      /explicit clean synthetic/,
    );
  }
  await writeFile(path.join(directory, "package.json"), "not JSON");
  assert.throws(
    () => apiRepository(environment(directory)),
    /explicit clean synthetic/,
  );
  await writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({ name: "kernel-api" }),
  );
  await rm(path.join(directory, "src/index.ts"));
  assert.throws(() => apiRepository(environment(directory)), /ENOENT/);
  await mkdir(path.join(directory, "src/index.ts"));
  assert.throws(
    () => apiRepository(environment(directory)),
    /explicit clean synthetic/,
  );
});

test("API fixture dotenv state is rejected by presence without loading its contents", async (t) => {
  const { directory } = await fixture(t);
  await writeFile(
    path.join(directory, ".env.local"),
    "SYNTHETIC_ONLY=must-not-be-loaded\n",
  );
  assert.throws(
    () => apiRepository(environment(directory)),
    /explicit clean synthetic/,
  );
});

test("API fixture directory aliases and linked source ancestors are rejected", async (t) => {
  const { root, directory } = await fixture(t);
  const alias = path.join(root, "alias");
  await symlink(directory, alias, "junction");
  assert.throws(
    () => apiRepository(environment(alias)),
    /explicit clean synthetic/,
  );
  const original = path.join(directory, "actual-source");
  await rename(path.join(directory, "src"), original);
  await symlink(original, path.join(directory, "src"), "junction");
  assert.throws(
    () => apiRepository(environment(directory)),
    /explicit clean synthetic/,
  );
});
