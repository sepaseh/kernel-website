# Performance helpers and measurement boundaries

[English](website-performance.md) · [فارسی](website-performance.fa.md)

Bundle/environment helpers, guarded process/analyzer runners, authored browser cases and the optional [Lighthouse runner](../scripts/run-website-performance.mjs) are maintained source. The current operations phase retains runnable application composition and separates required build/budget/browser acceptance from optional lab measurement. A false readiness marker still refuses operations before configuration, dependency or process access. Source availability establishes no lab score or field dataset, and no default external metrics transport exists.

## Published tooling

[check-bundle-website](../scripts/check-bundle-website.mjs) parses supported Next
client manifests as JSON data, not executable generated code. Given an explicit
build directory, it measures emitted browser JS/CSS and each page's reachable
client graph, deduplicating shared assets within a route. Unsupported data,
unsafe paths, missing assets and invalid measurements must fail explicitly.
[Owner tests](../scripts/website-performance.test.mjs) use synthetic build files
and budget boundaries, not a real Next build.

A reachable client graph includes shared runtime, polyfills and possible boundary
chunks. It is not initial network transfer, executed JavaScript or field usage.
Gzip numbers sum individually compressed files; they do not establish a host's
actual encoding. [performance-budget.json](../performance-budget.json) owns
limits: regression ceilings, not measured service objectives. Review compatible
real evidence before changing a limit.

[Environment construction](../scripts/website-performance-environment.mjs) requires
an isolated IPv4 loopback API origin with an explicit nonzero port and constructs an allowlisted
synthetic child environment. The clean-website preflight checks relevant dotenv
existence without loading, moving or overwriting values. These helpers do not
start processes or prove an API is installed. [API location](../scripts/api-repository.mjs)
requires KERNEL_SYNTHETIC_ENV=1 and an absolute explicit KERNEL_API_DIRECTORY;
the [fixture adapter](api-fixture.md) additionally verifies the immutable public
revision, clean source and independently installed dependency identity. Those
checks remain separate from actual API/browser execution.

## Optional owned Lighthouse lab

`npm run perf:website` uses exact Lighthouse 13.6.0 from the manifest, lock and installed package together with the reviewed root-owned Playwright 1.64.1 bundled Chromium. It requires the explicit pinned independently installed API fixture, fresh synthetic state and generated test-only authentication secret. Imports remain inert and readiness is checked before dependency/configuration/process work. `npm run perf:website -- --skip-build` may reuse an already prepared compatible build; it bypasses none of those guards.

One run owns an exclusive `.lighthouseci/website/lab-*` directory and performs twelve samples: `/` and `/login`, mobile and desktop profiles, three runs each. It retains individual HTML/JSON reports and median metric summaries, bounds child/report output and preserves partial evidence on failure. Only owned API/server/browser children are stopped; cleanup errors remain failures. Scores are advisory, while invalid samples, forbidden external application requests, missing metrics and ownership/cleanup failures fail execution. Simulated lab measurements establish neither field INP, RUM, p75, deployment nor a completed current lab run.

## Retained source support

[WebVitals](../src/shared/performance/WebVitals.tsx) supplies a stable callback to
the framework hook; its owner test mocks that boundary. The
[delivery helper](../src/shared/performance/web-vitals.ts) provides only permitted
standard numeric fields to explicitly subscribed consumers, without default
transport, storage or replay. Consumer failure cannot corrupt another delivery.
The callback and its mocked owner test alone establish neither root-layout
mounting nor an enabled RUM service, field INP or p75 dataset.
Do not sum successive metric values or treat a missing interaction metric as zero.

[Client message selection](../src/i18n/client-messages.ts) retains explicit scoped
keys. [Font integrity](fonts.md) verifies real source/subset binaries, license,
hashes and metadata, preserving the language preload policy. These helpers do not
prove browser transfer, shaping, computed CSS or page rendering performance.

## Application and measurement evidence

Require the real application inventory and independently installed
[pinned synthetic API](api-fixture.md) before build/bundle, browser, font-shaping,
Lighthouse or analyzer execution. Availability of source alone does not prove a completed operation. Use
owned temporary state, allowlisted environments and loopback-only targets;
sequence shared build outputs and clean only owned resources. Record exact
source/build, tool/browser versions, settings, all samples, failures and cleanup.

Keep lab observations separate from field metrics, and advisory scores separate
from mandatory correctness/budget failures. Do not hide content, delay work past
an audit window, remove real session behavior or refresh baselines to improve a
score. An analyzer graph is not itself a transfer/performance measurement.
Use [testing](testing.md), [visual regression](visual-regression.md) and
[canonical validation](validation.md). This guide records no current browser or
performance pass.
