# Safety

Preserve unrelated source, user-owned originals and private state.
Never read or expose real dotenv, keys, credentials, full environments or operator
data as fixtures. Secret names and reviewed public configuration are distinct
from secret values. Do not contact existing services or production for tests.

Create only owned synthetic resources. Before recursive cleanup, verify the
resolved target stays within the owned root and delete only that resource.
Do not use broad cleanup, destructive resets or history rewriting to repair work.

Use one existing checkout; another implementation checkout needs explicit
authorization. Verification exports are disposable and must not become workspaces.

Do not commit without user approval. Check authorization for pushes, remote
messages, PR changes, reviews, merges and protection changes.
Do not run destructive or irreversible actions without explicit authority.
Read [Git policy](git.md) and [private security reporting](../../SECURITY.md).
