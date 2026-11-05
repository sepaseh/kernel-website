import { constants } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  artifactDirectory,
  artifactFile,
  completeArtifactWork,
  copyArtifactTree,
  ensureArtifactDirectory,
  readArtifactFile,
  requireApplicationReady,
  runDeliveryCommand,
} from "./release-files.mjs";

const defaultRepository = fileURLToPath(new URL("../", import.meta.url));
const runtimeScripts = [
  "scripts/healthcheck.mjs",
  "scripts/release-files.mjs",
  "scripts/validate-deployment-env.mjs",
];
export function validateReleaseId(value) {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value) ||
    value.includes("..")
  )
    throw new Error(
      "Release ID must contain 1–128 letters, digits, dots, underscores or hyphens, start with a letter/digit and contain no '..'.",
    );
  return value;
}
export function parseReleaseArguments(args) {
  let releaseId;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    let value;
    if (argument.startsWith("--release="))
      value = argument.slice("--release=".length);
    else if (argument === "--release") value = args[++index];
    if (value === undefined || releaseId !== undefined)
      throw new Error("Usage: node scripts/package-release.mjs --release=ID");
    releaseId = validateReleaseId(value);
  }
  if (!releaseId)
    throw new Error("Usage: node scripts/package-release.mjs --release=ID");
  return releaseId;
}

export async function packageRelease({
  repositoryRoot = defaultRepository,
  releaseId,
}) {
  validateReleaseId(releaseId);
  const repository = await requireApplicationReady(repositoryRoot);
  const standalone = path.join(repository, ".next/standalone");
  await completeArtifactWork([
    ...[
      "package.json",
      "package-lock.json",
      ".next/BUILD_ID",
      ".next/standalone/server.js",
      ...runtimeScripts,
    ].map((name) => artifactFile(path.join(repository, name))),
    artifactDirectory(standalone),
    artifactDirectory(path.join(repository, "public")),
    artifactDirectory(path.join(repository, ".next/static")),
  ]);
  const outputRoot = await ensureArtifactDirectory(
    path.join(repository, "dist/releases"),
  );
  const output = path.join(outputRoot, releaseId);
  // An exclusive directory never overwrites a published or incomplete release.
  await mkdir(output);
  await copyArtifactTree({
    source: standalone,
    destination: path.join(output, "website"),
    sourceRoot: standalone,
    skipPaths: ["public", ".next/static"],
  });
  await completeArtifactWork([
    copyArtifactTree({
      source: path.join(repository, "public"),
      destination: path.join(output, "website/public"),
      sourceRoot: path.join(repository, "public"),
    }),
    copyArtifactTree({
      source: path.join(repository, ".next/static"),
      destination: path.join(output, "website/.next/static"),
      sourceRoot: path.join(repository, ".next/static"),
    }),
  ]);
  await completeArtifactWork(
    [...runtimeScripts, ".github/bootstrap-policy.json"].map(async (name) => {
      const target = path.join(output, name);
      await ensureArtifactDirectory(path.dirname(target));
      await copyFile(
        await artifactFile(path.join(repository, name)),
        target,
        constants.COPYFILE_EXCL,
      );
    }),
  );
  const release = {
    schemaVersion: 1,
    releaseId,
    createdAt: new Date().toISOString(),
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    websiteBuildId: (
      await readArtifactFile(path.join(repository, ".next/BUILD_ID"))
    )
      .toString("utf8")
      .trim(),
    entrypoints: { website: "website/server.js" },
    runtimeDependenciesBundled: true,
  };
  await writeFile(
    path.join(output, "release.json"),
    JSON.stringify(release, null, 2) + "\n",
    { flag: "wx" },
  );
  return { directory: output, release };
}
await runDeliveryCommand(import.meta.main, defaultRepository, async () => {
  const result = await packageRelease({
    releaseId: parseReleaseArguments(process.argv.slice(2)),
  });
  console.info(
    `Packaged ${result.release.releaseId} for ${result.release.platform}/${result.release.arch}: ${result.directory}`,
  );
});
