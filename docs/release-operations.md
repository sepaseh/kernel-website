# Release and environment preparation

[English](release-operations.md) · [فارسی](release-operations.fa.md)

The application source supplies runnable composition and its complete fifteen-check [canonical gate](validation.md), with real check/build/e2e/visual CI definitions plus the existing policy/scanner/native Sonar checks. Release, packaging, external staging, deployment-smoke and DAST workflows remain deferred; no operational workflow or deployed target is activated by this source publication. Native Sonar and the complete CodeRabbit preflight remain governed by [branch protection](branch-protection.md) and [Sonar](sonarqube.md).

[Version configuration](releasing.md) and historical changelog entries do not prove a tag, uploaded artifact, provider run or deployed service. The [packager](../scripts/package-release.mjs) consumes supplied local artifacts and retains synthetic owner tests; it does not invoke the application build or publish a release. Use actual build results for application acceptance. Local preparation grants no permission to commit, push, dispatch a workflow, provision secrets or activate infrastructure.

[Target validators](../scripts/validate-workflow-targets.mjs) parse explicit
staging/smoke/DAST inputs without contacting their URLs. Staging checks exact
configured application/API hostnames. Smoke additionally compares the explicit
deployment ID with the expected ID. DAST compares an allowed hostname and a
separately supplied production hostname. These are lexical checks, not DNS
pinning, redirect validation or proof that a host is non-production; an alias or
incorrect allowlist still requires operator review. No scanner or browser runner
is shipped by these functions.

The [cleanup helper](../scripts/docker-smoke-cleanup.mjs) accepts injected Docker
and Compose operations and scopes generated resource names and owned temporary
files. [Its tests](../scripts/docker-smoke-cleanup.test.mjs) use fake callbacks and
disposable files; they do not attest engine compatibility or successful removal of
real resources. Cleanup failures stay failures, and unrelated images, caches and
deployments must never be globally pruned.

Future runtime operations require a separately reviewed application gate, trusted
fixture provenance, exact artifact/target identity, least provider permissions and
explicit authorization. Forks and untrusted source must not receive private
fixture credentials. Record actual execution, failures and remaining resources;
never turn missing integration evidence into a skipped success. Follow
[staging acceptance](staging.md), [deployment acceptance](deployment.md) and
[security review](security/reviews.md).
