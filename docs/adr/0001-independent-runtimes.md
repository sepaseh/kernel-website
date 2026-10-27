# ADR 0001: Website runtime

[English](0001-independent-runtimes.md) · [فارسی](0001-independent-runtimes.fa.md)

Status: accepted architecture; runtime integration remains deferred.

Use one independently installable root package with source in src/, assets in
public/ and its own manifest/lockfile. The intended runtime is Next App Router.
The independent API is consumed through HTTP and owns authentication, credentials,
database migrations, persistence and storage.

The current guidance phase publishes local support and feature modules, not pages,
a root layout, request adapters, global CSS or deployment. Later runtime integration
must render public content and API-owned language/direction in Server Components,
keep browser interaction in narrow client boundaries and prevent shared caching
of private responses/settings. A standalone production package and explicit
server API origin remain delivery requirements, not evidence of an existing build.

Read [architecture](../architecture.md), [phase guide](../bootstrap.md),
[project package](../../package.json) and the [canonical checks](../../.agents/validation.json).
Local types or support tests alone do not prove released API compatibility,
SSR, browser behavior or deployment.
