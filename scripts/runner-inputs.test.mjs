import assert from "node:assert/strict";
import {
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

import { createApiFixture } from "./api-fixture-test-support.mjs";
import {
  apiFixtureRevision,
  readyRunnerRoot,
  resolveApiFixture,
  resolveNextCli,
  syntheticRunnerInputs,
  websiteRunnerEnvironment,
} from "./runner-inputs.mjs";

async function fixture(t, ready = true) {
  const parent = await realpath(os.tmpdir());
  const root = await realpath(
    await mkdtemp(path.join(parent, "website-runner-inputs-")),
  );
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("website-runner-inputs-"));
    await rm(root, { recursive: true, force: true });
  });
  const put = async (name, value) => {
    const filename = path.join(root, name);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(
      filename,
      typeof value === "string" ? value : JSON.stringify(value),
    );
  };
  await put(".github/bootstrap-policy.json", {
    schemaVersion: 1,
    applicationReady: ready,
  });
  return { root, put };
}
const environment = () => ({
  NODE_ENV: "production",
  API_BASE_URL: "http://127.0.0.1:43101",
  HOSTNAME: "127.0.0.1",
  PORT: "43102",
  WEBSITE_URL: "http://127.0.0.1:43102",
  WEBSITE_INDEXING_ENABLED: "false",
  WEBSITE_CSP_MODE: "enforce",
  KERNEL_SYNTHETIC_ENV: "1",
  PATH: "synthetic-path",
  SystemRoot: "synthetic-system",
  TEMP: "synthetic-temp",
  TMP: "synthetic-tmp",
});
async function nextFixture(put) {
  await put("package.json", {
    name: "kernel-website",
    dependencies: { next: "16.4.3" },
  });
  await put("package-lock.json", {
    lockfileVersion: 3,
    packages: {
      "": { name: "kernel-website", dependencies: { next: "16.4.3" } },
      "node_modules/next": { version: "16.4.3" },
    },
  });
  await put("node_modules/next/package.json", {
    name: "next",
    version: "16.4.3",
  });
  await put(
    "node_modules/next/dist/bin/next",
    "// Owned synthetic CLI, not Next.js.",
  );
}

test("every input operation gates a false phase before environment or dependency access", async (t) => {
  const { root } = await fixture(t, false);
  const poison = new Proxy(
    {},
    {
      get() {
        throw new Error("environment was accessed");
      },
    },
  );
  for (const operation of [
    readyRunnerRoot,
    resolveNextCli,
    websiteRunnerEnvironment,
    syntheticRunnerInputs,
    resolveApiFixture,
  ])
    await assert.rejects(operation(root, poison), /non-runnable/);
});

test("public runner environment is explicit, allowlisted and leaves the source untouched", async (t) => {
  const { root } = await fixture(t);
  const inherited = {
    ...environment(),
    TOKEN: "synthetic-private",
    NODE_OPTIONS: "--invalid",
    DATABASE_URL: "synthetic-private",
    API_SECRET: "synthetic-private",
    HTTPS_PROXY: "synthetic-private",
    CI: "unexpected",
  };
  Object.defineProperty(inherited, "AWS_SECRET_ACCESS_KEY", {
    get() {
      throw new Error("unlisted property read");
    },
  });
  const result = await websiteRunnerEnvironment(root, inherited);
  assert.deepEqual(result, {
    PATH: "synthetic-path",
    SystemRoot: "synthetic-system",
    TEMP: "synthetic-temp",
    TMP: "synthetic-tmp",
    NODE_ENV: "production",
    API_BASE_URL: "http://127.0.0.1:43101",
    HOSTNAME: "127.0.0.1",
    PORT: "43102",
    WEBSITE_URL: "http://127.0.0.1:43102",
    WEBSITE_INDEXING_ENABLED: "false",
    WEBSITE_CSP_MODE: "enforce",
    NEXT_TELEMETRY_DISABLED: "1",
  });
  assert.equal(inherited.NODE_OPTIONS, "--invalid");
  assert.equal(Object.hasOwn(inherited, "NEXT_TELEMETRY_DISABLED"), false);
  assert.equal(await readyRunnerRoot(root), root);
});

