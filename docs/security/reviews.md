# Security review policy and evidence

[English](reviews.md) · [فارسی](reviews.fa.md)

For each HTTP, authentication, session, artifact/configuration or deployment
reference change, review its threat boundary and actual source/tests. The
**delivery-tooling** phase keeps `applicationReady:false`: local tests and static
templates do not establish a secured service, a provider scan or a deployment.
Run the complete [canonical gate](../validation.md) before an authorized
commit/push/PR handoff and preserve audit/test failures.

Review file exclusions and linked-path rejection, immutable output ownership,
untrusted public configuration, target validation and cleanup errors. The current
CLI readiness guard prevents delivery operations in this non-runnable phase;
synthetic fixtures explicitly declaring readiness test the contract rather than
the missing application. A name-based file filter cannot discover every secret
inside allowed content. Never introduce real dotenv, keys, developer state,
production accounts or buckets into a fixture.

The existing Dependabot version-update limits remain zero; publishing this policy
does not activate update PRs or prove provider security-update settings. CodeQL,
DAST and release/staging activation remain separate future work. Do not describe
their deferred definitions as active scheduled scans. Native Sonar and required
checks still need exact-head provider evidence under the
[branch policy](../branch-protection.md).

As a human review policy, review security assumptions at least quarterly and
before a public launch: API compatibility and ownership, cookies/origins, CSP/cache
behavior, TLS renewal, target identity, release rollback and recovery evidence.
This document creates no scheduled automation and records no completed review.
External scanning requires an explicitly authorized target and a reviewed
non-production boundary. Preserve sensitive findings/artifacts privately using
[SECURITY](../../SECURITY.md). Record actual source, date, owner, execution,
failures and limits; absent evidence remains unknown. See the
[threat model](threat-model.md) and [authentication review](authentication-review.md).
