# Application integration contract

[English](application.md) · [فارسی](application.fa.md)

Read the [publication marker](../.github/bootstrap-policy.json), [canonical checks](../.agents/validation.json) and [phase guide](bootstrap.md) first. The application phase publishes complete runnable composition with `applicationReady:true`, 407 source files and 90 product modules. The full profile contains fifteen required checks. Source readiness and a recorded contract are not a claim that an arbitrary tree, hosted check or deployed service has passed.

## Composition

Framework composition, CSS/configuration, tests and documentation are delivered together. Owners are [the root layout](../src/app/layout.tsx), public/auth/account pages and error boundaries under [app](../src/app), [the API route](../src/app/api), [request proxy](../src/proxy.ts), [request messages](../src/i18n/request.ts), [server settings](../src/shared/settings/server.ts) and [the website shell](../src/website/layouts). Composition/adapter unit tests retain explicit framework mocks; real build and browser checks establish their separate integration evidence.

Preserve request-scoped uncached API language/direction, complete local catalogs and explicit root/auth/account messages, cookie/no-store forwarding, fresh CSP nonces and both modes, explicit SEO origins and opt-in indexing, local licensed fonts, reduced motion, independent theme and session/form ownership. Keep one independently installable package without source dependencies on another checkout. Inspect actual installed framework APIs; cover composition and adapter failure paths, every production TS/TSX owner and its import boundaries. Retain all security fixes, existing tests and coverage thresholds.

## Exact-tree acceptance

The runnable full profile registers fifteen required checks: the retained eleven plus dead-code analysis, production build with bundle budget, browser journeys including enforcing/report-only CSP, and visual comparison. The manifest, checked projections, exact inventory, package permissions, type/lint/coverage configuration and CI semantic tests must agree. Commands are owned by the canonical manifest and package scripts, including `check:unused`, `build`, `test:e2e` and `test:visual`; this document does not register an independent command list.

Freshly install Node and pinned Python dependencies in the exact isolated proposed export. For browser evidence independently install the public API revision and dependencies defined by [the fixture contract](api-fixture.md); use fresh owned state and a generated test-only secret outside source, explicit loopback targets and verified SDK/browser identity. Never reuse existing APIs, private dotenv or operator state.

Record source/tree identity, actual production build/bundle, browser/CSP results, failures/skips, current image comparisons, coverage and cleanup. A marker, historical report, earlier head or separate development candidate does not prove that publication tree passed.

## Visual and hosted acceptance

Use compatible image baselines and recorded platform/browser/font/configuration metadata. Preserve original bytes and dates. Updating a baseline requires explicit authorization and real visual review; never auto-update it to hide a failure. Include actual screenshots for visible UI changes. Missing visual evidence remains a blocker.

Before any runnable merge, observe genuine current-head `check`, `build`, `e2e` and `visual` jobs plus scanner, native Sonar and CodeRabbit evidence. Make real build/e2e/visual contexts required through an explicitly authorized [protection change](branch-protection.md), preserving all other safeguards, current-head approval and resolved conversations.

Apply the [CodeRabbit preflight](sonarqube.md#before-requesting-coderabbit): all required non-CodeRabbit checks and complete matching zero-unresolved Sonar report, at least one hour since both the latest request and substantive review, longer provider limits and no duplicate in-flight request. Keep one website PR open at a time; create authorized PRs ready for review.

## Publication boundary

After an actual authorized merge, reconcile real main with the prepared base and rerun complete acceptance whenever proposed bytes change. Keep each coherent package at most 100 GitHub entries; do not remove required tests/docs or split away runtime acceptance to fit.

Application acceptance does not authorize deployment, workflow dispatch, release creation or production access. Docker/Lighthouse orchestration and operations keep separate [delivery](deployment.md), [operations](release-operations.md) and [staging](staging.md) acceptance. [Dated QA](README.md) remains historical.
