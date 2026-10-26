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
foundation helpers and governance scripts, not Next.js UI, HTTP routes, browser
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

For S9382 in [PR-file pagination](../scripts/check-pr-size.mjs), each next URL
comes from the preceding response's Link header, so awaiting pages sequentially
is required. This matches the [documented dependent-iteration exception](https://eslint.org/docs/latest/rules/no-await-in-loop#when-not-to-use-it).
Repository review identifies this occurrence as a false positive; the provider
issue is still **OPEN** at the 26 October 2026 checkpoint. No provider
classification is claimed. Preserve the dependent sequence; do not add a
suppression, helper wrapper or parallel requests to silence this finding.

Use [official GitHub Actions setup](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/ci-based-analysis/github-actions-for-sonarcloud)
and [analysis methods](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/automatic-analysis).
