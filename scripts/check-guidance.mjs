import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseDocument } from "yaml";

import { validateCiWorkflow } from "./check-ci.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
export const isSafeGuidancePath = (filename) => {
  if (
    typeof filename !== "string" ||
    !filename.trim() ||
    /[\0\r\n]/.test(filename) ||
    path.isAbsolute(filename) ||
    /^[A-Za-z]:/.test(filename)
  )
    return false;
  const normalized = filename.replaceAll("\\", "/");
  if (
    normalized.split("/").includes("..") ||
    normalized.startsWith("/") ||
    /(^|\/)(?:\.git|node_modules|\.next|coverage)(?:\/|$)/.test(normalized) ||
    /(^|\/)server\/data(?:\/|$)/.test(normalized)
  )
    return false;
  return (
    !/(^|\/)\.env(?:\.|$)/.test(normalized) ||
    path.posix.basename(normalized) === ".env.example"
  );
};

const resolveGuidancePath = async (root, filename) => {
  if (!isSafeGuidancePath(filename))
    throw new Error("Unsafe maintained guidance path: " + filename);
  const actualRoot = await realpath(root);
  let cursor = actualRoot;
  for (const part of filename.replaceAll("\\", "/").split("/")) {
    cursor = path.join(cursor, part);
    if ((await lstat(cursor)).isSymbolicLink())
      throw new Error(
        "Maintained guidance must not follow symbolic links: " + filename,
      );
  }
  return cursor;
};

export const readGuidanceFile = async (root, filename) =>
  readFile(await resolveGuidancePath(root, filename), "utf8");
export const validateAssistantLanguageFiles = (filenames) =>
  filenames
    .map((filename) => filename.replaceAll("\\", "/"))
    .filter(
      (filename) =>
        /(?:^|\/)AGENTS\.fa\.md$/.test(filename) ||
        (/^(?:\.agents|\.claude)\//.test(filename) &&
          filename.endsWith(".fa.md")),
    )
    .map(
      (filename) =>
        `Active assistant guidance must be English-only: ${filename}`,
    );
export const validateStandaloneManifest = (pkg) => {
  const errors = [];
  if (Object.hasOwn(pkg, "workspaces"))
    errors.push(
      "The project must use one root package, without npm workspaces",
    );
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ])
    for (const [name, version] of Object.entries(pkg[field] ?? {}))
      if (
        name.startsWith("@kernel/") ||
        /^(?:workspace:|file:|link:)/.test(version)
      )
        errors.push(
          "Project dependencies must be independently installable: " + name,
        );
  for (const [name, command] of Object.entries(pkg.scripts ?? {}))
    if (/(?:^|\s)--(?:workspace|workspaces|prefix)(?:=|\s|$)/.test(command))
      errors.push("Project scripts must run from the root package: " + name);
  return errors;
};
export const validateStandaloneLockfile = (lock, pkg) => {
  const errors = [];
  const locked = lock.packages?.[""];
  if (!locked || lock.name !== pkg.name)
    errors.push("The lockfile must describe the root project");
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
  ]) {
    const entries = (value) =>
      Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b));
    if (
      JSON.stringify(entries(locked?.[field])) !==
      JSON.stringify(entries(pkg[field]))
    )
      errors.push("Lockfile root dependency drift: " + field);
  }
  for (const [location, metadata] of Object.entries(lock.packages ?? {}))
    if (/^(?:apps|packages)\//.test(location) || metadata.link === true)
      errors.push("Lockfile contains a local project link: " + location);
  return errors;
};
const isStrings = (value) =>
  Array.isArray(value) &&
  value.every((entry) => typeof entry === "string" && entry.trim());
const duplicates = (values) => new Set(values).size !== values.length;

