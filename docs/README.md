# Website documentation

[English](README.md) · [فارسی](README.fa.md)

The published `application-guidance` phase retains `applicationReady:false`, the
independent API fixture prerequisite and the same sixty-six production modules.
Start with the [phase guide](bootstrap.md) for the current inventory and eleven
required checks. The [application contract](application.md) describes the future
runnable integration and its acceptance conditions; publishing that contract does
not activate routes, CSS, a browser, delivery or additional provider workflows.

| Area                                   | Guide                                                                                                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current setup and source ownership     | [README](../README.md), [architecture](architecture.md), [navigation](source-navigation.md), [ADRs](adr/README.md)                                                                      |
| Future application integration         | [Application acceptance](application.md), [SEO contract](seo.md)                                                                                                                        |
| Local forms and session behavior       | [Forms](forms.md), [session](session.md), [client UI](client-ui.md)                                                                                                                     |
| API and server boundaries              | [API fixture](api-fixture.md), [server boundary](server-boundary.md), [client/document support](client-document.md)                                                                     |
| Design and languages                   | [Design](../DESIGN.md), [design skill](../.agents/skills/design-ui/SKILL.md), [localization](localization.md), [fonts](fonts.md)                                                        |
| Validation and evidence                | [Validation](validation.md), [testing](testing.md), [test reliability](test-reliability.md), [change workflow](change-workflow.md)                                                      |
| Browser and presentation prerequisites | [Browser foundation](browser-foundation.md), [runner foundation](runner-foundation.md), [accessibility](accessibility.md), [visual regression](visual-regression.md)                    |
| Security and privacy                   | [CSP](website-csp.md), [threat model](security/threat-model.md), [authentication](security/authentication-review.md), [security reviews](security/reviews.md), [policy](../SECURITY.md) |
| Performance                            | [Website performance](website-performance.md)                                                                                                                                           |
| Delivery preparation and operations    | [Deployment](deployment.md), [staging](staging.md), [release operations](release-operations.md), [versioning](releasing.md), [branch protection](branch-protection.md)                  |
| Analysis and assistant guidance        | [SonarQube](sonarqube.md), [instructions](../.agents/README.md), [source understanding](ai-code-understanding.md), [evaluation](comprehension-evaluation.md)                            |

Commands and gate ownership come from the
[canonical validation manifest](../.agents/validation.json). Human-facing English
guides have complete Persian companions; assistant instructions and skills remain
English-only. Authored browser suites, passive operator templates and local Node
fixtures establish only their documented scope.

## Dated evidence and original source

These records retain their original dates and findings. They describe the source
and checks recorded then, including paths whose runnable integration may still be
unpublished. They do not certify the current snapshot, current browser pixels,
provider setup or deployment. Use the current guides above for present acceptance.

- [Independent website verification](qa/independent-website-verification.md)
- [Requirements assessment, 24 October 2026](qa/requirements-audit-2026-10-24.md)
- [Topic dispositions, 24 October 2026](qa/roadmap-status-2026-10-24.md),
  [recorded JSON](qa/roadmap-status-2026-10-24.json)
- [Source comprehension, 24 October 2026](qa/source-comprehension-2026-10-24.md)
- [Standalone layout, 24 October 2026](qa/standalone-layout-2026-10-24.md)
- [Original Vitest tooling configuration](qa/source-originals/vitest.tooling.config.ts)

The archived Vitest file is preserved source history under `docs/qa/source-originals/`.
It is not an active root configuration, a registered validation command or an
invitation to execute archived source. The published configuration and measured
governance suite remain the current owners.
