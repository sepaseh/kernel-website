import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  checkGuidance,
  checkGuideLinks,
  ciCommands,
  isSafeGuidancePath,
  readGuidanceFile,
  validateAssistantLanguageFiles,
  validateManifest,
  validateNavigation,
  validateStandaloneLockfile,
  validateStandaloneManifest,
} from "./check-guidance.mjs";

test("host skill links and memory imports resolve safely to canonical local files", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "website-guide-links-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const adapter = path.join(root, ".claude/skills/design-ui/SKILL.md");
  const canonical = path.join(root, ".agents/skills/design-ui/SKILL.md");
  await mkdir(path.dirname(adapter), { recursive: true });
  await mkdir(path.dirname(canonical), { recursive: true });
  await writeFile(canonical, "Canonical instructions\n");
  await writeFile(path.join(root, "AGENTS.md"), "Project instructions\n");
  assert.deepEqual(
    await checkGuideLinks(
      root,
      adapter,
      "[Workflow](../../../.agents/skills/design-ui/SKILL.md)",
    ),
    [],
  );
  const errors = await checkGuideLinks(
    root,
    adapter,
    "[Missing](missing.md)\n[Outside](../../../../outside.md)",
  );
  assert.ok(errors.some((error) => error.includes("Missing guide link")));
  assert.ok(errors.some((error) => error.includes("Unsafe guide link")));
  assert.deepEqual(
    await checkGuideLinks(root, path.join(root, "CLAUDE.md"), "@AGENTS.md\n"),
    [],
  );
  assert.ok(
    (
      await checkGuideLinks(root, path.join(root, "CLAUDE.md"), "@missing.md\n")
    ).some((error) => error.includes("Missing guide link")),
  );
});

const fixture = () => {
  const manifest = {
    schemaVersion: 1,
    checks: [
      {
        id: "types",
        command: "npm run typecheck",
        kind: "required",
        ciJobs: ["check"],
        scopes: ["all"],
      },
      {
        id: "lab",
        command: "npm run lighthouse",
        kind: "advisory",
        ciJobs: ["build"],
        scopes: ["website"],
      },
    ],
    profiles: { full: ["types"], website: ["types"] },
  };
  const settings = {
    navigation: ".agents/navigation.json",
    validation: ".agents/validation.json",
    evaluation: ".agents/evaluation/cases.json",
    recommendedChecks: ["npm run typecheck"],
    recommendedChecksSource: {
      path: ".agents/validation.json",
      profile: "full",
    },
  };
  const ci = ciCommands(`jobs:
  check:
    steps:
      - run: npm run typecheck
  build:
    steps:
      - name: Lighthouse advisory audit
        continue-on-error: true
        run: npm run lighthouse
`);
  return { manifest, settings, ci };
};

test("CI extraction preserves job and advisory boundaries", () => {
  const { ci, manifest, settings } = fixture();
  assert.deepEqual(ci.get("check"), [
    { command: "npm run typecheck", advisory: false },
  ]);
  assert.deepEqual(ci.get("build"), [
    { command: "npm run lighthouse", advisory: true },
  ]);
  assert.deepEqual(validateManifest(manifest, settings, ci), []);
});

test("the verified canonical full runner projects every required check once", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  const manifest = JSON.parse(
    await readFile(
      new URL("../.agents/validation.json", import.meta.url),
      "utf8",
    ),
  );
  const settings = JSON.parse(
    await readFile(
      new URL("../.agents/settings.json", import.meta.url),
      "utf8",
    ),
  );
  const ci = ciCommands(workflow, manifest);
  assert.deepEqual(validateManifest(manifest, settings, ci), []);
  assert.deepEqual(
    ci.get("check").map(({ command }) => command),
    settings.recommendedChecks,
  );
  for (const changed of [
    workflow.replace(
      "run: npm run validate -- full",
      "if: false\n        run: npm run validate -- full",
    ),
    workflow.replace("npm run validate -- full", "npm run validate -- focused"),
  ])
    assert.throws(
      () => ciCommands(changed, manifest),
      /unconditional|canonical full gate/,
    );
  const extra = workflow.replace(
    "      - run: npm ci",
    "      - run: npm run unregistered\n      - run: npm ci",
  );
  assert.ok(
    validateManifest(manifest, settings, ciCommands(extra, manifest)).some(
      (error) => error.includes("Unregistered CI"),
    ),
  );
  assert.throws(() => ciCommands("jobs: [invalid"), /valid YAML/);
});

test("detects stale projections, missing CI gates and advisory promotion", () => {
  const { manifest, settings, ci } = fixture();
  settings.recommendedChecks = ["npm run stale"];
  manifest.profiles.full.push("lab");
  ci.get("check")[0].advisory = true;
  ci.get("build")[0].command = "npm run other";
  const errors = validateManifest(manifest, settings, ci).join("\n");
  for (const message of [
    "project",
    "every required",
    "advisory policy",
    "exactly once",
    "Unregistered CI",
  ])
    assert.ok(errors.includes(message), message);
});

