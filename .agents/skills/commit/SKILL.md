---
name: commit
description: Prepare a coherent website commit or commit message, stage explicitly requested files, or create a commit when the user requests it. Use at the Git commit boundary, not as permission to push or rewrite history.
---

# Commit website changes

Read [Git workflow](../../rules/git.md), [commit policy](../../rules/commits.md),
[branches](../../rules/branches.md) and [safety](../../rules/safety.md).

1. Inspect the current branch, status, relevant working-tree and staged diffs,
   and available history. Identify pre-existing work and any unborn repository.
2. Define one coherent scope without discarding, rewriting or silently staging
   unrelated user changes. Preparation or message requests remain local drafts.
3. Before an authorized commit, run the final tree's full canonical profile
   through [validate-change](../validate-change/SKILL.md). Resolve clear safe
   in-scope failures and rerun affected checks; disclose unresolved failures.
4. Stage only explicitly scoped paths when staging is authorized, then inspect
   the staged diff for accidental files, sensitive data and generated output.
5. Create a Conventional Commit only when the commit itself was requested and
   every required check passed. Do not amend, rebase or infer push authorization.
6. Report the hash, subject and executed validation. For preparation-only work,
   return the proposed scope/message and any readiness limits without committing.
