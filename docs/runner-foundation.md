# Node runner reference

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

## Readiness and imports

The phase is `application` with `applicationReady: true`. Application
startup, test-server, fixture-launcher and analyzer entry points reject false
or invalid markers before reading operation configuration, resolving installed tools,
writing output or starting children. Imports perform none of those operations.
Never change the source marker just to run a command. [Browser tooling](browser-foundation.md)
adds authored typed scenarios and guarded configuration; its operation entry
points preserve the same readiness-first boundary.

The owner tests create disposable synthetic roots with explicit readiness
metadata to exercise the contracts below. Their stub executables and standalone
files are test fixtures. They do not themselves establish framework compatibility,
a real Next build, browser execution or an application readiness declaration.

## Owners and contracts

| Owner                                                                         | Contract                                                                                                                                                              |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [runner-process.mjs](../scripts/runner-process.mjs)                           | Starts and drains one owned direct child with validated arguments, working directory and explicit environment; reports spawn, exit, signal and cancellation failures. |
| [runner-inputs.mjs](../scripts/runner-inputs.mjs)                             | Checks readiness, rejects runtime dotenv presence without reading contents, validates public inputs and resolves installed Next plus the local HTTP fixture entry.    |
| [start-website.mjs](../scripts/start-website.mjs)                             | Validates website inputs, prepares guarded standalone files and awaits the owned server.                                                                              |
| [test-website-api.mjs](../scripts/test-website-api.mjs)                       | Starts the local test-only HTTP fixture with fresh in-memory state and a filtered environment, then drains its direct child.                                          |
| [test-website-server.mjs](../scripts/test-website-server.mjs)                 | Builds with verified Next, prepares standalone files and serves after success; explicit skip-build mode still requires a guarded build ID.                            |
| [analyze-website-performance.mjs](../scripts/analyze-website-performance.mjs) | Runs verified local Next analysis; only its export path exclusively creates bounded owned output and preserves unrelated files on failure.                            |

`resolveNextCli` checks the selected website's manifest, lock and installed
`node_modules/next` identity/version, then selects an unlinked local CLI. It has
no parent/global fallback. `resolveApiFixture` selects only this repository's
`scripts/website-api-fixture.mjs`. The launcher requires explicit synthetic
loopback inputs and gives the child test mode, the synthetic marker, its selected
API port and website origin. It performs no external source or dependency
verification. [The fixture contract](api-fixture.md) defines its synthetic scope.

## Inputs and process ownership

The analyzer's `--export` mode owns an exclusive `graph.jsonl`, limits it to
64 MiB and removes its claimed output on failure. The default `--output` mode
delegates output creation to Next; this wrapper does not bound or clean those
framework-owned files.

The process helper is called after its entry has checked readiness; it does not
own a source root. It owns only the direct child object it creates. Idempotent
stopping uses bounded termination/escalation and drains that child's close event;
signal listeners and timers are removed. It does not search global PIDs or
supervise descendants. Filesystem guards require physical unlinked roots and a
single writer; they do not make portable filesystem operations race-proof.

## Owner verification

Each listed script has a colocated `*.test.mjs` suite in measured governance
coverage. Cases execute disposable Node programs in explicitly owned synthetic
roots, test real lifecycle failures and cleanup, and verify that false readiness
prevents input reads and side effects. They do not change the source marker or
use existing APIs, private dotenv or operator state.

The [manifest](../.agents/validation.json) remains the command authority for the
full gate and split CI profiles. These owner suites extend its governance check;
they do not replace unit coverage, font verification or the other required
checks. See [testing](testing.md) and [exact-tree validation](validation.md).