test("rejects duplicate IDs and unknown profile checks", () => {
  const { manifest, settings, ci } = fixture();
  manifest.checks.push(manifest.checks[0]);
  manifest.profiles.website.push("ghost");
  const errors = validateManifest(manifest, settings, ci).join("\n");
  assert.ok(errors.includes("unique"));
  assert.ok(errors.includes("Unknown check ghost"));
});

test("rejects stale instruction-discovery pointers", () => {
  const { manifest, settings, ci } = fixture();
  for (const key of ["navigation", "validation", "evaluation"])
    settings[key] = ".agents/missing.json";
  const errors = validateManifest(manifest, settings, ci).join("\n");
  for (const key of ["navigation", "validation", "evaluation"])
    assert.ok(errors.includes(`Settings ${key}`));
});

test("required CI checks cannot silently become advisory at job level", () => {
  const { manifest, settings } = fixture();
  const ci = ciCommands(`jobs:
  check:
    continue-on-error: true
    steps:
      - run: npm run typecheck
  build:
    steps:
      - run: npm run lighthouse
        continue-on-error: true
`);
  assert.ok(
    validateManifest(manifest, settings, ci).some((message) =>
      message.includes("advisory policy differs for types"),
    ),
  );
});

test("navigation/evaluation validate owners, evidence, English prompts and referenced checks", () => {
  const navigation = {
    schemaVersion: 1,
    tasks: [
      {
        id: "account",
        when: "Change profile",
        owners: ["owner.ts"],
        contracts: [],
        tests: ["test.ts"],
        checks: ["types"],
      },
    ],
  };
  const evaluation = {
    schemaVersion: 1,
    cases: [
      {
        id: "profile",
        prompt: { en: "Explain" },
        taskIds: ["account"],
        evidence: ["owner.ts"],
        mustExplain: ["HTTP ownership"],
        mustNot: ["Import persistence"],
        checks: ["types"],
      },
    ],
  };
  const exists = (filename) => ["owner.ts", "test.ts"].includes(filename);
  assert.deepEqual(
    validateNavigation(navigation, evaluation, new Set(["types"]), exists),
    [],
  );
  navigation.tasks[0].owners = ["missing.ts"];
  evaluation.cases[0].prompt.en = "";
  evaluation.cases[0].taskIds = ["unknown"];
  evaluation.cases[0].checks = ["missing-check"];
  const errors = validateNavigation(
    navigation,
    evaluation,
    new Set(["types"]),
    exists,
  ).join("\n");
  for (const message of [
    "missing.ts",
    "English prompt",
    "task reference",
    "missing-check",
  ])
    assert.ok(errors.includes(message), message);
});

test("active assistant translations are rejected without banning human docs", () => {
  assert.deepEqual(
    validateAssistantLanguageFiles([
      ".agents/skills/design-ui/SKILL.md",
      "docs/accessibility.fa.md",
      "DESIGN.fa.md",
      "README.fa.md",
      "deploy/docker/README.fa.md",
    ]),
    [],
  );
  assert.equal(
    validateAssistantLanguageFiles([
      "AGENTS.fa.md",
      "src/feature/AGENTS.fa.md",
      ".agents/rules/example.fa.md",
      ".agents/skills/design-ui/SKILL.fa.md",
      ".claude/skills/design-ui/SKILL.fa.md",
    ]).length,
    5,
  );
  const navigation = {
    schemaVersion: 1,
    tasks: [
      {
        id: "design",
        when: "Change UI",
        owners: ["owner.ts"],
        contracts: [],
        tests: [],
        checks: ["types"],
      },
    ],
  };
  const evaluation = {
    schemaVersion: 1,
    cases: [
      {
        id: "design",
        prompt: { en: "Explain the source", fa: "Translated prompt" },
        taskIds: ["design"],
        evidence: ["owner.ts"],
        mustExplain: ["Source ownership"],
        mustNot: ["Claim unexecuted checks"],
        checks: ["types"],
      },
    ],
  };
  assert.ok(
    validateNavigation(
      navigation,
      evaluation,
      new Set(["types"]),
      () => true,
    ).some((error) => error.includes("prompts must be English-only")),
  );
});

test("current guidance paths, instruction entrypoints and canonical check matrix agree", async () => {
  const result = await checkGuidance();
  assert.ok(result.tasks > 0);
  assert.ok(result.cases > 0);
  assert.deepEqual(result.errors, []);
});

test("guidance indexes reject traversal, private state and generated dependencies", () => {
  for (const value of [
    "../kernel/AGENTS.md",
    "C:/private/key",
    ".env.local",
    "src/.env.production",
    "server/data/test.sqlite",
    "node_modules/pkg/index.js",
    ".git/config",
    ".next/server.js",
    "docs/line\nbreak.md",
  ])
    assert.equal(isSafeGuidancePath(value), false, value);
  for (const value of [
    "src/index.ts",
    "src/contracts/index.ts",
    "deploy/docker/.env.example",
    "deploy/native/api.env.example",
  ])
    assert.equal(isSafeGuidancePath(value), true, value);
});

