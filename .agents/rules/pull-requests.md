# Pull requests

Confirm repository identity, actual head/base, complete diff and existing PRs.
Keep one website PR open at a time by default. Without explicit stack
authorization, prepare later scopes locally until the preceding PR is actually
merged and real main is reconciled.

An explicitly authorized stack may be published in predecessor order before
merges. Each PR targets its protected predecessor branch, receives its own
exact-head full validation and observes the same size and review gates.
Stack authorization grants no merge, bypass or protection waiver.
After an actual authorized merge, reconcile descendants against real main and
rerun full validation when proposed bytes change.

Target at most 80 changed entries initially, reserving 20 under the hard
100-entry limit. Count additions, deletions, renames and binaries.
Use Conventional Commit titles and the [PR template](../../.github/PULL_REQUEST_TEMPLATE.md).
Authorized PRs are ready for review unless the user explicitly requested a draft.

Before a commit, push or PR handoff, pass [fresh exact-tree validation](../../docs/validation.md).
Verify authorization separately for each remote effect.
Missing hosted/bootstrap checks remain blockers; do not fabricate a success,
weaken protection or infer permission to merge.

## Before requesting CodeRabbit

Apply [the complete current-head preflight](../../docs/reviews.md).
Every required non-CodeRabbit check, actual scanner, native Sonar gate and the
complete all-severity zero-unresolved Sonar report must match the exact head.
Wait at least one hour since both the latest request and substantive review,
respect longer provider limits and send no duplicate in-flight request.
A new head invalidates evidence; missing or skipped evidence blocks the request.

Merge only with explicit authorization under [ordinary protection](../../docs/branch-protection.md),
current-head approval and resolved conversations.
