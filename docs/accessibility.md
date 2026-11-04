# Assess website accessibility

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

## Check the available evidence

Automated page accessibility checks and an e2e wrapper are not published in this
phase. The local UI tests exercise component semantics, but do not establish
page accessibility. [Validation](validation.md) defines the required checks.
Use the manual checklist below when runnable pages are available; record which
states were actually reviewed and which remain untested.

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
