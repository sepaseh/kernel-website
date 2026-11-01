# Verify performance helpers

The [features phase](bootstrap.md) publishes font selection, client message
scopes, reveal behavior and an opt-in Web Vitals callback. Its local tests cover
these helpers. Application builds, bundle analysis and browser performance labs
require a later application integration.

## Check the published behavior

- Font preload selection includes the Latin subset and adds the Arabic subset
  for Persian and Arabic. The focused test checks selected bytes against the
  preload budget and verifies the generated assets. [Font tests](../src/shared/fonts/preloads.test.ts)
- Client message selection provides explicit key sets for the root,
  authentication and account scopes. It fails when a required string is missing.
  [Client message tests](../src/i18n/client-messages.test.ts)
- Reveal keeps content visible in static markup and removes the initial offset
  for reduced motion. [Reveal tests](../src/features/home/Reveal.test.ts)

## Keep field delivery opt-in

`WebVitals` registers a stable framework callback. The delivery helper accepts
finite values and deltas for CLS, INP, LCP, FCP and TTFB. It sends only the metric
name, value, delta, rating and unit to explicit subscribers. There is no default
transport, storage or replay, and a failing subscriber cannot interrupt other
deliveries. Preserve the framework's values and units for successive reports.
[Callback test](../src/shared/performance/WebVitals.test.ts) and
[delivery tests](../src/shared/performance/web-vitals.test.ts).

## Measure an integrated application

Once a phase publishes the build and measurement tools, record bundle budgets
from the exact production build and keep browser lab samples separate from field
metrics. A reachable bundle graph describes possible code, and summed gzip
sizes estimate compression per file. Measure actual transfer and executed code
in the browser when those are the quantities under review. Lab results describe
the tested routes and device profiles. Field percentiles require actual field
data and an explicitly authorized collection path.

Use an owned synthetic fixture for local measurements and record the executed
revision, inputs and outcomes. Follow the phase's required validation separately.
[Validation](validation.md).
