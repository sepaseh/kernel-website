# Client session, operation and cooldown ownership

[English](session.md) · [فارسی](session.fa.md)

[SessionProvider](../src/features/auth/SessionProvider.tsx) consumes the locale
already supplied by next-intl and reads /account/me through the reviewed HTTP
client. It does not own cookies, token refresh, authorization or language
selection. The independent API remains authoritative.

A snapshot belongs to one locale/refresh key. A changed key hides the old account
while a new read loads. Effect cleanup aborts the originating read; late success
or failure cannot install old data even when a synthetic transport ignores its
signal. A 401 account read represents an anonymous session without a visible
error. Other failures are exposed and refresh permits an explicit retry.

The readonly generation exposes the existing request version for form ownership.
It increments at the start of a refresh or locale transition, including a return
to a previously used locale. Accepting an account mutation does not increment it.
It is local request ownership, not an API session token or authorization value.

The kernel:session-expired listener starts a fresh read and is removed on unmount.
Accepted mutation data can replace only its own loaded snapshot; a callback
captured before a newer session cannot overwrite that session. Consumers outside
the provider fail explicitly. Cookie isolation and full login/logout browser
journeys require the later runnable application and API fixture.

## Form operation ownership

[Authentication and account forms](forms.md) key their local owner by locale,
session generation and account identity. Changing an owner remounts its form,
resets dirty local input and invalidates pending local feedback/navigation before
a new account read completes. Public login/register/OTP/recovery 401 responses do
not emit session-expired; protected mutation 401 responses still do. This keeps
a public form’s own error and values without weakening a genuine session refresh.

[useOperationScope](../src/shared/hooks/use-operation-scope.ts) captures one active
mount for an asynchronous operation. Effect cleanup permanently invalidates that
capture, including StrictMode replay. A late completion cannot update that owner
after replacement or unmount; it does not cancel or roll back an API write.
Accepted account mutations retain the provider’s separate key guard. OTP
destination checks and pending guards remain owned by the form.

Successful password changes use the narrow
[document adapter](../src/shared/navigation/document.ts); other feature
navigation uses the declared framework router boundary. Their tests mock only
those navigation boundaries, not the HTTP client, session or message selection.

## Cooldown

[useCooldown](../src/shared/hooks/use-cooldown.ts) exposes a retry countdown with
finite one-to-600-second bounds. Non-finite input becomes one second. Restarting
replaces the prior timer; reaching zero or unmounting clears it. It does not own
OTP rate limits or authorize retrying the server before its policy allows.

Real React hook tests cover StrictMode effect replay, late reads/mutations,
anonymous/error/retry, generation changes, locale round trips, event cleanup,
countdown boundaries and timer cleanup. Form tests add pending operations,
account replacement, scoped translations and late feedback/navigation checks. Requests use real local HTTP code with synthetic Responses and
owned AbortSignals. No existing API or browser session is contacted. These tests
establish local state ownership, not server authorization or browser hydration.
Read [UI foundation](client-ui.md) and [HTTP ownership](client-document.md).
