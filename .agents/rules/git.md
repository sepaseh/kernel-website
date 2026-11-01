# Git workflow

Read [branches](branches.md), [commits](commits.md), [PR policy](pull-requests.md)
and [safety](safety.md) for Git work. Confirm actual repository identity, branch,
head/base and relevant status/diffs before acting.

Do not commit without user approval. Preparation does not authorize publication.
Verify the authorization needed for each commit, push, remote message, review,
PR change, merge or protection change; preserve authorization already given.
Never infer a check bypass from a request to publish.

Use the existing checkout, `codex/` branches and Conventional Commit titles.
Run [fresh exact-tree validation](../../docs/validation.md) before each authorized
commit, push or PR handoff. Keep one PR open by default and prepare later scopes
locally. An explicitly authorized stack may be published in predecessor order;
protect each predecessor base and validate each exact head before publication.
Stack authorization grants no merge or bypass. After an actual authorized merge,
reconcile against real main and rerun full validation when proposed bytes change.

Do not silently discard/stash unrelated work, broadly stage files, rewrite
history, force-push or push directly to main.
Read [review preflight](../../docs/reviews.md) before requesting CodeRabbit.
