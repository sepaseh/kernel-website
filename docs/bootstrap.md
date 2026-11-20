# Understand this publication

The publication phase is **operations** and application readiness is **true**.
The [source policy](../.github/bootstrap-policy.json) lists the admitted files.
Keep one independently installable website package with its own setup,
contracts and fixtures.

## Published source

- Routes, shell, providers and HTTP adapters for Home, authentication and
  accounts. [Application composition](application.md)
- Public articles, archives and private preview, native FAQ disclosures and
  anonymous contact submissions. [Blog](blog.md), [FAQ](faq.md) and [contact](contact.md)
- Ten local catalogs, API-selected language, direction and calendar, and
  licensed self-hosted fonts. [Localization](localization.md) and [font integrity](fonts.md)
- SEO, CSP and optional Web Vitals delivery. [SEO](seo.md), [CSP](website-csp.md)
  and [website performance](website-performance.md)
- Guarded Node and browser runners, a disposable in-memory HTTP fixture,
  typed browser suites and reviewed Windows visual baselines.
  [Runner contracts](runner-foundation.md), [fixture](api-fixture.md) and
  [visual regression](visual-regression.md)
- Standalone build preparation, packaging, deployment templates and manual
  release, package, staging, deployment-smoke and DAST workflows on `main`.
  [Deployment](deployment.md) and [release operations](release-operations.md)

## Verify the proposed source

Run the canonical `full` profile on a fresh verification-only export of the
proposed source. It exercises the local HTTP fixture and verified browser and
uses the pinned Python tooling to regenerate font subsets in memory and measure
coverage. Use the [check manifest](../.agents/validation.json) and
[validation procedure](validation.md).

Manual package, smoke, staging and Docker checks and advisory Lighthouse
sampling have separate inputs, authorization and execution evidence. See
[release operations](release-operations.md).

Apply [branch protection](branch-protection.md) throughout an authorized PR
stack. Missing trusted default-branch checks still block merge.
