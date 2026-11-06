# Authentication boundary review

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

The [publication marker](../.github/bootstrap-policy.json) distinguishes
false-marker helper evidence from runnable application acceptance. The
[API forwarding helper](../src/shared/api/proxy.ts) and
[owner tests](../src/shared/api/proxy.test.ts) use synthetic Web requests,
responses and streams. They do not establish a mounted route, real API session
or browser cookie isolation. The [application contract](application.md)
requires separate exact-tree execution. Read the complete
[server boundary](server-boundary.md), [session](session.md) and
[forms](forms.md) contracts before changing authentication behavior.

Review the route/method allowlist, exact mutation Origin check, bounded JSON input,
timeout/cancellation, manual upstream redirects and generic failure responses.
Only the declared request/response headers cross the boundary. Personal responses,
including errors, remain private and no-store. Successful auth JSON removes known
bearer/refresh fields recursively; this is not a general detector for arbitrary
credentials. Forwarded Set-Cookie values are preserved, while authentication,
authorization, cookie attributes, password handling, OTP and session revocation
remain owned by the configured HTTP backend. Opaque sessions alone do not establish refresh
rotation or reuse detection.

Local session and operation-scope tests cover account/locale/generation ownership,
cleanup and invalidation of stale reads, accepted mutations and mount captures.
HTTP tests cover public-auth and protected-mutation expiry notification behavior.
Feature form tests also cover retained input, form feedback, OTP destination
ownership and stale navigation with synthetic HTTP responses and controlled
navigation adapters. These client guards do not authorize an API write or undo
one already accepted by the API. Preserve exact password whitespace from form
values through the HTTP operations. Local tests do not establish live backend
authentication, browser navigation or deployed cookie behavior.

Local application acceptance exercises auth/account journeys, errors, unavailable
settings, browser cookie isolation, actual CSP headers, cache behavior and
credential-safe output against this repository's
[synthetic HTTP fixture](api-fixture.md). The [pure CSP helper](website-csp.md)
does not wire those responses. Disposable Docker smoke can additionally exercise
its owned gateway with the fixture; neither result establishes an external
backend's authentication or persistence.

Deployment acceptance separately verifies the selected authorized target and HTTP
backend, including trusted Host/protocol and gateway forwarding, browser cookie
attributes/isolation, CSP/cache behavior and supported auth/account flows. Remote
or production access needs separate authorization. Record the exact source,
fixture or target, platform, failures and limits through [testing](testing.md),
and follow [private reporting](../SECURITY.md).
