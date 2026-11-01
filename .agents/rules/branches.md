# Branches

## Working checkout

Use the existing checkout. Creating another Git worktree, clone or copied
implementation checkout requires explicit user authorization, also for subagents.
A dirty checkout or an ordinary implementation/review request does not grant it.

Inspect branch, status, diffs and `git worktree list` before selecting a workspace.
Preserve unrelated tracked and untracked work. Keep repository-specific working
files in this checkout; disposable validation exports are verification fixtures,
not retained implementation workspaces.

Use `codex/<short-kebab-purpose>` unless the user requested an exact name.
Verify the actual base and reuse a suitable existing branch.
Preserve an unborn repository without inventing a commit.
Switch only when existing work is safe. Published branch renames/deletions and
history rewriting need explicit authorization.

Keep one PR open by default. An explicitly authorized stack may be published
in predecessor order before merges; protect every predecessor used as a base
and validate each exact head. Stack authorization grants no merge or bypass.
After an actual authorized merge, reconcile the stack against real main and
rerun full validation when proposed bytes change.
Branch preparation grants no commit or push permission.
Read [Git policy](git.md) and [safety](safety.md).
