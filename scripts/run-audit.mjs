import { spawnSync } from "node:child_process";
import process from "node:process";

const auditArguments = ["audit", "--audit-level=high", "--json"];

export const hasAuditMetadata = (output) => {
  try {
    const report = JSON.parse(output);
    return Boolean(report?.metadata?.vulnerabilities);
  } catch {
    return false;
  }
};

export const isCompletedAuditResult = (result) =>
  result.status !== null && hasAuditMetadata(result.stdout);

const printResult = (result) => {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
};

const runAudit = () =>
  spawnSync(process.execPath, [process.env.npm_execpath, ...auditArguments], {
    encoding: "utf8",
  });

if (process.argv[1] === import.meta.filename) {
  const lastResult = runAudit();

  printResult(lastResult);
  if (isCompletedAuditResult(lastResult)) {
    process.exitCode = lastResult.status;
  } else {
    process.stderr.write(
      "Online npm audit did not return a complete report.\n",
    );
    process.exitCode = 1;
  }
}
