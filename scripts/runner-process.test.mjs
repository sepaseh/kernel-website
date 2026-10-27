import assert from "node:assert/strict";
import { once } from "node:events";
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

import {
  runOwnedProcess,
  runVerificationCli,
  startOwnedProcess,
} from "./runner-process.mjs";

async function fixture(t, ready = true) {
  const prefix = path.join(
    await realpath(os.tmpdir()),
    "website-runner-process-",
  );
  const root = await realpath(await mkdtemp(prefix));
  assert.equal(path.dirname(root), path.dirname(prefix));
  t.after(async () => {
    assert.equal(await realpath(root), root);
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, ".github"));
  await writeFile(
    path.join(root, ".github/bootstrap-policy.json"),
    JSON.stringify({ schemaVersion: 1, applicationReady: ready }),
  );
  return root;
}

const environment = () =>
  Object.fromEntries(
    ["PATH", "SystemRoot", "TEMP", "TMP"]
      .filter((name) => typeof process.env[name] === "string")
      .map((name) => [name, process.env[name]]),
  );
const options = (cwd, source, extra = {}) => ({
  args: ["--input-type=module", "-e", source],
  cwd,
  env: environment(),
  stdio: "pipe",
  ...extra,
});
const collect = (stream) => {
  let output = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    output += chunk;
  });
  return () => output;
};
async function persistent(t, root, extra = {}) {
  const owned = startOwnedProcess(
    options(root, "process.send('ready'); setInterval(() => {}, 60_000);", {
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      ...extra,
    }),
  );
  t.after(async () => {
    if (owned.child.exitCode === null && owned.child.signalCode === null)
      await owned.stop();
  });
  const [message] = await once(owned.child, "message");
  assert.equal(message, "ready");
  return owned;
}

test("owned execution uses its explicit environment and drains output before success", async (t) => {
  const root = await fixture(t);
  const owned = startOwnedProcess(
    options(
      root,
      "process.stdout.write(process.env.OWNED_VALUE); process.stderr.write(process.cwd());",
      { env: { ...environment(), OWNED_VALUE: "synthetic-value" } },
    ),
  );
  const stdout = collect(owned.child.stdout);
  const stderr = collect(owned.child.stderr);
  assert.deepEqual(await owned.completion, { code: 0, signal: null });
  assert.equal(stdout(), "synthetic-value");
  assert.equal(stderr(), root);
  assert.equal(owned.child.listenerCount("close"), 0);
  assert.equal(owned.child.listenerCount("error"), 0);
  const first = owned.stop();
  assert.equal(owned.stop(), first);
  await first;
  assert.deepEqual(
    await runOwnedProcess(options(root, "process.exit(0)", { env: {} })),
    { code: 0, signal: null },
  );
});

test("owned environment is a single own-entry snapshot without inherited launch options", async (t) => {
  const root = await fixture(t);
  const env = Object.create({
    NODE_OPTIONS: "--invalid-inherited-node-option",
    INHERITED_VALUE: "synthetic-prototype-value",
  });
  let reads = 0;
  Object.defineProperty(env, "OWNED_VALUE", {
    enumerable: true,
    get() {
      reads += 1;
      return reads === 1 ? "single-snapshot" : "changed-after-validation";
    },
  });
  const owned = startOwnedProcess(
    options(
      root,
      "process.stdout.write(JSON.stringify({value:process.env.OWNED_VALUE,inherited:process.env.INHERITED_VALUE,nodeOptions:process.env.NODE_OPTIONS}));",
      { env },
    ),
  );
  const stdout = collect(owned.child.stdout);
  await owned.completion;
  assert.equal(reads, 1);
  assert.deepEqual(JSON.parse(stdout()), { value: "single-snapshot" });
});

test("nonzero exits and process creation failures remain failures without unhandled completion races", async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    runOwnedProcess(options(root, "process.exit(7)")),
    /exited with code 7/,
  );
  const missing = startOwnedProcess(
    options(root, "", { command: path.join(root, "missing-node-executable") }),
  );
  const closed = new Promise((resolve) => {
    missing.child.once("close", resolve);
  });
  await closed;
  await assert.rejects(
    missing.completion,
    (error) =>
      error.message.includes("failed to start") &&
      error.cause.code === "ENOENT",
  );
  await missing.stop();
});

