# Client and document support

[English](client-document.md) · [فارسی](client-document.fa.md)

This guide owns the HTTP/document support contract in both prerequisite and application snapshots. The [publication marker](../.github/bootstrap-policy.json) and [phase guide](bootstrap.md) identify the delivered scope. With `applicationReady:false`, local [forms](forms.md), providers, authored browser suites and fixture guards do not establish mounted Next.js routes, a CSS pipeline or real browser execution. The [application contract](application.md) defines the additional composition and evidence required for activation.

## HTTP ownership

The shared HTTP client calls same-origin /api routes, forces credentials:include and cache:no-store, copies caller headers and carries the API-selected locale. The existing proxy strips visitor language preferences before reaching the independent API. Five feature API modules use that shared client and own twelve operations and snake_case payloads. Password whitespace and caller cancellation are preserved. No token or language is stored locally.

Successful empty responses return undefined; malformed successful JSON fails. Error envelopes retain localized text, string field errors and request IDs; malformed or non-object JSON uses a safe fallback. Fetch and response-stream failures, including cancellation after headers, keep their original identity. A completed protected mutation 401 dispatches one session-expired event. The anonymous /account/me read, public login/register/OTP/recovery operations and cancelled body do not; a public authentication error must preserve its own form feedback.

## Document data and translation

SEO reads an explicit WEBSITE_URL and exact boolean indexing flag from a supplied environment. Indexing requires production and a non-loopback HTTPS origin; it defaults off. Metadata uses validated page paths, self-canonical URLs and translated title/description. It does not emit HTML here. JSON-LD escapes every less-than character so a value cannot terminate a later script element.

All 107 messages in every registered catalog are parsed and interpolated by installed next-intl. Root/auth/account client selections contain only their explicit flat keys, retain required shared keys and reject missing/nested values. Feature form tests use a real next-intl provider with explicit auth/account message selections. Request-scoped Next.js and root-provider integration must preserve those selections and be verified in the application snapshot; the helper tests alone do not execute that integration. See [localization](localization.md).

Web Vitals forwards only approved standard numeric fields to explicitly subscribed consumers. It stores no reports and has no default transport. A consumer exception cannot stop another consumer; dispatch uses a snapshot so unsubscribe/re-subscribe cannot loop the current metric. This delivery helper's Web Vitals import and the Metadata import are erased types. The separate [WebVitals component](client-ui.md) registers the stable callback through Next's runtime hook; its mock-based owner test does not establish browser collection.

The class helper uses the installed clsx and tailwind-merge libraries. [Fonts](fonts.md) describe licensed source, real binary verification and language-specific preload selection.

## Evidence and remaining work

Node tests exercise real Requests/Responses/streams and installed library behavior using synthetic fetch data. They verify twelve wire operations, cache/cookie/signal policy, stream and envelope failures, all-language ICU, SEO rejection/escaping, metric privacy/delivery and font integrity. Boundary tests require exact package owner, identity and runtime/type-only permissions; pure contracts/catalog data remain isolated.

The [canonical full gate](../.agents/validation.json) includes actual Python font verification/coverage. Its false-marker prerequisite profile has eleven checks; application activation expands it to all fifteen checks. Preserve all reviewed proxy, CSP, settings and catalog behavior, 90% unit thresholds, 80% governance thresholds and the narrow ten-catalog duplication exception.

SSR metadata, nonce request integration, framework routes, styled pages, browser font shaping/loading, session journeys, accessibility and visual comparison belong to application acceptance. Local [UI](client-ui.md) and [session](session.md) tests cover their documented state/DOM boundaries. Verify all fifteen application checks and genuine build/e2e/visual jobs against the [pinned independent synthetic API](api-fixture.md), then make those jobs required before a runnable merge. Preserve exact source/build evidence; support-phase results do not validate a different application tree or a deployment.
