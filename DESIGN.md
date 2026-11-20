# Design conventions

Identify the user task, primary action and relevant states before changing the
interface. Start with the feature owner and existing shared controls. Follow
the [design workflow](.agents/skills/design-ui/SKILL.md) for implementation and
handoff. Verify the appearance in the running website.

## Reuse the system

- Inspect [dependencies](package.json), local primitives and [client UI](docs/client-ui.md). Reuse React, shadcn/Radix, CVA, Lucide, Motion and next-intl. Do not introduce an admin UI stack or unreviewed generated component.
- Existing background/foreground/primary/muted/border/focus classes express semantic roles. Reuse the [global tokens](src/app/globals.css); verify computed contrast in the rendered page when changing colors.
- Preserve [font source/manifest](src/shared/fonts/manifest.json), [CSS](src/shared/fonts/vazirmatn.css), [preloads](src/shared/fonts/preloads.ts) and [license](public/fonts/OFL.txt). Binary integrity does not prove browser loading or shaping quality.
- Compose variants with [cn](src/shared/lib/cn.ts). [Button](src/shared/ui/button.tsx) defaults to type=button only for its own native button. A raw button in a form submits by default: explicitly mark secondary and submit controls. Preserve Slot child semantics and actual Radix behavior.
- [FormField](src/shared/ui/FormField.tsx), [Feedback](src/shared/ui/Feedback.tsx) and [forms](docs/forms.md) own visible labels, hints, invalid relationships, announcements, pending/disabled state, retained values and retry. API validation/authorization remains authoritative.
- [ThemeToggle](src/shared/ui/ThemeToggle.tsx), [Reveal](src/features/home/Reveal.tsx) and [providers](src/app/providers/Providers.tsx) preserve theme independence, reduced motion, essential visible content and explicit decorative icons.

Exercise applicable loading, empty, populated, invalid, error, success,
disabled and unauthorized states. Verify keyboard, focus and dismissal behavior
in the rendered menus and dialogs.

## Keep behavior and language

Follow [website](.agents/rules/website.md), [imports](.agents/rules/imports.md), [localization](.agents/rules/localization.md), [session](docs/session.md) and [accessibility](docs/accessibility.md). Keep direct named Props/icon conventions, control semantics, password whitespace, OTP ownership, session/mount stale-result guards and cleanup. Preserve supported native attributes and visible error/retry paths.

API settings alone select language and exact ltr/rtl direction. All ten flat catalogs need genuine translations and matching ICU variables. Use explicit client message scopes; no visitor language controls, duplicated catalogs or code-derived direction. Theme is independent of language. Verify both directions, long translated content, keyboard and reduced motion in actual runnable evidence.

## Tools and handoff

Choose the deliverable before selecting a tool: local component source, a design artifact or a hosted prototype have different acceptance. Inspect available host capabilities rather than assuming an integration exists. Map actual components/tokens/states to the design reference. Synthetic prototype data, repository connections, uploads and publication need authorization for their actual external effects. Private source/assets are not uploaded during ordinary local work.

Optional design tools are not runtime dependencies. [Claude memory](CLAUDE.md) and its [skill adapter](.claude/skills/design-ui/SKILL.md) point to local guidance; files prove neither host loading nor service setup.

## Verify the rendered page

Use the rendered interface to verify changed interactions and report the checks
that actually ran.

Use the [application acceptance guide](docs/application.md) to choose browser,
accessibility and visual checks for the changed states. Before an authorized
commit, push or pull request handoff, run the full profile from the
[validation manifest](.agents/validation.json) using the
[exact-tree procedure](docs/validation.md). Update baselines only after explicit
authorization and review of the new images. [Visual regression](docs/visual-regression.md)

Report the deliverable, inspected/reused owners, required states, tools actually used, actual checks/screenshots and API/accessibility/host limits. [Evaluation](docs/comprehension-evaluation.md) separates discovery and source understanding from design verification.
