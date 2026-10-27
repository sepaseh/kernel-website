# Website design guide

[English](DESIGN.md) · [فارسی](DESIGN.fa.md)

Use this guide with the [design workflow](.agents/skills/design-ui/SKILL.md) and
the design-ui task in [navigation](.agents/navigation.json). Source defines the
installed components and their behavior. This guidance phase remains non-runnable:
pages, a root layout, generator configuration and the CSS build are not published.
Class names do not establish a rendered design system or verified visual quality.

## Inspect the published system

| Concern             | Source                                                                                                                                                            | Design consequence                                                                                                                                                                                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Installed libraries | [package](package.json), [local primitives](src/components/ui)                                                                                                    | Reuse React, shadcn/Radix, CVA, Lucide, Motion and next-intl. Inspect generated components and dependencies before adoption. The missing CSS pipeline requires later integration.                                                                                                                                              |
| Semantic styling    | [Button](src/components/ui/button.tsx), [input](src/components/ui/input.tsx), [cn](src/lib/utils.ts)                                                              | Existing classes express background, foreground, primary, muted, border and focus roles. The global token stylesheet is deferred; do not invent a parallel registry or claim computed colors/contrast from these classes.                                                                                                      |
| Typography          | [font CSS](src/shared/fonts/vazirmatn.css), [manifest](src/shared/fonts/manifest.json), [preloads](src/shared/fonts/preloads.ts), [license](public/fonts/OFL.txt) | Preserve self-hosted variable Vazirmatn source, shaping, subsets and license. Binary integrity checks do not establish browser loading performance.                                                                                                                                                                            |
| Component variants  | [client UI guide](docs/client-ui.md), [Button](src/components/ui/button.tsx)                                                                                      | Compose installed variants with cn. Button defaults to type="button" only when rendering its own button; a bare native `<button>` inside a form defaults to submitting. Set native secondary controls to type="button" and submit controls to type="submit" explicitly. Preserve Slot child semantics and real Radix behavior. |
| Forms and feedback  | [Login](src/features/login/Login.tsx), [FormField](src/shared/ui/FormField.tsx), [Feedback](src/shared/ui/Feedback.tsx), [forms](docs/forms.md)                   | Keep visible labels, hints, invalid associations, announcements, pending/disabled states, retained values and retry paths. API validation and authorization remain authoritative.                                                                                                                                              |
| Interaction support | [Preferences](src/website/shared/Preferences.tsx), [Reveal](src/website/home/Reveal.tsx), [providers](src/app/providers/Providers.tsx)                            | Keep theme independent from language, decorative icons explicit and essential content visible. These support modules are not a published page shell.                                                                                                                                                                           |

For a proposed screen, identify its future route, feature owner, primary action and
needed states before styling. Cover applicable loading, empty, populated, invalid,
error, success, disabled and unauthorized states. Dialogs and menus need actual
keyboard, focus and dismissal behavior; a picture cannot establish those behaviors.

## Preserve the application contract

- Follow [website](.agents/rules/website.md), [imports](.agents/rules/imports.md)
  and [localization](.agents/rules/localization.md) rules. Keep existing component
  patterns and exact package-owner permissions.
- Preserve [session ownership](docs/session.md), mount cleanup and stale-result
  guards. Authentication, authorization, OTP delivery, data and storage belong to
  the independent API; a prototype does not implement them.
- API settings alone select language and valid direction. Keep ten genuine flat
  catalogs, ICU variables and explicit client-message groups. Do not add visitor
  language selection. See [localization](docs/localization.md).
- Keep theme preference, accessible names, visible focus and reduced motion.
  Planned responsive checks must cover narrow/wide layouts, both API directions,
  both themes and long translations. No browser or visual pass is established here.
- Reuse [server-boundary](docs/server-boundary.md), [document support](docs/client-document.md)
  and [font](docs/fonts.md) behavior. Future public pages must preserve explicit
  SEO origins, safe JSON-LD, private/no-store responses and document CSP integration.
  Current support tests do not prove that integration.

## Choose the deliverable

| Requested result          | Work and evidence                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Graphic or visual concept | Use an available image/design tool when useful; record scoped assets, dimensions, transparency, license and placement. A concept is not interactive application code.                       |
| Editable design           | Inspect available host tools and the applicable skill, then map actual components, typography, states and direction. Record its design reference and remaining integration work.            |
| Application source        | Reuse local primitives and feature owners. Routes, layout, generator setup and CSS belong to a later runnable phase and require its expanded validation gate.                               |
| Hosted prototype          | Use synthetic data and a defined scope. Verify the chosen service's actual compatibility. Uploads, repository connections and publication require authorization for those external actions. |

Discover available tools rather than assuming integrations exist. Do not upload
private source or assets during ordinary local work. Optional design tools are
not runtime dependencies. [CLAUDE.md](CLAUDE.md) and its thin
[skill adapter](.claude/skills/design-ui/SKILL.md) point to canonical guidance;
their presence does not prove a host loaded them or configured a design service.

## Verify and hand off

Select real IDs from the [canonical manifest](.agents/validation.json) through the
[validation workflow](.agents/skills/validate-change/SKILL.md). The full profile
applies before an authorized commit, push or PR handoff. This phase's source,
unit, governance and font evidence does not establish browser layout, accessibility,
SSR, application build or deployment. Runnable integration must add and pass its
required build/browser/visual checks before merging.

Report the deliverable, inspected owners, reused or changed components, required
states, tools actually invoked, executed checks and available visual references.
State remaining API, accessibility and host limits. Use the
[evaluation guide](docs/comprehension-evaluation.md) to distinguish observed
instruction discovery from source understanding and actual design verification.
