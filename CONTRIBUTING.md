# Contributing

[English](CONTRIBUTING.md) · [فارسی](CONTRIBUTING.fa.md)

Read [README](README.md), [AGENTS](AGENTS.md) and the
[foundation guide](docs/bootstrap.md). Keep wire definitions pure and feature
owned. Production imports must resolve only to the ten published local
production modules; packages, test modules, computed dependencies and another
checkout are not permitted.

Use the Node version in [.nvmrc](.nvmrc), npm 12 and `npm ci`. During development
select the smallest relevant existing check. Before every explicitly authorized
commit, push or PR handoff, run **`npm run validate -- full`** from the
[canonical manifest](.agents/validation.json) on the exact isolated proposed tree.
Do not weaken a failed or unavailable check. Untracked application files in
another checkout cannot validate a partial publication.

Use a focused `codex/<purpose>` branch and Conventional Commit title. Inspect the
whole base diff and keep each PR at **100 or fewer GitHub changed-file entries**,
including additions, deletions, renames and binaries. A GitHub rename is one entry.
The [inventory](.github/bootstrap-policy.json) is an exact content guard, not a
100-file limit on the repository.

Preserve user work, private environment/state and credentials. Tests use only
synthetic data; dotenv loading is disabled. Do not commit generated coverage.
Maintain meaningful failure tests and the declared coverage thresholds instead
of suppressing findings or making metrics pass with wrappers.

Use the [PR template](.github/PULL_REQUEST_TEMPLATE.md). Report the exact revision,
phase, commands, results and limitations. Publish or comment only with explicit
authorization. CodeRabbit reviews are requested manually for each authorized PR;
a skipped or quota-limited result is not a completed review. Fix actionable
findings and rerun affected checks on the new head.

Merge under the ordinary native CI, CodeRabbit and Sonar checks, an approving
review and resolved conversations; see [branch protection](docs/branch-protection.md).
Inspect scanner execution and provider quality gate separately. Configuration is
not hosted evidence.

A runnable phase must add real Next.js routes/UI/catalog adapters, the complete
application gate and its synthetic HTTP/auth, browser/CSP, accessibility and
reviewed visual evidence. It must preserve the independent API boundary.
Foundation success does not replace these checks or justify applicationReady:true.
