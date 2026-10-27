# Branches

Use a short, stable name that describes the work. Follow an exact name requested
by the user; otherwise use `codex/<short-kebab-purpose>`, optionally including a
verified issue number, such as `codex/42-fix-session-race`. Do not encode mutable
priority or assignee metadata.

- Inspect the current branch, relevant changes and available base before changing
  branches. Verify the intended base from repository evidence; do not assume main.
- Reuse a branch that already represents the requested work. Preserve unrelated
  tracked and untracked changes; do not switch when it would overwrite or mix them.
- If the repository has no commits, preserve its unborn branch and untracked
  source. Do not create a commit or invent a base merely to satisfy this workflow.
- Start authorized publication on an appropriate branch rather than committing
  directly to a protected base. A request for local preparation does not require
  creating a branch, commit or additional worktree. Reuse the single website
  checkout and prepare a later package in an isolated export while a PR is open.
  Branch preparation does not authorize a commit or push.
- Renaming or deleting a published branch, or rewriting history, requires an
  explicit request and coordination with any existing review request.

Read [Git workflow](git.md), [commit policy](commits.md) and [safety](safety.md).
