# Performance helpers and measurement boundaries

[English](website-performance.md) · [فارسی](website-performance.fa.md)

Bundle/environment helpers, readiness-first process/analyzer runners and
authored browser cases are maintained source. The [publication marker](../.github/bootstrap-policy.json)
identifies whether the exact inventory contains application composition. With
`applicationReady:false`, those tools do not establish a production build, browser
measurement, Lighthouse run or field dataset. [Application acceptance](application.md)
requires real build/budget/browser evidence; optional lab and field analysis
retain their own evidence and authorization. No default external metrics transport exists.

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
Lighthouse or analyzer execution. Availability of one runner does not activate
an unpublished operation. Use
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
