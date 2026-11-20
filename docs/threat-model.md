# Website trust boundaries and residual risks

Requests travel from the browser through a trusted TLS gateway to the website
request adapter and the configured HTTP backend. Verify the website path with
the [application acceptance checks](application.md) and the installed edge with
the [deployment checks](deployment.md).

## Credentials and untrusted content

The [proxy contract](server-boundary.md) limits routes/methods, mutation origins,
headers and JSON bodies, forwards API-owned cookies, removes known auth token
fields and returns private no-store responses. The application adapter and edge must
preserve trusted Host/protocol and reject spoofed forwarding headers. The
[session/forms](session.md) guard local stale results; the configured HTTP backend must
establish authentication, authorization, persistence, OTP and revocation.

Contact requests use a separate anonymous path. The proxy forwards an
idempotency key without visitor credentials and strips upstream Set-Cookie.
The API owns quotas and duplicate protection. [Contact transport](contact.md)

Public article HTML goes through an allowlist, and article images resolve through
the same-origin media adapter. Private preview passes a post-scoped capability
to the configured API for authorization on each read. [Blog rendering and preview](blog.md)

## Response and delivery controls

The [CSP helper](website-csp.md) validates a supplied nonce and policy settings.
Fresh cryptographic generation, forged-header removal, response-header selection,
HTML integration and cache exclusion belong to the application request pipeline
and need real response/browser evidence. Report-only does
not block violations. SEO/noindex is not authorization, and font file integrity
does not prove browser rendering or network delivery.

Delivery helpers constrain paths, file classes, public template fields and
immutable release ownership. Their CLI readiness guard rejects false-marker
snapshots before operations. Tests use owned synthetic build trees, public
configuration and loopback resources. Templates and matching metadata do not prove
working TLS, correct secrets handling, installed dependencies, artifact provenance
or a real target's identity. Filename filters do not detect all sensitive content;
lexical hostname checks do not defend against aliases, DNS changes or redirects.

Residual risks include dependency vulnerabilities, browser/platform differences,
unverified runtime wiring and operator/API behavior. Each runnable change needs
actual application gates and synthetic API/browser evidence. Deployment also needs edge/TLS
and rollback checks, and private review of sensitive findings. There is no default
RUM/CSP collector or scan schedule added here. Follow
[authentication review](authentication-review.md), [review policy](reviews.md) and
[deployment acceptance](deployment.md).
