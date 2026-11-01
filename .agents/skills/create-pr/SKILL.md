---
name: create-pr
description: Prepare or create one focused governance pull request when authorized.
---

# Create a pull request

Read [Git policy](../../rules/git.md), [PR policy](../../rules/pull-requests.md)
and [safety](../../rules/safety.md).

1. Verify repository identity, head/base, complete diff and open PRs.
2. Target at most 80 initial entries; preserve 20 for fixes under the hard 100-entry limit.
3. Complete [validate-change](../validate-change/SKILL.md) on the exact proposed tree.
4. Draft a Conventional Commit title and the [PR template](../../../.github/PULL_REQUEST_TEMPLATE.md)
   around the final problem, behavior, evidence and limits.
5. Confirm authorization for commit, push and PR creation; create ready for review unless a draft was requested.
6. Keep one PR open by default. For an explicitly authorized stack, publish in
   predecessor order, protect every predecessor base and validate each exact head.
   Without that authorization, keep later PRs unpublished until the open PR is
   actually merged and real main is reconciled. After a real merge, reconcile
   descendants against main and rerun full validation when proposed bytes change.
7. Apply [review preflight](../../../docs/reviews.md) before any CodeRabbit request.
   Publication does not authorize a review request, waiver or merge.
