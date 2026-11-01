# Kernel Website assistant instructions

The publication phase is **foundation** and `applicationReady` is **false**.
This package publishes repository governance, shared website contracts and catalogs, and licensed fonts.
It does not deliver a runnable website or establish deployment readiness.

Read [guidance](.agents/README.md), [settings](.agents/settings.json),
[task navigation](docs/source-navigation.md), [source policy](.github/bootstrap-policy.json),
[validation](.agents/validation.json), [Contributing](CONTRIBUTING.md) and matching rules.

Use the existing checkout. Another worktree, clone or copied implementation
checkout requires explicit authorization, including when delegating.
Preserve unrelated work and private state. Never read real dotenv, keys,
credentials or operator data, or contact production as a test fixture.

Do not commit without the user's approval. Commits, pushes, remote comments,
reviews, PR changes, merges and protection changes each require authorization
for their actual effect. Existing session authorization persists.
Use `codex/` branches and Conventional Commit titles.

Review each PR's complete scope and aim for at most 80 changed-file entries
initially. Split independent changes when useful and explain larger cohesive
changes. File count is advisory: exceeding 100 alone must not fail CI or require
recreating a PR. Count additions, deletions, renames and binaries.
Use a verified feature branch and PR for every change to main; never push directly.
A stacked PR targets its verified predecessor and states the dependency.
Before every authorized commit, push or PR handoff, validate the exact proposed
tree in a fresh disposable export using [the full procedure](docs/validation.md).

All required check kinds stay active for this phase. Keep executable
tooling measured, unit coverage at 90% and governance coverage at 80%, without
suppressions or source/rule/coverage exclusions.
Synchronize tests through actual readiness, completion and failure events;
do not add arbitrary sleeps, retry counts or test deadlines.

Preserve [branch protection](docs/branch-protection.md): strict checks, one
approval, stale-approval dismissal, resolved conversations, administrator
enforcement, linear history and no force pushes or branch deletion.
A passing provider check alone does not prove current-head CodeRabbit approval.
Apply [review preflight](docs/reviews.md) before every manual CodeRabbit request.

Write maintained Markdown and assistant instructions in English. Keep human
guides flat and task-oriented. Report QA in the task or terminal; save a local
report only when requested under ignored `test-results/`. Optional guidance
indexes prove neither host loading nor model comprehension.
