# Trace document-related behavior

The [features phase](bootstrap.md) publishes client features, HTTP support and
document policy helpers. Follow the relevant owner and its local tests.

Use this map when a page's language, metadata, security header or client behavior
does not match its configuration. It connects framework composition to the
canonical subject guides without defining another HTTP or document policy.

## From request to page

1. The [request proxy](../src/proxy.ts) matches every path, removes caller
   nonce/CSP headers and protects potential HTML with a fresh nonce and policy.
   It also applies indexing headers.
   [Server boundaries](server-boundary.md) owns the transport and nonce contract;
   [CSP](website-csp.md) describes policy directives.
2. [Server settings](../src/shared/settings/server.ts) reads validated uncached
   API language/direction. React cache deduplicates only within one server render;
   each new request reads settings again. [Localization](localization.md) owns
   settings failures, catalogs and explicit client message scopes.
3. The [request message adapter](../src/i18n/request.ts) loads the selected local
   catalog. The [root layout](../src/app/layout.tsx) renders `lang`/`dir`, font
   preloads, the skip link, Header/main/Footer, providers and WebVitals.
   Auth/account boundaries select their own message subsets.
4. Page metadata and nonce-bearing escaped JSON-LD come from the
   [SEO owners](seo.md). The root defaults new routes to noindex; public pages
   choose their own canonical metadata.
5. Browser feature operations call the same-origin `/api` route through the
   shared client. The server forwards only permitted operations to the configured
   HTTP backend. [Server boundaries](server-boundary.md#browser-http-client) describes
   cookies/no-store, errors and cancellation; [session](session.md) describes
   refresh and stale-result ownership.

## Find the relevant owner

| Change or symptom                                          | Canonical guide                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Request payload, cookie, 401 or upstream failure           | [Server boundary](server-boundary.md), [forms](forms.md), [session](session.md) |
| Wrong language, direction or missing client message        | [Localization](localization.md)                                                 |
| Canonical, robots, sitemap, share image or structured data | [SEO](seo.md)                                                                   |
| Nonce, CSP header or script/style enforcement              | [Server boundary](server-boundary.md#document-security), [CSP](website-csp.md)  |
| Input, feedback, theme or reduced motion                   | [Client UI](client-ui.md), [accessibility](accessibility.md)                    |
| Font preload, shaping or asset bytes                       | [Fonts](fonts.md)                                                               |
| Bundle size or optional metrics delivery                   | [Website performance](website-performance.md)                                   |

## Verify the layer you changed

Use [testing](testing.md) to distinguish helper/unit checks, framework composition
tests, real browser journeys and manual visual review. The full application
profile requires production build/budget, both CSP modes and compatible visual
comparison against the [local synthetic HTTP fixture](api-fixture.md).
[Validation](validation.md) owns preparation and publication checks.

Trace the exact failing response rather than treating a passed helper test or a
source marker as an observed browser result. Deployment and trusted gateway
behavior have separate [operational acceptance](deployment.md).
