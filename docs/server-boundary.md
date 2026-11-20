# Browser and server HTTP boundaries

The browser calls the website's same-origin `/api` route. The website forwards
its listed auth, account and anonymous contact operations to the configured HTTP backend, which owns
authentication, authorization, settings, business validation, persistence and
storage. This guide defines the transport and document-security boundaries.

## Browser HTTP client

[`apiRequest`](../src/shared/api/client.ts) constructs `/api` URLs, copies caller
headers, sets `Accept-Language` to the selected locale and uses
`cache: "no-store"`. Auth and account requests include credentials. Anonymous
contact requests omit credentials and strip any caller-supplied Cookie or
Authorization header. Feature APIs own snake_case payloads and exact password
values.

An empty successful response returns `undefined`; malformed successful JSON
fails. Error envelopes retain localized text, string field errors and request
IDs and Retry-After, with a safe fallback for malformed/non-object JSON. Fetch and body-stream
failures, including cancellation after headers, preserve their original identity.

After reading a protected mutation's 401 error body, the client emits one
`kernel:session-expired` event. The anonymous `/account/me` read and public
login/register/OTP/recovery and contact errors are exempt. An aborted body emits no expiry
event. [Session](session.md) owns the resulting refresh and generation changes.
[Forms](forms.md) owns visible error/input state.

## API forwarding

The App Router route awaits its route parameters and calls
[`forwardApiRequest`](../src/shared/api/proxy.ts) with a Web Request and explicit
segments. The forwarding map permits only declared paths and methods. An unknown
path returns 404; a disallowed method returns 405 with Allow. Exporting a route
handler does not widen that allowlist.

Mutations require an exact Origin matching the request protocol and browser Host;
forwarded-host headers do not authorize a request. [API-origin validation](../src/shared/api/origin.ts)
owns the upstream origin. An installed gateway must preserve the trusted target
Host/protocol and reject unrecognized public hosts; verify that boundary during
[deployment](deployment.md).

The proxy forwards Content-Type, Origin and X-Request-Id with a JSON Accept
header. Auth and account requests can also forward Cookie. Contact requires a
valid UUID in Idempotency-Key and forwards that header without cookies. Upstream
requests use no-store, manual redirects, caller cancellation and a fifteen-second
timeout. The proxy omits Authorization and Accept-Language.

Mutations accept application/json with optional media-type parameters. Streamed
bodies are bounded to 32 KiB. Oversized streams are cancelled and acquired readers
are released. Mutation-body stream failures, transport failures and malformed
successful auth JSON return a generic 503 without private diagnostics.

Every response, including local rejection and upstream failure, has private,
no-store caching. Content-Type, X-Request-Id and Retry-After can cross back.
Set-Cookie is preserved for auth and account and omitted for contact.
Successful auth JSON recursively removes `token`,
`access_token`, `accessToken`, `refresh_token` and `refreshToken` from objects and
arrays; this is not a general secret-content detector. Cookies remain intact. Bodyless 204/205
responses preserve status and cookies. Cookie attributes and session revocation
remain API-owned.

## Published content and preview boundary

The [blog reader](../src/features/blog/api.ts) and
[FAQ reader](../src/features/faq/api.ts) fetch public projections on the server.
They omit visitor credentials, reject redirects, bound response size and validate
the API data.
Only a short-lived, post-scoped preview capability enters its Authorization
header. The exchange replaces the initial capability URL with a scoped HttpOnly
cookie and clean preview URL; the API reauthorizes every read. [Blog](blog.md).

The same-origin `/media/:id` adapter accepts only public API JPEG/PNG bytes and
never follows an arbitrary HTML image source. The sanitizer rewrites validated
file IDs to that route, preserving CSP and image crawlability outside `/api/`.

## Document security

[`src/proxy.ts`](../src/proxy.ts) matches every path and strips caller nonce/CSP
request headers. Paths that can return HTML receive a fresh nonce from 18 random
bytes and Next's internal CSP header; the response selects enforcing or report-only
CSP. Normal documents use private/no-store caching, while font and framework-resource
paths preserve framework-owned resource caching and protect their private/no-store
HTML fallbacks. Only nonempty `/api/` routes and the actual icon, robots, sitemap
and social-image handlers opt out of CSP. The [server-only nonce reader](../src/shared/security/nonce.ts)
awaits framework headers and checks nonce syntax; the proxy establishes its trust.

[The root layout](../src/app/layout.tsx) passes that nonce into the theme
provider; [the home page](../src/app/page.tsx) uses it on escaped JSON-LD.
The [pure CSP helpers](../src/shared/security/csp.ts) validate the mode/nonce,
build directives and identify paths that can return HTML before filesystem routing.
They do not generate randomness or attach responses themselves.
[CSP](website-csp.md) explains production script/style rules, deliberate SSR
style-attribute allowance and development-only eval/WebSocket allowances.

The request proxy also applies indexing headers to utility/API paths and to
non-indexable configurations. That policy is independent of document CSP;
[SEO](seo.md) owns public origins, robots and metadata.

The [standalone root error document](../src/app/global-error.tsx) can render
before settings or the translation provider are available. It loads only the
English and Persian JSON catalogs directly to provide an explicit bilingual
fallback without guessing the active application language. The import guard
permits those two exact runtime edges for this owner only; other components
retain the lazy catalog registry and normal language selection.

## Verify a boundary change

Read the focused [client tests](../src/shared/api/client.test.ts),
[forwarding tests](../src/shared/api/proxy.test.ts),
[request-proxy tests](../src/proxy.test.ts) and
[framework adapter tests](../src/shared/runtime-adapters.test.ts). They use
synthetic fetch/Requests/Responses/streams and explicit framework mocks.

Then verify the actual production build and browser flows against the
[local synthetic HTTP fixture](api-fixture.md): cookies, origin rejection,
settings, private cache behavior, nonce spoofing/uniqueness and both CSP modes.
[Validation](validation.md) owns complete exact-tree publication checks. A helper
or adapter pass does not establish a browser run or trusted deployed gateway;
[branch protection](branch-protection.md) and operational acceptance remain
separate.
