# Release and environment preparation

[English](release-operations.md) · [فارسی](release-operations.fa.md)

The operations phase retains the complete fifteen-check [application gate](validation.md) and adds six operational workflow sources. [CodeQL](../.github/workflows/codeql.yml) defines automatic JavaScript/TypeScript analysis for main pushes, main-targeted PRs and a weekly schedule, plus manual dispatch. The other five workflows are manual and main-only: release, packaging, external staging, deployment smoke and DAST. Source definitions and semantic tests do not establish hosted availability, a completed scan, an uploaded artifact or a deployment. Native Sonar and CodeRabbit remain subject to [branch protection](branch-protection.md) and the [exact-head preflight](sonarqube.md).

[Version configuration](releasing.md) and historical changelog entries do not prove a tag, uploaded artifact, provider run or deployed service. The [packager](../scripts/package-release.mjs) consumes supplied local artifacts and retains synthetic owner tests; it does not invoke the application build or publish a release. Use actual build results for application acceptance. Local preparation grants no permission to commit, push, dispatch a workflow, provision secrets or activate infrastructure.

The [operational wrapper](../scripts/operations-checks.mjs) guards `deploy:package`, `test:smoke` and `test:staging`. Packaging consumes a prepared local build and exclusive release ID; browser modes validate explicit public targets before resolving the exact installed SDK and forward an allowlisted parent environment. Docker smoke and Lighthouse use their separate owned runners. These four manual operations and the advisory lab command remain outside `full`.

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

Actual runtime operations require a separately reviewed application gate, trusted
fixture provenance, exact artifact/target identity, least provider permissions and
explicit authorization. Forks and untrusted source must not receive private
fixture credentials. Record actual execution, failures and remaining resources;
never turn missing integration evidence into a skipped success. Follow
[staging acceptance](staging.md), [deployment acceptance](deployment.md) and
[security review](security/reviews.md).
