## Problem and resulting behavior

<!-- Explain who is affected, what changes for them and any prerequisite PR. -->

## Published scope

- Publication phase, application readiness and any limitations
- Exact proposed tree and intended base
- Complete changed-file count and scope rationale
- Published source and measured coverage scope

<!-- Target at most 80 entries. Explain larger cohesive changes and any useful split. -->

## Verification

- Full profile commands actually run against the proposed tree and their results
- Hosted required checks and native CodeQL result for the current head
- Sonar scanner result and actual quality gate for the analyzed revision
- Substantive CodeRabbit findings, their disposition and current-head approval evidence
- Sonar all-severity zero-unresolved evidence
- Native approving-review count and provider `CodeRabbit` check for the current head

<!-- Record failed, pending, skipped, stale or unavailable evidence. Match each result to the checked revision. -->

Record first failures and limits using the
[exact-tree validation procedure](../docs/validation.md). The operations phase
includes the production build, browser suites, both CSP modes and reviewed
visual comparisons against the synthetic API.

## Rollout and review

<!-- Describe compatibility, operator steps, authorized repository settings and remaining review decisions. Keep incomplete work in draft. Merge requires separate authorization. -->

<!-- Publication leaves manual review requests and merge subject to separate authorization. Follow the review preflight in docs/reviews.md. -->
