# Compare website screenshots

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

The current `browser-foundation` phase has `applicationReady: false`. The guarded
visual runner rejects it before configuration, dependencies or browser startup.
The retained Windows PNGs and capture metadata are historical evidence, not a
comparison of this source. Do not change the marker or rewrite baseline dates to
make them appear current.

After runnable composition and acceptance are delivered, use the guarded visual
runner to compare current pages with reviewed baseline images. The authored
[visual suite](../e2e/visual/website.spec.ts) covers home in
English/dark at 1280px, login in English/light at 1280px, registration in
Persian/light at 360px and home in Persian/dark at 360px. Capture height is 900px;
registration uses a full-page screenshot.

## Prepare and compare

```sh
npm run test:visual
```

[The runner](../scripts/run-visual.mjs) checks readiness, clean source paths,
explicit fixture inputs, SDK identity and free ports before capture. It owns an
exclusive visual lock, refuses an existing Next lock and probes the actual bundled
Chromium version. Comparison requires matching platform, Playwright/browser
versions and reviewed baseline metadata.

The lock remains present if child shutdown cannot confirm the capture has closed,
or if initial lock identity cannot be established. The descriptor is closed but
retries remain excluded, even with different fixture ports. Confirm the owned
process has stopped and inspect lock ownership before manually recovering that
lock; a replacement owner's lock must be preserved.

When readiness permits execution, the runner starts its owned website build/API
processes through Playwright.
The suite waits for local fonts, verifies language/theme/content and blocks
unexpected external application requests before taking screenshots.
[Capture configuration](../scripts/playwright-config.mjs) fixes reduced motion,
timezone, locale, device scale and screenshot options. Reports identify the source
input fingerprint and actual environment under ignored `test-results/visual`;
Playwright artifacts are separate from baseline files.

## Inspect a difference

Compare actual, expected and difference images together. Check content, language,
theme, viewport and loaded font metadata before deciding that pixels should
change. A Windows baseline does not establish another platform's appearance.
The source fingerprint describes the runner's listed inputs; it does not replace
the complete exact-tree validation record.

Keep original baseline bytes and review dates until an intentional update is
authorized. Do not widen tolerances or regenerate images to hide a defect.
Follow [test reliability](test-reliability.md) when results vary across runs.

## Update a baseline intentionally

Baseline replacement needs explicit authorization and real visual review.
Outside CI, the guarded update entry is:

```sh
node scripts/run-visual.mjs --update
```

It marks baseline metadata pending before capture and replaces images using the
same controlled runner. A failed update leaves the review pending. Review every
changed PNG with its capture environment; only then record the actual reviewer,
reviewed status and review time. A parseable metadata value alone cannot prove
that a human reviewed an image. Updates are forbidden in CI.

## Verification boundaries

[Visual helper tests](../scripts/visual-environment.test.mjs) exercise mode,
metadata, locks and owned listeners. [Runner tests](../scripts/run-visual.test.mjs)
exercise process/cleanup behavior with synthetic programs. Neither substitutes
for a real pixel comparison. Report actual comparison results and missing
evidence separately from local helper passes.

Future application acceptance runs build, browser/CSP and visual checks
sequentially as described by [validation](validation.md). Screenshots complement
[accessibility](accessibility.md) and behavior tests; they do not establish API
authorization, deployed security or complete accessibility conformance.
