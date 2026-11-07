# Assess website accessibility

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

Use accessible controls while implementing a page, then verify the whole page
with automated and manual checks. The repository includes DOM tests and
[Playwright/Axe scenarios](../e2e/website/accessibility.spec.ts); their source
defines checks, not a claim that a particular revision passed or meets WCAG.

## Start with existing behavior

[FormField](../src/shared/ui/FormField.tsx) associates labels, hints and errors.
[Feedback](../src/shared/ui/Feedback.tsx) announces errors as alerts and success
as status. [Button](../src/shared/ui/button.tsx) preserves native attributes and
explicit submit semantics. [ThemeToggle](../src/shared/ui/ThemeToggle.tsx) has a
translated accessible name and changes theme independently of language.
[Reveal](../src/features/home/Reveal.tsx) keeps essential content visible and
respects reduced motion.

[The root layout](../src/app/layout.tsx) supplies a translated skip link and a
focusable main target. Reuse the [UI contracts](client-ui.md) and
[form behavior](forms.md) rather than adding parallel controls. DOM owner tests
cover associations, input events, disabled/Slot semantics, localized feedback and
state changes. Browser focus, computed contrast and reflow need page-level review.

## Run the automated page checks

Prepare the clean local inputs, matching Chromium and
[local synthetic HTTP fixture](api-fixture.md) described in
[development](development.md). Build the current source, stop manually owned
launchers, then run:

```sh
npm run test:accessibility
```

The accessibility suite scans home, login, registration, recovery and a connected
account in English/Persian and light/dark themes after fonts are ready. It
attaches Axe violations and incomplete findings, and keeps violations blocking.
Keyboard cases check the skip link/main target, retained theme-toggle focus,
visible outlines, login focus order and native invalid-input focus.

Inspect incomplete findings rather than treating an empty violations list as a
complete assessment. Application journeys and the two CSP modes have their own
commands; [validation](validation.md) defines the complete publication gate.

## Review representative states manually

For each available changed flow:

1. Exercise English/LTR and Persian/RTL in both themes. Include loading,
   invalid input, error/retry, OTP/recovery and account-update states.
2. Use only the keyboard. Check action order, visible/retained focus, skip links,
   labels, descriptions and error announcements. New overlays need explicit
   focus, dismissal and return-focus behavior.
3. Check actual combined contrast, zoom/reflow, larger text, forced colors,
   reduced motion and touch interaction. Long translations and changed palettes
   need representative review.
4. For screen-reader review, record the actual browser, OS and assistive
   technology, page/state, expected announcement/focus and observed result.
   Translation completeness does not establish linguistic or speech quality.

Report source revision, commands, reviewer, results, failures and follow-up in the
task. Mark unexecuted checks explicitly. Save a local report only if requested,
under ignored `test-results/`. Do not disable rules, loosen checks or refresh
screenshots to conceal a failure. [Visual comparison](visual-regression.md)
supports appearance review; neither it nor automated scans certify complete
accessibility conformance.
