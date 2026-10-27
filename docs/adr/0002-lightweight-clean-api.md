# ADR 0002: HTTP boundary

[English](0002-lightweight-clean-api.md) · [فارسی](0002-lightweight-clean-api.fa.md)

Status: accepted; local HTTP and forwarding support is published.

The website consumes HTTP. It does not import backend SDKs, authentication setup,
persistence or storage implementation. Exclusive request DTOs live with their
feature, settings contracts beside their loader and reused wire concepts in
src/shared/contracts. Contract modules remain framework-free.

The browser client targets same-origin /api paths. Published proxy support owns
its route/method allowlist, mutation Origin checks, body limits, cookie forwarding,
credential stripping and private no-store responses. A future route must mount
that boundary; this phase does not publish the route or gateway. The API owns
input validation, authorization and atomic writes; forms and guards do not replace
those controls.

Read [proxy support](../../src/shared/api/proxy.ts),
[proxy tests](../../src/shared/api/proxy.test.ts),
[imports](../../.agents/rules/imports.md), [forms](../forms.md) and
[server boundary](../server-boundary.md). Coordinate incompatible path, DTO or
cookie changes before releasing a consumer. Synthetic local tests do not establish
an existing API deployment's behavior.
