# Website imports and source boundaries

Use ./ for same-directory modules and @/ for source across directories. @/ resolves to this root src/ only. Framework configuration/tooling and pure catalog modules may use explicit relative paths. Keep feature behavior near its feature and public feature exports intentional. Shared frontend adapters must not depend on route composition.

Use HTTP for the independent API. Keep feature-specific pure request DTOs in src/features/<feature>/types.ts and settings DTOs/path constants in src/shared/settings/contracts.ts. Reserve @/shared/contracts for wire concepts actually reused across local owners: Account, OtpResponse, profileNameMaxLength and shared AuthPaths. Owned wire modules may derive from that pure contract without importing runtime behavior. Do not import backend SDKs, database/auth/storage implementation, another checkout or retired @kernel packages. Message data comes from @/i18n/catalog-data; it cannot initialize Next/React/next-intl or import feature behavior. The script scripts/check-boundaries.mjs checks production imports, type edges, re-exports, literal dynamic imports, resolved aliases, backend dependencies and local wire/catalog purity. Root apps/ and packages/ scaffolds and npm workspaces are rejected. The current ESLint configuration checks the published TypeScript/TSX and tooling with the registered React Hooks and import-order rules. Runtime framework composition remains unpublished. Browser tooling and authored suites are published under the explicit browser-foundation inventory with installed SDKs and a separate required tooling TypeScript project; their imports must not activate the false application snapshot.

Mark type-only edges with import type, export type or type specifiers so they
remain erased. Keep values needed at runtime, including components, classes and
schema objects, as value imports. Import an internal implementation directly
when no public module boundary is needed; do not add shortcut barrels solely
to shorten paths or route server-only code through client-facing exports.
