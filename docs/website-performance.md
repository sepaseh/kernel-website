# Measure bundles and run an advisory local performance lab

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

Use this guide to inspect an actual local build and collect optional Lighthouse
samples. Production bundle budgets remain required; lab scores are advisory and
outside the [full validation profile](validation.md). These procedures establish
only the measurements actually run, not a field dataset or deployment result.

## Prepare the local fixture

Follow [development setup](development.md): pinned Node/npm, `npm ci`, the
same-repository [HTTP fixture](api-fixture.md), explicit loopback inputs and
project-local Chromium. In the same shell, keep `PLAYWRIGHT_BROWSERS_PATH=0` before:

```sh
node node_modules/@playwright/test/cli.js install chromium
```

Use an owned clean source tree without runtime dotenv files. Stop manually
started website/API launchers; the lab requires the selected ports to be free
and starts its own fresh synthetic services. Do not point it at an existing API,
operator data or external application URL. No authentication secret or database
path is supplied: the HTTP fixture keeps its test-only state in memory.

## Inspect the required build budget

With the explicit development inputs set:

```sh
npm run build
```

The command builds production output and evaluates
[performance-budget.json](../performance-budget.json). Success prints
`Production build and bundle budgets passed.`. The
[bundle helper](../scripts/check-bundle-website.mjs) measures emitted browser
JS/CSS and each page's reachable client graph from supported Next manifests.
It treats manifests as data and rejects missing/unsafe/unsupported inputs.

A reachable graph includes shared runtime, polyfills and possible boundary chunks;
it is not initial network transfer or executed JavaScript. Gzip figures sum
individually compressed files rather than measuring a host's actual encoding.
Budget limits are regression ceilings. Do not change them merely to hide a
failure or treat synthetic helper tests as an actual build measurement.

## Collect twelve owned Lighthouse samples

The runner checks exact installed Lighthouse `13.6.0`, Playwright `1.64.1` and its
reviewed Chromium identity before execution. Set `PLAYWRIGHT_BROWSERS_PATH=0`
before invoking the runner so the SDK selects its project-local installation.
The parent validates and forces that exact executable; cached global or custom
browser selections are rejected before launch. It owns the build and local
API/website processes. For each sample, the parent runner owns the browser and
retains shutdown control while a worker runs Lighthouse through its CDP connection.
The parent stops and drains that browser after the sample, including failure or
cancellation; cleanup failures remain failures:

```sh
npm run perf:website
```

Expected success prints the exclusive `test-results/website-performance/lab-*` directory.
It contains twelve HTML/JSON sample pairs: `/` and `/login`, mobile and desktop,
three runs each; `summary.json` records individual results and median score,
FCP, LCP, CLS, TBT and Speed Index for each route/profile. `pending.json` records
the required sample count before work starts; it can remain with a successful
summary and is not itself a failure verdict. Only a successful completed run
supplies its final summary.

To reuse a compatible existing production build from this same tree:

```sh
npm run perf:website -- --skip-build
```

This retains fixture, browser, port, budget and ownership checks. Scores remain
advisory; malformed samples, missing metrics, external application requests,
process failures and cleanup failures fail execution. These simulated lab
results do not measure field INP, RUM or p75.

Press Ctrl+C to cancel and wait for owned children to drain. Cleanup stops only
the direct children created by the run and removes the API's owned temporary
state; generated lab artifacts remain for inspection, including partial evidence
when a run fails. Keep first failures and inspect cleanup errors. Remove only
an explicitly selected run directory you own when its results are no longer
needed; do not prune shared state or overwrite another run.

## Export an analyzer graph when needed

Use a fresh owned source/export directory with the same synthetic inputs. First
capture the named analysis, then export that saved graph:

```sh
node scripts/analyze-website-performance.mjs
node scripts/analyze-website-performance.mjs --export
```

The first command runs the selected installed Next analyzer in disk-output mode
and saves a snapshot named `website`, without starting an analyzer server or
producing an application build. Next can replace an existing analysis with that
name, which is why this procedure uses a fresh owned directory. The export needs
that saved snapshot; an ordinary production build alone does not supply it.

The second command exclusively creates `.lighthouseci/website/graph.jsonl`,
bounded to 64 MiB. An existing graph fails rather than being overwritten; use a
fresh owned source/export directory or review the exact old output before an
authorized cleanup. A graph is diagnostic build data, not a browser transfer or
field-performance measurement.

## Keep field delivery separate

[WebVitals](../src/shared/performance/WebVitals.tsx) supplies the framework hook
callback. Its [delivery helper](../src/shared/performance/web-vitals.ts) exposes
permitted numeric fields to explicit subscribers, with no default transport,
storage or replay; one consumer's failure cannot corrupt another delivery.
Do not sum successive metric values or substitute zero for a missing interaction.

[Scoped messages](../src/i18n/client-messages.ts) and [font integrity](fonts.md)
reduce/verify their own source resources. Their tests do not prove browser
transfer, shaping, computed CSS or page speed. Preserve actual session behavior
and visible content while investigating a budget or lab result. Do not delay
work beyond an audit window or refresh visual baselines to improve a score.
Record exact source/build, tool/browser versions, sample settings, failures and
owned cleanup in the task. See [browser quality](visual-regression.md) and
[testing](testing.md) for the separate evidence layers.
