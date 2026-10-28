# Server boundary helpers

[English](server-boundary.md) · [فارسی](server-boundary.fa.md)

The forwarding and CSP owners below remain framework-independent helpers. The application mounts forwarding through [the App Router API boundary](../src/app/api) and document CSP through [the request proxy](../src/proxy.ts) and [server-only nonce adapter](../src/shared/security/nonce.ts). Read the [source marker](../.github/bootstrap-policy.json) and [application acceptance](application.md) for the current 90-module, `applicationReady:true` closure. Synthetic helper/adapter tests and actual framework/browser execution establish different evidence.

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

Run the complete fifteen-check `npm run validate -- full` profile on the exact isolated application snapshot before commit, push or PR handoff. It retains measured unit/governance coverage, strict inventory and closed imports and adds actual build/browser/CSP/visual execution with the independent synthetic API. Helper unit tests mock fetch and use synthetic Web streams; no existing service or private dotenv is a fixture.

The current composition includes Next.js routes, the server-only nonce adapter, request-header replacement, translation rendering, UI and framework metadata together with adapter tests and browser fixtures. The complete fifteen-check application gate is mandatory. Before runnable merge observe real build/e2e/visual jobs pass and make their contexts required. Helper tests or a historical false-marker gate cannot establish those results. The [branch policy](branch-protection.md) and [CodeRabbit preflight](sonarqube.md#before-requesting-coderabbit) remain mandatory.
