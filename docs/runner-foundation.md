# Node runner reference

Use this reference when changing launcher inputs, process ownership or analysis
output. Follow [local development](development.md) to start the website and
[API fixture](api-fixture.md).

## Readiness and imports

The phase is `operations` with `applicationReady: true`. Application
startup, test-server, fixture-launcher and analyzer entry points reject false
or invalid markers before reading operation configuration, resolving installed tools,
writing output or starting children. Imports perform none of those operations.
Never change the source marker just to run a command. [Browser tooling](browser-foundation.md)
adds authored typed scenarios and guarded configuration; its operation entry
points preserve the same readiness-first boundary.

## Owners and contracts

| Owner                                                                         | Contract                                                                                                                                                              |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [runner-process.mjs](../scripts/runner-process.mjs)                           | Starts and drains one owned direct child with validated arguments, working directory and explicit environment; reports spawn, exit, signal and cancellation failures. |
| [runner-inputs.mjs](../scripts/runner-inputs.mjs)                             | Checks readiness, rejects runtime dotenv presence without reading contents, validates public inputs and resolves installed Next plus the local HTTP fixture entry.    |
| [start-website.mjs](../scripts/start-website.mjs)                             | Validates website inputs, prepares guarded standalone files and awaits the owned server.                                                                              |
| [test-website-api.mjs](../scripts/test-website-api.mjs)                       | Starts the local test-only HTTP fixture with fresh in-memory state and a filtered environment, then drains its direct child.                                          |
| [test-website-server.mjs](../scripts/test-website-server.mjs)                 | Builds with verified Next and prepares standalone files. Explicit skip-build mode verifies the existing source, environment, toolchain and prepared output.           |
| [analyze-website-performance.mjs](../scripts/analyze-website-performance.mjs) | Runs verified local Next analysis; only its export path exclusively creates bounded owned output and preserves unrelated files on failure.                            |

`resolveNextCli` checks the selected website's manifest, lock and installed
`node_modules/next` identity/version, then selects an unlinked local CLI. It has
no parent/global fallback. `resolveApiFixture` selects only this repository's
`scripts/website-api-fixture.mjs`. The launcher requires explicit synthetic
loopback inputs and gives the child test mode, the synthetic marker, its selected
API port and website origin. It performs no external source or dependency
verification. [The fixture contract](api-fixture.md) defines its synthetic scope.

## Inputs and process ownership

Website inputs supply production `NODE_ENV`, `API_BASE_URL`, `HOSTNAME` and
`PORT`, plus the applicable public website/indexing/CSP settings. Child
environments contain only declared public values and allowlisted runtime
essentials; credentials, `NODE_OPTIONS` and unrelated ambient values are omitted.
Synthetic inputs require distinct `http://127.0.0.1:PORT` origins, matching website
host/port and explicitly disabled indexing. There is no default API or dotenv
fallback. The API launcher derives its child port while retaining website-origin
parent settings; [browser configuration](browser-foundation.md) adds the SDK
parent-environment boundary.

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

Run the changed owner's colocated `*.test.mjs` suite first. For a runner input
or lifecycle change, run:

```sh
node --test scripts/runner-inputs.test.mjs scripts/runner-process.test.mjs
```

Confirm that false readiness stops each guarded entry before input reads and
side effects. Verify the original failure, owned process completion and cleanup
in disposable synthetic roots. Keep the real source marker and operator state
out of the fixture.

The [manifest](../.agents/validation.json) includes these suites in measured
governance coverage. Follow [exact-tree validation](validation.md) for the
complete production build and browser checks. See [operations](release-operations.md)
for Docker, Lighthouse and external targets.
