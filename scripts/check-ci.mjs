import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseDocument } from "yaml";

const repository = fileURLToPath(new URL("../", import.meta.url));
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const pythonAction =
  "actions/setup-python@6d4fd22b20465ccc0f7354476588e8df7c9ca0e0";
const checkoutAction =
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1";
const nodeAction =
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020";
const artifactAction =
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a";
const fixtureInstallation = [
  'git clone --no-checkout https://github.com/sepaseh/kernel-api.git "$env:KERNEL_API_DIRECTORY"',
  "if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }",
  'git -C "$env:KERNEL_API_DIRECTORY" checkout --detach 4755d62d14fb9d53cbe9d6246ca9be6bb4a3a7a9',
  "if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }",
  'npm --prefix "$env:KERNEL_API_DIRECTORY" ci',
  "if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }",
  '"KERNEL_API_DIRECTORY=$env:KERNEL_API_DIRECTORY" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append',
].join("\n");
const chromiumInstallation =
  "node node_modules/@playwright/test/cli.js install chromium";
const applicationChecks = [
  "snapshot",
  "ci-policy",
  "guidance",
  "audit",
  "boundaries",
  "typecheck",
  "lint",
  "format",
  "unit-coverage",
  "governance-coverage",
  "font-integrity",
  "dead-code",
  "build",
  "e2e",
  "visual",
];
const applicationEnvironment = {
  HOSTNAME: "127.0.0.1",
  PORT: "3010",
  WEBSITE_URL: "http://127.0.0.1:3010",
  API_BASE_URL: "http://127.0.0.1:3100",
  WEBSITE_INDEXING_ENABLED: "false",
  NODE_ENV: "production",
  KERNEL_SYNTHETIC_ENV: "1",
  PLAYWRIGHT_BROWSERS_PATH: "0",
  NPM_CONFIG_INCLUDE: "dev",
};
const isRunnablePhase = (phase) =>
  phase === "application" || phase === "operations";

const assertPullRequestTrigger = (workflow) => {
  if (!isRecord(workflow.on) || !Object.hasOwn(workflow.on, "pull_request"))
    throw new Error("CI must run on pull_request events, including drafts.");
  const event = workflow.on.pull_request;
  if (event === null) return;
  if (!isRecord(event))
    throw new Error("The pull_request trigger must be an unfiltered mapping.");
  const filters = ["paths", "paths-ignore", "branches", "branches-ignore"];
  if (filters.some((key) => Object.hasOwn(event, key)))
    throw new Error("PR CI must not filter changed paths or target branches.");
  if (
    event.types !== undefined &&
    (!Array.isArray(event.types) ||
      ["opened", "synchronize", "reopened", "ready_for_review"].some(
        (type) => !event.types.includes(type),
      ))
  )
    throw new Error("PR CI must retain every required pull_request activity.");
};

const assertRootDirectory = (directory) => {
  if (directory !== undefined && directory !== ".")
    throw new Error("Canonical validation must run in the repository root.");
};

const assertRunSettings = (settings) => {
  assertRootDirectory(settings?.["working-directory"]);
  if (settings?.shell !== undefined)
    throw new Error(
      "Canonical validation must use GitHub's default fail-closed shell.",
    );
};

const assertUnconditional = (entry) => {
  if (
    Object.hasOwn(entry, "if") ||
    (entry["continue-on-error"] !== undefined &&
      entry["continue-on-error"] !== false)
  )
    throw new Error(
      "Required CI execution must be unconditional and fail closed.",
    );
};

const assertCheckJob = (workflow) => {
  const job = workflow.jobs?.check;
  if (!isRecord(job) || !Array.isArray(job.steps))
    throw new Error("CI needs the check job and its validation steps.");
  assertUnconditional(job);
  if (Object.hasOwn(job, "needs") || Object.hasOwn(job, "strategy"))
    throw new Error(
      "The complete check job must not depend on another job or use a matrix.",
    );
  assertRunSettings(workflow.defaults?.run);
  assertRunSettings(job.defaults?.run);
  return job;
};

