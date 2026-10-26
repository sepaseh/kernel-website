import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const repository = fileURLToPath(new URL("../", import.meta.url));
export const commandArguments = (command) => {
  if (typeof command !== "string" || /[;&|<>\x60$\r\n]/.test(command))
    throw new Error("Validation commands must not contain shell operators");
  const args = command
    .match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)
    ?.map((token) =>
      token.replace(
        /^(?:"(.*)"|'(.*)')$/,
        (_, double, single) => double ?? single,
      ),
    );
  if (
    args?.[0] !== "npm" ||
    args[1] !== "run" ||
    !/^[\w:][\w:-]*$/.test(args[2] ?? "")
  )
    throw new Error("Validation commands must use a declared npm script");
  const separator = args.indexOf("--");
  const npmOptions =
    separator === -1 ? args.slice(3) : args.slice(3, separator);
  if (npmOptions.length > 0)
    throw new Error("Validation commands must pass script arguments after --");
  return args.slice(1);
};
const checkInventory = (manifest) => {
  if (!Array.isArray(manifest.checks) || !manifest.checks.length)
    throw new Error("Validation checks must be a nonempty array");
  const checks = new Map();
  for (const check of manifest.checks) {
    if (
      typeof check?.id !== "string" ||
      !/^\w[\w:-]*$/.test(check.id) ||
      checks.has(check.id) ||
      !["required", "advisory", "manual"].includes(check.kind)
    )
      throw new Error("Validation checks need unique IDs and explicit kinds");
    checks.set(check.id, check);
  }
  return checks;
};

export const runProfile = (manifest, profile, run) => {
  const checks = checkInventory(manifest);
  const ids = manifest.profiles?.[profile];
  if (!Array.isArray(ids) || !ids.length)
    throw new Error("Unknown or empty validation profile: " + profile);
  if (new Set(ids).size !== ids.length)
    throw new Error("Validation profiles must not repeat check IDs");
  const selected = ids.map((id) => {
    const check = checks.get(id);
    if (!check) throw new Error("Unknown validation check: " + id);
    return check;
  });
  if (profile === "full") {
    const required = manifest.checks.filter(
      (check) => check.kind === "required",
    );
    if (
      !required.length ||
      selected.length !== required.length ||
      selected.some((check) => check.kind !== "required")
    )
      throw new Error(
        "Full validation must contain every required check exactly once and no optional checks",
      );
  }
  const commands = selected.map((check) => ({
    args: commandArguments(check.command),
    check,
  }));
  for (const { args, check } of commands) {
    const result = run(args, check);
    if (result !== 0) return result ?? 1;
  }
  return 0;
};
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const manifest = JSON.parse(
    await readFile(path.join(repository, ".agents/validation.json"), "utf8"),
  );
  const npm =
    process.env.npm_execpath ??
    path.join(
      path.dirname(process.execPath),
      "node_modules/npm/bin/npm-cli.js",
    );
  if (!existsSync(npm))
    throw new Error(
      "Run this tool through npm run validate so npm's CLI is available",
    );
  process.exitCode = runProfile(
    manifest,
    process.argv[2] ?? "full",
    (args, check) => {
      console.log("Running " + check.id + ": " + check.command);
      const result = spawnSync(process.execPath, [npm, ...args], {
        cwd: repository,
        stdio: "inherit",
        windowsHide: true,
      });
      if (result.error) throw result.error;
      return result.status ?? 1;
    },
  );
}
