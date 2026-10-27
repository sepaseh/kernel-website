# Client session and cooldown ownership

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

The kernel:session-expired listener starts a fresh read and is removed on unmount.
Accepted mutation data can replace only its own loaded snapshot; a callback
captured before a newer session cannot overwrite that session. Consumers outside
the provider fail explicitly. Cookie isolation and full login/logout browser
journeys require the later runnable application and API fixture.

[useCooldown](../src/shared/hooks/use-cooldown.ts) exposes a retry countdown with
finite one-to-600-second bounds. Non-finite input becomes one second. Restarting
replaces the prior timer; reaching zero or unmounting clears it. It does not own
OTP rate limits or authorize retrying the server before its policy allows.

Real React hook tests cover StrictMode effect replay, late reads/mutations,
anonymous/error/retry, locale changes, event cleanup, countdown boundaries and
timer cleanup. Requests use real local HTTP code with synthetic Responses and
owned AbortSignals. No existing API or browser session is contacted. These tests
establish local state ownership, not server authorization or browser hydration.
Read [UI foundation](client-ui.md) and [HTTP ownership](client-document.md).
