# Website imports and source boundaries

Read the current [source scope](../../docs/bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

Use ./ for same-directory modules and @/ for source across directories. @/ resolves to this root src/ only. Framework configuration/tooling and pure catalog modules may use explicit relative paths. Keep feature behavior near its feature and public feature exports intentional. Shared frontend adapters must not depend on route composition.

App Router composition owns the shell in src/app/_components. Home content and
Reveal belong in src/features/home. Authentication groups login, registration,
recovery, AuthLayout and shared OTP UI under src/features/auth; its session owner
contains SessionProvider, account reads and logout. Protected account writes stay
in src/features/account. Reusable controls, including ThemeToggle and primitives,
belong in src/shared/ui; cn belongs in src/shared/lib. Do not recreate parallel
website, root components or generic lib layers for those responsibilities.

Use HTTP for the configured sample backend. Keep feature-specific pure request DTOs in src/features/<feature>/types.ts and settings DTOs/path constants in src/shared/settings/contracts.ts. Reserve @/shared/contracts for wire concepts actually reused across local owners: Account, OtpResponse, profileNameMaxLength and shared AuthPaths. Owned wire modules may derive from that pure contract without importing runtime behavior. Do not import backend SDKs, database/auth/storage implementation, another checkout or cross-project local packages. Message data comes from @/i18n/catalog-data; it cannot initialize Next/React/next-intl or import feature behavior. The script scripts/check-boundaries.mjs checks production imports, type edges, re-exports, literal dynamic imports, resolved aliases, backend dependencies and local wire/catalog purity. Root apps/ and packages/ scaffolds and npm workspaces are rejected. The current ESLint configuration checks the published TypeScript/TSX and tooling with the registered React Hooks and import-order rules. Read the source marker and exact inventory before changing runtime composition. False-marker phases admit only their declared support owners; do not add entry points or broaden permissions merely to make a test realistic. Runnable composition must add its exact owner permissions, installed package identities and adapter tests with the complete application acceptance described in docs/application.md. Browser tooling and authored suites have a separate required tooling TypeScript project. Imports stay inert and readiness guards remain first.

Use `import type` or `export type` when the whole declaration must be erased.
Use inline `type` specifiers in declarations that also import or export runtime
values. Inline specifiers remove bindings, but a compiler can preserve an empty
import that still evaluates the module. Keep values needed at runtime, including
components, classes and schema objects, as value imports. Import an internal
implementation directly when no public module boundary is needed. Do not add
shortcut barrels solely to shorten paths or route server-only code through
client-facing exports.