// Only a verified canonical runner may project the full manifest into CI.
// Other npm steps remain explicit, so an extra or advisory command cannot hide
// behind the projection. This inspects configuration without running workflows.
export const ciCommands = (content, manifest) => {
  const document = parseDocument(content, { uniqueKeys: true });
  if (document.errors.length)
    throw new Error("Guidance CI extraction requires valid YAML.");
  const workflow = document.toJS({ maxAliasCount: 0 });
  if (manifest !== undefined) validateCiWorkflow(content, manifest);
  const result = new Map();
  const policyValue = (value) =>
    value === undefined || value === false
      ? false
      : value === true
        ? true
        : "unsupported";
  for (const [id, job] of Object.entries(workflow?.jobs ?? {})) {
    const checks = [];
    for (const step of job.steps ?? []) {
      if (typeof step.run !== "string" || !/^npm run /.test(step.run.trim()))
        continue;
      const jobPolicy = policyValue(job["continue-on-error"]);
      const stepPolicy = policyValue(step["continue-on-error"]);
      const advisory =
        jobPolicy === "unsupported" || stepPolicy === "unsupported"
          ? "unsupported"
          : jobPolicy || stepPolicy;
      const command = step.run.trim();
      if (command === "npm run validate -- full" && manifest !== undefined) {
        const inventory = new Map(
          manifest.checks.map((check) => [check.id, check]),
        );
        for (const checkId of manifest.profiles.full)
          checks.push({ command: inventory.get(checkId)?.command, advisory });
      } else checks.push({ command, advisory });
    }
    if (checks.length) result.set(id, checks);
  }
  return result;
};

const validateCheckDefinition = (check, ci) => {
  const errors = [];
  if (
    !/^npm run [\w:-]+(?: .+)?$/.test(check.command ?? "") ||
    !["required", "advisory", "manual"].includes(check.kind) ||
    !isStrings(check.ciJobs) ||
    !isStrings(check.scopes)
  )
    return [`Invalid check definition: ${check.id}`];
  if (check.kind === "required" && !check.ciJobs.length)
    errors.push(`Required check has no CI job: ${check.id}`);
  for (const job of check.ciJobs) {
    const steps =
      ci.get(job)?.filter((step) => step.command === check.command) ?? [];
    if (steps.length !== 1)
      errors.push(`CI ${job} must run ${check.command} exactly once`);
    else if (steps[0].advisory !== (check.kind === "advisory"))
      errors.push(`CI advisory policy differs for ${check.id}`);
  }
  return errors;
};

const validateProfiles = (manifest, checks) => {
  const errors = [];
  for (const [name, values] of Object.entries(manifest.profiles)) {
    if (!isStrings(values) || duplicates(values)) {
      errors.push(`Invalid profile: ${name}`);
      continue;
    }
    for (const id of values)
      if (!checks.has(id))
        errors.push(`Unknown check ${id} in profile ${name}`);
  }
  const full = manifest.profiles.full;
  const required = manifest.checks
    .filter((check) => check.kind === "required")
    .map((check) => check.id);
  if (
    !isStrings(full) ||
    JSON.stringify([...full].sort()) !== JSON.stringify(required.sort())
  )
    errors.push(
      "Full profile must contain every required check and no advisory/manual checks",
    );
  return errors;
};

const validateSettingsProjection = (manifest, settings, checks) => {
  const errors = [];
  const full = manifest.profiles.full;
  const projection = isStrings(full)
    ? full.map((id) => checks.get(id)?.command)
    : [];
  if (JSON.stringify(settings.recommendedChecks) !== JSON.stringify(projection))
    errors.push(
      "settings.recommendedChecks must project validation.profiles.full in order",
    );
  if (
    settings.recommendedChecksSource?.path !== ".agents/validation.json" ||
    settings.recommendedChecksSource?.profile !== "full"
  )
    errors.push("Settings must identify the canonical validation manifest");
  for (const [name, expected] of Object.entries({
    navigation: ".agents/navigation.json",
    validation: ".agents/validation.json",
    evaluation: ".agents/evaluation/cases.json",
  })) {
    if (settings[name] !== expected)
      errors.push(`Settings ${name} must point to ${expected}`);
  }
  return errors;
};

const unregisteredCiChecks = (manifest, ci) => {
  const errors = [];
  for (const [job, steps] of ci)
    for (const step of steps) {
      if (
        !manifest.checks.some(
          (check) =>
            check.command === step.command && check.ciJobs?.includes(job),
        )
      )
        errors.push(`Unregistered CI check: ${job}: ${step.command}`);
    }
  return errors;
};

