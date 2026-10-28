import assert from "node:assert/strict";
import { watch } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { createApiFixture } from "./api-fixture-test-support.mjs";
import { apiFixtureRevision } from "./runner-inputs.mjs";
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
  const directory = path.join(root, "api-fixture");
  const inherited = {
    NODE_ENV: "production",
    API_BASE_URL: "http://127.0.0.1:43101",
    HOSTNAME: "127.0.0.1",
    PORT: "43102",
    WEBSITE_URL: "http://127.0.0.1:43102",
    WEBSITE_INDEXING_ENABLED: "false",
    KERNEL_SYNTHETIC_ENV: "1",
    KERNEL_API_DIRECTORY: directory,
    NODE_OPTIONS: "--invalid-option",
    DATABASE_URL: "synthetic-disallowed",
    TOKEN: "synthetic-disallowed",
  };
  return { root, put, directory, inherited };
}
test(
  "API launcher executes only the explicit owned fixture entry with sanitized API port and environment",
  { timeout: 10000 },
  async (t) => {
    const { root, put, directory, inherited } = await fixture(t);
    await createApiFixture(
      t,
      put,
      directory,
      `import {writeFileSync} from 'node:fs';
const keys=['NODE_ENV','HOST','PORT','BETTER_AUTH_URL','SERVER_ALLOWED_ORIGIN','BETTER_AUTH_SECRET','DATABASE_URL','LOCAL_STORAGE_PATH','SERVER_SEED_DEVELOPMENT_DATA','OTP_FIXED_CODE','STORAGE_DRIVER','SERVER_ENVIRONMENT','SERVER_RELEASE_ID','LOG_LEVEL','TEMP','TMP','API_BASE_URL','WEBSITE_URL','NODE_OPTIONS','TOKEN','KERNEL_API_DIRECTORY'];writeFileSync('execution.json',JSON.stringify({cwd:process.cwd(),environment:Object.fromEntries(keys.map(key=>[key,process.env[key]]))}));`,
    );
    assert.deepEqual(
      await runWebsiteApi({
        root,
        inherited,
        stdio: "ignore",
        signal: AbortSignal.timeout(5000),
      }),
      { code: 0, signal: null },
    );
    const execution = JSON.parse(
      await readFile(path.join(directory, "execution.json"), "utf8"),
    );
    assert.equal(execution.cwd, directory);
    const {
      BETTER_AUTH_SECRET,
      DATABASE_URL,
      LOCAL_STORAGE_PATH,
      TEMP,
      TMP,
      ...publicValues
    } = execution.environment;
    assert.match(BETTER_AUTH_SECRET, /^[a-f0-9]{64}$/);
    assert.deepEqual(publicValues, {
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "43101",
      BETTER_AUTH_URL: "http://127.0.0.1:43101",
      SERVER_ALLOWED_ORIGIN: "http://127.0.0.1:43102",
      SERVER_SEED_DEVELOPMENT_DATA: "true",
      OTP_FIXED_CODE: "123456",
      STORAGE_DRIVER: "local",
      SERVER_ENVIRONMENT: "website-synthetic",
      SERVER_RELEASE_ID: apiFixtureRevision,
      LOG_LEVEL: "error",
    });
    assert.equal(TEMP, TMP);
    assert.match(path.basename(TEMP), /^website-api-state-/);
    assert.equal(fileURLToPath(DATABASE_URL), path.join(TEMP, "api.sqlite"));
    assert.equal(LOCAL_STORAGE_PATH, path.join(TEMP, "objects"));
    await assert.rejects(readFile(fileURLToPath(DATABASE_URL)), /ENOENT/);
    await assert.rejects(realpath(TEMP), /ENOENT/);
    assert.equal(inherited.PORT, "43102");
    assert.equal(inherited.NODE_OPTIONS, "--invalid-option");
  },
);

test("API launcher gates the false phase before reading fixture selection or process options", async (t) => {
  const { root } = await fixture(t, false);
  const options = { root };
  for (const name of ["inherited", "signal", "stdio"])
    Object.defineProperty(options, name, {
      get() {
        throw new Error(`${name} was accessed`);
      },
    });
  await assert.rejects(runWebsiteApi(options), /non-runnable/);
});

test("API launcher refuses absent synthetic opt-in, implicit fixture discovery and missing fixed entries", async (t) => {
  const { root, put, inherited } = await fixture(t);
  await assert.rejects(
    runWebsiteApi({ root, inherited: {}, stdio: "ignore" }),
    /KERNEL_SYNTHETIC_ENV/,
  );
  await assert.rejects(
    runWebsiteApi({
      root,
      inherited: { ...inherited, KERNEL_API_DIRECTORY: undefined },
      stdio: "ignore",
    }),
    /explicit clean synthetic/,
  );
  await put("api-fixture/package.json", JSON.stringify({ name: "kernel-api" }));
  await put("api-fixture/src/index.ts", "// owned fixture");
  await assert.rejects(
    runWebsiteApi({ root, inherited, stdio: "ignore" }),
    /ENOENT/,
  );
});

test("API launcher validates cancellation before reading settings or selecting the fixture", async (t) => {
  const { root } = await fixture(t);
  const controller = new AbortController();
  controller.abort(new Error("owned API fixture cancelled"));
  const options = { root, signal: controller.signal };
  Object.defineProperty(options, "inherited", {
    get() {
      throw new Error("settings were accessed");
    },
  });
  await assert.rejects(runWebsiteApi(options), /owned API fixture cancelled/);
  await assert.rejects(runWebsiteApi({ root, signal: {} }), /AbortSignal/);
});

test(
  "API launcher propagates an actual owned fixture failure",
  { timeout: 10000 },
  async (t) => {
    const { root, put, directory, inherited } = await fixture(t);
    await createApiFixture(
      t,
      put,
      directory,
      "import{writeFileSync}from'node:fs';writeFileSync('failed-state',process.env.TEMP);process.exitCode=9;",
    );
    await assert.rejects(
      runWebsiteApi({
        root,
        inherited,
        stdio: "ignore",
        signal: AbortSignal.timeout(5000),
      }),
      /9/,
    );
    const state = await readFile(path.join(directory, "failed-state"), "utf8");
    await assert.rejects(realpath(state), /ENOENT/);
  },
);

test(
  "cancelling an actual owned API child drains it before removing fresh state",
  { timeout: 10000 },
  async (t) => {
    const { root, put, directory, inherited } = await fixture(t);
    await createApiFixture(
      t,
      put,
      directory,
      "import{writeFileSync,renameSync}from'node:fs';writeFileSync('started.tmp',process.env.TEMP);renameSync('started.tmp','started');setInterval(()=>{},60000);",
    );
    const controller = new AbortController();
    const watcher = watch(directory, (_event, name) => {
      if (String(name) === "started") controller.abort();
    });
    try {
      await assert.rejects(
        runWebsiteApi({
          root,
          inherited,
          stdio: "ignore",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(8000),
          ]),
        }),
        /aborted/,
      );
    } finally {
      watcher.close();
    }
    const state = await readFile(path.join(directory, "started"), "utf8");
    assert.match(path.basename(state), /^website-api-state-/);
    await assert.rejects(realpath(state), /ENOENT/);
  },
);
