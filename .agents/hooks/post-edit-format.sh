#!/bin/bash
# Optional scoped ESLint helper. Reads one host JSON payload on stdin.
# A successful run validates only the edited file, not the canonical full gate.

NODE_BIN=$(command -v node 2>/dev/null || command -v node.exe 2>/dev/null || true)
if [[ -z "$NODE_BIN" ]]; then
  echo "Post-edit helper requires Node.js." >&2
  exit 2
fi
PROJECT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
case "$NODE_BIN" in
  *.exe)
    if command -v wslpath >/dev/null 2>&1; then
      PROJECT_DIR=$(wslpath -w "$PROJECT_DIR") || exit 2
    elif command -v cygpath >/dev/null 2>&1; then
      PROJECT_DIR=$(cygpath -w "$PROJECT_DIR") || exit 2
    fi
    ;;
  *)
    : # Native Node paths need no conversion.
    ;;
esac
NODE_SCRIPT=$(cat <<'NODE'
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
};
try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  if (!record(input) || (Object.hasOwn(input, "tool_input") && !record(input.tool_input)))
    throw new Error("Post-edit helper requires an object payload.");
  const tool = Object.hasOwn(input, "tool_input") ? input.tool_input : input;
  const filename = tool.file_path ?? tool.path;
  if (filename === undefined) process.exitCode = 0;
  else {
    if (typeof filename !== "string" || !filename.trim())
      throw new Error("Post-edit file path must be a nonempty string.");
    const root = realpathSync(process.argv[1]);
    const resolved = path.resolve(root, filename);
    const relative = path.relative(root, resolved);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
      throw new Error("Post-edit file must remain inside this project.");
    const blocked = (candidate) => {
      const parts = candidate.toLowerCase().split(path.sep);
      return parts.some((part) => [".git", "node_modules", ".next", "coverage"].includes(part) || part.startsWith(".env")) || parts.join("/").includes("server/data/");
    };
    if (blocked(relative))
      throw new Error("Post-edit helper cannot edit private or generated paths.");
    if (/\.[cm]?[jt]sx?$/.test(filename)) {
      const actual = realpathSync(resolved);
      const actualRelative = path.relative(root, actual);
      if (actualRelative === ".." || actualRelative.startsWith(`..${path.sep}`) || path.isAbsolute(actualRelative))
        throw new Error("Post-edit file resolves outside this project.");
      if (blocked(actualRelative))
        throw new Error("Post-edit file resolves to private or generated state.");
      if (!statSync(actual).isFile()) throw new Error("Post-edit path must be a file.");
      const eslint = path.join(root, "node_modules/eslint/bin/eslint.js");
      const result = spawnSync(process.execPath, [eslint, "--fix", "--", relative], {
        cwd: root,
        stdio: "inherit",
        windowsHide: true,
      });
      if (result.error || result.status !== 0)
        throw new Error("Scoped post-edit lint failed; the complete gate is still required.");
    }
  }
} catch (error_) {
  fail(error_ instanceof Error ? error_.message : "Post-edit helper failed.");
}
NODE
)
exec "$NODE_BIN" --input-type=module -e "$NODE_SCRIPT" "$PROJECT_DIR"