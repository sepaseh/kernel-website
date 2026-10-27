# Client and document support

[English](client-document.md) · [فارسی](client-document.fa.md)

This phase prepares independently testable support for the future website. It publishes no application entry point, Next.js routes/server adapters, UI or browser fixture. applicationReady remains false.

## HTTP ownership

The shared HTTP client calls same-origin /api routes, forces credentials:include and cache:no-store, copies caller headers and carries the API-selected locale. The existing proxy strips visitor language preferences before reaching the independent API. Five feature API modules use that shared client and own twelve operations and snake_case payloads. Password whitespace and caller cancellation are preserved. No token or language is stored locally.

Successful empty responses return undefined; malformed successful JSON fails. Error envelopes retain localized text, string field errors and request IDs; malformed or non-object JSON uses a safe fallback. Fetch and response-stream failures, including cancellation after headers, keep their original identity. A completed protected 401 dispatches one session-expired event; the anonymous /account/me read and cancelled body do not.

## Document data and translation

SEO reads an explicit WEBSITE_URL and exact boolean indexing flag from a supplied environment. Indexing requires production and a non-loopback HTTPS origin; it defaults off. Metadata uses validated page paths, self-canonical URLs and translated title/description. It does not emit HTML here. JSON-LD escapes every less-than character so a value cannot terminate a later script element.

All 107 messages in every registered catalog are parsed and interpolated by installed next-intl. Root/auth/account client selections contain only their explicit flat keys, retain required shared keys and reject missing/nested values. No Next.js request adapter or provider is included; see [localization](localization.md).

Web Vitals forwards only approved standard numeric fields to explicitly subscribed consumers. It stores no reports and has no default transport. A consumer exception cannot stop another consumer; dispatch uses a snapshot so unsubscribe/re-subscribe cannot loop the current metric. Next's Web Vitals and Metadata imports are erased types. React/React DOM satisfy the installed framework/ICU peer closure; no React component is published.

The class helper uses the installed clsx and tailwind-merge libraries. [Fonts](fonts.md) describe licensed source, real binary verification and language-specific preload selection.

## Evidence and remaining work

Node tests exercise real Requests/Responses/streams and installed library behavior using synthetic fetch data. They verify twelve wire operations, cache/cookie/signal policy, stream and envelope failures, all-language ICU, SEO rejection/escaping, metric privacy/delivery and font integrity. Boundary tests require exact package owner, identity and runtime/type-only permissions; pure contracts/catalog data remain isolated.

The ten-check [full gate](../.agents/validation.json) includes actual Python font verification/coverage. Preserve all reviewed proxy, CSP, settings and catalog behavior, 90% unit thresholds, 80% governance thresholds and the narrow ten-catalog duplication exception.

SSR metadata, nonce request integration, framework routes, components, browser font shaping/loading, session journeys, accessibility and visual baselines remain future owners' responsibilities. Before runnable publication add all fifteen application checks and real required build/e2e/visual jobs against an independent synthetic API fixture. None of this support-phase evidence establishes browser or deployment behavior.
