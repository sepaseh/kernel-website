# Verify the document CSP policy

The [features phase](bootstrap.md) publishes CSP helpers that parse a mode,
classify paths, validate a nonce and construct a policy string. An application
request adapter must generate the nonce and apply the response header.

## Pure policy contract

`readWebsiteCspMode` accepts `report-only` and `enforce` and defaults an absent
value to `report-only`. `createWebsiteCsp` accepts a 24-character nonce using
letters, digits, `+` and `/`. `isCspDocumentPath` distinguishes document paths
from API, static asset, font and metadata paths. Check these inputs and the
resulting directives in the focused tests. [Policy tests](../src/shared/security/csp.test.ts).

The policy includes the nonce, `'self'` and `'strict-dynamic'` in `script-src`
and disallows script attributes. It allows styles from the same origin or with
the nonce, and preserves inline style attributes for React and Motion. The
development option adds `'unsafe-eval'` and WebSocket connections.
[Policy owner](../src/shared/security/csp.ts).

## Verify a later application integration

Once the request adapter is published, verify that it generates an unpredictable
nonce per document, rejects caller spoofing and gives the same trusted value to
the framework, theme and JSON-LD output. Inspect the initial HTML and hydrated
behavior. Check private nonce-bearing HTML stays out of shared caches and that
headers follow actual document, API, static asset and metadata boundaries.

Use the same verified production build for separate enforcing and report-only
browser runs. Verify that enforced violations are blocked and report-only
violations are observed. Exercise script and style violations in actual
responses alongside known allowed cases. Record the headers, nonce uniqueness,
spoof rejection, theme and motion behavior, cache behavior and failures.

Gateway and TLS wiring, remote origins and collectors require separate
authorization and validation. Record unit results, browser behavior and
deployed security evidence separately. [Testing](testing.md) and
[validation](validation.md).
