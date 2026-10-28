import assert from "node:assert/strict";
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
async function apiFixture(put, program) {
  await put(
    "api-fixture/package.json",
    JSON.stringify({ name: "kernel-api", type: "module" }),
  );
  await put(
    "api-fixture/src/index.ts",
    "// Owned synthetic marker, not imported.",
  );
  await put("api-fixture/scripts/test-website-api.mjs", program);
}

test(
  "API launcher executes only the explicit owned fixture entry with sanitized API port and environment",
  { timeout: 10000 },
  async (t) => {
    const { root, put, directory, inherited } = await fixture(t);
    await apiFixture(
      put,
      `import {writeFileSync} from 'node:fs';
writeFileSync('execution.json',JSON.stringify({cwd:process.cwd(),port:process.env.PORT,host:process.env.HOSTNAME,synthetic:process.env.KERNEL_SYNTHETIC_ENV,api:process.env.API_BASE_URL,website:process.env.WEBSITE_URL,nodeOptions:process.env.NODE_OPTIONS,database:process.env.DATABASE_URL,token:process.env.TOKEN,fixture:process.env.KERNEL_API_DIRECTORY}));`,
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
    assert.deepEqual(
      JSON.parse(
        await readFile(path.join(directory, "execution.json"), "utf8"),
      ),
      {
        cwd: directory,
        port: "43101",
        host: "127.0.0.1",
        synthetic: "1",
        api: "http://127.0.0.1:43101",
        website: "http://127.0.0.1:43102",
      },
    );
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
    const { root, put, inherited } = await fixture(t);
    await apiFixture(put, "process.exitCode=9;");
    await assert.rejects(
      runWebsiteApi({
        root,
        inherited,
        stdio: "ignore",
        signal: AbortSignal.timeout(5000),
      }),
      /9/,
    );
  },
);
