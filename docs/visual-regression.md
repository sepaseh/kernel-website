# Visual tooling and deferred comparisons

[English](visual-regression.md) · [فارسی](visual-regression.fa.md)

The [visual environment helpers](../scripts/visual-environment.mjs),
[Node owner tests](../scripts/visual-environment.test.mjs), guarded
[visual runner](../scripts/run-visual.mjs), Playwright configuration and authored
scenes are published tooling. The [phase marker](../.github/bootstrap-policy.json)
keeps false-marker snapshots inert before application operations. Typed suites,
installed SDKs and fixture-identity checks are not a browser installation, pixel
comparison or design approval. [Application acceptance](application.md) requires
real execution over the exact integrated pages and CSS.

## Published helper behavior

The helpers validate requested mode, compare supplied baseline platform/version/
review metadata and an expected browser version when provided, mark metadata
pending, protect owned output with an exclusive lock and check local fixture-port
availability. Environment construction uses allowlisted runtime essentials and
synthetic values. Owner tests use temporary metadata, locks and loopback listeners;
they do not inspect actual PNG pixels, launch a browser or attest an installed API.

A reviewed value must identify a reviewer and parseable review time; passing
supplied data to a validator does not prove a review happened. A pending marker
does not capture or approve an image. Never remove another process's lock. Follow
[validation](validation.md) and [test reliability](test-reliability.md).

## Baselines and future acceptance

Previous Windows screenshots and metadata remain dated source material; their
presence or absence is established by the exact publication inventory. Importing
those bytes does not refresh their review or establish current compatibility. Windows records establish no Linux
or other-platform comparison. Source edits alone do not justify refreshing a
baseline or changing a historical review date.

Before actual comparison, close the application pages/CSS inventory and verify
the isolated browser runner, [pinned independent synthetic API](api-fixture.md)
and exact installed browser dependencies.
Verify real platform/browser/version and capture conditions against the selected
reviewed images. Record source fingerprints, viewport/theme/language, fonts and
readiness, operating system and results. Review every expected PNG change; a new
baseline needs explicit authorization and an actual reviewer/time. Never widen
tolerances or regenerate images merely to pass a failure.

Sequence runtime build, browser, both CSP modes and visual work over shared build
outputs. Updates must remain forbidden in CI. Treat missing or incompatible
baseline evidence as a blocker, not a skipped success. Screenshots complement
[accessibility](accessibility.md) and behavior tests; they do not prove API
authorization, SSR, deployment or complete accessibility conformance.
