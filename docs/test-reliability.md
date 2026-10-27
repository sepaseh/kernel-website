# Test reliability and failure ownership

[English](test-reliability.md) · [فارسی](test-reliability.fa.md)

This is a failure-investigation workflow, not an automatic flaky-test detector or
proof that every test is stable. The [current phase](bootstrap.md) measures local
product/tooling behavior with synthetic inputs; it does not imply browser,
deployment or production results.

Preserve the first failure and exact source, command, runtime, operating system,
locale, configuration and input. A failure followed by a pass needs investigation.
Distinguish a product race, missing test synchronization, resource leak and an
unavailable dependency before changing assertions.

## Investigation record

```text
Test file / case / owner:
First observed date / exact source / command:
Runtime / OS / locale / clock / concurrency / synthetic fixture:
First failure artifact and reproduction:
All observed failure and pass counts:
Cause or bounded hypothesis:
Correction and regression evidence:
Issue or local record / next review date:
Any explicitly authorized exception: scope / reason / owner / expiry:
```

Wait for the observable operation being asserted, not arbitrary sleeps or an
empty asynchronous flush. Resolving fetch headers need not finish response-body
processing or navigation. Preserve exact request counts, password whitespace,
stale-result protection and meaningful negative assertions. Rerunning until
green, increasing retries or weakening an assertion does not explain a failure.

Do not hide failures, skip required cases, use continue-on-error or refresh
screenshots to conceal defects. A proposed temporary exception needs exact scope,
evidence, an owner and review/expiry dates; this guide grants no exception or gate
waiver. Security, session, authorization and data-loss failures remain blocking
under the existing policy.

Recheck original conditions after a fix, then run relevant [canonical checks](validation.md).
Report unexecuted/unavailable work separately from passes. Clean only owned
temporary paths, locks, listeners and child resources. Verify ownership before
removing leftovers after interruption; never clear operator data or another
project's resources. Future browser/Docker lifecycle checks need their own
published tools and actual evidence. Dated research/source archives remain history.
