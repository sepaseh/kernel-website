import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const fixtureError = () =>
  new Error(
    "KERNEL_API_DIRECTORY must identify an explicit clean synthetic kernel-api fixture with package.json and src/index.ts; no sibling checkout is selected.",
  );

export function apiRepository(inherited = process.env) {
  const requested = inherited?.KERNEL_API_DIRECTORY;
  if (
    inherited?.KERNEL_SYNTHETIC_ENV !== "1" ||
    typeof requested !== "string" ||
    !requested.trim() ||
    !path.isAbsolute(requested) ||
    /^[\\/]{2}/.test(requested)
  )
    throw fixtureError();

  const directory = path.resolve(requested);
  let cursor = path.parse(directory).root;
  for (const part of path.relative(cursor, directory).split(path.sep)) {
    cursor = path.join(cursor, part);
    if (lstatSync(cursor).isSymbolicLink()) throw fixtureError();
  }
  if (
    !lstatSync(directory).isDirectory() ||
    readdirSync(directory).some(
      (name) => /^\.env(?:\.|$)/i.test(name) && name !== ".env.example",
    )
  )
    throw fixtureError();

  for (const filename of ["package.json", "src", "src/index.ts"]) {
    const entry = lstatSync(path.join(directory, filename));
    if (
      entry.isSymbolicLink() ||
      (filename === "src" ? !entry.isDirectory() : !entry.isFile())
    )
      throw fixtureError();
  }
  let manifest;
  try {
    manifest = JSON.parse(
      readFileSync(path.join(directory, "package.json"), "utf8"),
    );
  } catch {
    throw fixtureError();
  }
  if (!manifest || manifest.name !== "kernel-api") throw fixtureError();
  return realpathSync(directory);
}