export const validateManifest = (manifest, settings, ci) => {
  if (
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.checks) ||
    !manifest.profiles
  )
    return ["Invalid validation manifest schema"];
  const ids = manifest.checks.map((check) => check.id);
  const errors = [];
  if (!isStrings(ids) || !ids.length || duplicates(ids))
    errors.push("Validation check IDs must be unique nonempty strings");
  const checks = new Map(manifest.checks.map((check) => [check.id, check]));
  return [
    ...errors,
    ...manifest.checks.flatMap((check) => validateCheckDefinition(check, ci)),
    ...validateProfiles(manifest, checks),
    ...validateSettingsProjection(manifest, settings, checks),
    ...unregisteredCiChecks(manifest, ci),
  ];
};

const validateReferencePaths = (paths, label, exists) => {
  if (!isStrings(paths)) return [`Invalid paths: ${label}`];
  return paths
    .filter((filename) => !exists(filename))
    .map((filename) => `Missing or unsafe path in ${label}: ${filename}`);
};

const validateReferenceChecks = (values, label, checks) => {
  if (!isStrings(values)) return [`Invalid checks: ${label}`];
  return values
    .filter((id) => !checks.has(id))
    .map((id) => `Unknown check in ${label}: ${id}`);
};

const validateNavigationTask = (task, checks, exists) => {
  const errors = [];
  if (typeof task.when !== "string" || !task.when.trim())
    errors.push(`Missing task trigger: ${task.id}`);
  for (const field of ["owners", "contracts", "tests"])
    errors.push(
      ...validateReferencePaths(task[field], `${task.id}.${field}`, exists),
    );
  if (task.rules !== undefined)
    errors.push(
      ...validateReferencePaths(task.rules, `${task.id}.rules`, exists),
    );
  if (!task.owners?.length) errors.push(`Task has no owner: ${task.id}`);
  errors.push(...validateReferenceChecks(task.checks, task.id, checks));
  return errors;
};

const validateEvaluationCase = (item, taskIds, checks, exists) => {
  const errors = [];
  if (typeof item.prompt?.en !== "string" || !item.prompt.en.trim())
    errors.push(`Case needs an English prompt: ${item.id}`);
  if (Object.keys(item.prompt ?? {}).some((key) => key !== "en"))
    errors.push(`Active case prompts must be English-only: ${item.id}`);
  if (
    !isStrings(item.taskIds) ||
    !item.taskIds.length ||
    item.taskIds.some((id) => !taskIds.includes(id))
  )
    errors.push(`Unknown or missing task reference: ${item.id}`);
  errors.push(...validateReferencePaths(item.evidence, item.id, exists));
  if (!item.evidence?.length)
    errors.push(`Case needs source evidence: ${item.id}`);
  errors.push(...validateReferenceChecks(item.checks, item.id, checks));
  if (
    !isStrings(item.mustExplain) ||
    !item.mustExplain.length ||
    !isStrings(item.mustNot) ||
    !item.mustNot.length
  )
    errors.push(`Case needs observable positive/negative criteria: ${item.id}`);
  return errors;
};

export const validateNavigation = (navigation, evaluation, checks, exists) => {
  if (navigation.schemaVersion !== 1 || !Array.isArray(navigation.tasks))
    return ["Invalid navigation schema"];
  if (evaluation.schemaVersion !== 1 || !Array.isArray(evaluation.cases))
    return ["Invalid evaluation schema"];
  const errors = [];
  const ids = navigation.tasks.map((task) => task.id);
  if (!isStrings(ids) || !ids.length || duplicates(ids))
    errors.push("Navigation task IDs must be unique and nonempty");
  const caseIds = evaluation.cases.map((item) => item.id);
  if (!isStrings(caseIds) || !caseIds.length || duplicates(caseIds))
    errors.push("Evaluation case IDs must be unique and nonempty");
  return [
    ...errors,
    ...navigation.tasks.flatMap((task) =>
      validateNavigationTask(task, checks, exists),
    ),
    ...evaluation.cases.flatMap((item) =>
      validateEvaluationCase(item, ids, checks, exists),
    ),
  ];
};