const assertCanonicalSteps = (job) => {
  const commandSteps = (command) =>
    job.steps.flatMap((step, index) =>
      isRecord(step) &&
      typeof step.run === "string" &&
      step.run.trim() === command
        ? [{ step, index }]
        : [],
    );
  const installs = commandSteps("npm ci");
  const fullRuns = commandSteps("npm run validate -- full");
  if (installs.length !== 1 || fullRuns.length !== 1)
    throw new Error(
      "CI must install once and invoke the canonical full gate once.",
    );
  if (installs[0].index >= fullRuns[0].index)
    throw new Error("npm ci must precede complete canonical validation.");
  for (const { step } of [...installs, ...fullRuns]) {
    assertUnconditional(step);
    assertRunSettings(step);
  }
};

const assertFontTooling = (job, command) => {
  if (!isRecord(job) || !Array.isArray(job.steps))
    throw new Error("Font verification requires an explicit job and steps.");
  const entries = job.steps.map((step, index) => ({ step, index }));
  const setups = entries.filter(({ step }) => step.uses === pythonAction);
  const installs = entries.filter(
    ({ step }) =>
      step.run?.trim() ===
      "python -m pip install --requirement font-source/requirements.txt",
  );
  const checks = entries.filter(({ step }) => step.run?.trim() === command);
  if (
    setups.length !== 1 ||
    installs.length !== 1 ||
    checks.length !== 1 ||
    setups[0].step.with?.["python-version"] !== "3.14.4" ||
    setups[0].index >= installs[0].index ||
    installs[0].index >= checks[0].index
  )
    throw new Error(
      "Pinned Python setup and font dependencies must precede required font verification.",
    );
  for (const { step } of [...setups, ...installs, ...checks]) {
    assertUnconditional(step);
    assertRunSettings(step);
  }
};

export const validateSonarFontWorkflow = (content) => {
  const document = parseDocument(content, { uniqueKeys: true });
  if (document.errors.length)
    throw new Error("Sonar workflow must be valid YAML.");
  const workflow = document.toJS({ maxAliasCount: 0 });
  const job = workflow?.jobs?.analysis;
  assertRunSettings(workflow?.defaults?.run);
  assertRunSettings(job?.defaults?.run);
  assertFontTooling(job, "npm run check:fonts");
  const font = job.steps.findIndex(
    (step) => step.run?.trim() === "npm run check:fonts",
  );
  const scanners = job.steps.flatMap((step, index) =>
    typeof step.uses === "string" &&
    step.uses.startsWith("SonarSource/sonarqube-scan-action@")
      ? [index]
      : [],
  );
  if (scanners.length !== 1 || scanners[0] <= font)
    throw new Error(
      "Real Python coverage must be generated before the Sonar scanner.",
    );
  assertUnconditional(job.steps[scanners[0]]);
};

const assertCheckOwnership = (manifest) => {
  if (!Array.isArray(manifest?.checks))
    throw new Error("CI needs the canonical required-check inventory.");
  const required = manifest.checks.filter((check) => check.kind === "required");
  const applicationOwners = new Map([
    ["build", ["check", "build", "e2e", "visual"]],
    ["e2e", ["check", "e2e"]],
    ["visual", ["check", "visual"]],
  ]);
  const expectedOwners = (check) =>
    isRunnablePhase(manifest.phase)
      ? (applicationOwners.get(check.id) ?? ["check"])
      : ["check"];
  if (
    !required.length ||
    required.some(
      (check) =>
        !Array.isArray(check.ciJobs) ||
        check.ciJobs.join(",") !== expectedOwners(check).join(","),
    )
  )
    throw new Error(
      isRunnablePhase(manifest.phase)
        ? "Application checks must retain their exact job ownership."
        : "Every current required check must belong to check; a multi-job phase needs an explicit CI policy transition.",
    );
};

const sameRecord = (actual, expected) =>
  isRecord(actual) &&
  Object.keys(actual).length === Object.keys(expected).length &&
  Object.entries(expected).every(([key, value]) => actual[key] === value);

