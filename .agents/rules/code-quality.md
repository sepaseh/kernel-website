# Code quality

## Validation

Start with the smallest relevant command in the
[canonical manifest](../validation.json), following
[Contributing](../../CONTRIBUTING.md) and the [phase guide](../../docs/bootstrap.md).
Read the actual source marker and registered profile. Runnable application source
requires all fifteen checks, including declared Knip, build/bundle, browser/CSP
and visual commands. Never invent an unregistered command or substitute support
tests for actual application acceptance. Before every authorized commit, push or PR handoff, run the complete
full profile on an isolated export of the exact proposed tree, including for
changes limited to documentation.

Use the existing ESLint and Prettier configuration for imports and formatting.
Apply autofixes only to the intended scope and inspect the result. Do not replace
or add tooling merely to make a check pass.

## Readability

Write self-documenting code. Comments explain non-obvious business behavior,
algorithmic choices or a temporary workaround with its context. Treat blank lines
as boundaries between distinct responsibilities. Keep one workflow's consecutive
steps together, leave space after guards before the main path, and separate
arrange, act and assert when those phases are distinct. Prettier does not verify
these conceptual boundaries.

Solve the current problem directly. Prefer a small clear implementation over a
speculative abstraction. Avoid handling impossible states or duplicating state
that can be derived from its owner.

## Analysis and cleanup

Understand a diagnostic's behavior and context before changing code. Correct data
flow, narrowing and dependencies rather than adding analyzer-only wrappers,
placeholder branches or indirection. Preserve behavior, source boundaries and
measured coverage. Do not add suppressions, exclusions, thresholds or provider
classifications to bypass a required check. A suspected false positive remains
unresolved until a separately authorized decision is reflected in the actual
provider report; follow [the PR preflight](pull-requests.md#before-requesting-coderabbit).

Remove newly unused imports, code and dependencies when they belong to the
change. Preserve unrelated unpublished files and original recovery copies. A
passing gate does not excuse a maintainability regression.
