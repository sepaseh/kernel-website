# Code Quality

## Validate code changes

Read the complete affected owner and its tests. Start with the smallest declared
check for changed files, then use the canonical [full profile](../validation.json)
on the exact proposed export before an authorized commit, push or PR handoff.
Follow [validation](../../docs/validation.md); focused checks do not replace it.

Keep one independently installable npm package and inert imports. This governance
phase contains repository tooling, not application behavior. Validate external
data at its boundary, preserve original failures and cancellation, and fail
clearly on missing required inputs. Keep ownership and cleanup local to resources
created by the operation.

## Autofix workflow

- Let the published formatter and import sorter handle their configured rules.
- Never sort imports manually if the published configuration can do it.
- Do not introduce a formatter or new tooling unless the user asks.

## Readable code over comments

Write self-documenting code. Add comments only for:

- Non-obvious business logic
- Algorithmic decisions that are not clear from the code
- Temporary workarounds with context

## Semantic whitespace

- Treat a blank line as a paragraph boundary between conceptually distinct
  parts of the code, not as decoration between individual statements.
- Leave one blank line after guard clauses before the main execution path.
- Keep consecutive steps of one workflow together, including setup, derived
  values, branching, and their related success effects.
- Add a blank line only when the code changes responsibility or begins an
  independently meaningful phase. If a function needs many such phases,
  consider extracting a focused helper instead of adding more visual sections.
- Apply this to changed functions, helpers and tests; arrange/act/assert are useful
  test phases. Review the semantic grouping directly:
  a formatter passing does not prove that phase boundaries are readable.
- Keep consecutive request steps together, such as setting the busy flag,
  awaiting the request and applying its result. Avoid a new padding rule or
  unrelated formatting sweep to enforce a prose convention.

## Simplicity

- Solve the current task directly; avoid speculative abstractions.
- Keep starter-kit code generic and easy to replace.
- Do not add error handling for impossible states.
- Prefer straightforward repetition over premature abstraction.

## Static-analysis findings

- Treat SonarQube findings as prompts to improve the design, not targets to
  silence mechanically. Understand the reported risk and its runtime context
  before changing code.
- Prefer the simplest idiomatic correction that leaves the code at least as
  readable, cohesive, and type-safe as before.
- Do not introduce wrappers, adapters, `bind` calls, indirection, duplicated
  state, placeholder branches, or speculative abstractions whose only purpose
  is to make an analyzer stop reporting an issue.
- Explain verified false positives and require explicit authorization for provider
  classification changes. Do not suppress findings or weaken rules to pass a gate.
- Re-run the analyzer when available, but also review the resulting code on its
  own merits. A passing quality gate does not justify a maintainability
  regression.

## No unused code

- Remove unused files, exports, dependencies, translations, and routes.
- Verify cleanup with the actual published checks in the validation manifest.
- Keep all executable tooling measured. Preserve 90% unit and 80% governance
  coverage; add no suppressions or source, rule or coverage exclusions.

Do not manufacture compatibility or provider results. Follow [testing](testing.md)
and preserve meaningful order under [ordering](ordering.md).
