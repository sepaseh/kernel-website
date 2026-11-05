# Feature form behavior

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

This phase publishes login, registration, recovery and account form components
with their local integration tests. They combine form-value helpers, UI
primitives, HTTP operations and session hooks. Application routes and browser
execution remain outside this phase.

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

The [login](../src/features/auth/login/Login.test.tsx),
[registration](../src/features/auth/register/Register.test.tsx),
[recovery](../src/features/auth/recovery/Recovery.test.tsx) and
[account](../src/features/account/Account.test.tsx) suites use the
[shared fixture](../src/test/feature-session.tsx), which selects only auth/account
messages through selectClientMessages. The suites exercise normalized values,
exact HTTP payloads, pending/error/retry behavior, retained input, OTP destination
ownership and stale feedback/navigation. Account form owner tests cover email
verification, profile and username responses, password changes and owner resets.

These local tests use synthetic responses and controlled navigation adapters.
They do not establish Next.js routing, browser constraint validation, cookie
isolation, hydration, visual layout or deployment.
