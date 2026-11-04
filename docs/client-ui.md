# Use the website's UI components

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

## Choose and compose controls

Use the existing Alert, Button, Card, Input and Label primitives, with
[FormField](../src/shared/ui/FormField.tsx) and
[Feedback](../src/shared/ui/Feedback.tsx) for form labels and messages.
The primitives use Radix Slot/Label, class-variance-authority and
[cn](../src/shared/lib/cn.ts) to combine clsx and tailwind-merge classes.
Preserve native attributes, caller classes, disabled behavior and Slot child
semantics. New component input parameters use a named Props type; do not use
React.FC or FunctionComponent aliases.

For an account email field, use the existing translated label and native input
attributes inside the account message scope:

```tsx
<FormField
  id="account-email"
  name="email"
  label={t("accountEmailLabel")}
  type="email"
  autoComplete="email"
  required
/>
```

Button defaults its own native button to `type="button"`. Set
`type="submit"` explicitly on submit controls; keep resend, retry and logout
controls non-submitting. `asChild` preserves the child element's own type
semantics. Directly import named Lucide icons, give them explicit size and
currentColor, and mark decorative icons `aria-hidden`.

Feedback renders errors as an alert and success as a status. Errors take
precedence. TypeError, server API errors and unknown values use translated generic
network feedback; other Error messages render as escaped text. Do not insert
API messages as HTML or expose transport diagnostics.

## Keep state with its feature

[Forms](forms.md) defines the later integration requirements for submitted values,
native validation, pending/error/retry states and OTP destinations.
[Session](session.md) supplies generation and mount-operation guards. Feature
forms, their reset identity and the shared authentication OTP component are not
published in this phase.

## Verify a UI change

Run focused owner tests using [testing](testing.md), then applicable type/lint
checks. Real React Testing Library tests cover native attributes, labels,
descriptions, disabled/Slot behavior, escaped localized feedback and theme-only
storage. These are local component tests. Feature form integration tests and
application provider tests for nonce forwarding or reduced-motion configuration
are not published in this phase; see [form evidence](forms.md#evidence-and-limits).
