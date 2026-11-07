# Website documentation

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

Choose the task you want to complete. This standalone website owns its source,
setup and tests. Local acceptance uses its own synthetic HTTP fixture; downstream
developers choose backend integrations.

## Run and develop

1. [Local development](development.md): install dependencies, select a disposable
   local HTTP fixture, build and open the website; follow the profile-feedback example
   through UI, wire types, translations and focused tests.
2. [Architecture](architecture.md): find feature, shared infrastructure and
   framework composition owners.
3. [Forms](forms.md) and [session](session.md): preserve submitted values,
   cancellation, account identity and stale-result behavior when changing a flow.
4. [Testing](testing.md): choose and place focused tests while editing.
5. [Validation](validation.md): export the proposed public bytes, install fresh
   Node/Python/browser dependencies and run complete acceptance for publication.

Use [troubleshooting](troubleshooting.md) when a command fails and
[source navigation](source-navigation.md) when you need an exact owner or test.
[Contributing](../CONTRIBUTING.md) covers commits, PR size and review.

## Build, install and maintain

- [Deployment](deployment.md): build and package a standalone release; review
  native and Docker installation requirements.
- [Release operations](release-operations.md): choose a manual operational task
  and follow its input, ownership and cleanup requirements.
- [Staging](staging.md): validate explicit target inputs, then run separately
  authorized smoke/staging checks with the matching installed browsers.
- [Releasing](releasing.md): version metadata and release workflow.
- [Branch protection](branch-protection.md) and [SonarQube](sonarqube.md): verify
  current-head checks and review prerequisites.

## Behavior and configuration references

| Topic                            | Read                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP and API compatibility       | [Server boundary](server-boundary.md), [API fixture](api-fixture.md), [request/document flow](client-document.md)                                               |
| UI and translated content        | [Design](../DESIGN.md), [client UI](client-ui.md), [localization](localization.md), [fonts](fonts.md)                                                           |
| SEO, security and privacy        | [SEO](seo.md), [CSP](website-csp.md), [threat model](threat-model.md), [authentication review](authentication-review.md), [security reviews](reviews.md)        |
| Browser quality                  | [Accessibility](accessibility.md), [visual regression](visual-regression.md), [website performance](website-performance.md)                                     |
| Application and runner internals | [Application composition](application.md), [runner foundation](runner-foundation.md), [browser foundation](browser-foundation.md), [source scope](bootstrap.md) |
| Change and failure investigation | [Change workflow](change-workflow.md), [test reliability](test-reliability.md)                                                                                  |
| Assistant tooling                | [Guidance](../.agents/README.md), [source understanding](ai-code-understanding.md), [evaluation](comprehension-evaluation.md)                                   |

The [canonical manifest](../.agents/validation.json) owns commands and profiles.
Keep guides in English and flat under `docs`. Report QA results in the task or
terminal; create a local report only when explicitly requested, under ignored
`test-results/`. Documentation contains current guidance rather than QA reports
or decision-record archives.
