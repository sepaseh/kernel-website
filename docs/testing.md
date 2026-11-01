# Test repository governance

Read [source scope](bootstrap.md) and [the manifest](../.agents/validation.json).
The governance phase has nine actual required checks; run affected owner tests
while editing and the complete [exact-tree procedure](validation.md) before an
authorized commit, push or PR handoff.

The audit wrapper has a focused Vitest unit suite with its subprocess boundary
mocked; it does not contact the registry. Required online audit is separate.
Unit coverage remains 90% for all metrics. Node owner tests measure executable
governance helpers with 80% thresholds. Add no suppressions or source/rule/coverage
exclusions, fabricated coverage or metric-only wrappers.

Use colocated `*.test.mjs` owner suites and explicitly named integration cases
for agreement across owners. Fixtures use synthetic public data and disposable
resources owned by the test. Verify observable failures, original errors,
cancellation, API pagination/identity checks and cleanup.
Follow [test reliability](test-reliability.md).

A passed local suite proves only the exercised source. It does not establish
hosted CI, Sonar binding or CodeRabbit approval. This phase requires no
application server, browser, Python/font verification or external backend.
Report actual commands, first failures/skips and limits in the task or terminal.
