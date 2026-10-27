# Code review

Review the issue/acceptance criteria, pull-request description, complete diff and relevant tests before
judging a change. Passing automation is evidence, not proof.

## Priorities

- `P0`: immediate security exposure, irreversible data loss, or system-wide outage.
- `P1`: likely serious regression, authorization failure, or broken critical workflow.
- `P2`: localized correctness, reliability, accessibility, performance, or maintainability defect.
- `P3`: low-risk improvement worth addressing but not blocking the change.

## Findings

Lead with actionable findings ordered by priority. Each finding includes a tight
file and line location, failure scenario, impact, reason the diff permits it,
and a concise fix direction. Keep questions and suggestions separate from
defects.

Check affected behavior, security, HTTP contract alignment, state lifecycle,
failure-path tests, accessibility, localization, visible UI evidence, and the
documentation map. If no finding remains, say so and disclose checks not run.

Apply [semantic whitespace](code-quality.md) to changed functions, handlers,
hooks and tests. Report only a concrete defect or relevant changed-phase issue;
do not turn unchanged padding or style preferences into fabricated regressions.
