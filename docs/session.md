# Client session, operation and cooldown ownership

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

[SessionProvider](../src/features/auth/session/SessionProvider.tsx) consumes the locale
already supplied by next-intl and reads /account/me through `getAccount` in the
[session HTTP module](../src/features/auth/session/api.ts). That module also owns
`logout`; protected account writes remain in the account feature. Both use the
reviewed shared HTTP client. The provider does not own cookies, token refresh, authorization or language
selection. The configured HTTP backend remains authoritative.

A snapshot belongs to one locale/refresh key. A changed key hides the old account
while a new read loads. Effect cleanup aborts the originating read; late success
or failure cannot install old data even when a synthetic transport ignores its
signal. A 401 account read represents an anonymous session without a visible
error. Other failures are exposed and refresh permits an explicit retry.

The readonly generation exposes the existing request version for form ownership.
It increments at the start of a refresh or locale transition, including a return
to a previously used locale. Accepting an account mutation does not increment it.
It is local request ownership, not an API session token or authorization value.

## Form operation ownership

When [authentication and account forms](forms.md) are introduced, key their local
owner by locale, session generation and account identity. Owner replacement must
reset dirty input and invalidate pending feedback/navigation before a new account
read completes. Form integration is not published or tested in this phase.
The published HTTP operations already distinguish public login, registration,
OTP and recovery 401 responses, which do not emit session-expired, from protected
mutation 401 responses, which do.

[useOperationScope](../src/shared/hooks/use-operation-scope.ts) activates a fresh
per-mount token in `useLayoutEffect` setup. A capture made after that owner's
layout setup stays active through passive effects. Waiting until passive setup
could leave committed work bound to the initial inactive token and suppress its
successful feedback/navigation or busy-state cleanup. Layout cleanup permanently
invalidates the captured token; StrictMode replay installs a new token rather
than reviving an earlier capture. A late completion cannot update that owner
after replacement or unmount; the guard does not cancel or roll back an API write.
Accepted account mutations retain the provider’s separate key guard. OTP
destination checks and pending guards remain owned by the form.

The [document adapter](../src/shared/navigation/document.ts) and its isolated test
are published. Wiring successful password changes or other form results to
navigation remains part of later feature integration.

## Cooldown

[useCooldown](../src/shared/hooks/use-cooldown.ts) exposes a retry countdown with
finite one-to-600-second bounds. Non-finite input becomes one second. Restarting
replaces the prior timer; reaching zero or unmounting clears it. It does not own
OTP rate limits or authorize retrying the server before its policy allows.

Real React hook tests cover committed-layout capture before passive effects,
StrictMode effect replay, late reads/mutations,
anonymous/error/retry, generation changes, locale round trips, event cleanup,
countdown boundaries and timer cleanup. Requests use real local HTTP code with
synthetic Responses and owned AbortSignals. Feature form integration tests for
pending operations, input reset, scoped translations and late feedback/navigation
are not included in this phase. No existing API or browser session is contacted.
These tests establish local state ownership, not server authorization or browser
hydration.
Read [UI foundation](client-ui.md) and [HTTP ownership](client-document.md).
