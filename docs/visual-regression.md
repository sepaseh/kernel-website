# Compare website screenshots

Run the visual suite to compare the current website against reviewed
screenshots. The authored
[visual suite](../e2e/visual/website.spec.ts) covers home in
English/dark at 1280px, login in English/light at 1280px, registration in
Persian/light at 360px and home in Persian/dark at 360px. Capture height is 900px;
registration uses a full-page screenshot.

## Prepare and compare

1. Install the toolchain and project-local Chromium, then select explicit inputs
   for the same-repository [local HTTP fixture](api-fixture.md) using
   [development](development.md) and [validation](validation.md).
2. Use a platform with compatible reviewed baselines. The checked-in images are
   Windows-specific; Linux is a supported runner mode but needs its own reviewed
   images/metadata. A missing or incompatible baseline is a failure.
3. Stop manually owned website/API launchers before the run. Keep build/browser
   work sequential on each checkout. Confirm the owner before taking any action
   on an existing Next or visual lock.
4. Build the current source, then run the registered comparison command:

```sh
npm run build
npm run test:visual
```

[The runner](../scripts/run-visual.mjs) checks readiness, clean source paths,
explicit fixture inputs, SDK identity and free ports before capture. It owns an
exclusive visual lock, refuses an existing Next lock and probes the actual
bundled Chromium version. Comparison requires matching platform,
Playwright/browser versions and valid review metadata. Preserve the baseline's
original Node version, capture dates and source fingerprint as recorded.

The lock remains present if child shutdown cannot confirm the capture has closed,
or if initial lock identity cannot be established. The descriptor is closed but
retries remain excluded, even with different fixture ports. Confirm the owned
process has stopped and inspect lock ownership before manually recovering that
lock; a replacement owner's lock must be preserved.

Direct execution with `node scripts/run-visual.mjs` builds by default. The registered
`npm run test:visual` command, canonical full gate
and hosted visual job reuse the single verified production build. Under the
visual lock, reuse verifies the admitted source, runtime inputs, exact
Node/Next/platform identity and every non-cache `.next` file before and after
capture. Hosted CI binds the downloaded build to its successful producer
attempt in the same run. For a baseline update, the runner requires a fresh build.

The runner starts its owned website/API processes through Playwright.
The suite waits for local fonts, verifies language/theme/content and blocks
unexpected external application requests before taking screenshots.
[Capture configuration](../scripts/playwright-config.mjs) fixes reduced motion,
timezone, locale, device scale and screenshot options. The runner records the
current source fingerprint and environment in
`test-results/visual/environment.json`. Open the Playwright report in
`playwright-report/visual` for individual outcomes.

## Inspect a difference

For a pixel mismatch, open the actual, expected and difference images in the
run's artifacts. Check the content, language, theme, viewport and font readiness.
For a browser setup failure, inspect the first lock, origin, SDK or browser
diagnostic before retrying.

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

Local full acceptance runs build and the disjoint browser profiles sequentially
as described by [validation](validation.md). Hosted browser jobs use isolated
copies of the same verified build. Screenshots complement
[accessibility](accessibility.md) and behavior tests; they do not establish API
authorization, deployed security or complete accessibility conformance.
