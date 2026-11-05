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

Local session and operation-scope tests cover account/locale/generation ownership,
cleanup and invalidation of stale reads, accepted mutations and mount captures.
HTTP tests cover public-auth and protected-mutation expiry notification behavior.
Feature form tests also cover retained input, form feedback, OTP destination
ownership and stale navigation with synthetic HTTP responses and controlled
navigation adapters. These client guards do not authorize an API write or undo
one already accepted by the API. Preserve exact password whitespace from form
values through the HTTP operations. Local tests do not establish live backend
authentication, browser navigation or deployed cookie behavior.