test("public inputs reject missing, malformed and incompatible deployment settings", async (t) => {
  const { root } = await fixture(t);
  for (const key of ["NODE_ENV", "API_BASE_URL", "HOSTNAME", "PORT"]) {
    const inherited = environment();
    delete inherited[key];
    await assert.rejects(
      websiteRunnerEnvironment(root, inherited),
      new RegExp(key),
    );
  }
  for (const patch of [
    { PORT: "0" },
    { PORT: "65536" },
    { PORT: " 80" },
    { PORT: "80\n" },
    { HOSTNAME: "host;run" },
    { HOSTNAME: " " },
    { NODE_ENV: "development" },
    { API_BASE_URL: "https://api.test/path" },
    { WEBSITE_CSP_MODE: "off" },
    { WEBSITE_URL: 42 },
    { WEBSITE_URL: "bad\norigin" },
    { WEBSITE_INDEXING_ENABLED: "true", WEBSITE_URL: "http://127.0.0.1:43102" },
    { WEBSITE_URL: "https://user:password@site.test" },
  ])
    await assert.rejects(
      websiteRunnerEnvironment(root, { ...environment(), ...patch }),
    );
  const minimal = {
    NODE_ENV: "production",
    API_BASE_URL: "https://api.example.test",
    HOSTNAME: "0.0.0.0",
    PORT: "443",
    PATH: 42,
    TEMP: "",
    TMP: "bad\npath",
  };
  assert.deepEqual(await websiteRunnerEnvironment(root, minimal), {
    NODE_ENV: "production",
    API_BASE_URL: "https://api.example.test",
    HOSTNAME: "0.0.0.0",
    PORT: "443",
    NEXT_TELEMETRY_DISABLED: "1",
  });
  assert.equal(
    (await websiteRunnerEnvironment(root, { ...minimal, WEBSITE_URL: "" }))
      .WEBSITE_URL,
    "",
  );
});

test("synthetic inputs require explicit isolated origins and separate sanitized child ports", async (t) => {
  const { root } = await fixture(t);
  const value = await syntheticRunnerInputs(root, environment());
  assert.equal(value.websiteOrigin, "http://127.0.0.1:43102");
  assert.equal(value.apiOrigin, "http://127.0.0.1:43101");
  assert.equal(value.websiteEnvironment.PORT, "43102");
  assert.equal(value.apiEnvironment.PORT, "43101");
  assert.equal(value.apiEnvironment.KERNEL_SYNTHETIC_ENV, "1");
  assert.notEqual(value.apiEnvironment, value.websiteEnvironment);
  let originReads = 0;
  const inherited = environment();
  Object.defineProperty(inherited, "WEBSITE_URL", {
    get() {
      originReads += 1;
      return "http://127.0.0.1:43102";
    },
  });
  const snapshot = await syntheticRunnerInputs(root, inherited);
  assert.equal(originReads, 1);
  assert.equal(snapshot.websiteOrigin, snapshot.websiteEnvironment.WEBSITE_URL);
  for (const patch of [
    { KERNEL_SYNTHETIC_ENV: undefined },
    { API_BASE_URL: "http://localhost:43101" },
    { API_BASE_URL: "https://127.0.0.1:43101" },
    { API_BASE_URL: "http://127.0.0.1" },
    { API_BASE_URL: "http://127.0.0.1:80" },
    { API_BASE_URL: "http://127.0.0.1:43102" },
    { WEBSITE_URL: "https://public.test" },
    { WEBSITE_URL: undefined },
    { PORT: "43103" },
    { HOSTNAME: "0.0.0.0" },
    { WEBSITE_INDEXING_ENABLED: undefined },
  ])
    await assert.rejects(
      syntheticRunnerInputs(root, { ...environment(), ...patch }),
    );
});

test("ready roots reject dotenv by presence and linked ancestors without reading contents", async (t) => {
  const { root, put } = await fixture(t);
  await put(".env.example", "PUBLIC_EXAMPLE=value");
  assert.equal(await readyRunnerRoot(root), root);
  await put(".env.production.local", "OWNED_SYNTHETIC_FILE=not-loaded");
  await assert.rejects(
    websiteRunnerEnvironment(root, environment()),
    /without runtime dotenv/,
  );
  assert.equal(
    await readFile(path.join(root, ".env.production.local"), "utf8"),
    "OWNED_SYNTHETIC_FILE=not-loaded",
  );
  await rm(path.join(root, ".env.production.local"));
  await symlink(root, path.join(root, "alias"), "junction");
  await assert.rejects(readyRunnerRoot(path.join(root, "alias")), /links/);
});

