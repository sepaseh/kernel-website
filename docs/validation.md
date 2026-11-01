# Validate the exact proposed tree

Use this procedure before every authorized commit, push or PR handoff, including
documentation-only work. The [manifest](../.agents/validation.json) owns the nine
required check commands and their full-profile order.

## Prepare an owned export

Identify the exact proposed public bytes, including admitted untracked changes,
and review them against the [inventory](../.github/bootstrap-policy.json).
Create a fresh disposable source export outside the implementation checkout.
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
`NPM_CONFIG_GLOBALCONFIG`. Install development dependencies from the lockfile:

```text
npm ci
npm run validate -- full
```

Stop on any failed command. Do not reuse installed dependencies, read private
npm configuration, alter the lockfile or skip checks to obtain a pass.
This governance phase requires no Python environment, font regeneration,
application build or browser. Those are not delivered evidence.

## Record the result and clean up

Record the exact tree/fingerprint, runtime versions, fresh install, all nine
check outcomes, first failures/skips and source/export comparison.
Keep unit coverage at 90% and governance coverage at 80%, with all executable
tooling measured and no suppressions or exclusions.

Before recursive cleanup, verify the resolved absolute export/environment paths
belong to this run and remain outside the implementation checkout.
Delete only owned resources and preserve original failure logs in the task.
A saved report requires an explicit request and belongs under ignored
`test-results/`.

Do not stage or commit if any required check fails or cannot run.
Passing local validation grants no commit, push, remote review or merge authority.
Hosted CI, Sonar and CodeRabbit results remain separate [review evidence](reviews.md).
