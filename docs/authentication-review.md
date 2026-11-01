# Authentication boundary review

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

Review the route/method allowlist, exact mutation Origin check, bounded JSON input,
timeout/cancellation, manual upstream redirects and generic failure responses.
Only the declared request/response headers cross the boundary. Personal responses,
including errors, remain private and no-store. Successful auth JSON removes known
bearer/refresh fields recursively; this is not a general detector for arbitrary
credentials. Forwarded Set-Cookie values are preserved, while authentication,
authorization, cookie attributes, password handling, OTP and session revocation
remain owned by the configured HTTP backend. Opaque sessions alone do not establish refresh
rotation or reuse detection.

Local session/form tests cover account/locale/generation ownership, cleanup and
stale feedback/navigation. Public auth errors retain their form feedback;
protected mutation expiry notifications remain intact. These client guards do not
authorize an API write or undo one already accepted by the API. Preserve exact
password whitespace and OTP destination ownership.
