---
name: validate-change
description: Select and run the current website phase checks, including the complete gate before authorized commits, pushes and PR handoffs.
---

# Validate a change

Read the changed files and matching rules, [phase guide](../../../docs/bootstrap.md),
[Contributing](../../../CONTRIBUTING.md) and
[canonical manifest](../../validation.json).

- Behavior: start with the smallest relevant source or governance test.
- TypeScript/TSX: include the registered typecheck and lint checks.
- Imports, exports or dependencies: include the registered source-boundary check.
- Guidance: include its registered structure/link/command check and governance
  tests, then formatting.
- Configuration: include the matching semantic policy and fixture tests.

Use only commands registered for the actual phase. The non-runnable phase has no
Knip, application build or browser job. Future runnable integration must add and
execute the complete application gate; no support check substitutes for it.

Before every authorized commit, push or PR handoff, install the declared Node and
pinned Python dependencies and pass the full manifest profile on an isolated
export of the exact proposed tree. Preserve source/coverage scope and thresholds.
Report actual results and limitations; guidance checks do not measure assistant
loading, comprehension or model performance.

Correct clear safe in-scope inconsistencies and rerun the affected checks. Never
hide or weaken a failure. Ask only when a correction needs a missing material
decision, destructive action, outside authority or a scope change. Preserve user
authorization already provided; routine safe fixes need no repeated permission.

For independent quality helpers, run their relevant Node owner tests first, then the required governance coverage check. Keep explicit fixture-location, bundle/budget, environment, metadata and locking failures observable in owned temporary projects. Read [testing](../../../docs/testing.md); deferred browser suites and real API compatibility are not established by this phase gate.

For delivery tooling, run the matching registered Node owner cases with owned marked fixtures and injected engine callbacks. The current false source marker must never be toggled to run an operation. The complete canonical profile includes all delivery cases and the existing audit regression; static templates and synthetic archives do not establish an application build or deployment.

For runner-foundation changes, select the six Node owner files in [runner foundation](../../../docs/runner-foundation.md), then run measured governance coverage and the unchanged full profile on the exact exported source. Positive cases use owned marked fixtures and disposable Node children; do not toggle the current source marker, load real dotenv, or use a live API/Next/browser/Docker run as a shortcut.
