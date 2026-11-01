# Code quality

Read the complete affected owner and its tests. Keep one independently
installable npm package and inert imports. This governance phase contains
repository tooling, not application behavior.

Validate external data at its boundary, preserve original failures and
cancellation, and fail clearly on missing required inputs. Keep ownership and
cleanup local to resources created by the operation.
Prefer small focused changes over speculative abstractions or new dependencies.

Keep all executable tooling measured. Preserve 90% unit and 80% governance
coverage; add no suppressions or source/rule/coverage exclusions.
Do not manufacture compatibility or provider results.
Use [testing](testing.md) and [full validation](../../docs/validation.md).
