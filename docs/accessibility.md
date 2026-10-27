# Local accessibility behavior and future assessment

[English](accessibility.md) · [فارسی](accessibility.fa.md)

The **integration-tooling** phase is non-runnable. Local controls and forms have
DOM/behavior tests, but published pages, root layout, CSS, Playwright journeys and
automated axe scans are absent. This guide and local tests establish neither
complete WCAG conformance nor screen-reader behavior.

## Published support

[FormField](../src/shared/ui/FormField.tsx) associates controls with labels,
hints and errors. [Feedback](../src/shared/ui/Feedback.tsx) announces local
error/success feedback. [Button](../src/components/ui/button.tsx) preserves native
props and explicit submit semantics. [Preferences](../src/website/shared/Preferences.tsx)
keeps theme independent of API-owned language. [Reveal](../src/website/home/Reveal.tsx)
keeps essential content visible and respects reduced motion. Read
[client UI](client-ui.md) and [forms](forms.md) for ownership and test limits.

Real React/RTL and supporting libraries run in isolated jsdom. Owner tests cover
associations, input events, disabled/Slot semantics, localized feedback and local
state transitions. They do not verify computed global CSS, browser focus or
constraint validation, whole-page keyboard order, contrast or reflow. Translation
completeness is separate from linguistic quality and assistive-technology review.

## Acceptance before runnable publication

After pages and CSS exist, assess representative English/LTR and Persian/RTL
states in both themes: loading, invalid input, errors/retry, OTP/recovery and
account updates. Check keyboard-only operation, visible/retained focus, labels
and error announcements, actual combined contrast, zoom/reflow, larger text,
forced colors and touch interaction. New overlays need their own focus behavior.

Automated browser checks must use owned disposable fixtures. Keep violations
blocking and attach incomplete findings for human investigation. An empty
violations list or screenshot is not a complete assessment. Name the actual
browser, operating system and assistive technology for manual screen-reader work;
other languages and new palettes need representative review.

Record source revision, date/reviewer, versions, page/state, expected and observed
focus/speech, artifacts, owner and follow-up. Mark unexecuted/unavailable work
explicitly. Do not disable rules or widen tolerances to conceal a failure.
[Testing](testing.md), [reliability](test-reliability.md) and [validation](validation.md)
own execution evidence; [visual comparison](visual-regression.md) is complementary,
not an accessibility certification.
