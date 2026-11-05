import assert from "node:assert/strict";
import childProcess from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createApiFixture } from "./api-fixture-test-support.mjs";
import { abortOnFixtureFile } from "./runner.test-support.mjs";
import { runWebsiteApi } from "./test-website-api.mjs";
async function fixture(t, ready = true) {
  const parent = await realpath(os.tmpdir());
  const root = await realpath(
    await mkdtemp(path.join(parent, "website-owned-api-")),
  );
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("website-owned-api-"));
    await rm(root, { recursive: true, force: true });
  });
  const put = async (name, value) => {
    const filename = path.join(root, name);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, value);
  };
  await put(
    ".github/bootstrap-policy.json",
    JSON.stringify({ schemaVersion: 1, applicationReady: ready }),
  );
  const inherited = {
    NODE_ENV: "production",
    API_BASE_URL: "http://127.0.0.1:43101",
    HOSTNAME: "127.0.0.1",
    PORT: "43102",
    WEBSITE_URL: "http://127.0.0.1:43102",
    WEBSITE_INDEXING_ENABLED: "false",
    KERNEL_SYNTHETIC_ENV: "1",
  };
  return { root, put, inherited };
}
test("HTTP launcher executes only its website-owned entry with a filtered test environment", async (t) => {
  const { root, put, inherited } = await fixture(t);
  for (const key of ["NODE_OPTIONS", "DATABASE_URL", "TOKEN"])
    Object.defineProperty(inherited, key, {
      get() {
        throw new Error("Private input read");
      },
    });
  await createApiFixture(
    put,
    "import {writeFileSync} from 'node:fs';writeFileSync('execution.json',JSON.stringify({cwd:process.cwd(),environment:process.env}));",
  );
  assert.deepEqual(
    await runWebsiteApi({
      root,
      inherited,
      stdio: "ignore",
    }),
    { code: 0, signal: null },
  );
  const { cwd, environment } = JSON.parse(
    await readFile(path.join(root, "execution.json"), "utf8"),
  );
  assert.equal(cwd, root);
  assert.equal(environment.NODE_ENV, "test");
  assert.equal(environment.KERNEL_SYNTHETIC_ENV, "1");
  assert.equal(environment.PORT, "43101");
  assert.equal(environment.WEBSITE_URL, inherited.WEBSITE_URL);
  for (const key of [
    "NODE_OPTIONS",
    "TOKEN",
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "API_BASE_URL",
  ])
    assert.equal(Object.hasOwn(environment, key), false);
  assert.equal(inherited.PORT, "43102");
});
test("HTTP launcher gates readiness before settings and process options", async (t) => {
  const { root } = await fixture(t, false);
  const options = { root };
  for (const name of ["inherited", "signal", "stdio"])
    Object.defineProperty(options, name, {
      get() {
        throw new Error(name + " was accessed");
      },
    });
  await assert.rejects(runWebsiteApi(options), /non-runnable/);
});
test("HTTP launcher rejects absent synthetic opt-in and a missing local responder", async (t) => {
  const { root, inherited } = await fixture(t);
  await assert.rejects(
    runWebsiteApi({ root, inherited: {}, stdio: "ignore" }),
    /KERNEL_SYNTHETIC_ENV/,
  );
  await assert.rejects(
    runWebsiteApi({ root, inherited, stdio: "ignore" }),
    /ENOENT/,
  );
});
test("HTTP launcher validates cancellation before reading settings", async (t) => {
  const { root } = await fixture(t);
  const controller = new AbortController();
  controller.abort(new Error("owned HTTP fixture cancelled"));
  const options = { root, signal: controller.signal };
  Object.defineProperty(options, "inherited", {
    get() {
      throw new Error("settings accessed");
    },
  });
  await assert.rejects(runWebsiteApi(options), /owned HTTP fixture cancelled/);
  await assert.rejects(runWebsiteApi({ root, signal: {} }), /AbortSignal/);
});
test("HTTP launcher propagates the actual child exit failure", async (t) => {
  const { root, put, inherited } = await fixture(t);
  await createApiFixture(put, "process.exitCode=9;");
  await assert.rejects(
    runWebsiteApi({
      root,
      inherited,
      stdio: "ignore",
    }),
    /9/,
  );
});
test("cancelling the owned responder drains its child", async (t) => {
  const { root, put, inherited } = await fixture(t);
  await createApiFixture(
    put,
    "import{writeFileSync,renameSync}from'node:fs';process.stdin.resume();writeFileSync('started.tmp','owned');renameSync('started.tmp','started');",
  );
  const controller = new AbortController();
  const spawn = childProcess.spawn;
  const children = [];
  let closeObserved = false;
  const observedSpawn = t.mock.method(childProcess, "spawn", (...args) => {
    const child = spawn(...args);
    children.push(child);
    child.once("close", () => {
      closeObserved = true;
    });
    return child;
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(
      abortOnFixtureFile(root, "started", controller, () =>
        runWebsiteApi({
          root,
          inherited,
          stdio: ["pipe", "ignore", "ignore"],
          signal: controller.signal,
        }),
      ),
      /aborted/,
    );
    assert.equal(children.length, 1);
    assert.equal(closeObserved, true);
    assert.ok(children[0].exitCode !== null || children[0].signalCode !== null);
  } finally {
    observedSpawn.mock.restore();
    syncBuiltinESMExports();
  }
  assert.equal(await readFile(path.join(root, "started"), "utf8"), "owned");
});