const markdownFiles = async (directory) => {
  const files = [];
  let entries;
  try {
    if ((await lstat(directory)).isSymbolicLink())
      throw new Error(
        "Guidance inventory must not contain symbolic links: " + directory,
      );
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(
        "Guidance inventory must not contain symbolic links: " + filename,
      );
    if (entry.isDirectory()) files.push(...(await markdownFiles(filename)));
    else if (entry.name.endsWith(".md")) files.push(filename);
  }
  return files;
};

export const checkGuideLinks = async (root, filename, content) => {
  const errors = [];
  const source = content.replace(/```[\s\S]*?```/g, "");
  const links = [...source.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
  // Claude memory imports are file references, not Markdown links.
  if (path.basename(filename) === "CLAUDE.md")
    links.push(
      ...[...source.matchAll(/^\s*@([^\s]+)\s*$/gm)].map((match) => match[1]),
    );
  const actualRoot = await realpath(root);
  for (const link of links) {
    if (/^(?:https?:|mailto:|codex:|#)/.test(link)) continue;
    let target;
    try {
      target = decodeURI(link.split("#")[0].replace(/^<|>$/g, ""));
    } catch {
      errors.push(`Malformed guide link: ${filename}: ${link}`);
      continue;
    }
    const resolved = path.resolve(path.dirname(filename), target);
    const relative = path.relative(root, resolved);
    if (!isSafeGuidancePath(relative.replaceAll(path.sep, "/"))) {
      errors.push(`Unsafe guide link: ${filename}: ${link}`);
      continue;
    }
    try {
      const actual = await realpath(resolved);
      const actualRelative = path.relative(actualRoot, actual);
      if (
        actualRelative === ".." ||
        actualRelative.startsWith(".." + path.sep) ||
        path.isAbsolute(actualRelative)
      )
        errors.push(`Guide link escapes repository: ${filename}: ${link}`);
    } catch {
      errors.push(
        `Missing guide link: ${path.relative(root, filename)}: ${link}`,
      );
    }
  }
  return errors;
};

const loadGuidanceDocuments = async (root) => {
  const json = async (filename) =>
    JSON.parse(await readGuidanceFile(root, filename));
  const [manifest, settings, navigation, evaluation, pkg, lock, workflow] =
    await Promise.all([
      json(".agents/validation.json"),
      json(".agents/settings.json"),
      json(".agents/navigation.json"),
      json(".agents/evaluation/cases.json"),
      json("package.json"),
      json("package-lock.json"),
      readGuidanceFile(root, ".github/workflows/ci.yml"),
    ]);
  return { manifest, settings, navigation, evaluation, pkg, lock, workflow };
};

const obsoleteProjectContainers = async (root) => {
  const errors = [];
  for (const obsolete of ["apps", "packages"]) {
    try {
      await stat(path.join(root, obsolete));
      errors.push("Obsolete project container must be removed: " + obsolete);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return errors;
};

const guidanceReferences = (settings, navigation, evaluation, manifest) => {
  const errors = [];
  for (const field of ["rules", "skills", "optionalHooks"])
    if (!isStrings(settings[field]))
      errors.push("Settings " + field + " must be a path array");
  const referencedPaths = [
    ...(Array.isArray(settings.rules) ? settings.rules : []),
    ...(Array.isArray(settings.skills) ? settings.skills : []),
    ...(Array.isArray(settings.optionalHooks) ? settings.optionalHooks : []),
  ];
  for (const task of navigation.tasks)
    for (const field of ["owners", "contracts", "tests"])
      referencedPaths.push(...(Array.isArray(task[field]) ? task[field] : []));
  for (const task of navigation.tasks)
    if (task.rules) referencedPaths.push(...task.rules);
  for (const item of evaluation.cases) referencedPaths.push(...item.evidence);
  for (const entry of manifest.externalWorkflows ?? [])
    referencedPaths.push(entry.path);
  return { paths: referencedPaths, errors };
};

const existingGuidanceReferences = async (root, referencedPaths) => {
  const found = new Set();
  for (const filename of new Set(referencedPaths)) {
    if (!isSafeGuidancePath(filename)) continue;
    try {
      await resolveGuidancePath(root, filename);
      found.add(filename);
    } catch {
      /* Report with the owning reference below. */
    }
  }
  return found;
};

const validateManifestScripts = (manifest, pkg) => {
  const errors = [];
  for (const check of manifest.checks) {
    const script = check.command.match(/^npm run ([\w:-]+)/)?.[1];
    if (
      /(?:^|\s)--(?:workspace|workspaces|prefix)(?:=|\s|$)/.test(check.command)
    )
      errors.push(
        "Manifest commands must run from the root package: " + check.command,
      );
    if (!script || !pkg.scripts?.[script])
      errors.push(`Manifest command has no package script: ${check.command}`);
  }
  return errors;
};

const maintainedMarkdown = async (root) => {
  const markdown = [
    ...(await markdownFiles(path.join(root, ".agents"))),
    ...(await markdownFiles(path.join(root, ".claude"))),
    ...(await markdownFiles(path.join(root, "docs"))),
    ...(await readdir(root))
      .filter((name) => name.endsWith(".md"))
      .map((name) => path.join(root, name)),
  ];
  for (const filename of [
    "AGENTS.md",
    "docs/bootstrap.md",
    "docs/bootstrap.fa.md",
    "docs/source-navigation.md",
    "docs/source-navigation.fa.md",
    "docs/comprehension-evaluation.md",
    "docs/comprehension-evaluation.fa.md",
  ])
    markdown.push(path.join(root, filename));
  markdown.push(
    ...(await markdownFiles(path.join(root, "src"))).filter((filename) =>
      /(?:^|[\\/])AGENTS(?:\.fa)?\.md$/.test(filename),
    ),
  );
  return [...new Set(markdown)];
};

const validateMaintainedMarkdown = async (root, markdown) => {
  const errors = validateAssistantLanguageFiles(
    markdown.map((filename) => path.relative(root, filename)),
  );
  for (const filename of markdown) {
    let content;
    try {
      content = await readGuidanceFile(root, path.relative(root, filename));
    } catch {
      errors.push(`Missing maintained guide: ${path.relative(root, filename)}`);
      continue;
    }
    errors.push(...(await checkGuideLinks(root, filename, content)));
  }
  return errors;
};

export const checkGuidance = async (root = repository) => {
  const { manifest, settings, navigation, evaluation, pkg, lock, workflow } =
    await loadGuidanceDocuments(root);
  const references = guidanceReferences(
    settings,
    navigation,
    evaluation,
    manifest,
  );
  const found = await existingGuidanceReferences(root, references.paths);
  const markdown = await maintainedMarkdown(root);
  const errors = [
    ...validateManifest(manifest, settings, ciCommands(workflow, manifest)),
    ...validateStandaloneManifest(pkg),
    ...validateStandaloneLockfile(lock, pkg),
    ...(await obsoleteProjectContainers(root)),
    ...references.errors,
    ...validateNavigation(
      navigation,
      evaluation,
      new Set(manifest.checks.map((check) => check.id)),
      (filename) => found.has(filename),
    ),
    ...references.paths
      .filter((filename) => !found.has(filename))
      .map(
        (filename) => `Guidance references missing/unsafe path: ${filename}`,
      ),
    ...validateManifestScripts(manifest, pkg),
    ...(await validateMaintainedMarkdown(root, markdown)),
  ];
  return {
    errors,
    checks: manifest.checks.length,
    tasks: navigation.tasks.length,
    cases: evaluation.cases.length,
    markdownFiles: markdown.length,
  };
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await checkGuidance();
  if (result.errors.length) {
    console.error(result.errors.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      `Guidance checked: ${result.checks} checks, ${result.tasks} tasks, ${result.cases} evaluation cases, ${result.markdownFiles} Markdown files. Model/client behavior is not evaluated by this check.`,
    );
}
