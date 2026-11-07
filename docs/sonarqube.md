# Configure and verify SonarQube Cloud

Use [the existing CI analysis job](../.github/workflows/ci.yml) on Linux and
CI-based analysis. Disable automatic analysis for the same project to avoid
duplicate analysis. Do not add another scanner workflow.

## Required configuration

Use Actions variable `SONAR_PROJECT_KEY=sepaseh_kernel-website` and
`SONAR_HOST_URL=https://sonarcloud.io`. Store the analysis credential only as
Actions secret `SONAR_TOKEN`; never print, read back or put its value in source,
variables, dotenv, chat or logs.

A secret name and public variables are configured metadata, not proof of token
validity or the new repository's provider binding.
Verify access and binding in the provider account, then observe real analysis.
A repository rename or recreation must not be assumed to preserve that binding.

## Required evidence

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

Each LCOV source record must declare one valid `LF` count matching its distinct
`DA` entries. A source with no executable lines declares `LF:0` and needs no `DA`
entries.

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
