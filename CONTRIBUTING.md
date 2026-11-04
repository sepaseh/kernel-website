# Contributing

## Prepare a focused change

Read [the assistant entry point](AGENTS.md), [task navigation](docs/source-navigation.md)
and matching [rules](.agents/settings.json). This foundation phase owns its
checks and guidance; do not require another repository's source or workflows.

Use the existing checkout and preserve unrelated work. Another implementation
checkout needs explicit authorization. Choose a `codex/` branch from a verified
base and keep changes focused on one independently reviewable outcome.

Start with the affected owner tests. Before an authorized commit, push or PR
handoff, complete [fresh exact-tree validation](docs/validation.md), including every
required check. Documentation changes use the same full profile.
Do not stage or commit when a required check fails or cannot run.

## Publish and review

Do not commit without the user's approval. Verify authorization separately for
pushes, PR changes, remote messages, review requests and merges.
Use a Conventional Commit title and the [PR template](.github/PULL_REQUEST_TEMPLATE.md).

Review the complete base-to-head diff and aim for at most 80 changed-file
entries initially. Split independent changes when useful and explain larger
cohesive changes. Count additions, deletions, renames and binaries. File count
is advisory: exceeding 100 alone must not fail CI or require recreating a PR.
A stacked PR targets its verified predecessor and states the dependency.
After an authorized merge, reconcile descendants against actual main and rerun
full validation when proposed bytes change.

Apply [protected checks](docs/branch-protection.md) and [review preflight](docs/reviews.md).
Missing bootstrap checks remain blockers; no merge or bootstrap waiver is
authorized by publication. Do not replace them with passing placeholders.

## Maintain evidence and guidance

Write maintained Markdown in English, keep human guides flat, and update the
owning explanation when behavior changes. Report QA in the task or terminal.
A saved local report requires a request and belongs under ignored `test-results/`.
Never use private environments, existing services or production data as fixtures.

## Dependency maintenance

[Dependabot](.github/dependabot.yml) schedules weekly npm and GitHub Actions
version updates on Monday at 09:00 Asia/Tehran after this configuration is
published on the default branch. Minor and patch updates are grouped by production,
development and Actions dependencies; major updates remain separate. Limits are
10 npm PRs and 5 Actions PRs. Every update follows the ordinary checks, review
and merge authorization; the configuration does not enable automatic merging.
Security-update settings remain separate repository controls.
