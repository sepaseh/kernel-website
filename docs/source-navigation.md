# Find the owning policy and test

Start with [AGENTS.md](../AGENTS.md), [source scope](bootstrap.md),
[settings](../.agents/settings.json) and [machine navigation](../.agents/navigation.json).

| Task                                     | Owners and evidence                                                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change phase or public inventory         | [Source policy](../.github/bootstrap-policy.json), [snapshot validator](../scripts/validate-bootstrap.mjs) and [its tests](../scripts/validate-bootstrap.test.mjs)               |
| Change checks or CI agreement            | [Manifest](../.agents/validation.json), [runner](../scripts/validate.mjs), [CI policy](../scripts/check-ci.mjs), [integration tests](../scripts/validation.integration.test.mjs) |
| Verify measured CI coverage              | [Evidence owner](../scripts/ci-evidence.mjs) and [its tests](../scripts/ci-evidence.test.mjs)                                                                                    |
| Change source boundaries                 | [Boundary guard](../scripts/check-boundaries.mjs) and [its tests](../scripts/check-boundaries.test.mjs)                                                                          |
| Validate Actions syntax                  | [actionlint runner](../scripts/run-actionlint.mjs) and [its tests](../scripts/run-actionlint.test.mjs)                                                                           |
| Maintain guidance                        | [Guidance rules](../.agents/rules/guidance.md), [guard](../scripts/check-guidance.mjs) and [its tests](../scripts/check-guidance.test.mjs)                                       |
| Change review gates                      | [Protection](branch-protection.md), [review preflight](reviews.md), [CI policy](../scripts/check-ci.mjs) and [its tests](../scripts/check-ci.test.mjs)                           |
| Validate or publish                      | [Validation](validation.md), [Git policy](../.agents/rules/git.md) and [Contributing](../CONTRIBUTING.md)                                                                        |
| Change shared catalogs                   | [Catalogs](localization.md), [catalog integrity tests](../src/i18n/catalog-data/integrity.test.ts)                                                                               |
| Change client session or HTTP forwarding | [Session](session.md), [proxy tests](../src/shared/api/proxy.test.ts), [session tests](../src/features/auth/session/SessionProvider.test.tsx)                                    |
| Change shared controls or forms          | [Client UI](client-ui.md), [forms](forms.md), [form field tests](../src/shared/ui/FormField.test.tsx)                                                                            |
| Verify font assets                       | [Font guidance](fonts.md), [font check](../scripts/subset-website-fonts.py)                                                                                                      |

Read whole owners and matching tests, not isolated search matches.
The client-foundation scope contains no delivered application or browser execution.
Indexes establish discoverability and consistency, not comprehension or hosted success.
