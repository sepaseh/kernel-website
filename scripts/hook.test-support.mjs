import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const runtimeEnvironment = (inherited = process.env) => {
  const environment = {};
  for (const name of ["PATH", "SystemRoot", "TEMP", "TMP"])
    if (inherited[name] !== undefined) environment[name] = inherited[name];
  return environment;
};

export const hooks = fileURLToPath(
  new URL("../.agents/hooks/", import.meta.url),
);
export const hook = path.join(hooks, "block-dangerous.mjs");
export const shellHook = path.join(hooks, "block-dangerous.sh");
export const run = (payload) =>
  spawnSync(process.execPath, [hook], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    windowsHide: true,
  });
export const bash = [
  ...(process.platform === "win32"
    ? ["C:/Program Files/Git/bin/bash.exe"]
    : ["/bin/bash", "/usr/bin/bash"]),
  "bash",
].find(
  (candidate) =>
    spawnSync(candidate, ["--noprofile", "--norc", "-c", "exit 0"], {
      encoding: "utf8",
      windowsHide: true,
    }).status === 0,
);
export const runShell = (
  payload,
  script = shellHook,
  missingNode = false,
  nativeNode = false,
) => {
  assert.ok(
    bash,
    "Portable hook checks require usable Bash, including on Windows.",
  );
  return spawnSync(
    bash,
    [
      "--noprofile",
      "--norc",
      "-c",
      `hook_path=$1
node_path=$2
if command -v cygpath >/dev/null 2>&1; then
  hook_path=$(cygpath -u "$hook_path") || exit 2
  node_path=$(cygpath -u "$node_path") || exit 2
elif command -v wslpath >/dev/null 2>&1; then
  hook_path=$(wslpath -u "$hook_path") || exit 2
  node_path=$(wslpath -u "$node_path") || exit 2
fi
if [ "$3" = missing-node ]; then
  PATH='' exec "$BASH" "$hook_path"
else
  if [ "$4" = native-node ]; then
    node() { return 1; }
    export -f node
  fi
  PATH="$(dirname "$node_path"):$PATH" exec "$BASH" "$hook_path"
fi`,
      "optional-hook-test",
      script,
      process.execPath,
      missingNode ? "missing-node" : "node-available",
      nativeNode ? "native-node" : "platform-node",
    ],
    {
      input: typeof payload === "string" ? payload : JSON.stringify(payload),
      encoding: "utf8",
      windowsHide: true,
    },
  );
};

export const fixture = async (t, hookName) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "website-optional-hook-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const script = path.join(root, ".agents/hooks", hookName);
  await mkdir(path.dirname(script), { recursive: true });
  await copyFile(path.join(hooks, hookName), script);
  return { root, script };
};

export async function aliasFixture(t) {
  const { root, script } = await fixture(t, "block-dangerous.mjs");
  const alias = path.join(root, "linked-hooks");
  await symlink(path.dirname(script), alias, "junction");
  return { root, script, alias };
}
