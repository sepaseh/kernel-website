# Website trust boundaries and residual risks

[English](threat-model.md) · [فارسی](threat-model.fa.md)

The intended runtime boundary is browser → trusted TLS gateway → website request
adapter → explicit independent API. The [publication marker](../../.github/bootstrap-policy.json)
and exact inventory identify delivered owners. With a false marker, local
HTTP/session/CSP support, authored browser cases and passive gateway templates do
not establish a running end-to-end boundary. [Application acceptance](../application.md)
requires exact-tree execution; a later deployment additionally requires its own
trusted edge and operator evidence.

The [proxy contract](../server-boundary.md) limits routes/methods, mutation origins,
headers and JSON bodies, forwards API-owned cookies, removes known auth token
fields and returns private no-store responses. The application adapter and edge must
preserve trusted Host/protocol and reject spoofed forwarding headers. The
[session/forms](../session.md) guard local stale results; the independent API must
establish authentication, authorization, persistence, OTP and revocation through
its own contract and evidence. No API implementation is certified here.

The [CSP helper](../website-csp.md) validates a supplied nonce and policy settings.
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
[deployment acceptance](../deployment.md).
