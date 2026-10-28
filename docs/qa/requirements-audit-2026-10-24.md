# Website requirements audit — 24 October 2026

[English](requirements-audit-2026-10-24.md) · [فارسی](requirements-audit-2026-10-24.fa.md)

Publication note: original source paths in this report remain archived references; their runnable integration may still be unpublished. Current acceptance is defined in the [application guide](../application.md). The recorded date and findings are unchanged.

This dated assessment reviews website requirements and planning topics. A topic does not require installing every technology: implemented means owning source exists, configured means an executable tool/workflow exists, and verified means the specific recorded execution ran.

## Requirement-level result

| Requirement / roadmap connection                                          | Status in this repository                                | Owning evidence and boundary                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Independent website and local pure libraries                              | Implemented                                              | [Workspace](../../package.json), [ADR 0005](../adr/0005-independent-repositories.md), local contracts/i18n. API implementation and persistence stay external.                                                                                                                                                      |
| Next App Router, TypeScript, Tailwind/shadcn, Lucide and Motion           | Implemented                                              | [Routes](../../src/app), [UI primitives](../../src/components/ui), header (`../../src/website/layouts/Header.tsx`), [reduced-motion reveal](../../src/website/home/Reveal.tsx). Admin conventions are not imported.                                                                                                |
| Introduction home; login, registration, recovery and account              | Implemented; OTP launch depends on API delivery          | Home (`../../src/website/home/Home.tsx`), [features](../../src/features), [real browser journeys](../../e2e/website/website.spec.ts). Production SMS/email delivery is API-owned and not supplied by these screens.                                                                                                |
| One persisted active language; fresh English; canonical URLs              | Implemented                                              | [Language loader](../../src/shared/settings/language.ts), request config (`../../src/i18n/request.ts`), redirects (`../../next.config.ts`). No visitor control/header/cookie language selection; invalid/unavailable settings fail. The API owns the fresh default and preserved settings.                         |
| Genuine common labels and all ten complete catalogs                       | Implemented                                              | [Local catalog integrity](../../src/i18n/catalog-data/integrity.test.ts), [registry](../../src/i18n/catalog-data/locales.ts), [client selection](../../src/i18n/client-messages.ts). Independent copies need no cross-repository translation synchronization.                                                      |
| HTTP-only ownership, cookie sessions and credential stripping             | Implemented                                              | [Allowlisted proxy](../../src/shared/api/proxy.ts), [proxy tests](../../src/shared/api/proxy.test.ts). Backend DB/auth/storage SDKs are excluded by [boundary checks](../../scripts/check-boundaries.mjs) (F022).                                                                                                  |
| Private account/cache boundaries, finite upstream waits                   | Implemented                                              | Proxy uses private/no-store and 15-second upstream timeout; settings use no-store/5 seconds. [Cache/browser cases](../../e2e/website/performance.spec.ts) and [session provider](../../src/features/auth/SessionProvider.tsx) distinguish loading/error/unauthenticated (F043/F113/F120/F121).                     |
| Late account mutation after logout/new login                              | Fixed in this audit                                      | SessionProvider now accepts a mutation result only into its matching loaded snapshot. [Regression](../../e2e/website/session-isolation.spec.ts) uses two real fixture accounts and holds the old successful profile response until the second login completes (F118).                                              |
| SEO foundation and English/Persian operator tutorial                      | Implemented                                              | [SEO guide](../seo.md), [configuration/metadata/JSON-LD](../../src/shared/seo), robots (`../../src/app/robots.ts`), sitemap (`../../src/app/sitemap.ts`), [SEO journeys](../../e2e/website/seo.spec.ts). Noindex default; only actual public Home is discoverable; no invented business schema or visitor locales. |
| Standard Web Vitals, no default collector                                 | Implemented; external RUM conditional                    | [Framework adapter](../../src/shared/performance/web-vitals.ts), [client boundary](../../src/shared/performance/WebVitals.tsx), [unit semantics](../../src/shared/performance/web-vitals.test.ts). Standard CLS/INP units are preserved; no default storage/transport (F039/F110).                                 |
| Bundle/route budgets, lab runner and analyzer                             | Implemented/configured                                   | [Budget](../../performance-budget.json), [bundle gate](../../scripts/check-bundle-website.mjs), Lighthouse runner (`../../scripts/run-website-performance.mjs`), [analyzer](../../scripts/analyze-website-performance.mjs). Historical lab scores are not a new field-performance result (F041/F045).              |
| Smaller client boundaries, scoped messages, Motion and local font subsets | Implemented                                              | [Message selector](../../src/i18n/client-messages.ts), server header (`../../src/website/layouts/Header.tsx`), [font manifest](../../src/shared/fonts/manifest.json), [font browser cases](../../e2e/website/font-performance.spec.ts). Essential text remains readable without JS.                                |
| Next-compatible nonce CSP, report-only/enforce and deployment wiring      | Implemented                                              | Proxy (`../../src/proxy.ts`), [policy](../../src/shared/security/csp.ts), [CSP cases](../../e2e/website/csp.spec.ts), [deployment settings](../../scripts/validate-deployment-env.mjs). Default report-only does not claim blocking or a violation collector (F051).                                               |
| Contrast, semantic errors, keyboard and reduced motion                    | Implemented and automatically checked                    | [Website accessibility guide](../accessibility.md), [eight EN/FA/theme cases](../../e2e/website/accessibility.spec.ts), [form fields](../../src/shared/ui/FormField.tsx). No contrast-rule exclusion. Website overlays do not exist, so admin dialog-loop behavior belongs to kernel-admin (F035/F046/F047).       |
| Manual screen-reader/full WCAG evaluation                                 | Not executed; verification remains partial               | NVDA/VoiceOver, speech, zoom/forced-colors, other languages/custom content need a recorded manual assessment. Axe and screenshots cannot prove them (F048).                                                                                                                                                        |
| Reviewed visual regression and CI job                                     | Implemented/configured; earlier local comparisons passed | [Runner](../../scripts/run-visual.mjs), [configuration](../../playwright.visual.config.ts), four reviewed Windows baselines (`../../e2e/visual/baselines/win32`). Hosted job execution is not claimed (F034).                                                                                                      |
| Docker/native release packaging, TLS, health and rollback                 | Implemented; earlier disposable payloads verified        | [Deployment](../deployment.md), [packager](../../scripts/package-release.mjs), [Docker](../../deploy/docker/README.md), [native](../../deploy/native/README.md). The website is stateless; database/object recovery belongs to API. Linux systemd/ACME and production rollout remain operator actions.             |
| Automatic Docker test-output cleanup                                      | Implemented and separately tested                        | [Cleanup helper](../../scripts/docker-smoke-cleanup.mjs), [regressions](../../scripts/docker-smoke-cleanup.test.mjs), [testing rule](../../.agents/rules/testing.md). Own builder/cache, tags, containers, volumes/network and TEMP are cleaned; no routine global prune.                                          |
| Portable assistant instructions, navigation, ADRs and evaluation cases    | Implemented; fresh semantic benchmark not claimed        | [Guidance](../../.agents/README.md), [navigation](../../.agents/navigation.json), [eight local oracles](../../.agents/evaluation/cases.json), [evaluation limits](../comprehension-evaluation.md), [ADRs](../adr/README.md) (F079/F085/F086). Original 79/80 is historical.                                        |
| CI/security/release/staging templates                                     | Configured; remote activation/execution pending          | [CI](../../.github/workflows/ci.yml), [release operations](../release-operations.md). Private API integration requires a read token and immutable revision. No remote workflow, provider or branch protection was activated here.                                                                                  |

