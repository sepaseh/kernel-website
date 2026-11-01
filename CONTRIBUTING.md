# Contributing

## Prepare a focused change

Read [the assistant entry point](AGENTS.md), [task navigation](docs/source-navigation.md)
and matching [rules](.agents/settings.json). This governance phase owns its
checks and guidance; do not require another repository's source or workflows.

Use the existing checkout and preserve unrelated work. Another implementation
checkout needs explicit authorization. Choose a `codex/` branch from a verified
base and keep changes focused on one independently reviewable outcome.

Start with the affected owner tests. Before an authorized commit, push or PR
handoff, complete [fresh exact-tree validation](docs/validation.md), including all
nine required checks. Documentation changes use the same full profile.
Do not stage or commit when a required check fails or cannot run.

## Publish and review

Do not commit without the user's approval. Verify authorization separately for
pushes, PR changes, remote messages, review requests and merges.
Use a Conventional Commit title and the [PR template](.github/PULL_REQUEST_TEMPLATE.md).

Keep one website PR open by default. An explicitly authorized stack may be
published in predecessor order before merges. Protect every predecessor used
as a base and validate each exact head. Stack authorization grants no merge,
bypass or protection waiver.

Target at most 80 initial changed entries per PR and reserve 20 for fixes under
the hard 100-entry limit; count additions, deletions, renames and binaries.
Without explicit stack authorization, publish the next PR only after the
preceding PR is actually merged and real main has been reconciled.
After any actual authorized merge, reconcile descendants against real main and
rerun full validation when proposed bytes change.

Apply [protected checks](docs/branch-protection.md) and [review preflight](docs/reviews.md).
Missing bootstrap checks remain blockers; no merge or bootstrap waiver is
authorized by publication. Do not replace them with passing placeholders.

## Maintain evidence and guidance

Write maintained Markdown in English, keep human guides flat, and update the
owning explanation when behavior changes. Report QA in the task or terminal.
A saved local report requires a request and belongs under ignored `test-results/`.
Never use private environments, existing services or production data as fixtures.
