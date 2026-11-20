# Request and verify a review

Record the current PR head and intended base. Read the complete diff,
acceptance criteria and affected owners. For each actionable defect, identify
the changed location and a concrete failure scenario.

## Before requesting CodeRabbit

A manual initial review or re-review requires explicit authorization and all of:

1. In the PR checks, verify every required non-CodeRabbit protected check
   succeeded for the exact head with its [expected provider](branch-protection.md).
   Exclude only CodeRabbit's provider check and approval requirement to avoid
   a circular dependency.
   This includes the native `CodeQL` security result from App `57789`;
   its Actions analysis job alone does not satisfy that result.
2. Open the scanner run and confirm the native `SonarCloud Code Analysis` gate
   succeeded for the same head.
3. In Sonar, select the matching project and analysis. Review the full
   OPEN/unresolved issue list across all severities, including existing issues.
   Check filters, result counts and pagination. Require zero such issues.
4. Check the timestamps of the last request and substantive review. Wait at
   least one hour from each, honor longer provider limits and avoid duplicating
   an in-flight request.

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
