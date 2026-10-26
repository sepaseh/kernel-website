# Kernel Website foundation instructions

Read [README](README.md), [Contributing](CONTRIBUTING.md), the [phase guide](docs/bootstrap.md), [validation manifest](.agents/validation.json) and [snapshot policy](.github/bootstrap-policy.json) before changes.

This standalone TypeScript foundation owns pure wire definitions, form-input helpers, API-origin validation and public-settings language loading. Its ten production modules have only local production imports. Keep the source closure explicit; no runtime dependencies, React/Next implementation, UI, browser fixtures or deployment are included. applicationReady remains false. Never import another checkout or add workspaces/local-package links.

Preserve API-owned active-language and direction authority, no-store settings reads, safe origins, password whitespace and normalized mobile digits. Use synthetic tests; never load real dotenv, credentials, DB/storage or existing services. Vitest uses Node and envDir:false.

The canonical full phase gate is npm run validate -- full after npm ci. It must pass on the exact isolated snapshot before an authorized commit, push or PR handoff. Never substitute primary-checkout results, omit failures or fabricate coverage. Keep each PR at 100 or fewer GitHub changed-file entries.

Preserve unrelated work. Git/remote mutations and provider comments require explicit authorization. Use codex/ branches and Conventional Commit titles. Follow the native CI/CodeRabbit/Sonar review process; no custom approval publisher is used. Existing app build/e2e/visual requirements remain unsatisfied until real runnable implementation and evidence exist.

Assistant instructions are English only. Human docs keep complete English/Persian companions and reciprocal links. A later runnable phase requires the full application build, HTTP/auth integration, browser/CSP, accessibility and reviewed visual checks with a separately installed synthetic API fixture. Foundation checks do not establish application readiness.