## Corrections made

The delayed-profile regression first failed on the previous production output:
account B had loaded, then account A's late response replaced the provider's
snapshot key and left the account screen loading. The functional snapshot-key
guard fixed it without adding a package, changing HTTP/session semantics or
rewriting the API. The navigation map and evaluation evidence now include this
provider and regression, so future work follows the client generation boundary.

Accessibility guidance covers website-owned paths and commands. Evidence screenshots target ignored test-results/website/evidence inside CI artifacts. Performance and deployment results retain their recorded dates and scopes.

## Fresh execution and limits

The installed Next 16.4.2 server/client and use-client guides were read before the
framework edit. Node 24.18.0 and synthetic fixture configuration were used.

- Previous behavior reproduced: the new focused session case failed at the final
  account-visibility check after releasing the old response.
- A fresh production build and the focused fixed case passed; then all 48 browser
  cases passed against that same build, including all ten language/SEO cases,
  authentication/account, nonce enforcement, accessibility and the new race.
- npm run test:unit passed: 171 website cases, 9 catalog cases and 39 tooling
  cases. These per-command counts are not a sum of unique application journeys.
- Typecheck, lint, Knip, import boundaries and 14 guidance regressions passed.
  The fresh bundle gate passed at 824,117 browser-JS bytes, largest chunk 235,044
  and CSS 37,452, without widening a budget.
- Two focused real-browser journeys passed after the output-path change; all
  eight evidence PNGs were created inside ignored test-results/website/evidence.
  Final formatting and local guidance checks passed. No new full-profile or
  hosted-CI result is implied.

No Docker app rebuild, real dotenv/state read, production request, commit or push
was performed in this audit. Dated native/Docker/visual evidence is recorded
in [the prior record](independent-website-verification.md); this audit does not
relabel that execution as fresh. No new Lighthouse, field INP/p75, manual
screen-reader assessment or uncontaminated AI comprehension benchmark ran.

## Remaining choices and suggestions

For a deployed product, first configure and verify API-owned OTP delivery before
opening registration/recovery/email verification. Select public domain, indexing,
certificate renewal, backup/recovery ownership and private-CI credentials for the
actual environment. These need operator/provider decisions, not another website
framework.

Record a short manual accessibility assessment before making a conformance claim.
If a real site needs RUM, add a deliberate consent/sampling/retention/transport
policy to the existing adapter; do not enable an unsolicited collector. SSG/ISR,
content cache invalidation, CMS/media/video, OAuth, offline/PWA, realtime and AI
product features remain conditional. Serena/Graphify/Repomix/Context7 pilots need a
measured discovery/understanding problem; none is a missing runtime dependency.
The reusable [handoff/implementation plan](../change-workflow.md) and
[flaky-test ownership policy](../test-reliability.md) now implement F038/F081/F082
as local workflow artifacts. They do not add a runtime or claim an automatic
flaky detector.

After the scoped audit, a [separate source-comprehension evaluation](source-comprehension-2026-10-24.md) was performed. Manual discovery and partial rubric coverage are not an all-assistant benchmark or another runtime test execution.

The [complete 137-topic matrix](roadmap-status-2026-10-24.md) records this website's dispositions. [Change handoff/planning](../change-workflow.md) and [flaky-test ownership](../test-reliability.md) are local workflows, not extra runtime services.
