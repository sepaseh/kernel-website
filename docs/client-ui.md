# Local client UI foundation

[English](client-ui.md) · [فارسی](client-ui.fa.md)

The [guidance phase](bootstrap.md) retains thirteen independently testable foundation support
modules: five local shadcn/Radix primitives, FormField and Feedback, session and
theme/motion providers, preferences, a bounded countdown, Reveal and a Web Vitals
hook adapter. There are no pages, root layout, CSS build, Next.js request adapter
or runnable website. Keep applicationReady:false until real application gates pass.

## Components and styling

Local primitives in src/components/ui use Radix Slot/Label, class-variance-authority
and the existing clsx/tailwind-merge helper. Preserve native input/button props,
disabled behavior, Slot child semantics and caller classes. Components receive
typed parameters; React.FC/FunctionComponent aliases are forbidden by lint.
Imports stay within exact per-owner package and erased/runtime permissions.

Native Button elements default to type="button" to avoid accidental form
submission. Submit controls pass type="submit" explicitly; asChild leaves the
child element's type behavior unchanged.

FormField associates an explicit id or a generated React id with its label; form
names remain independent and need not be unique across the document.
Generated ids keep anonymous fields distinct. Error text takes precedence over a
hint, and its description id is combined with caller-provided aria-describedby
references. Feedback renders actual translated alert/status content, escapes API
text through React and uses generic network text for transport/server errors.
Lucide icons use direct named imports, explicit size/currentColor and decorative
aria-hidden. No HTML message insertion is permitted.

Tailwind class strings and component semantics are published; the stylesheet and
production CSS pipeline are not. DOM and static-markup tests do not establish
visual layout, contrast, keyboard journeys or browser accessibility compliance.

## Feature forms

[Login, registration, recovery and account forms](forms.md) compose these same primitives and reviewed HTTP helpers. Submit controls keep their explicit type; resend, retry and logout controls cannot submit an enclosing form. Feature ownership, scoped translations, late-result guards and document navigation are described in [session ownership](session.md). The shared OTP form retains separate registration and recovery payload contracts without duplicating their UI.

## Theme, motion and metrics

Preferences changes only the theme through installed next-themes. The composite
provider uses class-based dark/light themes, fixed dark bootstrap, no system-theme
selection and kernel-website-theme storage. This preference never selects a
language; API settings remain authoritative. The theme script receives a supplied
CSP nonce for static server markup. Real Next.js nonce/request integration remains
unpublished.

Reveal uses Motion's strict minimal component with initial content visible.
Reduced motion removes initial displacement and animation delay. The composite
provider forwards the user's reduced-motion policy. Static React markup tests
exercise this local behavior; they do not prove framework hydration or browser
motion/loading behavior.

WebVitals registers the existing stable, private report callback with Next's hook
and renders no UI. Its owner test verifies registration; actual browser metric
collection is reserved for the runnable application. There is no default telemetry
transport. Preserve the existing subscriber snapshot and privacy checks.

## Validation

Real React Testing Library tests use installed React, Radix, next-intl and theme
libraries in isolated jsdom. They cover Slot/disabled semantics, native input
events, label/description links, localized safe feedback and theme-only storage.
Node static-markup tests check content visibility, provider composition and nonce
forwarding. Synthetic media-query fixtures are test support, not browser evidence.
Feature tests use real HTTP/session behavior and only the explicit auth/account messages; framework router and document navigation are mocked. These tests do not establish browser navigation, native constraint validation or hydration. All executable production modules remain in measured coverage and Sonar analysis.
Hooks recommended lint rules join the existing required lint command; all eleven
canonical checks, font verification and existing thresholds remain required.

Read [session and cooldown ownership](session.md), [client/document support](client-document.md)
and [Contributing](../CONTRIBUTING.md). Before any runnable publication, add all
fifteen application checks and genuine required build/e2e/visual jobs against an
independently installed synthetic API fixture.
