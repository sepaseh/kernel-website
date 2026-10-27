# Commits

Use Conventional Commit subjects:

```text
<type>[(scope)][!]: <description>
```

Allowed types are `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`,
`refactor`, `revert`, and `test`.

- Use a lowercase kebab-case scope only when it adds stable context.
- Use an imperative description without a trailing period.
- Keep the complete subject at 72 characters or fewer.
- Use `!` only for an actual incompatible change.
- Add a body for a non-obvious reason or trade-off and a related-work footer
  only when it adds useful context. Do not manufacture a breaking-change claim.
- Do not commit when a required check fails.
- Do not amend or rewrite history without explicit authorization.

Follow [Git workflow](git.md) and [the commit skill](../skills/commit/SKILL.md):
the full canonical profile applies to the final tree before every authorized
commit. Review explicit staged paths and their diff; a faster subset or remote
CI does not replace that gate.
