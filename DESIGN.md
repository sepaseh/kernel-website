# Website design guide

[English](DESIGN.md) · [فارسی](DESIGN.fa.md)

Use this with the [design workflow](.agents/skills/design-ui/SKILL.md), actual source and the design-ui task in [navigation](.agents/navigation.json). Inspect [the marker](.github/bootstrap-policy.json), inventory and [application acceptance](docs/application.md) before claiming rendered results. A false-marker phase has support components without runnable shell/CSS. Actual application composition and current visual evidence must establish computed appearance.

## Reuse the system

- Inspect [dependencies](package.json), [local primitives](src/components/ui) and [client UI](docs/client-ui.md). Reuse React, shadcn/Radix, CVA, Lucide, Motion and next-intl. Do not introduce an admin UI stack or unreviewed generated component.
- Existing background/foreground/primary/muted/border/focus classes express semantic roles. Reuse actual global tokens when delivered; do not invent a parallel registry or infer computed contrast from class names.
- Preserve [font source/manifest](src/shared/fonts/manifest.json), [CSS](src/shared/fonts/vazirmatn.css), [preloads](src/shared/fonts/preloads.ts) and [license](public/fonts/OFL.txt). Binary integrity does not prove browser loading or shaping quality.
- Compose variants with [cn](src/lib/utils.ts). [Button](src/components/ui/button.tsx) defaults to type=button only for its own native button. A raw button in a form submits by default: explicitly mark secondary and submit controls. Preserve Slot child semantics and actual Radix behavior.
- [FormField](src/shared/ui/FormField.tsx), [Feedback](src/shared/ui/Feedback.tsx) and [forms](docs/forms.md) own visible labels, hints, invalid relationships, announcements, pending/disabled state, retained values and retry. API validation/authorization remains authoritative.
- [Preferences](src/website/shared/Preferences.tsx), [Reveal](src/website/home/Reveal.tsx) and [providers](src/app/providers/Providers.tsx) preserve theme independence, reduced motion, essential visible content and explicit decorative icons.

Identify the feature owner, primary action and relevant loading/empty/data/invalid/error/success/disabled/unauthorized states before styling. Menus/dialogs need actual keyboard, focus and dismissal behavior; an image does not prove interaction.

## Keep behavior and language

Follow [website](.agents/rules/website.md), [imports](.agents/rules/imports.md), [localization](.agents/rules/localization.md), [session](docs/session.md) and [accessibility](docs/accessibility.md). Keep direct named Props/icon conventions, control semantics, password whitespace, OTP ownership, session/mount stale-result guards and cleanup. Preserve supported native attributes and visible error/retry paths.

API settings alone select language and exact ltr/rtl direction. All ten flat catalogs need genuine translations and matching ICU variables. Use explicit client message scopes; no visitor language controls, duplicated catalogs or code-derived direction. Theme is independent of language. Verify both directions, long translated content, keyboard and reduced motion in actual runnable evidence.

## Tools and handoff

Choose the deliverable before selecting a tool: local component source, a design artifact or a hosted prototype have different acceptance. Inspect available host capabilities rather than assuming an integration exists. Map actual components/tokens/states to the design reference. Synthetic prototype data, repository connections, uploads and publication need authorization for their actual external effects. Private source/assets are not uploaded during ordinary local work.

Optional design tools are not runtime dependencies. [Claude memory](CLAUDE.md) and its [skill adapter](.claude/skills/design-ui/SKILL.md) point to local guidance; files prove neither host loading nor service setup.

Select actual IDs from the [manifest](.agents/validation.json) through [validation](.agents/skills/validate-change/SKILL.md). Full exact-tree acceptance precedes authorized commit/push/handoff. Unit/governance/font tests do not establish browser layout or visual quality. Runnable composition needs all fifteen checks, real build/browser/CSP/visual results and protected jobs before merge. Baseline changes require explicit authorization and actual visual review.

Report the deliverable, inspected/reused owners, required states, tools actually used, actual checks/screenshots and API/accessibility/host limits. [Evaluation](docs/comprehension-evaluation.md) separates discovery and source understanding from design verification.
