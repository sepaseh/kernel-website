# Website trust boundaries and residual risks

[English](threat-model.md) · [فارسی](threat-model.fa.md)

The intended runtime boundary is browser → trusted TLS gateway → website request
adapter → explicit independent API. In this **delivery-tooling** phase the gateway
is a passive template and the framework request adapter is absent;
`applicationReady:false` remains mandatory. The local source supplies tested
HTTP/session/CSP support, not an end-to-end deployed security boundary.

The [proxy contract](../server-boundary.md) limits routes/methods, mutation origins,
headers and JSON bodies, forwards API-owned cookies, removes known auth token
fields and returns private no-store responses. The eventual adapter and edge must
preserve trusted Host/protocol and reject spoofed forwarding headers. The
[session/forms](../session.md) guard local stale results; the independent API must
establish authentication, authorization, persistence, OTP and revocation through
its own contract and evidence. No API implementation is certified here.

The [CSP helper](../website-csp.md) validates a supplied nonce and policy settings.
Fresh cryptographic generation, forged-header removal, response-header selection,
HTML integration and cache exclusion remain future runtime work. Report-only does
not block violations. SEO/noindex is not authorization, and font file integrity
does not prove browser rendering or network delivery.

Delivery helpers constrain paths, file classes, public template fields and
immutable release ownership. Their CLI readiness guard rejects this non-runnable
snapshot before operations. Tests use owned synthetic build trees, public
configuration and loopback resources. Templates and matching metadata do not prove
working TLS, correct secrets handling, installed dependencies, artifact provenance
or a real target's identity. Filename filters do not detect all sensitive content;
lexical hostname checks do not defend against aliases, DNS changes or redirects.

Residual risks include dependency vulnerabilities, browser/platform differences,
missing runtime wiring and unverified operator/API behavior. A future runnable
change needs actual application gates, synthetic API/browser evidence, edge/TLS
and rollback checks, and private review of sensitive findings. There is no default
RUM/CSP collector or scan schedule added here. Follow
[authentication review](authentication-review.md), [review policy](reviews.md) and
[deployment acceptance](../deployment.md).
