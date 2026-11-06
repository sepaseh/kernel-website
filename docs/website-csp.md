# Verify the document CSP policy

The [application phase](bootstrap.md) includes pure policy helpers and a request
proxy that generates trusted nonces and applies enforcing or report-only headers.

## Pure policy contract

`readWebsiteCspMode` accepts `report-only` and `enforce` and defaults an absent
value to `report-only`. `createWebsiteCsp` accepts a 24-character nonce using
letters, digits, `+` and `/`. `isCspDocumentPath` classifies paths that can return
HTML before filesystem routing. Only `/api/` with nonempty route segments and
the actual `/icon.svg`, `/robots.txt`, `/sitemap.xml` and `/social-image` handlers
opt out. Missing font, framework-asset, favicon and image-looking routes can
render HTML and receive policy protection. [Policy tests](../src/shared/security/csp.test.ts).

The policy includes the nonce, `'self'` and `'strict-dynamic'` in `script-src`
and disallows script attributes. It allows styles from the same origin or with
the nonce, and preserves inline style attributes for React and Motion. The
development option adds `'unsafe-eval'` and WebSocket connections.
[Policy owner](../src/shared/security/csp.ts).

## Request and resource boundaries

The [proxy](../src/proxy.ts) matches every path and removes caller nonce and CSP
headers before forwarding. Potential HTML gets one fresh nonce in the internal
request policy, response policy and framework scripts. Syntax validation in
the [server reader](../src/shared/security/nonce.ts) alone is not proof of trust;
the request proxy establishes that boundary. Known non-HTML handlers receive no
forwarded nonce or policy.

Normal documents use private, no-store caching. Font and framework-resource
paths also receive CSP because a missing resource can return an HTML document,
but the proxy preserves framework-owned status, body and caching for actual
resources. Their missing-resource HTML uses the framework's private, no-store
response. Thus real JavaScript, font and text resources can carry a policy
header without losing their existing public cache behavior. This describes the
current application's verified resources, not general worker-script compatibility.

## Verify the application integration

Verify that the request adapter generates an unpredictable
nonce per document, rejects caller spoofing and gives the same trusted value to
the framework, theme and JSON-LD output. Inspect the initial HTML and hydrated
behavior. Check private nonce-bearing HTML stays out of shared caches and that
headers follow actual document, API, static asset and metadata boundaries.
Include missing resource-looking paths with forged nonce and CSP headers and
non-HTML Accept values; request headers do not establish the response's MIME type.

Use the same verified production build for separate enforcing and report-only
browser runs. Verify that enforced violations are blocked and report-only
violations are observed. Exercise script and style violations in actual
responses alongside known allowed cases. Record the headers, nonce uniqueness,
spoof rejection, theme and motion behavior, cache behavior and failures.

Gateway and TLS wiring, remote origins and collectors require separate
authorization and validation. Record unit results, browser behavior and
deployed security evidence separately. [Testing](testing.md) and
[validation](validation.md).