test("unexpected signals never become successful exits", async (t) => {
  const root = await fixture(t);
  const owned = await persistent(t, root);
  owned.child.kill("SIGTERM");
  await assert.rejects(owned.completion, /exited with (signal|code)/);
});

test("stop is idempotent and drains only its owned direct child", async (t) => {
  const root = await fixture(t);
  const owned = await persistent(t, root);
  let closeObserved = false;
  owned.child.once("close", () => {
    closeObserved = true;
  });
  const stopping = owned.stop();
  assert.equal(owned.stop(), stopping);
  await stopping;
  assert.equal(closeObserved, true);
  await assert.rejects(owned.completion, /was stopped/);
  assert.ok(owned.child.exitCode !== null || owned.child.signalCode !== null);
});

test("abort stops an owned process and a pre-aborted signal cannot start one", async (t) => {
  const root = await fixture(t);
  const controller = new AbortController();
  const owned = await persistent(t, root, { signal: controller.signal });
  controller.abort();
  await assert.rejects(owned.completion, /was aborted/);
  await owned.stop();
  assert.throws(
    () => startOwnedProcess(options(root, "", { signal: controller.signal })),
    /was aborted/,
  );
});

test("bounded stop escalates on the same owned handle when graceful termination is ineffective", async (t) => {
  const root = await fixture(t);
  const owned = await persistent(t, root, { stopTimeoutMs: 500 });
  const terminate = owned.child.kill.bind(owned.child);
  const signals = [];
  t.mock.method(owned.child, "kill", (signal) => {
    signals.push(signal);
    if (signal === "SIGTERM") return false;
    return terminate(signal);
  });
  await owned.stop();
  await assert.rejects(owned.completion, /was stopped/);
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
});

test("an unresponsive owned handle reports the stop deadline instead of pretending cleanup succeeded", async (t) => {
  const root = await fixture(t);
  const owned = await persistent(t, root, { stopTimeoutMs: 25 });
  const terminate = owned.child.kill.bind(owned.child);
  t.mock.method(owned.child, "kill", () => {
    throw new Error("synthetic kill failure");
  });
  try {
    await assert.rejects(
      owned.stop(),
      (error) =>
        error.message.includes("bounded stop deadline") &&
        error.cause.message === "synthetic kill failure",
    );
    await assert.rejects(owned.completion, /bounded stop deadline/);
  } finally {
    const closed = once(owned.child, "close");
    terminate("SIGKILL");
    await closed;
    // The stop failure remains observable; the fixture owns its final cleanup.
    t.mock.restoreAll();
  }
});

test("process options never silently use implicit paths, arguments, environment or cancellation", async (t) => {
  const root = await fixture(t);
  const baseline = options(root, "");
  for (const patch of [
    { command: "node" },
    { cwd: "relative" },
    { cwd: "//remote/share" },
    { command: process.execPath + "\n" },
    { args: undefined },
    { args: ["\0"] },
    { env: undefined },
    { env: [] },
    { env: { VALUE: 1 } },
    { signal: {} },
    { stopTimeoutMs: 0 },
    { stopTimeoutMs: 10_001 },
  ])
    assert.throws(
      () => startOwnedProcess({ ...baseline, ...patch }),
      /Owned process/,
    );
});

async function cliObservation(t, action) {
  const originalExitCode = process.exitCode;
  const errors = [];
  t.mock.method(console, "error", (message) => {
    errors.push(message);
  });
  try {
    process.exitCode = undefined;
    await action(errors);
  } finally {
    process.exitCode = originalExitCode;
    t.mock.restoreAll();
  }
}

test("CLI import and false main markers perform no configuration work or install signal listeners", async (t) => {
  const root = await fixture(t);
  const filename = path.join(root, "imported.txt");
  const moduleUrl = new URL("./runner-process.mjs", import.meta.url).href;
  const owned = startOwnedProcess(
    options(
      root,
      `import assert from 'node:assert/strict'; import {writeFile} from 'node:fs/promises'; const before=['SIGINT','SIGTERM'].map(s=>process.listenerCount(s)); await import(${JSON.stringify(moduleUrl)}); assert.deepEqual(['SIGINT','SIGTERM'].map(s=>process.listenerCount(s)),before); await writeFile(${JSON.stringify(filename)},'imported');`,
    ),
  );
  await owned.completion;
  assert.equal(await readFile(filename, "utf8"), "imported");
  await cliObservation(t, async (errors) => {
    await runVerificationCli(false, undefined, () => {
      throw new Error("must not run");
    });
    assert.equal(process.exitCode, undefined);
    assert.deepEqual(errors, []);
  });
});

