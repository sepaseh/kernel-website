# Local synthetic HTTP fixture

Website browser checks run the real website against
the [synthetic HTTP responder](../scripts/website-api-fixture.mjs). Each run
starts with fresh in-memory settings, accounts, sessions, blog posts and FAQs.
Contact submissions are stored in memory for the lifetime of that run.

## Start the fixture

Install this website's declared dependencies with `npm ci --include=dev`, then set the
[explicit local inputs](development.md#set-explicit-local-inputs). Use distinct
free IPv4 loopback ports for the website and fixture, with indexing disabled.
No separate source checkout, dependency installation, database or credentials
is needed for the fixture.

```sh
node scripts/test-website-api.mjs
```

Wait for `Owned website HTTP test fixture is listening.` before requesting the
website. The launcher resolves the fixture from the website root. Its parent `PORT` stays
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
hostname `www.kernel.test` with an explicit port. The
[disposable Docker smoke runner](../scripts/run-docker-smoke.mjs) owns that setup.

The fixture does not read the application's readiness marker. Tests may start
it independently under its explicit synthetic inputs and must close the server
they create. The application-facing launcher adds the readiness gate and filters
the child's environment to its required public/test values and approved runtime
paths. Never use production accounts, an existing backend, secrets or operator
state as fixture data.

## Feature data and test operations

The FAQ fixture seeds twenty-one active plain-text questions and one inactive
record. Public queries allow only bounded offset/size and return four-field active
projections ordered by sort and UUID. Administrator-only edits support public
visibility, atomic-invalid-edit and long-token browser checks; they do not replace
the real API's independent permission and database contracts. See [FAQ](faq.md).

The blog fixture seeds thirteen published articles and an unpublished working
draft. It provides public offset pagination, category reads, sitemap projections,
and administrator-only preview capabilities and publish/unpublish operations.
Capabilities expire after five minutes and require the issuing session to remain
live. These are synthetic frontend acceptance contracts, not a production CMS.

The anonymous contact responder accepts exactly three required plain-text fields,
normalizes Iranian mobile digits, and models UUID-keyed 24-hour replay, conflict
and bounded quotas. Its receipt excludes personal input. An administrator-only
in-memory inbox read lets the browser assert that an uncertain retry created one
message. These disposable records do not establish real API persistence or its
management permissions; see the [contact contract](contact.md).

Run the fixture through the normal browser runner when checking the real website,
and use the [exact-tree validation procedure](validation.md) for publication
evidence. Verify production authentication, OTP delivery and persistence against
the selected backend in a separately authorized integration environment.
