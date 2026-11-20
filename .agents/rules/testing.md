# Testing

## Choose checks

Start with the smallest declared check that covers the changed behavior. Select
commands from the [validation manifest](../validation.json).

Use the [validation workflow](../skills/validate-change/SKILL.md) to choose
and run the required checks.

## Design synthetic tests

Use [synthetic fixtures](safety.md#secrets-and-local-state) and disposable
resources owned by the test. Exercise observable success and failure.

Keep focused tests beside their owner and cross-owner cases explicitly named
as integration tests. Cover cancellation, original error identity and cleanup
through observable behavior.

## Synchronize with actual events

Synchronize with observable readiness, completion, errors and close events. Use
controlled clocks for timing behavior and explicit cancellation for interrupted
work. Preserve the first operation failure and any cleanup failures.

Do not add arbitrary sleeps, timed keepalive loops, retry counts, empty
microtask flushes or project-defined test deadlines to hide races.
Observe failure as well as readiness so an early exit cannot leave a test pending.

See [test reliability](../../docs/test-reliability.md) for diagnosing failures.

## Coverage and check integrity

Keep unit coverage at 90% and governance coverage at 80%. Keep all executable
tooling measured. Preserve assertions and measured source and rule scopes.
Do not suppress findings, weaken required checks or add source, rule or
coverage exclusions. Report failures, skips and evidence limits under the
[evidence rules](guidance.md#record-evidence).
