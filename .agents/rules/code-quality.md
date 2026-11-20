# Code quality

## Validate code changes

Use the [validation workflow](../skills/validate-change/SKILL.md) to select
checks and verify the proposed source.

Validate external data at its boundary. Preserve original failures and
cancellation, and fail clearly on missing required inputs. Follow
[runner ownership](../../docs/runner-foundation.md) for executable tooling.

## Autofix workflow

Let the configured formatter and import sorter apply their rules to the intended
files. Preserve unrelated work. Use the existing sorter for import order.

- Use only tooling published for this repository. Get user authorization before
  introducing new tooling.

## Readable code over comments

Write self-documenting code. Use comments for non-obvious business logic,
algorithmic decisions the code alone cannot explain, and temporary workarounds
that need context.

## Semantic whitespace

- Use blank lines to mark conceptually distinct parts of the code.
- Leave one blank line after guard clauses before the main execution path.
- Keep consecutive steps of one workflow together, including setup, derived
  values, branching and their related success effects.
- Add a blank line when the code changes responsibility or begins an
  independently meaningful phase. Consider extracting a focused helper when
  one function has many such phases.
- Apply the same grouping to changed functions, helpers and tests. Arrange,
  act and assert are common test phases. Check the grouping directly alongside
  formatter results.
- Keep consecutive request steps together, such as setting the busy flag,
  awaiting the request and applying its result. Keep changes within the affected
  scope and use the existing padding rules.

## Simplicity

- Solve the current task directly and avoid speculative abstractions.
- Keep starter-kit code generic and easy to replace.
- Keep error handling focused on reachable failures.
- Prefer straightforward repetition over premature abstraction.

## Static-analysis findings

- Review each SonarQube finding in its runtime context and identify the risk
  before editing.
- Prefer the simplest idiomatic correction that preserves readability, cohesion
  and type safety.
- Avoid wrappers, adapters, `bind` calls, indirection, duplicated state,
  placeholder branches or speculative abstractions introduced solely to silence
  analysis.
- Explain verified false positives and require explicit authorization for provider
  classification changes. Follow [check integrity](testing.md#coverage-and-check-integrity).
- Rerun the analyzer when available and review the resulting code on its own
  merits. Preserve maintainability when resolving a quality gate failure.

## No unused code

Remove demonstrably unused files, exports, dependencies, translations and routes
within scope. Verify cleanup with the affected checks in the
[validation manifest](../validation.json).

Preserve meaningful order under [ordering](ordering.md).
