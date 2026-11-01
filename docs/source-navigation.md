# Find the owning policy and test

Start with [AGENTS.md](../AGENTS.md), [source scope](bootstrap.md),
[settings](../.agents/settings.json) and [machine navigation](../.agents/navigation.json).

| Task                             | Owners and evidence                                                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change phase or public inventory | [Source policy](../.github/bootstrap-policy.json), [snapshot validator](../scripts/validate-bootstrap.mjs) and [its tests](../scripts/validate-bootstrap.test.mjs)               |
| Change checks or CI agreement    | [Manifest](../.agents/validation.json), [runner](../scripts/validate.mjs), [CI policy](../scripts/check-ci.mjs), [integration tests](../scripts/validation.integration.test.mjs) |
| Change source boundaries         | [Boundary guard](../scripts/check-boundaries.mjs) and [its tests](../scripts/check-boundaries.test.mjs)                                                                          |
| Maintain guidance                | [Guidance rules](../.agents/rules/guidance.md), [guard](../scripts/check-guidance.mjs) and [its tests](../scripts/check-guidance.test.mjs)                                       |
| Change review gates              | [Protection](branch-protection.md), [review preflight](reviews.md), [verifier](../scripts/review-policy.mjs) and [its tests](../scripts/review-policy.test.mjs)                  |
| Validate or publish              | [Validation](validation.md), [Git policy](../.agents/rules/git.md) and [Contributing](../CONTRIBUTING.md)                                                                        |

Read whole owners and matching tests, not isolated search matches.
The governance scope contains no delivered application or browser execution.
Indexes establish discoverability and consistency, not comprehension or hosted success.
