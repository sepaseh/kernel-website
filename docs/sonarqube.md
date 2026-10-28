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
runs actual TypeScript/governance coverage plus required Python font verification
before scanning. The [properties](../sonar-project.properties) import
`coverage/unit/lcov.info`, `coverage/governance/lcov.info` and measured Python
`coverage/fonts/coverage.xml` from that same checkout/revision. False-marker
prerequisites retain sixty-six production modules; application activation must
expand coverage/analysis to every executable production owner in its exact
inventory. Test/support TS/TSX files remain classified as tests. No production
source, security or coverage exclusion may hide the new composition. Authored
browser suites are test infrastructure, not measured product behavior or a
deployment result. Type-only DTO declarations have no executable behavior.
Do not fabricate reports or substitute another project's coverage.

The maintained analysis also includes `scripts/check-guidance.mjs` and the optional
Node safety guard in `.agents/hooks`. The governance command runs the guidance
and portable-hook tests and measures their actual imported JavaScript alongside
the existing guards. Shell fixture behavior is tested, but Node LCOV does not
measure Bash source. No new analysis or coverage exclusion is introduced.

## Static catalog findings

The first localization analysis for PR #2 reported **65.2% new-code duplication**
across the ten static translated dictionaries. Their repeated key schema is data
ownership, not shared executable behavior. The explicitly authorized duplication-only
scope covers only the ten language-data files under
`src/i18n/catalog-data/locales/*.ts`; loaders, settings, application
logic and tooling remain subject to duplication analysis. Source/security checks
and genuine unit/governance coverage still include every catalog.

The [catalog tests](../src/i18n/catalog-data/integrity.test.ts) must additionally
inspect each file's TypeScript AST: a flat object of literal string values,
erased local type imports and its default export only. Runtime statements,
spreads, computed keys and computed values must fail CI. This prevents the
data-only duplication scope from concealing executable logic. This authorization
does not extend to other files, security rules or provider classifications. The complete gate and
fresh Sonar analysis must verify the actual result.

Sonar classifies the `typescript:S2068` finding `AaF5M1BkNrX0jLhu4aR3` on the
Spanish `password: "Contraseña"` UI label in
[`es.ts`](../src/i18n/catalog-data/locales/es.ts) as **False Positive**, under
separate explicit user authorization. The value is visible UI text, not an
authentication credential. The translation is unchanged; no security-rule
suppression or source/coverage exclusion was added. This classification applies
only to this exact literal-label finding and does not authorize classifying
other issues. Before requesting CodeRabbit, verify a fresh report for the exact
current head with zero open/unresolved issues and a passing actual quality gate.

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
API calls. Fresh provider analysis must verify the result. The PR-file guard
does not suppress findings or change provider classifications.

Use [official GitHub Actions setup](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/ci-based-analysis/github-actions-for-sonarcloud)
and [analysis methods](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/automatic-analysis).

## Before requesting CodeRabbit

Request an initial review or re-review only after **every required
non-CodeRabbit check passes for the exact current PR head**. Use the approved
phase-specific set in [branch protection](branch-protection.md). The non-runnable
publication requires `check`, the trusted `PR file limit`, `SonarQube Cloud analysis` and the actual
`SonarCloud Code Analysis` quality gate before a request. Exclude only
CodeRabbit's own check and approval from this preflight to avoid a circular
dependency.

The approved false-marker policy does not require app `build`, `e2e` and
`visual` jobs. This is a phase boundary, not permission to remove live required
checks. Before any runnable-app merge,
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
change invalidates this evidence. Recheck after fixes; wait at least one hour
since both the latest review request and substantive website review, respect
any longer provider retry limit and do not duplicate an accepted review already
in flight for the same head. Send one manual
request only after preflight passes and the remote action is explicitly
authorized; a skipped or quota-limited review is not a completed review.

Quality helpers under scripts remain in the existing analysis scope. Their Node
owner tests produce genuine governance LCOV from the same source tree. Synthetic
build, fixture-location, environment, metadata and lock tests do not establish
application/API/browser execution. [Testing](testing.md), [validation](validation.md)
and the [application contract](application.md) identify the additional evidence.

All eight new delivery Node helpers stay under scripts in the existing analysis scope, with genuine coverage from the six Node owner files and the existing audit regression. Passive Docker/native shell/configuration templates have static and owned fixture contract checks; Node LCOV does not measure shell source or prove a container/service run. No source, rule, coverage or duplication exception is added. A locally prepared package has no new hosted analysis until it is separately authorized and published after the current PR merges.

The [runner foundation](runner-foundation.md) owns explicit inputs, direct-child
lifecycle, standalone/API fixture launching and bounded analysis output. Core
entry operations read the public readiness marker first and reject false-marker
snapshots. Imports do not load dotenv, mutate the environment or launch services.
Node owner tests execute owned synthetic children, including failures/cancellation;
they do not establish real Next.js/API/browser/Docker or lab execution. The
[browser foundation](browser-foundation.md) adds guarded Playwright configuration
and visual/CSP orchestration. The [API fixture contract](api-fixture.md) verifies
the immutable public revision and independent installation without turning a
false marker into runnable evidence. Keep all helpers measured and thresholds intact.

Authored e2e TypeScript files and exact Playwright configurations remain analyzed
as test infrastructure and checked by tsconfig.tooling.json against installed
Playwright/Axe packages. Genuine application activation must add exact-tree real
build, browser/CSP and visual execution and protected jobs; a passed typecheck,
old report or local plan does not satisfy that requirement. No source, rule or
coverage exclusion is added.
