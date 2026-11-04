# Validate the exact proposed tree

Use this procedure before every authorized commit, push or PR handoff, including
documentation-only work. The [manifest](../.agents/validation.json) owns all
required check commands and their full-profile order.

## Local and hosted execution

Local `full` validation still runs all required checks once. Hosted CI uses
`ci-quality`, `ci-audit`, `ci-unit` and `ci-governance` as an exact partition of
that gate. The static checks and test suites install their locked dependencies;
the dependency audit reads the lockfile without an installation.

The static profile includes `npm run check:actions`, which runs pinned
actionlint 1.7.12 against both admitted workflows. The runner verifies official
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
Unit and governance jobs each record and upload their measured coverage once;
Sonar verifies both suite artifacts directly before analysis. CodeQL remains its
own hosted security workflow. This foundation phase runs no application build,
E2E, visual or performance job.

## Prepare an owned export

Identify the exact proposed public bytes, including admitted untracked changes,
and review them against the [inventory](../.github/bootstrap-policy.json).
Create a fresh disposable source export under an owned ignored `coverage/`
subdirectory. Keep it verification-only; never use it for implementation.
Include only those reviewed inventory files; reject links, unsafe paths, Git
metadata, dotenv, credentials, dependencies and generated output.
Compare source/export bytes and record the reviewed tree or content fingerprint.

A verified Git tree object may be exported with `git archive`; do not export
HEAD when it differs from the proposed bytes. Do not stage the real index merely
to obtain an export. A temporary index/tree object grants no commit permission.
The export is a verification fixture, not another implementation checkout.
Keep source/export under one writer and restart if any proposed byte changes.

## Install and run all checks

Use the exact Node version from [.nvmrc](../.nvmrc) and its npm.
In the export, create separate empty npm user/global configuration files in the
owned temporary parent and select them with `NPM_CONFIG_USERCONFIG` and
`NPM_CONFIG_GLOBALCONFIG`. Use a disposable CPython 3.14.4 environment for the
font tools. Install both sets of dependencies before running the full profile:

```text
npm ci
python -m pip install --require-hashes --only-binary :all: --requirement font-source/requirements.txt
npm run validate -- full
```

Stop on any failed command. Do not reuse installed dependencies, read private
npm configuration, alter the lockfile or skip checks to obtain a pass.
The [wheel lock](../font-source/requirements.txt) covers x64 Windows and x64
and Arm64 on glibc Linux and macOS. This phase runs no application build or
browser checks.

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
