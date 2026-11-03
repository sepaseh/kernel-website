# Make asynchronous tests deterministic

Wait for the operation that establishes the asserted state: readiness messages,
response-stream demand, child completion, connection closure or an observable
UI update. Observe error and early-exit paths alongside readiness.

Do not synchronize with arbitrary sleeps, fixed retry counts, timed keepalive
loops, empty microtask flushes or project-defined numeric test deadlines.
Drive cancellation and timer transitions directly when those behaviors are
under test. Preserve actual operational bounds without waiting for wall time.

Keep ownership explicit. Drain only the direct child created by the fixture,
close listeners/streams and release resources before deleting owned files.
Report cleanup failures without hiding the original operation error.
Never delete unrelated resources or use existing services/private data.

A repeated green run does not fix a race. Correct the missing ownership or
completion signal and retain meaningful failure assertions.
Use [testing](testing.md) and [full validation](validation.md) for evidence limits.
