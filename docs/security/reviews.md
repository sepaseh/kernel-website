# Security review policy and evidence

[English](reviews.md) · [فارسی](reviews.fa.md)

For each HTTP, authentication, session, artifact/configuration or deployment
reference change, review its threat boundary and actual source/tests. Select the
scope from the [publication marker](../../.github/bootstrap-policy.json) and
[application contract](../application.md). Local tests, authored suites and static
templates do not establish a secured service, provider scan or deployment.
Run the complete [canonical gate](../validation.md) before an authorized
commit/push/PR handoff and preserve audit/test failures.

Review file exclusions and linked-path rejection, immutable output ownership,
untrusted public configuration, target validation and cleanup errors. The
CLI readiness guard prevents application/delivery operations when the marker is false;
synthetic fixtures explicitly declaring readiness test the contract rather than
the missing application. A name-based file filter cannot discover every secret
inside allowed content. Never introduce real dotenv, keys, developer state,
production accounts or buckets into a fixture.

The existing Dependabot version-update limits remain zero; publishing this policy
does not activate update PRs or prove provider security-update settings. Verify
CodeQL, DAST and release/staging definitions and actual runs independently.
A plan, absent workflow or manual definition is not an active scheduled scan.
Publishing a workflow does not authorize dispatch, production access or a release. Native Sonar and required
checks still need exact-head provider evidence under the
[branch policy](../branch-protection.md).

The published CodeQL source defines automatic main/PR/weekly JavaScript/TypeScript analysis with pinned actions, no application autobuild and job-scoped security-event upload permission. Confirm actual host support, permissions and each analysis result independently. DAST, release, packaging, staging and deployment smoke stay manual main-only workflows; their target validation, artifact scope, environment filtering and least permissions are checked as source policy, not as completed scans or deployments.

As a human review policy, review security assumptions at least quarterly and
before a public launch: API compatibility and ownership, cookies/origins, CSP/cache
behavior, TLS renewal, target identity, release rollback and recovery evidence.
This document creates no scheduled automation and records no completed review.
External scanning requires an explicitly authorized target and a reviewed
non-production boundary. Preserve sensitive findings/artifacts privately using
[SECURITY](../../SECURITY.md). Record actual source, date, owner, execution,
failures and limits; absent evidence remains unknown. See the
[threat model](threat-model.md) and [authentication review](authentication-review.md).
