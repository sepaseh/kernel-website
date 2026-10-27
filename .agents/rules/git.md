# Git Workflow

Read this router for issue, branch, commit, pull-request or review work, along
with [safety](safety.md). The user's request and current repository evidence
determine the authorized action.

| Topic                             | Canonical policy or workflow                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Branch selection and lifecycle    | [Branches](branches.md)                                                                                             |
| Commit content and history        | [Commits](commits.md), [commit workflow](../skills/commit/SKILL.md)                                                 |
| Issue evidence and implementation | [Issues](issues.md), [start-issue](../skills/start-issue/SKILL.md), [create-issue](../skills/create-issue/SKILL.md) |
| Pull requests and review          | [Pull requests](pull-requests.md), [code review](code-review.md)                                                    |
| Required checks                   | [Validation manifest](../validation.json), [contribution and phase policy](../../CONTRIBUTING.md)                   |

Establish branch/status and the relevant complete diff before acting. Preserve
unrelated tracked/untracked work, including an unborn repository. Link related
artifacts rather than repeating conversation history. Inspect relevant authorized
metadata through the actual origin host and available tools; do not guess issue
state, labels, templates, repository identity or base branch.

## Before committing

1. Run `git status`.
2. Review the relevant `git diff`.
3. Run every required check in the `full` profile of
   [the canonical manifest](../validation.json), following
   [Contributing](../../CONTRIBUTING.md). The manifest is shared
   with CI and the checked `settings.json` projection; do not maintain another
   complete command list here.

4. Do not stage or create a commit when any required check fails or cannot run.
   Correct safe in-scope failures and rerun the affected checks. Report unresolved
   blockers; never infer permission for a check bypass.
5. Stage only the files that belong to the requested change.
6. Use a concise commit message with a first line under 72 characters.

## Rules

- Do not commit unless the user explicitly asks.
- Do not push unless the user explicitly asks.
- Avoid `git add .` or `git add -A` unless the user asks for a broad commit.
- Never commit `.env`, credentials, build output, or local-only settings.
- Never use `--no-verify` unless the user explicitly asks.
- Never force-push to `main` or `master`.
- Do not add AI co-author trailers unless the user asks for one.
- One action does not authorize another: preparation does not publish, starting
  an issue does not assign/comment, and a commit does not authorize a push.
  Remote issue/review/PR updates and published branch changes need authorization
  for their actual effect. Preserve explicit authorization already given;
  do not ask again when the requested workflow already authorizes the action.
- Keep one website PR open at a time. Prepare a later package locally while the
  current PR is open; publish it only after the current PR is actually merged
  and the user has authorized that publication. Reconcile against actual main
  and rerun the full gate if the tested tree changes.
