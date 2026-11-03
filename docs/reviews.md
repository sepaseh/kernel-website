# Request and verify a review

Use the exact current PR head for every check. Read the complete diff,
acceptance criteria and affected owners. Report actionable defects with their
failure scenario; local validation does not replace review.

## Before requesting CodeRabbit

A manual initial review or re-review requires explicit authorization and all of:

1. Every required non-CodeRabbit protected check succeeds for the exact head.
   Exclude only CodeRabbit's provider check and approval requirement to avoid
   a circular dependency.
   This includes the native `CodeQL` security result from App `57789`;
   its Actions analysis job alone does not satisfy that result.
2. The real Sonar scanner ran and the native `SonarCloud Code Analysis` gate
   succeeded for the same head.
3. The applicable complete Sonar report has zero OPEN/unresolved issues across
   all severities, including existing issues. Verify filters and pagination.
4. At least one hour has passed since both the latest request and substantive
   review; honor longer provider limits and send no duplicate in-flight request.

Missing, failed, pending, skipped, mismatched or incomplete evidence blocks a
request. A new head invalidates prior evidence.
A skipped/conversational reply is not a substantive review.
Do not suppress or reclassify findings without explicit authorization.

## Verify approval and merge readiness

[CodeRabbit configuration](../.coderabbit.yaml) keeps automatic review disabled,
automatic approvals enabled and author approval commands disabled.
Use GitHub's native approving-review count alongside the provider `CodeRabbit`
check and [ordinary protection](branch-protection.md). A native approval count
does not select a particular reviewer. Inspect the actual substantive review,
its commit and the current-head provider check before claiming CodeRabbit approval.
A skipped, neutral, quota-limited or conversational result is not a completed review.

No separate approval publisher or review-signal workflow is required. A successful
Actions job that merely received a review event would prove no approval.
Resolve conversations and verify current-head evidence before an explicitly
authorized merge. See [Sonar setup and evidence](sonarqube.md).
