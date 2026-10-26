# SonarQube Cloud

[English](sonarqube.md) · [فارسی](sonarqube.fa.md)

The existing [Sonar workflow](../.github/workflows/sonar.yml) runs on
`ubuntu-latest`: choose **Linux** in the provider wizard, irrespective of local
Windows development. Reuse this workflow; do not add duplicate `build.yml`.
Choose CI-based analysis and disable automatic analysis for this project.

Use the imported project key **`sepaseh_kernel-website`** in Actions variable
`SONAR_PROJECT_KEY`. `SONAR_HOST_URL` defaults to `https://sonarcloud.io`.
Create a token permitted to analyze this project and store only its value as
Actions secret **`SONAR_TOKEN`**. A token label such as
`kernel-github-actions` is arbitrary and differs from both the secret name and
project key. Never put token values in source, dotenv, variables, chat or logs.
Missing credentials/project settings fail explicitly; no analysis is claimed.

The workflow validates the declared snapshot, installs the locked toolchain and
runs both real coverage commands before scanning. The
[properties](../sonar-project.properties) import `coverage/unit/lcov.info` and
`coverage/governance/lcov.info` from that same checkout/revision. They cover
published helpers, local catalogs and governance scripts, not Next.js UI, HTTP routes, browser
journeys or deployment. Type-only DTO declarations have no executable behavior.
Do not fabricate reports or substitute another project's coverage.

Record the actual run, analyzed SHA/PR, provider analysis and quality-gate result.
The scanner uses `sonar.qualitygate.wait=false`; successful scan submission and
a successful Actions job are distinct from a passing **SonarCloud Code Analysis**
check from App `12526`, required under [branch protection](branch-protection.md).
Missing, skipped or failed analysis is not a passing quality gate.

Configuration and an empty project's zero issue counters are not execution
evidence. The initial CI and Sonar quality gate for [website PR #1](https://github.com/sepaseh/kernel-website/pull/1)
were verified on 26 October 2026; later heads require fresh results. An empty main
analysis history alone does not prove that first-PR analysis is blocked; inspect
the actual provider error. Fork PRs do not receive this workflow's credentials;
do not expose secrets to unreviewed fork code.

The [PR-file guard](../scripts/check-pr-size.mjs) rejects metadata counts above
100 before requesting files. An accepted PR fits one `per_page=100` response;
any next-page link is inconsistent and fails closed without following it.
The guard validates all returned entries and rechecks the head, base and count
after retrieval. This keeps the 100-file policy explicit and avoids unnecessary
API calls. Fresh provider analysis must verify the result; no suppression or
provider classification is used.

Use [official GitHub Actions setup](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/ci-based-analysis/github-actions-for-sonarcloud)
and [analysis methods](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/automatic-analysis).

## Before requesting CodeRabbit

Request an initial review or re-review only after **every required
non-CodeRabbit check passes for the exact current PR head**. Use the approved
phase-specific set in [branch protection](branch-protection.md). The non-runnable
publication requires `check`, `SonarQube Cloud analysis` and the actual
`SonarCloud Code Analysis` quality gate before a request. Exclude only
CodeRabbit's own check and approval from this preflight to avoid a circular
dependency.

Under the non-runnable publication policy, app `build`, `e2e` and
`visual` jobs are not currently required. Before any runnable-app merge,
introduce those real jobs, observe them pass, add them to required checks and
expand the full canonical application gate. Do not emit placeholder jobs,
skip required checks or treat a documentation edit as a remote policy change.

Verify the latest applicable Sonar PR/branch analysis matches that head and
source scope, with **zero OPEN/unresolved issues across all severities**,
including existing issues. A green quality gate or zero issues on new code is
insufficient. Check complete issue results, filters and pagination. Missing,
pending, skipped, failed or unavailable checks, an absent/mismatched report or
missing complete zero-issue evidence blocks the review request.

A locally documented false positive remains a blocker while OPEN in the provider.
A properly authorized
provider classification, or a real fix followed by fresh analysis, must be
reflected in the report. Do not exclude/suppress issues, add metric-only wrappers
or weaken checks to bypass this requirement.

Record the head, required-check results and Sonar analysis. Any new commit/head
change invalidates this evidence. Recheck after fixes, respect review quotas and
do not duplicate a request already in flight for the same head. Send one manual
request only after preflight passes and the remote action is explicitly
authorized; a skipped or quota-limited review is not a completed review.
