import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This reviewed list is independent of the editable publication marker.
export const publicationFiles = Object.freeze([
  ".agents/README.md",
  ".agents/navigation.json",
  ".agents/rules/branches.md",
  ".agents/rules/code-quality.md",
  ".agents/rules/code-review.md",
  ".agents/rules/commits.md",
  ".agents/rules/git.md",
  ".agents/rules/guidance.md",
  ".agents/rules/issues.md",
  ".agents/rules/ordering.md",
  ".agents/rules/pull-requests.md",
  ".agents/rules/safety.md",
  ".agents/rules/testing.md",
  ".agents/settings.json",
  ".agents/skills/commit/SKILL.md",
  ".agents/skills/create-issue/SKILL.md",
  ".agents/skills/create-pr/SKILL.md",
  ".agents/skills/review-pr/SKILL.md",
  ".agents/skills/start-issue/SKILL.md",
  ".agents/skills/validate-change/SKILL.md",
  ".agents/validation.json",
  ".coderabbit.yaml",
  ".gitattributes",
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/bootstrap-policy.json",
  ".github/dependabot.yml",
  ".github/workflows/ci.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/pr-policy.yml",
  ".github/workflows/review-policy.yml",
  ".github/workflows/review-signal.yml",
  ".github/workflows/sonar.yml",
  ".gitignore",
  ".nvmrc",
  ".prettierignore",
  ".prettierrc.json",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "README.md",
  "SECURITY.md",
  "docs/bootstrap.md",
  "docs/branch-protection.md",
  "docs/reviews.md",
  "docs/sonarqube.md",
  "docs/source-navigation.md",
  "docs/test-reliability.md",
  "docs/testing.md",
  "docs/validation.md",
  "eslint.config.mjs",
  "package-lock.json",
  "package.json",
  "scripts/check-boundaries.mjs",
  "scripts/check-boundaries.test.mjs",
  "scripts/check-ci.mjs",
  "scripts/check-ci.test.mjs",
  "scripts/check-guidance.mjs",
  "scripts/check-guidance.test.mjs",
  "scripts/check-pr-size.mjs",
  "scripts/check-pr-size.test.mjs",
  "scripts/review-policy.mjs",
  "scripts/review-policy.test.mjs",
  "scripts/run-audit.mjs",
  "scripts/run-audit.test.mjs",
  "scripts/validate-bootstrap.mjs",
  "scripts/validate-bootstrap.test.mjs",
  "scripts/validate.mjs",
  "scripts/validate.test.mjs",
  "scripts/validation.integration.test.mjs",
  "sonar-project.properties",
  "vitest.config.mjs",
]);
const admitted = new Set(publicationFiles);
const ignoredDirectories = new Set([".git", "node_modules", "coverage"]);
const repository = fileURLToPath(new URL("../", import.meta.url));

