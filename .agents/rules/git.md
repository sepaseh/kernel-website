# Git workflow

Read [safety](safety.md) before changing Git state or a remote system.

| Topic                        | Canonical guidance                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Branch naming and lifecycle  | [Branches](branches.md)                                                                 |
| Commit preparation and title | [Commit workflow](../skills/commit/SKILL.md) and [commit titles](commits.md)            |
| Issue quality and startup    | [Issues](issues.md), [start-issue](../skills/start-issue/SKILL.md)                      |
| Pull requests and review     | [Pull requests](pull-requests.md), [code review](code-review.md)                        |
| Checks and handoff           | [Validation](../../docs/validation.md), [change handoff](../../docs/change-workflow.md) |

## Establish context

Check the repository, branch, status and relevant diffs before acting. Preserve
unrelated tracked, staged and untracked work. Verify remote metadata with
authorized tools. Report observed facts, inferences and access limits separately.
Follow the [working-checkout rule](branches.md#working-checkout).

## Before committing

Follow the [commit workflow](../skills/commit/SKILL.md) for scope, exact-tree
validation and staged-diff review.

## Rules

- Check [authorization](safety.md#authorization) before acting.
- Keep `.env`, credentials, build output and local-only settings out of commits.
- Use `git add .` or `git add -A` only if the user requests a broad commit.
- Use `--no-verify` only when the user explicitly authorizes skipping optional
  hooks. Required checks still apply.
- Add AI co-author trailers only at the user's request.
