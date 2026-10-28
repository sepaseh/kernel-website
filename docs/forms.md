# Feature form behavior

[English](forms.md) · [فارسی](forms.fa.md)

The local [login](../src/features/login/Login.tsx),
[registration](../src/features/register/Register.tsx),
[recovery](../src/features/recovery/Recovery.tsx) and
[account](../src/features/account/Account.tsx) components preserve the same behavior
in prerequisite and application snapshots. Registration and
recovery share the typed [OTP form](../src/features/auth/OtpForm.tsx); their
payloads and success destinations remain feature-owned. The [phase marker](../.github/bootstrap-policy.json)
distinguishes local component evidence from application integration; its false
value does not establish routes, a root layout, CSS build or browser execution.
API validation, authorization, OTP limits and cookie revocation remain owned by
the independent API. See the [application acceptance contract](application.md).

## Values and controls

[Form helpers](../src/shared/lib/form-values.ts) trim ordinary text, normalize
Persian/Arabic digits and preserve password whitespace. Mobile input accepts an
11-digit value starting with 09. OTP text uses the same digit normalization.
Registration and profile names use profileNameMaxLength from the shared wire
contract: 1,000 trimmed JavaScript UTF-16 code units. New passwords have native
8–128-character constraints and matching confirmation; login/current-password
values remain exact. The API remains authoritative for all writes.

Every submit control passes type="submit"; resend, retry and logout controls are
non-submitting buttons. Visible labels, descriptions, Feedback announcements,
pending/disabled controls and retained input on failure belong to the existing
[UI primitives](client-ui.md). A request failure preserves input within the same
owner; replacing the locale, account or protected session intentionally resets
that owner's local state.

## Request and session ownership

Authentication and protected account forms reset on locale, SessionProvider
generation and account identity. A generation changes when a refresh or locale
transition starts, not when an accepted mutation updates the same snapshot. Thus
a pending read cannot leave an old form operation live. A 401 from the public
login/register/OTP/recovery operations does not announce session expiry, so the
originating form keeps its error and entered values. Protected mutation 401
responses still announce session expiry.

[Operation scopes](../src/shared/hooks/use-operation-scope.ts) capture the
originating mount. Late success, failure or completion cannot change local
feedback, pending state or navigation after that owner is replaced or unmounted.
SessionProvider separately rejects stale accepted account mutations. These guards
do not cancel or undo a server mutation that has already completed. See
[session ownership](session.md).

OTP feedback and cooldown belong to the requested mobile. Changing that
normalized destination while a request is pending prevents its late response
from starting feedback or a countdown for another number. Email code requests
trim/lowercase their destination; editing it invalidates verification, and only
a matching request revision may accept the returned code state. Verification
uses that requested address and normalized code, then reloads the current
account. Profile and username inputs accept normalized server values after a
successful update. An account replacement cannot retain another account's dirty
fields.

A successful password change uses the narrow
[document-navigation adapter](../src/shared/navigation/document.ts) for
/login?password=changed. This avoids a competing account refresh redirect. Login
and registration refresh the session and navigate to /account; recovery navigates
to /login?reset=success. Routes are fixed local destinations.

## Evidence and limits

Feature component tests use real React/RTL, next-intl, SessionProvider, the HTTP
client and synthetic fetch responses. The
[shared fixture](../src/test/feature-session.tsx) selects only auth/account
messages through selectClientMessages, so a full catalog cannot mask a missing
client key. Only framework router and document navigation are mocked. Tests cover
validation, exact payload values, pending/error/retry, OTP ownership, account
replacement and delayed results; they do not establish Next.js routing, browser
constraint validation, cookie isolation, hydration, visual layout or deployment.

Run the [canonical full gate](../.agents/validation.json) on the exact proposed
snapshot as described in [Contributing](../CONTRIBUTING.md). Runnable integration
must retain these tests and pass all fifteen application checks plus genuine
build/e2e/visual jobs against the [pinned independent synthetic API](api-fixture.md).
Those jobs must be required before merge; a prior component pass does not
validate different application source.