const applicationStepKind = (step) => {
  if (!isRecord(step))
    throw new Error("Application CI steps must be mappings.");
  const command = step.run?.trim().replaceAll("\r\n", "\n");
  const kind = new Map([
    ["npm ci", "install"],
    [fixtureInstallation, "fixture"],
    [chromiumInstallation, "chromium"],
    [
      "python -m pip install --requirement font-source/requirements.txt",
      "fonts",
    ],
    ["npm run validate -- full", "full"],
    ["npm run build", "build"],
    ["npm run test:e2e", "e2e"],
    ["npm run test:visual", "visual"],
    [checkoutAction, "checkout"],
    [nodeAction, "node"],
    [pythonAction, "python"],
    [artifactAction, "artifact"],
  ]).get(command ?? step.uses);
  if (!kind || (step.run !== undefined && step.uses !== undefined))
    throw new Error(
      "Application CI requires its exact pinned actions and commands.",
    );
  assertRunSettings(step);
  if (kind === "artifact") {
    if (step.if !== "${{ !cancelled() }}")
      throw new Error("Application evidence must upload unless cancelled.");
    if (step["continue-on-error"] !== undefined)
      throw new Error("Application evidence upload must preserve failures.");
  } else assertUnconditional(step);
  if (kind === "fixture") {
    if (
      !sameRecord(step.env, {
        KERNEL_API_DIRECTORY: "${{ runner.temp }}/kernel-api-fixture",
      })
    )
      throw new Error(
        "The API fixture must use its explicit owned runner-temp directory.",
      );
  } else if (step.env !== undefined)
    throw new Error(
      "Required application steps cannot override synthetic inputs.",
    );
  const setupOptions = new Map([
    ["checkout", { "persist-credentials": false }],
    ["node", { "node-version-file": ".nvmrc", cache: "npm" }],
    ["python", { "python-version": "3.14.4" }],
  ]).get(kind);
  if (setupOptions && !sameRecord(step.with, setupOptions))
    throw new Error(
      "Application actions must retain exact source and runtime setup.",
    );
  return kind;
};

const assertApplicationJob = (workflow, id, sequence) => {
  const job = workflow.jobs?.[id];
  if (!isRecord(job) || !Array.isArray(job.steps))
    throw new Error(`Application CI requires the real ${id} job.`);
  assertUnconditional(job);
  assertRunSettings(job.defaults?.run);
  if (
    job["runs-on"] !== "windows-latest" ||
    Object.hasOwn(job, "strategy") ||
    Object.hasOwn(job, "env") ||
    Object.hasOwn(job, "container") ||
    Object.hasOwn(job, "services") ||
    Object.hasOwn(job, "environment") ||
    Object.hasOwn(job, "permissions") ||
    !(job["timeout-minutes"] > 0 && job["timeout-minutes"] <= 90) ||
    (["e2e", "visual"].includes(id)
      ? job.needs !== "build"
      : Object.hasOwn(job, "needs"))
  )
    throw new Error(
      "Application jobs need explicit Windows runners, bounded execution and real build ownership.",
    );
  const actual = job.steps.map(applicationStepKind);
  if (actual.join(",") !== sequence.join(","))
    throw new Error(
      "Application jobs must install independently, build before browser checks and preserve required step order.",
    );
  if (sequence.at(-1) === "artifact") {
    const prefix = id === "check" ? "canonical" : id;
    if (
      !sameRecord(job.steps.at(-1).with, {
        name: prefix + "-evidence-${{ github.run_id }}",
        path: "playwright-report\ntest-results\n",
        "retention-days": 14,
      })
    )
      throw new Error(
        "Application evidence must use only its owned report directories.",
      );
  }
};

const assertApplicationCi = (workflow, manifest) => {
  if (
    manifest.applicationReady !== true ||
    !sameRecord(workflow.env, applicationEnvironment) ||
    !sameRecord(workflow.permissions, {
      contents: "read",
      "pull-requests": "read",
    }) ||
    Object.keys(workflow.jobs)
      .sort((left, right) => left.localeCompare(right))
      .join(",") !== "build,check,e2e,visual" ||
    manifest.checks
      .filter((check) => check.kind === "required")
      .map((check) => check.id)
      .join(",") !== applicationChecks.join(",") ||
    manifest.profiles?.full?.join(",") !== applicationChecks.join(",")
  )
    throw new Error(
      "The runnable application requires all fifteen canonical checks and explicit public synthetic inputs.",
    );
  for (const [id, command] of [
    ["dead-code", "npm run check:unused"],
    ["build", "npm run build"],
    ["e2e", "npm run test:e2e"],
    ["visual", "npm run test:visual"],
  ])
    if (manifest.checks.find((check) => check.id === id)?.command !== command)
      throw new Error(
        "Application manifest commands must execute their real owners.",
      );
  assertApplicationJob(workflow, "check", [
    "checkout",
    "node",
    "install",
    "fixture",
    "python",
    "fonts",
    "chromium",
    "full",
    "artifact",
  ]);
  assertApplicationJob(workflow, "build", [
    "checkout",
    "node",
    "install",
    "fixture",
    "build",
  ]);
  for (const id of ["e2e", "visual"])
    assertApplicationJob(workflow, id, [
      "checkout",
      "node",
      "install",
      "fixture",
      "chromium",
      "build",
      id,
      "artifact",
    ]);
};

