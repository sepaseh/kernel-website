# Server boundary helpers

[English](server-boundary.md) · [فارسی](server-boundary.fa.md)

This phase publishes framework-independent API forwarding and document CSP policy
helpers with synthetic Node tests. The wider [client-document phase](client-document.md) contains thirty-seven production modules and fifteen source test files; these HTTP/CSP helpers remain framework independent. `applicationReady:false` remains
mandatory. No Next.js route, request nonce generator, renderer or browser behavior
is provided or verified by these helpers.

## API forwarding

`src/shared/api/proxy.ts` accepts a Web `Request` and explicit route segments. Only
the website's listed auth/account routes and their methods can reach the separate
API. Mutations require an exact Origin matching the request protocol and browser
Host; forwarded-host headers do not authorize requests. The eventual deployment
must preserve the trusted target Host/protocol at this boundary and reject
unrecognized public hosts. API-origin validation remains local to `origin.ts`.

Requests forward only Cookie, Content-Type, Origin and X-Request-Id, with JSON
Accept, uncached fetch, manual redirects, caller cancellation and a fifteen-second
upstream timeout. Browser Authorization and language preferences are not forwarded;
the API owns persisted active language and direction. Mutations accept the
application/json media type with optional parameters. Their streamed bodies are
limited to 32 KiB; oversized streams are cancelled and every acquired reader is
released. Stream read/cancellation failures, transport failures and malformed auth
JSON return a generic 503 without private diagnostics.

All responses, including local rejections and upstream errors, use private,
no-store caching. Only Content-Type, X-Request-Id, Retry-After and all Set-Cookie
headers cross back to the browser. Redirect targets and arbitrary upstream headers
are not forwarded. Successful auth JSON removes known bearer/refresh credential
fields recursively through objects and arrays; HttpOnly cookies remain intact.
Bodyless 204/205 responses preserve their status and cookies. The API still owns
authentication, authorization, cookie attributes, business validation and storage.

## CSP policy

`src/shared/security/csp.ts` validates the report-only/enforce rollout setting,
checks the exact nonce alphabet/length, builds a restrictive document policy and
distinguishes document paths from API/static metadata assets. Production scripts
and style elements use the supplied nonce; existing SSR style attributes are
allowed deliberately. Development mode alone permits unsafe-eval and WebSockets.
These are pure helpers: they do not generate randomness, trust a browser nonce,
attach headers or establish that a browser enforces CSP.

## Validation and remaining publication

Run the entire ten-check `npm run validate -- full` gate on this exact isolated
snapshot before commit, push or PR handoff. It includes measured unit/governance
coverage, strict inventory and closed imports, without contacting an existing API or loading dotenv.
Tests mock fetch and use synthetic Web streams; they never contact an existing API.

Later focused PRs must publish Next.js routes, the server-only nonce adapter and
request-header replacement, translation rendering, actual UI, framework metadata integration and browser
fixtures. Before any runnable-app merge, introduce the complete fifteen-check
application gate, observe real build/e2e/visual jobs pass and make their contexts
required. This phase's pass cannot establish those results. The [branch policy](branch-protection.md)
and [CodeRabbit preflight](sonarqube.md#before-requesting-coderabbit) remain mandatory.
