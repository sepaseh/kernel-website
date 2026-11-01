# Testing

Read [the source policy](../../.github/bootstrap-policy.json) and
[canonical manifest](../validation.json) for the actual governance scope.
Start with the affected owner test; all nine checks run through
[exact-tree validation](../../docs/validation.md) before authorized publication.

Keep focused tests beside their owner and cross-owner cases explicitly named
as integration tests. Use synthetic data and owned disposable resources.
Exercise observable success, failure, cancellation, original error identity
and cleanup, rather than mirroring an implementation.

Synchronize with actual readiness, stream demand, completion and close/error
events. Use controlled clocks/cancellation for timing behavior.
Do not add arbitrary sleeps, timed keepalive loops, retry counts, empty
microtask flushes or project-defined test deadlines to hide races.
Observe failure as well as readiness so an early exit cannot leave a test pending.

Keep run-audit unit coverage at 90% and governance coverage at 80%.
All executable tooling remains measured; add no suppressions or exclusions.
Report failures/skips and evidence limits honestly.
See [test reliability](../../docs/test-reliability.md).
