# API collection

Read the current [source scope](../../docs/bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

- This website owns its HTTP adapters, feature DTOs, settings contracts and
  consumer tests. Its local HTTP fixture supplies synthetic test responses.
  Do not require another repository's collection, source or instructions.
- Treat explicit user decisions and the local sample HTTP contract as
  authoritative for this starter. Inspect affected request/response fields, examples, paths,
  defaults, validation, permissions and statuses before changing a consumer.
  Separate verified facts, assumptions and unresolved compatibility decisions.
- Keep local types, API helpers, consumer tests and mapped documentation aligned.
  Preserve the sample's existing paths, payloads, statuses and error semantics
  unless an explicit requirement changes them. Downstream applications choose
  backend integration and rollout; do not import backend runtime implementation.
- Review both request and response examples when changing creation defaults.
  Defaults owned by the backend must not be sent by frontend forms, and must be
  present in successful responses whenever the resulting domain model requires
  them.
- External JSON and query fields use `snake_case`; TypeScript may use
  `camelCase` after conversion at the transport boundary.
- Keep path constants with their actual feature/settings or multi-feature wire
  owner. Reuse the existing local API helpers without inventing another route
  registry or importing a backend SDK.
- Prefer omission for absent optional fields unless `null` has explicit domain
  meaning.
- Do not invent fields, envelopes, permissions, errors, or status codes without
  authoritative evidence.
- Follow the endpoint's actual date, query-default, status and deletion semantics;
  do not apply a different product's lifecycle or error policy to this consumer.
- Keep tokens and examples synthetic. Never commit credentials, private
  endpoints, signed URLs, or personal data.
