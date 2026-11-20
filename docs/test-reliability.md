# Investigate unreliable tests

Investigate the first failure even when a rerun passes. Preserve the exact
command, runtime, platform, error output and synthetic fixture in use.

## Choose the event that proves readiness

Wait for the operation that establishes the asserted state. Observe its error
and early-exit paths alongside readiness.

| Test target         | Wait for                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| Owned child process | Its readiness message and the same child's completion or close event.  |
| HTTP response       | The consumer's stream demand, observable response or connection close. |
| UI update           | The awaited interaction and observable DOM state.                      |
| Timer or expiry     | A controlled clock advance, then the actual state transition.          |

Do not synchronize with arbitrary sleeps, fixed retry counts, timed keepalive
loops, empty microtask flushes or project-defined numeric test deadlines.
Drive cancellation and timer transitions directly when those behaviors are
under test. Follow the [runner process cases](../scripts/runner-process.test.mjs)
for readiness and cleanup and the [cooldown cases](../src/shared/hooks/use-cooldown.test.ts)
for timer transitions.

## Verify failure and cleanup

Drain only the direct child created by the fixture,
close listeners/streams and release resources before deleting owned files.
Report cleanup failures without hiding the original operation error.
Never delete unrelated resources or use existing services/private data.

A repeated green run does not fix a race. Correct the missing ownership or
completion signal and retain meaningful failure assertions.
Use [testing](testing.md) and [full validation](validation.md) for evidence limits.
