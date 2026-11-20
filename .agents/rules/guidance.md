# Guidance and documentation

## Maintain documentation

Keep assistant instructions and maintained documentation in English, current and
organized by reader task. Update the owning guide alongside behavior,
configuration, test or workflow changes. Verify changed claims against the
owning source and nearby tests.

Procedures state prerequisites, actions, expected results and relevant recovery.
References define contracts. Explanations describe ownership and reasoning.

Do not add routine dated QA reports, archives, ADRs, translated companion guides
or bilingual navigation. Application localization remains a separate concern.

Keep human guides flat. Put each shared instruction in its owning rule and use
a section link where another workflow needs it. Follow the
[published inventory](../../.github/bootstrap-policy.json).

## Maintain indexes and optional integrations

Use repository-relative machine paths and document-relative Markdown links to
current files. Register only published owners, tests, rules, skills and actual
check IDs. Use admitted public source and synthetic fixtures for examples.
Follow the [fixture safety rules](safety.md#secrets-and-local-state).

The [validation manifest](../validation.json) owns commands and profiles.
Settings project that inventory. Refer to the manifest for the full gate and
keep prose free of a separate gate inventory or check count.

Optional adapters and hooks depend on actual host integration and remain
subject to the [safety rules](safety.md) and
[validation workflow](../skills/validate-change/SKILL.md#validate-the-exact-tree).

## Record evidence

Report execution outcomes and evidence limits in the current task or terminal.
Do not commit execution reports. Create a local report only when explicitly
requested, under ignored `test-results/`. Required coverage stays in its
configured location. Use the [working-checkout rule](branches.md#working-checkout)
for scratch exports and recovery files.

Static guidance checks verify published paths, local Markdown links and section
anchors, indexes and command consistency. Support claims about instruction loading, application behavior, provider results,
portability or performance with evidence from the relevant execution.

Record actual host-reported loading where available and otherwise mark discovery
unknown. Follow the [bounded evaluation procedure](../../docs/comprehension-evaluation.md)
when measuring comprehension. Keep prompts separate from scoring criteria and
use only allowlisted public source and synthetic fixtures. Require measured
evidence for claims of compatibility.
