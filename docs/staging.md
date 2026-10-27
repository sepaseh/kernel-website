# Staging target contracts and future verification

[English](staging.md) · [فارسی](staging.fa.md)

The non-runnable **delivery-tooling** phase publishes
[pure target validators](../scripts/validate-workflow-targets.mjs) and
[Node owner tests](../scripts/validate-workflow-targets.test.mjs). Validation does
not open a URL, resolve DNS, follow redirects or launch a browser/scanner. No
staging, deployment-smoke or DAST workflow, Playwright configuration or operations
browser suite is activated in this snapshot.

Staging requires explicit application/API target URLs and their exact configured
allowed hostnames. Smoke uses its own named inputs and additionally requires equal
nonempty deployment and expected-deployment IDs. DAST requires an explicit target,
an allowed hostname and a separate production hostname to deny. URL parsing rejects
credentials, non-HTTP(S) schemes and malformed/control-character inputs. These
contracts do not make allowlists trustworthy or prevent a production alias, DNS
change or downstream redirect. Operator review and runtime controls must address
those cases before any request.

Future verification needs a separately authorized, genuinely non-production target,
an identified deployed artifact, synthetic data policy and independently installed
compatible browser/API fixtures. Verify actual public routes, assets/fonts,
noindex, CSP modes, health responses and the release marker if implemented. Record
the exact build, browser/platform, target and actual failures. A syntactically
valid target or matching input IDs is not proof of the remote service's identity.
Staging noindex is indexing policy, never access control.

The current eleven-check [validation gate](validation.md) uses synthetic/local
evidence and remains required. It supplies no browser, real cookie/session,
deployment or DAST result. External target access and scanning need their own
authorization; importing or testing these validators grants none. Read
[operations](release-operations.md) and [security review](security/reviews.md).
