# Configure and verify SonarQube Cloud

Use [the existing workflow](../.github/workflows/sonar.yml) on Linux and
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

The scanner imports genuinely measured unit and governance coverage from the
same exact proposed source, as defined by [properties](../sonar-project.properties).
Keep all executable governance source analyzed; add no source, rule or coverage
exclusion or suppression.

Successful scan submission and the native `SonarCloud Code Analysis` quality
gate are distinct requirements. An empty project's zero counters are not an
analysis result. Record the exact head, scanner execution, provider analysis
and native gate; configuration or old-repository results do not satisfy them.

Before a CodeRabbit request, verify the complete matching all-severity report
has zero OPEN/unresolved issues under [review preflight](reviews.md).
Missing analysis, credentials, binding or hosted results remain blockers.
