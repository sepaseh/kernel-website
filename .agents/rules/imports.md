# Import paths and ownership

Use `./` for same-directory source modules and `@/` for source across
directories. `@/` resolves to this checkout's `src/`. Framework configuration,
tooling and pure catalog modules may use their declared relative paths.
Keep feature exports intentional and shared adapters independent of route
composition.

## Source owners

Follow the [website ownership map](website.md#ownership-and-boundaries) for
feature, route and control behavior. Keep each feature's DTOs and endpoint
constants with that feature. Keep settings DTOs and path constants in
`src/shared/settings/contracts.ts`. Reserve `src/shared/contracts`
for reused HTTP concepts such as `Account`, `OtpResponse`, `profileNameMaxLength`,
`AuthPaths` and `PublicPaths`. Shared wire modules stay free of runtime behavior.

Use HTTP for the configured backend. Keep backend SDKs, storage, authentication
and database implementations outside frontend source. The package stands alone
without another checkout's source, collection or instructions, cross-project
packages, npm workspaces or root `apps/` or `packages/` scaffolds.
Follow the [catalog rules](localization.md#catalogs) for message data.

## Enforce boundaries

The [boundary checker](../../scripts/check-boundaries.mjs) checks production
imports, type edges, re-exports, literal dynamic imports, resolved aliases and
wire/catalog purity. Check the exact owner and target before changing a runtime
or type-only edge. Keep framework entry points and installed package identities
aligned with the [published inventory](../../.github/bootstrap-policy.json) and
the [application contract](../../docs/application.md#composition). Inspect the
installed framework's request APIs and signatures before changing an adapter.
Broaden permissions only for an actual source requirement with owner tests.
Run the [tooling typecheck](../../tsconfig.tooling.json) for authored browser
suites and their configuration. Follow the
[readiness and inert-import contract](../../docs/runner-foundation.md#readiness-and-imports)
for runner, browser and delivery tooling.

## Type-only edges

Use `import type` or `export type` when every symbol in the declaration is used
only as a type. Use value imports for runtime references such as components,
classes, enum values and schema objects.
Use inline `type` specifiers in mixed imports and re-exports. A compiler can
preserve an empty import that still evaluates the module after removing inline
bindings. Import an internal
implementation directly when no public module boundary is needed. Do not add
shortcut barrels solely to shorten paths or route server-only code through
client-facing exports.

Follow the [autofix workflow](code-quality.md#autofix-workflow) for import order.
