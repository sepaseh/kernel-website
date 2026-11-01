# Assess website accessibility

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

## Start with existing behavior

## Run the automated page checks

The accessibility suite scans home, login, registration, recovery and a connected
account in English/Persian and light/dark themes after fonts are ready. It
attaches Axe violations and incomplete findings, and keeps violations blocking.
Keyboard cases check the skip link/main target, retained theme-toggle focus,
visible outlines, login focus order and native invalid-input focus.

Inspect incomplete findings rather than treating an empty violations list as a
complete assessment. The e2e wrapper also exercises the other browser journeys in
both CSP modes; [validation](validation.md) defines the complete publication gate.

## Review representative states manually

For each changed flow:

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
