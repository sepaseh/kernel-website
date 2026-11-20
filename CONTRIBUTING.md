# Contributing

Use the existing checkout and preserve unrelated tracked, staged and untracked
work. Read the [assistant entry point](AGENTS.md) and the
[Git workflow](.agents/rules/git.md). Check which files are admitted in the
[publication policy](.github/bootstrap-policy.json).

Use [Source navigation](docs/source-navigation.md) and
[matching rules](.agents/settings.json) to find the owner. The declared phase
owns its checks and guidance. Keep this project independent of other
repositories' source and workflows.

## Pull requests

### Publish and review

Verify the repository, current branch, status and intended base. Create or
reuse a focused `codex/<purpose>` branch. Keep changes to protected `main`
on a pull request.

Review the complete diff against the intended base. Aim for at most 80
changed-file entries. Count additions, deletions, renames and binaries,
with one entry per rename. Split independent changes and explain larger
cohesive changes.

File count is advisory. Exceeding 100 entries alone does not fail CI or
require recreating a PR.

Use a Conventional Commit title and the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
Explain the problem, resulting behavior, checked snapshot and material
limitations. A stacked PR targets its verified predecessor and states that
dependency.

Get user authorization before committing. Verify authorization separately for
pushes, PR changes, remote messages, review requests and merges.
After an authorized merge, reconcile descendants against actual `main` and
rerun full validation when proposed bytes change.

Apply [protected checks](docs/branch-protection.md) and
[review preflight](docs/reviews.md). Missing bootstrap checks remain blockers.
Publication leaves merge authorization and bootstrap requirements in force.
Keep genuine failures visible without passing placeholders.

## Checks

Use the Node version in [.nvmrc](.nvmrc) and the locked root dependencies.
Start with the smallest relevant check in the
[validation manifest](.agents/validation.json). Keep all required checks
active. Report actual commands, results and unavailable evidence.

Start with the affected owner tests. Before an authorized commit, push or PR
handoff, run all required checks on a
[fresh exact-tree export](docs/validation.md). Documentation changes use the same
full profile. Keep staging and committing pending if a required check fails or
cannot run.

## Documentation

Write maintained Markdown in English and organize it by reader task. Update
the owning guide when behavior, configuration, tests or workflows change. Use
the [documentation index](docs/README.md) to make guides discoverable. State
the prerequisites, actions, expected result and recovery where needed. Verify
commands against their source and use descriptive links to files and sections
in this repository. Use public synthetic examples.

Keep the root README focused on getting started and link to the relevant flat
guide in `docs/`. Use the [source map](docs/source-navigation.md) for exact
owners and tests. [GitHub README guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes) · [Google developer documentation style guide](https://developers.google.com/style/procedures)

Run `npm run check:guidance` and `npm run format:check` while editing Markdown.
Report QA in the task or terminal. Save an explicitly requested local report
under ignored `test-results/`. Keep private environments, existing services
and production data out of fixtures.

## Dependency maintenance

[Dependabot](.github/dependabot.yml) schedules weekly npm and GitHub Actions
version updates on Monday at 09:00 Asia/Tehran after this configuration is
published on the default branch. Minor and patch updates are grouped by production,
development and Actions dependencies; major updates remain separate. Limits are
10 npm PRs and 5 Actions PRs. Every update follows the ordinary checks, review
and merge authorization; the configuration does not enable automatic merging.
Security-update settings remain separate repository controls.

When updating npm packages manually, verify the peer and Node requirements for
the compatible set and update `package.json` and `package-lock.json` together.
Use `npm ci --strict-peer-deps` in the verification export and run the separate
dependency audit. Keep the lockfile's reviewed Playwright and Chromium pair
aligned with the visual baseline until a baseline update is authorized and
reviewed. [Browser tooling](docs/browser-foundation.md) · [Visual baselines](docs/visual-regression.md)
