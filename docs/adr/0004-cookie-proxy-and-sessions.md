# ADR 0004: Cookie sessions

[English](0004-cookie-proxy-and-sessions.md) · [فارسی](0004-cookie-proxy-and-sessions.fa.md)

Status: accepted; local forwarding, session and form ownership are published.

Use HttpOnly session cookies through the narrowly allowlisted same-origin
auth/account boundary. Forwarding support preserves native Set-Cookie headers
and API statuses/errors, rejects foreign mutation Origins, removes successful
authentication credential fields from JSON and marks responses private/no-store.
Website JavaScript does not store bearer credentials. The
[application contract](../application.md) requires real mounted-route and browser
cookie-isolation evidence; false-marker helper tests do not establish it.

The independent API owns password handling, authorization, persisted sessions
and revocation semantics after password change or recovery. Production OTP
delivery requires API/operator provision. This ownership decision does not prove
provider implementation, JWT rotation or reuse detection.

SessionProvider keys reads and accepted mutations to the loaded locale/generation.
Refresh invalidates the old snapshot immediately. Feature forms additionally reset
by locale/generation/account identity; mount-operation guards discard obsolete
feedback and navigation. Public authentication 401 responses preserve their own
form feedback; protected mutation 401 notifications still refresh the session.
These guards cannot undo a server write already completed.

Read [proxy support](../../src/shared/api/proxy.ts),
[proxy tests](../../src/shared/api/proxy.test.ts),
[session provider](../../src/features/auth/SessionProvider.tsx),
[session behavior](../session.md) and [forms](../forms.md).
Local synthetic tests do not establish cookie behavior in a live browser,
released API or every production domain/topology.