export const validateCiWorkflow = (content, manifest) => {
  const document = parseDocument(content, { uniqueKeys: true });
  if (document.errors.length)
    throw new Error("CI must be valid YAML without duplicate mapping keys.");
  const workflow = document.toJS({ maxAliasCount: 0 });
  if (!isRecord(workflow)) throw new Error("CI must be a workflow mapping.");
  assertPullRequestTrigger(workflow);
  assertCanonicalSteps(assertCheckJob(workflow));
  assertFontTooling(workflow.jobs.check, "npm run validate -- full");
  assertCheckOwnership(manifest);
  if (isRunnablePhase(manifest.phase)) assertApplicationCi(workflow, manifest);
};

const mainOnly = "github.ref == 'refs/heads/main'";
const operationalFixtureInstallation = [
  'git clone --no-checkout https://github.com/sepaseh/kernel-api.git "$KERNEL_API_DIRECTORY"',
  'git -C "$KERNEL_API_DIRECTORY" checkout --detach 4755d62d14fb9d53cbe9d6246ca9be6bb4a3a7a9',
  'npm --prefix "$KERNEL_API_DIRECTORY" ci',
  'printf \'KERNEL_API_DIRECTORY=%s\\n\' "$KERNEL_API_DIRECTORY" >> "$GITHUB_ENV"',
].join("\n");
const checkoutStep = {
  uses: checkoutAction,
  with: { "persist-credentials": false },
};
const nodeStep = {
  uses: nodeAction,
  with: { "node-version-file": ".nvmrc", cache: "npm" },
};
const operationalArtifact = (name, directories) => ({
  if: "${{ !cancelled() }}",
  uses: artifactAction,
  with: {
    name: name + "-${{ github.run_id }}",
    path: directories.join("\n") + "\n",
    "retention-days": 14,
  },
});
const browserOperation = (mode) => ({
  job: mode === "smoke" ? "smoke" : "validate",
  inputs: [
    "application_url",
    "api_health_url",
    ...(mode === "smoke" ? ["deployment_id"] : []),
  ],
  environment: {
    [mode.toUpperCase() + "_ALLOWED_API_HOST"]:
      "${{ vars." + mode.toUpperCase() + "_ALLOWED_API_HOST }}",
    [mode.toUpperCase() + "_ALLOWED_APP_HOST"]:
      "${{ vars." + mode.toUpperCase() + "_ALLOWED_APP_HOST }}",
    [mode.toUpperCase() + "_API_HEALTH_URL"]: "${{ inputs.api_health_url }}",
    [mode.toUpperCase() + "_BASE_URL"]: "${{ inputs.application_url }}",
    ...(mode === "smoke"
      ? {
          SMOKE_DEPLOYMENT_ID: "${{ inputs.deployment_id }}",
          SMOKE_EXPECTED_DEPLOYMENT_ID:
            "${{ vars.SMOKE_EXPECTED_DEPLOYMENT_ID }}",
        }
      : {}),
    PLAYWRIGHT_BROWSERS_PATH: "0",
    NPM_CONFIG_INCLUDE: "dev",
  },
  steps: [
    checkoutStep,
    nodeStep,
    { run: "node scripts/validate-workflow-targets.mjs " + mode },
    { run: "npm ci" },
    {
      run:
        "node node_modules/@playwright/test/cli.js install --with-deps " +
        (mode === "smoke" ? "chromium" : "chromium firefox webkit"),
    },
    { run: "npm run test:" + mode },
    operationalArtifact(
      mode === "smoke" ? "deployment-smoke" : "staging-validation",
      ["playwright-report/" + mode, "test-results/" + mode],
    ),
  ],
});
const operationalPolicies = {
  codeql: {
    job: "analyze",
    permissions: { contents: "read", "security-events": "write" },
    steps: [
      checkoutStep,
      {
        uses: "github/codeql-action/init@cdf488f595d80d6e07e03d4674febd5ab45fa938",
        with: {
          languages: "javascript-typescript",
          "build-mode": "none",
          queries: "security-extended",
        },
      },
      {
        uses: "github/codeql-action/analyze@cdf488f595d80d6e07e03d4674febd5ab45fa938",
      },
    ],
  },
  dast: {
    job: "zap",
    inputs: ["target_url"],
    environment: {
      DAST_ALLOWED_HOST: "${{ vars.STAGING_ALLOWED_APP_HOST }}",
      DAST_PRODUCTION_HOST: "${{ vars.PRODUCTION_HOST }}",
      DAST_TARGET: "${{ inputs.target_url }}",
    },
    steps: [
      checkoutStep,
      { uses: nodeAction, with: { "node-version-file": ".nvmrc" } },
      { run: "node scripts/validate-workflow-targets.mjs dast" },
      {
        uses: "zaproxy/action-full-scan@3c58388149901b9a03b7718852c5ba889646c27c",
        with: {
          allow_issue_writing: false,
          artifact_name: "staging-dast-${{ github.run_id }}",
          cmd_options: "-a",
          docker_name:
            "ghcr.io/zaproxy/zaproxy:2.17.0@sha256:c558ee87358911ab17278c70991e856f57793e115d9cd0f88ca475cf82907a1a",
          fail_action: true,
          target: "${{ env.DAST_TARGET }}",
        },
      },
    ],
  },
  "deployment-smoke": browserOperation("smoke"),
  staging: browserOperation("staging"),
  "package-release": {
    job: "package",
    inputs: ["release_id"],
    environment: {
      ...applicationEnvironment,
      RELEASE_ID: "${{ inputs.release_id }}",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    steps: [
      checkoutStep,
      nodeStep,
      { run: "npm ci" },
      {
        env: { KERNEL_API_DIRECTORY: "${{ runner.temp }}/kernel-api-fixture" },
        run: operationalFixtureInstallation,
      },
      { run: "npm run build" },
      { run: 'npm run deploy:package -- --release="$RELEASE_ID"' },
      {
        uses: artifactAction,
        with: {
          name: "website-release-${{ github.run_id }}",
          path: "dist/releases",
          "retention-days": 14,
          "if-no-files-found": "error",
        },
      },
    ],
  },
  release: {
    job: "release",
    inputs: [],
    permissions: { contents: "write", "pull-requests": "write" },
    steps: [
      {
        uses: "googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7",
        with: {
          "config-file": "release-please-config.json",
          "manifest-file": ".release-please-manifest.json",
          token: "${{ secrets.RELEASE_PLEASE_TOKEN || secrets.GITHUB_TOKEN }}",
        },
      },
    ],
  },
};

function assertOperationalTriggers(workflow, name, policy) {
  if (name === "codeql") {
    if (
      Object.keys(workflow.on ?? {})
        .sort()
        .join(",") !== "pull_request,push,schedule,workflow_dispatch" ||
      workflow.on.push?.branches?.join(",") !== "main" ||
      workflow.on.pull_request?.branches?.join(",") !== "main" ||
      Object.keys(workflow.on.push).join(",") !== "branches" ||
      Object.keys(workflow.on.pull_request).join(",") !== "branches" ||
      workflow.on.schedule?.length !== 1 ||
      workflow.on.schedule[0].cron !== "30 3 * * 1"
    )
      throw new Error(
        "CodeQL must retain its reviewed main/PR/security schedule.",
      );
    return;
  }
  if (Object.keys(workflow.on ?? {}).join(",") !== "workflow_dispatch")
    throw new Error("Operational target and release work must remain manual.");
  const inputs = workflow.on.workflow_dispatch?.inputs ?? {};
  if (
    Object.keys(inputs).sort().join(",") !==
      [...policy.inputs].sort().join(",") ||
    Object.values(inputs).some(
      (input) => input.type !== "string" || input.required !== true,
    )
  )
    throw new Error(
      "Manual workflow inputs must remain explicit required strings.",
    );
}

function assertOperationalStep(step, expected) {
  if (!isRecord(step))
    throw new Error("Operational workflow steps must be explicit mappings.");
  const allowed = new Set(["name", "run", "uses", "with", "env", "if"]);
  assertRunSettings(step);
  if (
    Object.keys(step).some((key) => !allowed.has(key)) ||
    step.uses !== expected.uses ||
    step.run?.trim().replaceAll("\r\n", "\n") !== expected.run ||
    step.if !== expected.if ||
    (expected.with
      ? !sameRecord(step.with, expected.with)
      : step.with !== undefined) ||
    (expected.env
      ? !sameRecord(step.env, expected.env)
      : step.env !== undefined)
  )
    throw new Error(
      "Operational actions, filtered wrappers and validation order must remain fail closed.",
    );
}

function assertOperationalSteps(job, policy) {
  if (job.steps.length !== policy.steps.length)
    throw new Error(
      "Operational workflow steps must preserve their reviewed closure.",
    );
  for (const [index, step] of job.steps.entries())
    assertOperationalStep(step, policy.steps[index]);
}

function assertOperationalJob(workflow, job, name, policy) {
  assertRunSettings(workflow.defaults?.run);
  assertRunSettings(job.defaults?.run);
  if (
    !sameRecord(workflow.permissions, { contents: "read" }) ||
    workflow.env !== undefined ||
    Object.keys(workflow.jobs).join(",") !== policy.job ||
    job["runs-on"] !== "ubuntu-latest" ||
    !(job["timeout-minutes"] > 0 && job["timeout-minutes"] <= 60) ||
    [
      "continue-on-error",
      "strategy",
      "container",
      "services",
      "environment",
      "needs",
    ].some((key) => Object.hasOwn(job, key)) ||
    (name === "codeql" ? job.if !== undefined : job.if !== mainOnly) ||
    (policy.permissions
      ? !sameRecord(job.permissions, policy.permissions)
      : job.permissions !== undefined) ||
    (policy.environment
      ? !sameRecord(job.env, policy.environment)
      : job.env !== undefined)
  )
    throw new Error(
      "Operational jobs need manual main ownership, bounded execution and least permissions.",
    );
}

/** Validate operational source without dispatching jobs or contacting targets. */
export function validateOperationalWorkflows(contents) {
  if (
    !isRecord(contents) ||
    Object.keys(contents).sort().join(",") !==
      Object.keys(operationalPolicies).sort().join(",")
  )
    throw new Error("All six operational workflow sources are required.");
  for (const [name, policy] of Object.entries(operationalPolicies)) {
    const document = parseDocument(contents[name], { uniqueKeys: true });
    if (document.errors.length)
      throw new Error("Operational workflows require valid unique-key YAML.");
    const workflow = document.toJS({ maxAliasCount: 0 });
    const job = workflow?.jobs?.[policy.job];
    if (!isRecord(workflow) || !isRecord(job) || !Array.isArray(job.steps))
      throw new Error(
        "Each operational workflow needs its explicit owned job.",
      );
    assertOperationalJob(workflow, job, name, policy);
    assertOperationalTriggers(workflow, name, policy);
    assertOperationalSteps(job, policy);
  }
}

export const inspectCi = async (root = repository) => {
  const [workflow, manifest, sonar] = await Promise.all([
    readFile(path.join(root, ".github/workflows/ci.yml"), "utf8"),
    readFile(path.join(root, ".agents/validation.json"), "utf8"),
    readFile(path.join(root, ".github/workflows/sonar.yml"), "utf8"),
  ]);
  const parsedManifest = JSON.parse(manifest);
  validateCiWorkflow(workflow, parsedManifest);
  validateSonarFontWorkflow(sonar);
  if (parsedManifest.phase === "operations") {
    const contents = Object.fromEntries(
      await Promise.all(
        Object.keys(operationalPolicies).map(async (name) => [
          name,
          await readFile(
            path.join(root, `.github/workflows/${name}.yml`),
            "utf8",
          ),
        ]),
      ),
    );
    validateOperationalWorkflows(contents);
  }
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await inspectCi();
    console.log("CI policy passed: every PR runs the complete canonical gate.");
  } catch (error) {
    console.error(
      JSON.stringify({
        message: error instanceof Error ? error.message : "CI policy failed.",
        status: "failed",
      }).replaceAll(/[\r\n\u2028\u2029]/g, " "),
    );
    process.exitCode = 1;
  }
}
