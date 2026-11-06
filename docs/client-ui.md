# Use the website's UI components

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

Build feature UI from the controls in shared UI. Keep
authentication behavior in `src/features/auth`, account forms in
`src/features/account`, home content in `src/features/home` and page/shell
composition in `src/app`. [Architecture](architecture.md) maps the owners;
[Design](../DESIGN.md) describes the visual system.

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

FormField uses a supplied `id` or React-generated unique ID to associate the
label and input. A form `name` is independent of that DOM ID. Error text takes
precedence over hint text; its description is combined with any caller-supplied
`aria-describedby`, and an error marks the input invalid. See
[EmailForm](../src/features/account/components/email-form/EmailForm.tsx) for a
complete form using this control.

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

[Forms](forms.md) defines the published feature behavior for submitted values,
native validation, pending/error/retry states and OTP destinations.
[Session](session.md) supplies generation and mount-operation guards. Feature
forms key their reset identity by locale, session generation and account.
The shared [OTP component](../src/features/auth/OtpForm.tsx) owns registration
and recovery code requests, destination checks and cooldown feedback.

Reuse `src/app/globals.css` tokens and existing control variants. The
application stylesheet supplies actual CSS; class names and isolated DOM tests
do not establish contrast, focus visibility or layout.

[Providers](../src/app/providers/Providers.tsx) composes class-based light/dark
themes, Motion's user reduced-motion policy and SessionProvider.
[ThemeToggle](../src/shared/ui/ThemeToggle.tsx) changes theme only. The default is
dark, system-theme selection is disabled and the preference uses
`kernel-website-theme` storage. It never chooses a language.

The [root layout](../src/app/layout.tsx) passes the trusted request nonce to the
theme provider. [Server boundaries](server-boundary.md#document-security) explains
nonce creation and forwarding. Preserve that relationship when changing provider
composition.

[Reveal](../src/features/home/Reveal.tsx) belongs to the home feature. Its initial
content stays visible; reduced motion removes its displacement and delay.
It uses Motion's strict minimal component with the existing animation features.

The root layout mounts [WebVitals](../src/shared/performance/WebVitals.tsx).
It renders no UI and registers the stable callback with Next's hook. There is no
default telemetry transport or storage; [performance](website-performance.md)
owns subscriber privacy, delivery and measurement details.

## Verify a UI change

Run focused owner tests using [testing](testing.md), then applicable type/lint
checks. Real React Testing Library tests cover native attributes, labels,
descriptions, disabled/Slot behavior, escaped localized feedback and theme-only
storage. Feature form integration tests cover submitted values, pending state,
errors, retries and stale operations; see [form evidence](forms.md#evidence-and-limits).

Provider/static-markup tests cover nonce forwarding, visible content and
reduced-motion configuration. Form tests use the real HTTP/session owners and
explicit messages, mocking framework router/document navigation.

Review actual pages in both themes and directions using
[accessibility](accessibility.md) and [visual comparison](visual-regression.md).
Those steps exercise browser focus, native constraint validation, hydration and
computed appearance beyond isolated tests. Complete publication validation follows
[validation](validation.md); a component test does not certify a browser journey,
deployment or accessibility conformance.
