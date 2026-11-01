---
name: commit
description: Prepare an approved governance commit without implying push permission.
---

# Commit a focused change

Read [Git policy](../../rules/git.md), [commits](../../rules/commits.md),
[branches](../../rules/branches.md) and [safety](../../rules/safety.md).

1. Inspect repository identity, branch, status and relevant staged/unstaged diffs.
2. Define the coherent scope and preserve unrelated work.
3. Run [validate-change](../validate-change/SKILL.md) on the exact proposed tree.
4. Stage only approved paths after all required checks pass; inspect the staged diff.
5. Create a Conventional Commit only with user approval. Do not amend or infer push authorization.
6. Report the hash, subject, validation and remaining limits. Preparation-only work stays uncommitted.