test("CLI rejects unsupported main markers and false readiness before its action or signal setup", async (t) => {
  const root = await fixture(t, false);
  const before = ["SIGINT", "SIGTERM"].map((signal) =>
    process.listenerCount(signal),
  );
  await cliObservation(t, async (errors) => {
    let calls = 0;
    await runVerificationCli(undefined, undefined, () => {
      calls += 1;
    });
    assert.match(errors[0], /Node.js 24 runtime/);
    assert.equal(process.exitCode, 1);
    process.exitCode = undefined;
    await runVerificationCli(true, root, () => {
      calls += 1;
    });
    assert.match(errors[1], /non-runnable/);
    assert.equal(process.exitCode, 1);
    assert.equal(calls, 0);
    assert.deepEqual(
      ["SIGINT", "SIGTERM"].map((signal) => process.listenerCount(signal)),
      before,
    );
  });
});

test("ready CLI executes real owned work and removes listeners on success and action failure", async (t) => {
  const root = await fixture(t);
  const before = ["SIGINT", "SIGTERM"].map((signal) =>
    process.listenerCount(signal),
  );
  await cliObservation(t, async (errors) => {
    let actionSignal;
    await runVerificationCli(true, root, async ({ signal }) => {
      actionSignal = signal;
      assert.deepEqual(
        ["SIGINT", "SIGTERM"].map((name) => process.listenerCount(name)),
        before.map((count) => count + 1),
      );
      await runOwnedProcess(options(root, "process.exit(0)", { signal }));
    });
    assert.equal(process.exitCode, undefined);
    assert.equal(actionSignal.aborted, true);
    assert.deepEqual(errors, []);
    assert.deepEqual(
      ["SIGINT", "SIGTERM"].map((signal) => process.listenerCount(signal)),
      before,
    );
    await runVerificationCli(true, root, () => {
      throw new Error("owned action failed");
    });
    assert.equal(process.exitCode, 1);
    assert.match(errors[0], /owned action failed/);
    assert.deepEqual(
      ["SIGINT", "SIGTERM"].map((signal) => process.listenerCount(signal)),
      before,
    );
    await runVerificationCli(true, root, () => {
      throw "synthetic non-error failure";
    });
    assert.equal(errors[1], "Verification operation failed.");
  });
});

test("CLI interrupt and terminate aborts are failures and remove listeners in the isolated caller", async (t) => {
  const root = await fixture(t);
  const moduleUrl = new URL("./runner-process.mjs", import.meta.url).href;
  for (const signal of ["SIGINT", "SIGTERM"]) {
    const source = `import assert from 'node:assert/strict'; import {once} from 'node:events'; import {runVerificationCli,startOwnedProcess} from ${JSON.stringify(moduleUrl)}; const before=['SIGINT','SIGTERM'].map(s=>process.listenerCount(s)); await runVerificationCli(true,${JSON.stringify(root)},async({signal:abortSignal})=>{const owned=startOwnedProcess({args:['-e',"process.send('ready');setInterval(()=>{},60000)"],cwd:${JSON.stringify(root)},env:{},signal:abortSignal,stdio:['ignore','ignore','ignore','ipc']});await once(owned.child,'message');process.emit(${JSON.stringify(signal)});await owned.completion;});assert.deepEqual(['SIGINT','SIGTERM'].map(s=>process.listenerCount(s)),before);console.log('listeners removed');`;
    const owned = startOwnedProcess(options(root, source));
    const stdout = collect(owned.child.stdout);
    const stderr = collect(owned.child.stderr);
    await assert.rejects(owned.completion, /exited with code 1/);
    assert.match(stdout(), /listeners removed/);
    assert.match(stderr(), /was aborted/);
  }
});
