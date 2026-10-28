# ADR 0001: Website runtime

[English](0001-independent-runtimes.md) · [فارسی](0001-independent-runtimes.fa.md)

Status: accepted architecture; delivery status follows the publication marker.

Use one independently installable root package with source in src/, assets in
public/ and its own manifest/lockfile. The intended runtime is Next App Router.
The independent API is consumed through HTTP and owns authentication, credentials,
database migrations, persistence and storage.

False-marker prerequisites publish local support, forms and guarded test tooling
without establishing runnable pages, a root layout, request adapters or CSS.
Application integration must render public content and API-owned language/direction in Server Components,
keep browser interaction in narrow client boundaries and prevent shared caching
of private responses/settings. A standalone production package and explicit
server API origin remain delivery requirements. The [application contract](../application.md)
defines exact-tree acceptance; an accepted decision is not an executed build.

Read [architecture](../architecture.md), [phase guide](../bootstrap.md),
[project package](../../package.json) and the [canonical checks](../../.agents/validation.json).
Local types or support tests alone do not prove released API compatibility,
SSR, browser behavior or deployment.
