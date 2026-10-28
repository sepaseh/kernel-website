# Website testing and evidence

[English](testing.md) · [فارسی](testing.fa.md)

The [marker](../.github/bootstrap-policy.json) and [canonical manifest](../.agents/validation.json) define actual scope and commands. [Validation](validation.md) owns sequencing; [application integration](application.md) maps the delivered composition and complete acceptance. Tests and dated reports establish only the source actually exercised.

| Layer                   | Evidence and limits                                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product                 | Real React/RTL, Radix, next-intl and next-themes with isolated jsdom and synthetic HTTP; all product modules remain measured. Framework/document navigation and motion have documented mocks.                           |
| Language/fonts          | All ten complete catalogs, actual ICU and explicit client scopes; real font binaries, license, codepoints, axes, regenerated subsets and Python coverage. Browser shaping/loading needs browser evidence.               |
| Governance              | Snapshot/import/CI/guidance guards and owned helper tests. API-location/build-graph/metadata fixtures test helpers, not real services or screenshots.                                                                   |
| Delivery                | Owned copy/archive/configuration fixtures, injected engines and owned loopback health listeners. The audit regression remains in measured Vitest unit coverage.                                                         |
| Runners/browser tooling | Disposable Node children test lifecycle; installed Playwright/Axe type-check authored suites/configuration. Node callbacks and successful compilation do not execute journeys.                                          |
| Runtime                 | A runnable package must separately demonstrate exact-tree production build/budget, independent API/browser/CSP journeys and compatible current visual comparison. Deployment and field results need their own evidence. |

## Owner selection

[API tests](../scripts/api-repository.test.mjs), [performance helpers](../scripts/website-performance.test.mjs) and [visual helpers](../scripts/visual-environment.test.mjs) use disposable synthetic projects. Delivery owners are [file policy](../scripts/release-files.test.mjs), [preparation](../scripts/prepare-standalone.test.mjs), [packaging](../scripts/package-release.test.mjs), [configuration/health](../scripts/deployment.test.mjs), [cleanup](../scripts/docker-smoke-cleanup.test.mjs) and [targets](../scripts/validate-workflow-targets.test.mjs). [Audit tests](../scripts/run-audit.test.mjs) retain their unit owner and mocked registry subprocess.

[Runner](runner-foundation.md) and [browser](browser-foundation.md) guides map their measured Node owner cases. Imports stay inert; false-marker core entries reject before configuration, dependency, network or artifact operations. Only owned synthetic roots may declare readiness to test positive guard paths. Test cancellation, failures, bounded output and cleanup of the actual direct child object created by its owner.

The [API fixture](api-fixture.md) requires explicit absolute selection, pinned public Git revision, clean tracked source, independent dependency installation and its published entry. Structural markers alone are insufficient. Preserve standard fixed system Git, strict environment allowlists and launcher parent/child port ownership. Its Node owner tests use owned fixtures and mocked Git; the application browser checks separately run the independently installed API with fresh test-only state/secret outside source and verified browser identity.

## Recording results

Record exact tree/revision, command, first failure, result, failures/skips, coverage and owned cleanup; follow [test reliability](test-reliability.md). Keep all product source measured, 90% unit and 80% governance thresholds and real font coverage. Smaller checks and old green logs do not validate another publication tree.

Local tests, actual browser execution, manual visual review, hosted checks and dated history are distinct evidence. A true marker or authored suite proves none of them. Full runnable acceptance requires all fifteen checks plus actual protected build/e2e/visual jobs before merge. It does not establish production OTP, deployment, complete accessibility compliance or field performance.
