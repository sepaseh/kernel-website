# Website assistant guidance

[AGENTS.md](../AGENTS.md) is the short entry point. [settings.json](settings.json)
indexes local rules, workflow skills and optional hooks. [navigation.json](navigation.json)
maps published owners, contracts and tests. [validation.json](validation.json) owns
commands, profiles and CI execution. [evaluation/cases.json](evaluation/cases.json)
supplies source-grounded questions and observable criteria.

This delivery-tooling phase preserves the non-runnable feature snapshot. The source has
local authentication/account forms and support modules; pages, a root layout, the
CSS pipeline, browser journeys and deployment remain future integration work.
Read [the phase guide](../docs/bootstrap.md) before selecting checks or claiming
readiness.

Visual work starts with [DESIGN.md](../DESIGN.md) and the
[canonical design skill](skills/design-ui/SKILL.md). The optional Claude memory
entry point and skill adapter reference this same local guidance. Repository
files do not prove host loading, native design-tool setup or model performance.

Assistant instructions, rules, skills and active evaluation prompts use English
only. Human documentation has complete English/Persian companions; it does not
add a second assistant policy layer.

Issue, branch, commit and review work starts with [Git policy](rules/git.md),
[branches](rules/branches.md) and the matching local skill. Preserve authorization
already provided by the user. Local preparation does not publish a branch or PR.
The complete canonical gate applies to the exact isolated proposed tree before
an authorized commit, push or PR handoff; a fast hook cannot replace it.

The four optional hooks require explicit host integration. The Bash safety
wrapper delegates its input and exit status to the Node guard and fails closed
when Node is unavailable. Other hooks have their own prerequisites. Checked-in
scripts and portable fixture tests do not establish all-client portability.

The Dependabot configuration keeps version-update PR limits at zero for both
package ecosystems. Publishing the file does not enable scheduled version-update
PRs; security-update settings are separate. Activation needs its own reviewed
change, consistent with the one-open-PR workflow.

Read [navigation](../docs/source-navigation.md),
[contribution and validation policy](../CONTRIBUTING.md),
[evaluation](../docs/comprehension-evaluation.md) and
[source ownership](../docs/adr/0005-independent-repositories.md).

The integration-tooling phase adds four independently tested quality helpers and three Node owner-test files while preserving the non-runnable product scope. [Testing](../docs/testing.md) and [validation](../docs/validation.md) explain their synthetic fixtures and actual evidence. Runtime launchers and browser activation remain deferred.

Delivery preparation adds owned artifact/configuration/target helpers and passive operator templates. [Delivery](../docs/deployment.md) and [operations](../docs/release-operations.md) define their synthetic evidence. Every core CLI gates on the unlinked public readiness marker; this source phase remains false with no bypass and no new build, service or operational provider workflow.
