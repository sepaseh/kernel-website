# Website validation — 24 October 2026

[English](standalone-layout-2026-10-24.md) · [فارسی](standalone-layout-2026-10-24.fa.md)

This dated record describes the tested website revision and its actual results/limits. It is not a claim of a new full-profile run or current Docker inventory.

## Verification

All 15 required profile gates passed after a clean root install: 15 guidance regressions, boundaries covering 97 production modules, dependency audit (zero findings), typecheck, lint (zero warnings), format, 171 unit tests, nine catalog tests, 39 tooling tests, 24 deployment/start regressions, Knip and the Next.js build. The unchanged bundle budgets passed with 824,118 JavaScript bytes, a 235,044-byte maximum chunk and 39,624 CSS bytes. All 48 real browser journeys, four report-only CSP cases and four pinned visual comparisons passed without updating or newly approving baselines.

The freshly built native package was relocated outside the checkout and passed seven real checks: SSR, noindex, JavaScript, font delivery, stripped credential fields, HttpOnly session cookies and account access against the independent API. Its entry is `website/server.js`; the disposable processes, package and temporary fixture were cleaned.

The first browser run retained its failure evidence and exposed two failing test-only catalog imports. Those tests now use the production explicit locale loader map; all 48 journeys were rerun successfully. No retry policy, skip or assertion threshold was weakened.

The real Docker smoke reached the root Dockerfile but Docker Hub/CloudFront returned HTTP 403 for the pinned Node image metadata before application source was built. A successful Linux image run is not claimed. The optional external Dockerfile frontend directive was removed; standard instructions use the bundled BuildKit frontend. All 24 packaging/start/deployment regressions passed again after this change.

All five disposable builders from these attempts were confirmed absent. Test containers, custom networks, volumes, application images, builder caches and Docker fixtures were removed; the newly pulled shared BuildKit tool image was also removed after the test suite. Final Docker inventory was zero images, containers, volumes and build-cache bytes. No global prune was used.

## Evidence boundaries

Forced Windows process-tree shutdown left five synthetic browser fixtures containing 798,720 bytes of test SQLite data and empty upload folders, with no remaining fixture listener. Their cleanup was not completed. This is separate from the successfully cleaned native package and Docker resources.

Hosted CI, production rollout, Linux systemd activation, manual screen-reader certification and provider-dependent product integrations are not implied by local tests. The Docker cleanup policy remains exact-resource cleanup after every test, including failures; no global prune is used.
