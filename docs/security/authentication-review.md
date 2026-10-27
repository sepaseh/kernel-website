# Authentication boundary review

[English](authentication-review.md) · [فارسی](authentication-review.fa.md)

The **delivery-tooling** phase remains non-runnable. The
[API forwarding helper](../../src/shared/api/proxy.ts) and
[owner tests](../../src/shared/api/proxy.test.ts) use synthetic Web requests,
responses and streams. There is no mounted framework route, real API session or
browser cookie-isolation result in this snapshot. Read the complete
[server boundary](../server-boundary.md), [session](../session.md) and
[forms](../forms.md) contracts before changing authentication behavior.

Review the route/method allowlist, exact mutation Origin check, bounded JSON input,
timeout/cancellation, manual upstream redirects and generic failure responses.
Only the declared request/response headers cross the boundary. Personal responses,
including errors, remain private and no-store. Successful auth JSON removes known
bearer/refresh fields recursively; this is not a general detector for arbitrary
credentials. Forwarded Set-Cookie values are preserved, while authentication,
authorization, cookie attributes, password handling, OTP and session revocation
remain owned by the independent API. Opaque sessions alone do not establish refresh
rotation or reuse detection.

Local session/form tests cover account/locale/generation ownership, cleanup and
stale feedback/navigation. Public auth errors retain their form feedback;
protected mutation expiry notifications remain intact. These client guards do not
authorize an API write or undo one already accepted by the API. Preserve exact
password whitespace and OTP destination ownership.

Future acceptance must exercise the actual trusted Host/protocol and gateway
forwarding boundary, browser cookie attributes/isolation, the supported auth/account
journeys, errors and unavailable settings using an independently installed
synthetic API. Verify real CSP headers/cache behavior and credential-safe output;
the [pure CSP helper](../website-csp.md) does not wire them. Remote or production
access needs separate authorization. Record the exact source, API fixture,
platform, failures and limits through [testing](../testing.md), and follow
[private reporting](../../SECURITY.md).
