import assert from "node:assert/strict";
import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Register before starting the owned writer. Atomic marker publication means a
// notification always refers to a complete file, including on Windows.
export async function abortOnFixtureFile(root, name, controller, action) {
  const ready = Promise.withResolvers();
  const inspections = new Set();
  const inspectionFailures = [];
  let observing = true;
  let markerObserved = false;
  let recheck = false;
  const inspectionFailed = (error) => {
    markerObserved = true;
    inspectionFailures.push(error);
    ready.reject(error);
  };
  const inspect = () => {
    if (!observing || markerObserved) return;
    if (inspections.size) {
      recheck = true;
      return;
    }
    const inspection = readFile(path.join(root, name), "utf8").then(
      (contents) => {
        markerObserved = true;
        ready.resolve(contents);
      },
      (error) => {
        if (error.code !== "ENOENT") inspectionFailed(error);
      },
    );
    inspections.add(inspection);
    void inspection.finally(() => {
      inspections.delete(inspection);
      if (recheck) {
        recheck = false;
        inspect();
      }
    });
  };
  const watcher = watch(root, (_event, filename) => {
    if (observing && (filename == null || String(filename) === name)) inspect();
  });
  const closed = Promise.withResolvers();
  watcher.once("close", closed.resolve);
  watcher.once("error", inspectionFailed);
  const operation = Promise.resolve().then(action);
  let result;
  let failure;
  let failed = false;
  try {
    inspect();
    await Promise.race([
      ready.promise,
      operation.then(() => {
        throw new Error(`Owned fixture finished before publishing ${name}.`);
      }),
    ]);
    controller.abort();
    result = await operation;
  } catch (error) {
    failure = error;
    failed = true;
  }
  observing = false;
  watcher.close();
  controller.abort();
  const failures = failed ? [failure] : [];
  try {
    await operation;
  } catch (error) {
    const expectedCancellation =
      !(error instanceof AggregateError) &&
      (error === controller.signal.reason ||
        (error instanceof Error &&
          error.message === "Owned process was aborted."));
    if (!expectedCancellation && !failures.includes(error))
      failures.push(error);
  }
  await Promise.all(inspections);
  await closed.promise;
  for (const error of inspectionFailures)
    if (!failures.includes(error)) failures.push(error);
  if (failures.length === 1) throw failures[0];
  if (failures.length)
    throw new AggregateError(
      failures,
      "Fixture readiness and owned operation cleanup failed.",
      { cause: failures[0] },
    );
  return result;
}

export function controlledStopTimers(t) {
  const pending = new Map();
  t.mock.method(globalThis, "setTimeout", (callback) => {
    const handle = {};
    pending.set(handle, callback);
    return handle;
  });
  t.mock.method(globalThis, "clearTimeout", (handle) => pending.delete(handle));
  return {
    fireNext() {
      const next = pending.entries().next();
      assert.equal(next.done, false, "Expected a pending stop transition.");
      const [handle, callback] = next.value;
      pending.delete(handle);
      callback();
    },
    get pendingCount() {
      return pending.size;
    },
  };
}