test("Next resolution stays in the selected root and checks exact package and lock identity", async (t) => {
  const { root, put } = await fixture(t);
  await nextFixture(put);
  assert.equal(
    await resolveNextCli(root),
    path.join(root, "node_modules/next/dist/bin/next"),
  );
  for (const installed of [
    { name: "other", version: "16.4.3" },
    { name: "next", version: "16.4.2" },
  ]) {
    await put("node_modules/next/package.json", installed);
    await assert.rejects(resolveNextCli(root), /exact manifest and lock/);
  }
  await nextFixture(put);
  for (const manifest of [
    { name: "other", dependencies: { next: "16.4.3" } },
    { name: "kernel-website", dependencies: { next: "^16.4.3" } },
    { name: "kernel-website" },
  ]) {
    await put("package.json", manifest);
    await assert.rejects(resolveNextCli(root), /exact manifest and lock/);
  }
  await nextFixture(put);
  for (const lock of [
    {},
    { lockfileVersion: 2 },
    { lockfileVersion: 3, packages: { "": { name: "other" } } },
    {
      lockfileVersion: 3,
      packages: {
        "": { name: "kernel-website", dependencies: { next: "16.4.3" } },
        "node_modules/next": { version: "0.0.0" },
      },
    },
  ]) {
    await put("package-lock.json", lock);
    await assert.rejects(resolveNextCli(root), /exact manifest and lock/);
  }
  await nextFixture(put);
  await rm(path.join(root, "node_modules/next/dist/bin/next"));
  await assert.rejects(resolveNextCli(root), /ENOENT/);
  await rm(path.join(root, "node_modules/next/dist/bin"), { recursive: true });
  await put("owned-bin/next", "// synthetic");
  await symlink(
    path.join(root, "owned-bin"),
    path.join(root, "node_modules/next/dist/bin"),
    "junction",
  );
  await assert.rejects(resolveNextCli(root), /links/);
});

test("explicit API fixtures must own their fixed unlinked entry and never fall back to siblings", async (t) => {
  const { root, put } = await fixture(t);
  const directory = path.join(root, "api-fixture");
  await put("api-fixture/package.json", { name: "kernel-api" });
  await put("api-fixture/src/index.ts", "// synthetic fixture marker");
  const inherited = {
    KERNEL_SYNTHETIC_ENV: "1",
    KERNEL_API_DIRECTORY: directory,
  };
  await assert.rejects(resolveApiFixture(root, {}), /explicit clean synthetic/);
  await assert.rejects(resolveApiFixture(root, inherited), /ENOENT/);
  await createApiFixture(t, put, directory);
  assert.deepEqual(await resolveApiFixture(root, inherited), {
    directory,
    entry: path.join(directory, "src/index.ts"),
    revision: apiFixtureRevision,
  });
  await rm(path.join(directory, "src"), { recursive: true });
  await put("owned-api-src/index.ts", "// synthetic");
  await symlink(
    path.join(root, "owned-api-src"),
    path.join(directory, "src"),
    "junction",
  );
  await assert.rejects(
    resolveApiFixture(root, inherited),
    /explicit clean synthetic/,
  );
});

test("API fixture resolution rejects changed revision, tracked sources, lock and installed dependency identities", async (t) => {
  const { root, put } = await fixture(t);
  const directory = path.join(root, "api-fixture");
  const { control, calls, manifest } = await createApiFixture(
    t,
    put,
    directory,
  );
  const inherited = {
    KERNEL_SYNTHETIC_ENV: "1",
    KERNEL_API_DIRECTORY: directory,
    PATH: "owned-path",
    TOKEN: "must-not-read",
  };
  for (const patch of [
    { revision: "a".repeat(40) },
    { top: root },
    { changes: " M src/index.ts" },
  ]) {
    const previous = { ...control };
    Object.assign(control, patch);
    await assert.rejects(
      resolveApiFixture(root, inherited),
      /clean independent checkout/,
    );
    Object.assign(control, previous);
  }
  control.error = new Error("Git could not inspect the fixture");
  await assert.rejects(
    resolveApiFixture(root, inherited),
    /Git could not inspect/,
  );
  control.error = undefined;
  await put("api-fixture/package-lock.json", { lockfileVersion: 2 });
  await assert.rejects(
    resolveApiFixture(root, inherited),
    /manifest and lock identity/,
  );
  await put("api-fixture/package-lock.json", {
    lockfileVersion: 3,
    packages: {
      "": manifest,
      "node_modules/owned-api-runtime": { version: "1.0.0" },
    },
  });
  await put("api-fixture/node_modules/owned-api-runtime/package.json", {
    name: "owned-api-runtime",
    version: "2.0.0",
  });
  await assert.rejects(
    resolveApiFixture(root, inherited),
    /installed lock versions/,
  );
  assert.deepEqual(calls[0].options.env, { PATH: "owned-path" });
  assert.equal(calls[0].options.windowsHide, true);
});
