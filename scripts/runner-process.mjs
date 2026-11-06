import { spawn } from "node:child_process";
import path from "node:path";

import { requireApplicationReady } from "./release-files.mjs";

const localAbsolutePath = (value) =>
  typeof value === "string" &&
  path.isAbsolute(value) &&
  !/^[\\/]{2}/.test(value) &&
  !/[\0\r\n]/.test(value);

/**
 * Reject implicit launch inputs and snapshot the environment's own entries once
 * so inherited properties or changing getters cannot alter validated settings.
 */
function validateProcessOptions({
  command,
  args,
  cwd,
  env,
  signal,
  stopTimeoutMs,
}) {
  if (!localAbsolutePath(command) || !localAbsolutePath(cwd))
    throw new Error(
      "Owned processes require explicit absolute local command and working-directory paths.",
    );
  if (
    !Array.isArray(args) ||
    args.some((value) => typeof value !== "string" || value.includes("\0"))
  )
    throw new Error(
      "Owned process arguments must be an explicit array of strings without null bytes.",
    );
  if (!env || typeof env !== "object" || Array.isArray(env))
    throw new Error(
      "Owned processes require an explicit string-valued environment.",
    );
  const environment = Object.fromEntries(Object.entries(env));
  if (Object.values(environment).some((value) => typeof value !== "string"))
    throw new Error(
      "Owned processes require an explicit string-valued environment.",
    );
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new Error("Owned process cancellation requires an AbortSignal.");
  if (
    !Number.isInteger(stopTimeoutMs) ||
    stopTimeoutMs < 1 ||
    stopTimeoutMs > 10_000
  )
    throw new Error(
      "Owned process stop timeout must be between 1 and 10000 milliseconds.",
    );
  return environment;
}

const abortedProcess = () => new Error("Owned process was aborted.");

/**
 * Start one direct child after caller-owned readiness checks. The caller consumes
 * its pipes; successful completion follows close. Cancellation stops this handle
 * with bounded escalation and reports failure if cleanup cannot observe close.
 */
export function startOwnedProcess({
  command = process.execPath,
  args,
  cwd,
  env,
  signal,
  stdio = "inherit",
  stopTimeoutMs = 1_000,
}) {
  const environment = validateProcessOptions({
    command,
    args,
    cwd,
    env,
    signal,
    stopTimeoutMs,
  });
  if (signal?.aborted) throw abortedProcess();

  const child = spawn(command, args, {
    cwd,
    env: environment,
    stdio,
    windowsHide: true,
    shell: false,
  });
  let resolveCompletion;
  let rejectCompletion;
  const completion = new Promise((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });
  // A caller may attach its completion handler after a child readiness event.
  // Preserve the rejection for that caller without an unhandled-rejection race.
  completion.catch(() => {});

  let resolveClosed;
  const closed = new Promise((resolve) => {
    resolveClosed = resolve;
  });
  let didClose = false;
  let settled = false;
  let processError;
  let aborted = false;
  let stopped = false;
  let stopPromise;
  let resolveStop;
  let gracefulTimer;
  let forceTimer;

  const cleanup = () => {
    clearTimeout(gracefulTimer);
    clearTimeout(forceTimer);
    signal?.removeEventListener("abort", onAbort);
  };
  const settle = (error, result) => {
    if (settled) return;
    settled = true;
    if (error) rejectCompletion(error);
    else resolveCompletion(result);
  };
  const onError = (error) => {
    processError = error;
  };
  child.once("error", onError);
  child.once("close", (code, exitSignal) => {
    didClose = true;
    cleanup();
    child.removeListener("error", onError);
    if (processError)
      settle(
        new Error(`Owned process failed to start: ${processError.message}`, {
          cause: processError,
        }),
      );
    else if (aborted) settle(abortedProcess());
    else if (stopped)
      settle(
        new Error("Owned process was stopped before successful completion."),
      );
    else if (exitSignal)
      settle(new Error(`Owned process exited with signal ${exitSignal}.`));
    else if (code !== 0)
      settle(new Error(`Owned process exited with code ${code}.`));
    else settle(undefined, { code, signal: exitSignal });
    resolveClosed();
    resolveStop?.();
  });

  /**
   * Stop this direct child once, escalating from TERM to KILL and awaiting close;
   * reject the shared stop promise if the bounded cleanup deadline expires.
   */
  function stop() {
    if (stopPromise) return stopPromise;
    if (didClose) return closed;
    stopped = true;
    let killError;
    const killOwnedChild = (terminationSignal) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      try {
        child.kill(terminationSignal);
      } catch (error) {
        killError = error;
      }
    };
    stopPromise = new Promise((resolve, reject) => {
      resolveStop = resolve;
      killOwnedChild("SIGTERM");
      gracefulTimer = setTimeout(
        () => killOwnedChild("SIGKILL"),
        stopTimeoutMs,
      );
      forceTimer = setTimeout(() => {
        const error = new Error(
          "Owned process did not close within its bounded stop deadline.",
          { cause: killError },
        );
        cleanup();
        for (const stream of child.stdio) stream?.destroy?.();
        settle(error);
        reject(error);
      }, stopTimeoutMs * 2);
    });
    stopPromise.catch(() => {});
    return stopPromise;
  }

  function onAbort() {
    aborted = true;
    stop();
  }
  signal?.addEventListener("abort", onAbort, { once: true });
  return { child, completion, stop };
}

/**
 * Discard every exposed output pipe while awaiting owned completion, allowing
 * completion-only callers to finish even when child writes exceed pipe capacity.
 */
export async function runOwnedProcess(options) {
  const owned = startOwnedProcess(options);
  for (const stream of owned.child.stdio.slice(1)) stream?.resume?.();
  return owned.completion;
}

/**
 * Keep imports inert and gate the CLI action on readiness before signal setup.
 * Supply owned cancellation, remove listeners after settlement and report action
 * or cancellation failures through the CLI exit code.
 */
export async function runVerificationCli(main, root, action) {
  if (main === false) return;
  let controller;
  let interrupt;
  let terminate;
  try {
    if (typeof main !== "boolean")
      throw new Error(
        "Verification tools require the repository's Node.js 24 runtime.",
      );
    await requireApplicationReady(root);
    controller = new AbortController();
    interrupt = () => controller.abort();
    terminate = () => controller.abort();
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    await action({ signal: controller.signal });
    if (controller.signal.aborted) throw abortedProcess();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Verification operation failed.",
    );
    process.exitCode = 1;
  } finally {
    controller?.abort();
    if (interrupt) process.removeListener("SIGINT", interrupt);
    if (terminate) process.removeListener("SIGTERM", terminate);
  }
}
