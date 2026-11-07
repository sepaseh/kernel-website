# Local synthetic HTTP fixture

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

Website browser checks run the real website against
[`scripts/website-api-fixture.mjs`](../scripts/website-api-fixture.mjs), a test-only
Node HTTP responder maintained in this repository. It supplies deterministic
settings and auth/account responses with fresh in-memory state. It is not a
production authentication service or evidence of external backend compatibility.

## Start the fixture

Install this website's declared dependencies with `npm ci --include=dev`, then set the
[explicit local inputs](development.md#set-explicit-local-inputs). Use distinct
free IPv4 loopback ports for the website and fixture, with indexing disabled.
No separate source checkout, dependency installation, database or credentials
is needed for the fixture.

```sh
node scripts/test-website-api.mjs
```

The launcher resolves the fixture from the website root. Its parent `PORT` stays
at the website port; the child port is derived from `API_BASE_URL`. The child
receives `NODE_ENV=test`, `KERNEL_SYNTHETIC_ENV=1`, its selected `PORT` and
`WEBSITE_URL`, with only approved runtime environment values. Supply no real
secret, database URL or storage setting.

Each process owns its in-memory accounts and sessions. The test OTP is `123456`.
Stopping the owned child discards its state. The launcher drains its direct child
and preserves operation/cleanup errors; it does not discover or stop other
services.

## Direct fixture and environment boundaries

The fixture itself has a separate test-only contract. Its import is inert;
explicit creation/startup requires `NODE_ENV=test`, `KERNEL_SYNTHETIC_ENV=1`, a
canonical nonzero TCP port and a synthetic website origin. Default binding is
`127.0.0.1` with an explicit HTTP loopback website port. The opt-in
`WEBSITE_FIXTURE_CONTAINER=1` mode binds `0.0.0.0` and requires the exact HTTPS
hostname `www.kernel.test` with an explicit port. That mode is a source contract,
not evidence of container execution or a delivered smoke runner.

The fixture does not read the application's readiness marker. Tests may start
it independently under its explicit synthetic inputs and must close the server
they create. The application-facing launcher adds the readiness gate and filters
the child's environment to its required public/test values and approved runtime
paths. Never use production accounts, an existing backend, secrets or operator
state as fixture data.

## Evidence boundaries

The [application contract](application.md) requires exact-tree production
build/bundle checks, real browser journeys against this local responder in both
CSP modes and compatible Windows visual comparison. The fixture supports frontend
acceptance; it does not verify production authentication, OTP delivery, persistence
or a developer-selected backend. Downstream integrations are application decisions.

Before authorized commit, push or handoff, freshly install Node and pinned Python
dependencies and pass the complete isolated
[validation procedure](validation.md). Source markers and historical images
cannot replace execution. Operational targets and production deployment require
separate authorization.
