import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { hasAuditMetadata, isCompletedAuditResult } from "./run-audit.mjs";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

const originalArgument = process.argv[1];
const originalExitCode = process.exitCode;
afterEach(() => {
  process.argv[1] = originalArgument;
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("audit result classification", () => {
  it("recognizes a completed vulnerability report", () => {
    expect(
      hasAuditMetadata(
        JSON.stringify({ metadata: { vulnerabilities: { high: 1 } } }),
      ),
    ).toBe(true);
  });

  it.each(["", "not json", JSON.stringify({ error: "Unavailable" })])(
    "treats an infrastructure response as incomplete",
    (output) => {
      expect(hasAuditMetadata(output)).toBe(false);
    },
  );

  it("rejects a zero exit status without audit metadata", () => {
    expect(isCompletedAuditResult({ status: 0, stdout: "" })).toBe(false);
  });

  it("accepts completed reports for both clean and blocking audits", () => {
    const stdout = JSON.stringify({
      metadata: { vulnerabilities: { high: 1 } },
    });

    expect(isCompletedAuditResult({ status: 0, stdout })).toBe(true);
    expect(isCompletedAuditResult({ status: 1, stdout })).toBe(true);
  });

  it("rejects terminated audit processes", () => {
    const stdout = JSON.stringify({ metadata: { vulnerabilities: {} } });

    expect(isCompletedAuditResult({ status: null, stdout })).toBe(false);
  });
});

describe("audit command execution", () => {
  const invoke = async () => {
    vi.resetModules();
    process.argv[1] = fileURLToPath(
      new URL("./run-audit.mjs", import.meta.url),
    );
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await import("./run-audit.mjs");
  };
  const report = JSON.stringify({ metadata: { vulnerabilities: { high: 0 } } });

  it.each([0, 1])(
    "preserves the completed audit result %s without retrying",
    async (status) => {
      vi.mocked(spawnSync).mockReturnValue({
        status,
        stdout: report,
        stderr: "synthetic diagnostics",
      });
      await invoke();
      expect(process.exitCode).toBe(status);
      expect(spawnSync).toHaveBeenCalledTimes(1);
      expect(process.stdout.write).toHaveBeenCalledWith(report);
    },
  );
  it("retries an unavailable audit and accepts the first complete report", async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: null, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: report, stderr: "" });
    await invoke();
    expect(spawnSync).toHaveBeenCalledTimes(2);
    expect(process.exitCode).toBe(0);
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining("retrying"),
    );
  });
  it("fails closed after three incomplete reports", async () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "",
      stderr: "synthetic offline response",
    });
    await invoke();
    expect(spawnSync).toHaveBeenCalledTimes(3);
    expect(process.exitCode).toBe(1);
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining("did not return a complete report"),
    );
  });
});
