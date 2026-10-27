# Repository guidance and evidence

Read this rule when changing instructions, navigation, validation policy, ADRs or
comprehension evaluation. Keep repository guidance assistant-neutral. Optional
assistants, host integration and design tools are not runtime dependencies.

## Canonical sources

- Observable HTTP behavior: the API-owned Bruno collection, local wire DTOs,
  owning-service routes and consumer/provider tests. Frontend repositories keep
  their own HTTP integration evidence; the Bruno collection and backend routes
  belong to the API repository.
- Runtime ownership: source, composition and executable boundary checks.
- Validation commands/profiles: `.agents/validation.json`. Other command lists are
  links or checked projections, never independent definitions of a complete gate.
- Task navigation: `.agents/navigation.json`; the readable guide is
  `docs/source-navigation.md`. Open owners and contracts, not just the map.
- Decisions: `docs/adr/`; record consequences and supersession, not copied source.
- Evaluation: `.agents/evaluation/cases.json` and `docs/comprehension-evaluation.md`.

When a document conflicts with current behavior, verify source and contracts,
correct the active explanation and preserve dated historical evidence as historical.
Never describe a proposed tool, template or past test as a current executed result.

## Progressive reading and verification

Root and scoped `AGENTS.md` files are short entry points that link canonical rules.
Active assistant instructions, rules and skills use English only; do not create
Persian assistant guides or adjacent skill translations. Existing bilingual human
documentation stays separate and does not add an assistant instruction layer.
`.agents/settings.json` inventories guidance; it does not register itself with every
assistant. Optional hooks are host-dependent fast checks, not a full validation gate.
Requested thin host entrypoints may reference canonical local instructions, including the
Claude memory and skill adapters. Keep business rules in their canonical source,
without copied host-specific policy. Do not add installers, plugins or remote
services merely for discovery; document actual host capabilities and loading limits.

Keep navigation paths relative to the repository root and maintained Markdown links
relative to their file. Prefer symbol/path references over fragile line numbers in
living navigation; cite verified lines in actual task evidence. Update renamed paths,
affected tests and relevant human documentation in the same change.

The guidance checker can verify paths, indexes and command consistency. It cannot
prove that an assistant loaded instructions, that a semantic graph is complete, or
that the linked explanation remains factually correct. Record host-reported loaded
files where available; otherwise mark discovery unknown and follow the manual probe.

Use only synthetic disposable fixtures. Do not read real environments, credentials,
ignored databases or object stores to answer comprehension questions. Do not claim
all-client portability or improved agent performance without measured evidence.

## Project ownership

This project owns its local contracts, catalogs and maintained documentation. Coordinate HTTP compatibility with affected consumers. Read ADR 0005 for source ownership. Active guidance uses local source and canonical checks; a dated assessment certifies only its recorded scope, never the current working tree automatically.

## Change acceptance and test failures

Use the [change handoff and implementation plan](../../docs/change-workflow.md) to distinguish required behavior, proposals and provider-dependent work, and link observable acceptance scenarios to the canonical checks. Follow [testing](testing.md) to record ownership, first failures, reproduction and actual completion evidence. These are portable workflows, not automatic assistant discovery, flaky-test detection or permission to weaken a required gate.
