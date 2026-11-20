# Configure and verify SonarQube Cloud

Use CI-based analysis. Disable SonarQube Cloud automatic analysis for the same
project to avoid duplicate scans.
Use the [existing CI analysis job](../.github/workflows/ci.yml) on Linux. Keep that job as the only scanner workflow.

## Required configuration

Set the Actions variable `SONAR_PROJECT_KEY=sepaseh_kernel-website`. The workflow
defaults to `https://sonarcloud.io` and accepts the public `SONAR_HOST_URL`
variable. Store the analysis credential in Actions secret `SONAR_TOKEN`. Keep
its value out of source, variables, dotenv, chat and logs.

A secret name and public variables are configured metadata, not proof of token
validity or the new repository's provider binding.
Verify access and binding in the provider account, then observe real analysis.
A repository rename or recreation must not be assumed to preserve that binding.

## Verify coverage and the native gate

The separate unit and governance jobs each measure their suite once. After the
`check` aggregate succeeds, analysis downloads their immutable suite/run/attempt
artifacts and verifies each report's exact source identity and measured bytes
before scanning, as defined by [the evidence owner](../scripts/ci-evidence.mjs)
and [properties](../sonar-project.properties). Each download uses its own
successful producer attempt, including analysis-only reruns. A missing or
mismatched report blocks analysis; the scanner does not rerun tests to replace
missing evidence.

The separate build artifact serves browser acceptance only. Its provenance
checks do not replace measured coverage, change the unit/governance thresholds
or cause analysis to rebuild the website or rerun browser suites.

If provenance verification fails, identify the failing producer and inspect its
run attempt. LCOV source paths must belong to the attested Git tree, and measured
lines must fall within those files. Each record declares one valid `LF` count
matching its distinct `DA` entries. A source with no executable lines declares
`LF:0`. Governance also verifies coverage XML for the attested Python font
verifier.

Keep all executable governance source analyzed; add no source, rule or coverage
exclusion or suppression.

Successful scan submission and the native `SonarCloud Code Analysis` quality
gate are distinct requirements. An empty project's zero counters are not an
analysis result. Record the exact head, scanner execution, provider analysis
and native gate; configuration or old-repository results do not satisfy them.

The separate native `CodeQL` security result from GitHub Advanced Security
App `57789` is also required under [branch protection](branch-protection.md).
It replaces neither Sonar scanner execution nor the native Sonar quality gate.

Before a CodeRabbit request, verify the complete matching all-severity report
has zero OPEN/unresolved issues under [review preflight](reviews.md).
Missing analysis, credentials, binding or hosted results remain blockers.
