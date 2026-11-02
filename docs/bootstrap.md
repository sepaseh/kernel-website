# Understand this publication

The current phase is **governance**. The [source policy](../.github/bootstrap-policy.json)
declares `applicationReady: false` and the exact allowed inventory.
Read source and marker before claiming delivery.

This phase publishes one npm package containing repository validation,
review enforcement, assistant rules/skills and their owner tests.
It delivers no application routes, runtime server, browser fixture or deployment.
Installed dependencies alone do not establish those capabilities.

The [manifest](../.agents/validation.json) registers ten required check kinds.
[Testing](testing.md) defines their evidence; [validation](validation.md) defines
fresh exact-tree acceptance. No Python, browser or font verification is required
for this governance-only source scope.

Later application delivery must add its real source, boundaries, tests, measured
coverage and acceptance together. Do not turn readiness on, add placeholder jobs
or weaken a check to imitate a delivered application.
Native hosted CI, CodeQL, Sonar and CodeRabbit evidence remains separate from
local validation. Configuration does not manufacture a provider result.
[Branch protection](branch-protection.md) applies the actual phase checks and
GitHub's native approving-review count without a custom approval publisher.
