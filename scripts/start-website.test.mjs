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

import { startWebsite } from "./start-website.mjs";

async function fixture(t, ready = true) {
  const parent = await realpath(os.tmpdir());
  const root = await realpath(
    await mkdtemp(path.join(parent, "website-owned-start-")),
  );
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("website-owned-start-"));
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
  return { root, put };
}
const environment = () => ({
  NODE_ENV: "production",
  API_BASE_URL: "https://api.example.test",
  HOSTNAME: "127.0.0.1",
  PORT: "43102",
  WEBSITE_URL: "https://website.example.test",
  WEBSITE_INDEXING_ENABLED: "false",
  WEBSITE_CSP_MODE: "enforce",
  NODE_OPTIONS: "--invalid-option",
  ACCESS_TOKEN: "synthetic-disallowed",
});
const childProgram = `const fs=require('node:fs');
fs.writeFileSync('execution.json',JSON.stringify({cwd:process.cwd(),api:process.env.API_BASE_URL,port:process.env.PORT,mode:process.env.NODE_ENV,telemetry:process.env.NEXT_TELEMETRY_DISABLED,token:process.env.ACCESS_TOKEN,nodeOptions:process.env.NODE_OPTIONS,publicAsset:fs.readFileSync('public/asset.txt','utf8'),staticAsset:fs.readFileSync('.next/static/asset.js','utf8')}));`;
async function buildFixture(put, program = childProgram) {
  await put("package.json", JSON.stringify({ type: "commonjs" }));
  await put(".next/BUILD_ID", "owned-synthetic-build");
  await put(".next/standalone/server.js", program);
  await put("public/asset.txt", "owned-public-asset");
  await put(".next/static/asset.js", "owned-static-asset");
}

test(
  "startup prepares actual owned assets and runs an owned Node entry with only explicit public configuration",
  { timeout: 10000 },
  async (t) => {
    const { root, put } = await fixture(t);
    await buildFixture(put);
    const inherited = environment();
    assert.deepEqual(
      await startWebsite({
        root,
        inherited,
        stdio: "ignore",
        signal: AbortSignal.timeout(5000),
      }),
      { code: 0, signal: null },
    );
    assert.deepEqual(
      JSON.parse(
        await readFile(
          path.join(root, ".next/standalone/execution.json"),
          "utf8",
        ),
      ),
      {
        cwd: path.join(root, ".next/standalone"),
        api: "https://api.example.test",
        port: "43102",
        mode: "production",
        telemetry: "1",
        publicAsset: "owned-public-asset",
        staticAsset: "owned-static-asset",
      },
    );
    assert.equal(inherited.NODE_OPTIONS, "--invalid-option");
  },
);

test("startup fails a false phase before reading supplied environment, signal or output options", async (t) => {
  const { root } = await fixture(t, false);
  const options = { root };
  for (const name of ["inherited", "signal", "stdio"])
    Object.defineProperty(options, name, {
      get() {
        throw new Error(`${name} was accessed`);
      },
    });
  await assert.rejects(startWebsite(options), /non-runnable/);
});

test("startup rejects missing public inputs and absent prepared build files", async (t) => {
  const { root } = await fixture(t);
  await assert.rejects(
    startWebsite({ root, inherited: {}, stdio: "ignore" }),
    /NODE_ENV/,
  );
  await assert.rejects(
    startWebsite({ root, inherited: environment(), stdio: "ignore" }),
    /ENOENT/,
  );
});

test("startup validates cancellation before reading settings or preparing assets", async (t) => {
  const { root, put } = await fixture(t);
  await buildFixture(put);
  const controller = new AbortController();
  controller.abort(new Error("owned startup cancelled"));
  const options = { root, signal: controller.signal };
  Object.defineProperty(options, "inherited", {
    get() {
      throw new Error("settings were accessed");
    },
  });
  await assert.rejects(startWebsite(options), /owned startup cancelled/);
  await assert.rejects(
    readFile(path.join(root, ".next/standalone/public/asset.txt")),
    /ENOENT/,
  );
  await assert.rejects(startWebsite({ root, signal: {} }), /AbortSignal/);
});

test(
  "startup reports the actual owned child failure",
  { timeout: 10000 },
  async (t) => {
    const { root, put } = await fixture(t);
    await buildFixture(put, "process.exitCode=7;");
    await assert.rejects(
      startWebsite({
        root,
        inherited: environment(),
        stdio: "ignore",
        signal: AbortSignal.timeout(5000),
      }),
      /7/,
    );
  },
);
