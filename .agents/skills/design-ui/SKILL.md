---
name: design-ui
description: Design or implement this website's pages and components, restyle its UI, or prepare design-tool handoffs using its actual system. Use for visual and interaction work, not unrelated backend changes.
---

# Design UI

Read [AGENTS.md](../../../AGENTS.md), the [design system](../../../DESIGN.md)
and the owner of the affected interface in the current checkout. Identify the
requested deliverable and available tools. Follow the
[remote action rules](../../rules/safety.md#external-systems) for uploads and
publication.

1. Follow the [design handoff guide](../../../DESIGN.md#tools-and-handoff) for
   artifacts and hosted prototypes. Apply the remote action rules to tool
   connections as well as uploads and publication.
2. Find the relevant owners in [source navigation](../../../docs/source-navigation.md).
   Inspect the root CSS, layout, affected routes, primitives and interaction
   states. Verify generator metadata before using a generator.
3. Follow the [existing design system](../../../DESIGN.md#reuse-the-system) and
   [website behavior rules](../../rules/website.md). Keep optional design tools
   and assistants outside runtime dependencies.
4. Review responsive behavior and interaction states in the browser on the
   proposed source. Follow the
   [rendered review procedure](../../../DESIGN.md#verify-the-rendered-page) and
   [exact-tree validation](../validate-change/SKILL.md#validate-the-exact-tree)
   at the appropriate handoff boundary.

Report the deliverable, reused or changed components and tokens, actual checks,
visual observations and evidence limits.
