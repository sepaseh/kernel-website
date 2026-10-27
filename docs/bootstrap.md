# Client/document publication phase

[English](bootstrap.md) · [فارسی](bootstrap.fa.md)

This non-runnable publication contains thirty-seven production modules, fifteen source test files and an exact 111-file maintained inventory. The [policy](../.github/bootstrap-policy.json) enforces applicationReady:false, complete source closure and no private paths or symlinks. Only ordinary root node_modules and coverage outputs are ignored. A PR changes at most 100 GitHub file entries; inventory size is independent.

The [client/document guide](client-document.md), [fonts](fonts.md), [localization](localization.md) and [server boundary](server-boundary.md) describe ownership. Next.js supplies erased framework types; actual next-intl tests exercise ICU. No src/app, server-only request adapter, UI, entry point, browser fixture or deployment is present.

The [canonical manifest](../.agents/validation.json) has ten required checks: snapshot, semantic CI policy, audit, source boundaries, types, lint, formatting, measured unit tests, measured governance tests and real font integrity. Run npm ci, install [pinned Python requirements](../font-source/requirements.txt) under Python3.14.4, then npm run validate -- full before every authorized commit/push/handoff on the exact isolated tree.

Every PR, including drafts, runs that complete profile without changed-path filtering. The runner rejects duplicate IDs, omitted required checks and manual/advisory entries before executing commands. CI requires unconditional root npm installation and full execution plus pinned Python setup/dependency installation. The scanner must generate real Python font coverage before analysis; semantic tests reject missing, conditional, reordered or advisory steps.

Unit thresholds remain 90% for statements, branches, functions and lines. Governance thresholds remain 80% for lines, functions and branches. Font tooling has measured branch/line coverage and an 80% combined required minimum. Actual reports are coverage/unit/lcov.info, coverage/governance/lcov.info and coverage/fonts/coverage.xml. Do not commit or fabricate them.

Native [branch protection](branch-protection.md) still requires check, trusted PR file limit, SonarQube Cloud analysis, SonarCloud Code Analysis and CodeRabbit. The target size guard executes only its immutable workflow checkout with read-only permissions. Keep strict/up-to-date checks, current approval, resolved conversations and administrator enforcement.

Request CodeRabbit only after the [exact-head zero-issue preflight](sonarqube.md#before-requesting-coderabbit), the repository cooldown and no in-flight duplicate. Automatic review remains disabled. A skipped result is not substantive review evidence.

Before any runnable-app merge, publish all fifteen application checks with independently installed synthetic API fixtures, observe real build/e2e/visual jobs pass and require them. Current tests establish no Next.js rendering, browser, accessibility, visual or deployment readiness.
