# Visual tooling and deferred comparisons

[English](visual-regression.md) · [فارسی](visual-regression.fa.md)

**integration-tooling** publishes [visual environment helpers](../scripts/visual-environment.mjs)
and [Node owner tests](../scripts/visual-environment.test.mjs), not a Playwright
runner, scene/configuration, browser installation or screenshot baseline. There
is no runnable page or CSS pipeline. Helper success is not a visual comparison
or approval of the current design.

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

Previous Windows screenshots and metadata are preserved as dated source material
outside this published snapshot. They are deferred, not silently replaced or
promoted to current compatibility evidence. Windows records establish no Linux
or other-platform comparison. Source edits alone do not justify refreshing a
baseline or changing a historical review date.

Before actual comparison, publish pages/CSS, an isolated browser runner, an
independently installed synthetic API fixture and pinned browser dependencies.
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
