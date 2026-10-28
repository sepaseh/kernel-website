# Staging target contracts and future verification

[English](staging.md) · [فارسی](staging.fa.md)

[Pure target validators](../scripts/validate-workflow-targets.mjs) and [Node owner tests](../scripts/validate-workflow-targets.test.mjs) remain local contracts alongside the runnable application. Validation does not open a URL, resolve DNS, follow redirects or launch a browser/scanner. Guarded smoke/staging Playwright configurations and authored operation suites are published/type-checked, but external staging, deployment-smoke and DAST workflows and execution remain outside the application gate.

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

The complete fifteen-check [application gate](validation.md) requires owned local build, independent API/browser/CSP and visual evidence. It does not establish an external staging deployment or DAST result. Target-validator owner tests retain synthetic/local inputs and do not prove remote service identity. External target access and scanning require their own authorization; importing or testing these validators grants none. Read [operations](release-operations.md) and [security review](security/reviews.md).