// Logical publication paths use UTF-16 ordinal order on every host.
export const comparePublicationPaths = (left, right) => {
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

export async function completePublicationWork(operations) {
  const results = await Promise.allSettled(operations);
  const failures = results
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(
      failures,
      failures.map((failure) => failure.message).join("\n"),
    );
  return results.map((result) => result.value);
}

export function validateBootstrapPolicy(policy) {
  assert.equal(policy?.schemaVersion, 1, "Unsupported publication schema.");
  assert.equal(policy.phase, "governance", "Only governance is published.");
  assert.equal(
    policy.applicationReady,
    false,
    "Application readiness must remain false.",
  );
  assert.equal(
    policy.maximumChangedFiles,
    100,
    "The PR file limit remains 100.",
  );
  assert.deepEqual(Object.keys(policy).sort(comparePublicationPaths), [
    "allowedFiles",
    "applicationReady",
    "maximumChangedFiles",
    "phase",
    "schemaVersion",
  ]);
  assert.ok(
    Array.isArray(policy.allowedFiles),
    "An exact publication list is required.",
  );
  assert.equal(
    new Set(policy.allowedFiles).size,
    policy.allowedFiles.length,
    "Duplicate publication path.",
  );
  assert.deepEqual(
    [...policy.allowedFiles].sort(comparePublicationPaths),
    [...publicationFiles].sort(comparePublicationPaths),
    "The reviewed publication inventory must match exactly.",
  );
  return new Set(policy.allowedFiles);
}

async function inspectAncestors(cursor, parts, index = 0) {
  const entry = await lstat(cursor);
  assert.equal(
    entry.isSymbolicLink(),
    false,
    "Publication paths cannot contain symbolic links.",
  );
  return index === parts.length
    ? entry
    : inspectAncestors(path.join(cursor, parts[index]), parts, index + 1);
}

export async function ordinaryPath(filename, directory = false) {
  const absolute = path.resolve(filename);
  const origin = path.parse(absolute).root;
  const parts = absolute.slice(origin.length).split(path.sep).filter(Boolean);
  const entry = await inspectAncestors(origin, parts);
  assert.ok(
    directory ? entry.isDirectory() : entry.isFile(),
    "Unexpected publication path type.",
  );
  return absolute;
}

export async function readPublishedFile(root, filename) {
  assert.ok(admitted.has(filename), "Unpublished file reference: " + filename);
  const directory = await ordinaryPath(root, true);
  return readFile(await ordinaryPath(path.join(directory, filename)), "utf8");
}

async function inspectDirectory(root, relative, found) {
  const entries = await readdir(path.join(root, relative), {
    withFileTypes: true,
  });
  await completePublicationWork(
    entries.map(async (entry) => {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      assert.equal(
        entry.isSymbolicLink(),
        false,
        "Publication paths cannot contain symbolic links.",
      );
      if (!relative && ignoredDirectories.has(name)) {
        assert.ok(
          entry.isDirectory(),
          "Ignored output must be an ordinary directory.",
        );
        return;
      }
      if (entry.isDirectory()) {
        assert.ok(
          publicationFiles.some((file) => file.startsWith(name + "/")),
          "Unexpected publication directory: " + name,
        );
        return inspectDirectory(root, name, found);
      } else {
        assert.ok(
          entry.isFile() && admitted.has(name),
          "Unexpected publication file: " + name,
        );
        found.add(name);
      }
    }),
  );
}

export async function inspectBootstrap(root = repository) {
  const directory = await ordinaryPath(root, true);
  const found = new Set();
  // Reject unreviewed/private names before reading any file contents.
  await inspectDirectory(directory, "", found);
  assert.deepEqual(
    [...found].sort(comparePublicationPaths),
    [...publicationFiles].sort(comparePublicationPaths),
    "Missing declared publication files.",
  );
  const policy = JSON.parse(
    await readPublishedFile(directory, ".github/bootstrap-policy.json"),
  );
  validateBootstrapPolicy(policy);
  await completePublicationWork(
    publicationFiles
      .filter((file) => file.endsWith(".json"))
      .map(async (filename) =>
        JSON.parse(await readPublishedFile(directory, filename)),
      ),
  );
  publicationFiles
    .filter((file) => file.endsWith(".mjs"))
    .forEach((filename) => {
      const result = spawnSync(
        process.execPath,
        ["--check", path.join(directory, filename)],
        { cwd: directory, env: {}, encoding: "utf8", windowsHide: true },
      );
      assert.equal(
        result.error,
        undefined,
        "JavaScript syntax verification could not run.",
      );
      assert.equal(
        result.status,
        0,
        "Invalid JavaScript syntax: " + filename + "\n" + result.stderr,
      );
    });
  return { phase: policy.phase, applicationReady: false, files: found.size };
}

if (import.meta.main) {
  await inspectBootstrap();
  console.log(
    "Exact governance publication passed; application readiness remains false.",
  );
}
