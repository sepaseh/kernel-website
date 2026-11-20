# Validate a source change

The [validation manifest](../.agents/validation.json) defines check commands,
profiles and execution order.
Follow this procedure before every authorized commit, push or PR handoff,
including documentation changes. Work on a platform with reviewed visual
baselines. The current baseline set is for Windows.

## Prepare an owned export

1. Review the proposed public files against the
   [source inventory](../.github/bootstrap-policy.json). Include admitted
   untracked files that belong to the proposed tree.
2. Export those reviewed files to a fresh, owned subdirectory under ignored
   `coverage/`. Reject links, unsafe paths, Git metadata, runtime dotenv files,
   credentials, dependencies and generated output. Use the export for verification.
3. Compare the source and export bytes. Record the reviewed tree or content
   fingerprint and recreate the export if a proposed file changes.

A verified Git tree object may be exported with `git archive`; do not export
HEAD when it differs from the proposed bytes. Do not stage the real index merely
to obtain an export. A temporary index/tree object grants no commit permission.
Keep source/export under one writer and restart if any proposed byte changes.

## Install and run all checks

1. Select the exact Node version in [.nvmrc](../.nvmrc) and its npm. Activate a
   disposable CPython 3.14.4 environment for the font tools. Create separate
   empty npm configuration files in the export's owned parent and set
   `NPM_CONFIG_USERCONFIG` and `NPM_CONFIG_GLOBALCONFIG` to their absolute paths.
2. In the export, set the [public loopback environment](development.md#set-explicit-local-inputs).
   Keep the site and API ports distinct and free, and leave `PLAYWRIGHT_BROWSERS_PATH=0`
   set for installation and checks. The browser runner starts the local fixture.
3. Install the locked dependencies and project-local Chromium from the export root.

   ```sh
   npm ci --strict-peer-deps
   python -m pip install --require-hashes --only-binary :all: --requirement font-source/requirements.txt
   node node_modules/@playwright/test/cli.js install chromium
   ```

4. Run the full profile in the same environment after all installations succeed.

   ```sh
   npm run validate -- full
   ```

   The profile should exit successfully after the production build, browser
   journeys, both CSP modes and visual comparison pass. The browser profiles
   reuse the single verified build sequentially.

Stop at the first failed command and preserve its error. Use fresh locked
installs and keep the readiness marker, required checks and reviewed baselines
intact. [Troubleshoot setup and checks](troubleshooting.md)

The [Python wheel lock](../font-source/requirements.txt) covers x64 Windows and
x64 and Arm64 on glibc Linux and macOS. Browser comparison also requires reviewed
baseline metadata for the current platform. [Visual regression](visual-regression.md)

## Record the result and clean up

Record the exact tree/fingerprint, runtime versions, fresh install, all required
check outcomes, first failures/skips and source/export comparison.
Keep unit coverage at 90% and governance coverage at 80%, with all executable
tooling measured and no suppressions or exclusions.

Before recursive cleanup, verify the resolved absolute export/environment paths
belong to this run and remain inside its owned ignored `coverage/` parent.
Delete only owned resources and preserve original failure logs in the task.
A saved report requires an explicit request and belongs under ignored
`test-results/`.

Do not stage or commit if any required check fails or cannot run.
Passing local validation grants no commit, push, remote review or merge authority.
Hosted CI, Sonar and CodeRabbit results remain separate [review evidence](reviews.md).

## Local and hosted execution

Local `full` validation still runs all required checks once. Hosted CI uses
the static, audit, unit, governance, build, functional E2E, accessibility, SEO,
CSP and visual profiles as an exact partition of the complete required gate.
The static checks and test suites install their locked dependencies;
the dependency audit reads the lockfile without an installation.

The static profile includes `npm run check:actions`, which runs pinned
actionlint 1.7.12 against the admitted workflows. The runner verifies official
Windows/Linux x64 release archives by SHA-256 and keeps them under ignored
`coverage/tools/actionlint/`. Each invocation extracts its own binary and cleans
that owned extraction. Cached archives are checked and read through the same open
file handle, then verified by SHA-256. Cache creation is exclusive; a competing
entry fails without being overwritten. Cache directories are created and checked
in parent-to-child order before descending into each child.
Downloads have a five-minute overall deadline and stop reading as soon as the
archive exceeds 16 MiB, including responses without a trustworthy length header.
This validates GitHub Actions syntax and expressions in
addition to repository-specific CI policy tests. Optional ShellCheck and
Pyflakes integrations are disabled consistently; this check does not claim
separate shell or Python analysis.

The separate jobs appear beside the required `check` aggregate. That aggregate
accepts only success from every producer and never executes the gate again.
Unit and governance jobs each record and upload their measured coverage once.
Before analysis, Sonar verifies both suite artifacts and checks that measured
source files belong to the attested Git tree. LCOV lines must fall within their
source files.
CodeQL remains its own hosted security workflow. A single Windows build owns
dead-code analysis, the production build and bundle budgets. Its immutable
artifact contains the prepared `.next` output and records the source,
environment, toolchain and output. It excludes the known build caches and
standalone runtime route cache. Each browser job verifies the build producer's
attempt and output before its acceptance profile and reuses the prepared build.
Immutable server code and static assets remain fully hashed; the route cache
may be populated by requests after verification.
Before hashing, build preparation materializes Next's exact generated PostCSS
aliases from each tree's own locked package into bounded ordinary copies. Other
links, nested package links and unexpected targets remain errors; verification
never repairs or follows a link introduced after the build was recorded.
Artifact names include run and producer attempt, digest mismatches fail, and
changed source, semantic environment, toolchain or output bytes reject reuse.
Each browser check verifies the same build again after its owned run finishes.
A changed build fails the check even if the browser passes. CSP rechecks between
enforce and report-only runs. Visual reuse rechecks before reporting a pass.
Typechecking includes the authored suites through the
[tooling project](../tsconfig.tooling.json); compilation alone supplies no browser execution evidence.