test("malformed encoded guide links produce a diagnostic without being followed", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "website-guide-encoding-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const errors = await checkGuideLinks(
    root,
    path.join(root, "guide.md"),
    "[Bad](%E0%A4%A)\n[Private](.env%2Elocal)",
  );
  assert.ok(errors.some((error) => error.includes("Malformed guide link")));
  assert.ok(errors.some((error) => error.includes("Unsafe guide link")));
});

test("maintained JSON and Markdown reads reject linked ancestors before loading content", async (t) => {
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), "website-guide-private-link-"),
  );
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, "project");
  const outside = path.join(temporary, "synthetic-outside");
  await mkdir(root);
  await mkdir(outside);
  await writeFile(
    path.join(outside, "settings.json"),
    "not JSON; must not be loaded",
  );
  await writeFile(path.join(outside, "guide.md"), "synthetic private marker");
  await symlink(outside, path.join(root, ".agents"), "junction");
  for (const filename of [".agents/settings.json", ".agents/guide.md"])
    await assert.rejects(
      readGuidanceFile(root, filename),
      /must not follow symbolic links/,
    );
  await assert.rejects(
    readGuidanceFile(root, "../synthetic-outside/settings.json"),
    /Unsafe maintained/,
  );
});

test("malformed manifest and navigation definitions fail explicitly", () => {
  const { manifest, settings, ci } = fixture();
  assert.deepEqual(
    validateManifest({ ...manifest, schemaVersion: 0 }, settings, ci),
    ["Invalid validation manifest schema"],
  );
  manifest.checks[0].ciJobs = [];
  manifest.checks.push({
    id: "broken",
    command: "echo false",
    kind: "unknown",
    ciJobs: [],
    scopes: [],
  });
  manifest.profiles.empty = null;
  const failures = validateManifest(manifest, settings, ci).join("\n");
  assert.match(failures, /Required check has no CI job/);
  assert.match(failures, /Invalid check definition/);
  assert.match(failures, /Invalid profile/);
  assert.deepEqual(
    validateNavigation({}, {}, new Set(), () => false),
    ["Invalid navigation schema"],
  );
  assert.deepEqual(
    validateNavigation(
      { schemaVersion: 1, tasks: [] },
      {},
      new Set(),
      () => false,
    ),
    ["Invalid evaluation schema"],
  );
  const invalid = validateNavigation(
    {
      schemaVersion: 1,
      tasks: [
        {
          id: "",
          when: "",
          owners: [],
          contracts: null,
          tests: [],
          checks: null,
          rules: null,
        },
      ],
    },
    {
      schemaVersion: 1,
      cases: [
        {
          id: "",
          taskIds: [],
          evidence: [],
          checks: [],
          mustExplain: [],
          mustNot: [],
        },
      ],
    },
    new Set(),
    () => false,
  ).join("\n");
  for (const message of [
    "task IDs",
    "task trigger",
    "Invalid paths",
    "no owner",
    "Invalid checks",
    "case IDs",
    "English prompt",
    "source evidence",
    "positive/negative",
  ])
    assert.ok(invalid.includes(message), message);
});
test("single-project manifest rejects local package dependencies and workspace scripts", () => {
  assert.deepEqual(
    validateStandaloneManifest({
      name: "kernel-project",
      scripts: { build: "tsc", test: "node --test src/example.test.ts" },
      dependencies: { hono: "^4.0.0" },
    }),
    [],
  );
  const errors = validateStandaloneManifest({
    workspaces: [],
    dependencies: { "@kernel/contracts": "*", outside: "file:../kernel" },
    devDependencies: { local: "workspace:*", linked: "link:../shared" },
    scripts: { test: "npm run test --workspace=other" },
  });
  assert.equal(errors.length, 6);
  assert.ok(errors.some((message) => message.includes("root package")));
  for (const name of ["@kernel/contracts", "outside", "local", "linked"])
    assert.ok(
      errors.some((message) => message.endsWith(name)),
      name,
    );
});

test("lockfile proves root dependency ownership and rejects stale local links", () => {
  const pkg = { name: "kernel-project", dependencies: { hono: "^4.0.0" } };
  const lock = {
    name: pkg.name,
    packages: {
      "": { dependencies: pkg.dependencies },
      "node_modules/hono": { version: "4.0.0" },
    },
  };
  assert.deepEqual(validateStandaloneLockfile(lock, pkg), []);
  lock.packages[""].dependencies = { hono: "^3.0.0" };
  lock.packages["apps/old"] = { name: "old" };
  lock.packages["node_modules/local"] = {
    link: true,
    resolved: "packages/old",
  };
  const errors = validateStandaloneLockfile(lock, pkg);
  assert.equal(errors.length, 3);
  assert.ok(errors.some((message) => message.includes("dependency drift")));
  assert.ok(errors.some((message) => message.endsWith("apps/old")));
  assert.ok(errors.some((message) => message.endsWith("node_modules/local")));
});
