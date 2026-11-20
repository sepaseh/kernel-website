# HTTP contracts

## Verify before changing a consumer

Treat explicit user decisions and this repository's sample HTTP contract as
authoritative. Inspect request and response examples, paths, fields, defaults,
dates, validation, permissions, statuses, error envelopes and deletion behavior.
Distinguish verified behavior, assumptions and unresolved compatibility decisions.
Keep existing wire behavior unless a requirement changes it. Claim support for
new fields, permissions, status codes and lifecycle rules only with verified
evidence. The [synthetic HTTP fixture](../../docs/api-fixture.md#feature-data-and-test-operations)
supplies evidence about the local sample contract.

## Maintain payloads and examples

- Review request and response behavior together. Omit backend-owned creation
  defaults from frontend requests. Include them in successful responses when
  the resulting domain model requires them.
- Use `snake_case` in wire JSON and query fields. Convert to `camelCase` at the
  transport boundary when the consumer needs it.
- Omit absent optional fields in payloads and examples unless `null` has
  explicit protocol meaning.
- Base changes to fields, envelopes, permissions, errors and status codes on
  verified contract evidence.
- Update local types, API helpers, consumer tests and the owning guide together.
  Reuse the existing HTTP helpers. Keep endpoint constants with their
  [source owner](imports.md#source-owners) and avoid a second route registry.
- Keep tokens and payloads synthetic. Keep credentials, private endpoints, real
  signed URLs and personal data out of committed fixtures and examples.
  [Sensitive data handling](safety.md#secrets-and-local-state)
