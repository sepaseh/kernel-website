# Safety

Read this guidance before shell commands, sensitive-file access, Git changes or
remote actions. Keep work within the authorized repository and preserve unrelated
tracked, staged and untracked work.

## Authorization

Honor authorization and preferences already given for the same action and scope.
When authorization is missing, ask only for the specific effect that requires it.
A request to prepare a draft covers local preparation. Staging requires an explicit
request or authorization to commit the reviewed scope. A commit requires explicit
authorization and does not authorize a push.

## Destructive commands

Get explicit user authorization and verify the exact target before running a
destructive command. Inspect status and relevant diffs before changing Git
state. Avoid `git reset --hard`, `git clean -fd` and recursive moves or deletions
against computed paths. Avoid force pushes.

Before recursive cleanup, verify the resolved target stays within the owned root.
Delete only resources created for the task and preserve operation and cleanup
failures.

## Secrets and local state

Get explicit authorization before reading, printing, editing or committing
secrets. Treat real `.env` files, private keys, credential files, tokens,
passwords, databases and uploads as sensitive. Never dump the full environment
or run broad secret searches. Authentication tools may use existing credentials
without exposing their values. Use only names and metadata for status checks.

Use synthetic disposable fixtures for tests and evaluations. Keep real
environments, credentials, databases, buckets, uploads and existing services
out of fixtures.

Keep machine-specific tool settings in ignored `.agents/settings.local.json`.
Keep that file private and leave it unread while reviewing guidance.

## External systems

Use authorized targets for external actions. Keep local experiments away from
production and mainnet endpoints. Never push directly to protected `main` or
`master`, and never force-push to either branch.

Require explicit authorization for each remote effect, including pushes,
publication, comments, reviews, resolving conversations, issue and PR changes,
merges, and changes to protection or other remote configuration. This includes
creating, updating, closing or marking a PR ready. For publication that requires
a push, verify authorization for both. One request may explicitly authorize both
effects. Creating or starting an issue does not authorize comments, assignment,
labels, status changes or a pull request.

### Standalone PR comments

Post standalone PR comments only with prior explicit user authorization.
Authorization to fix, commit, push or reply to review threads does not authorize
a standalone comment.

## Optional safety hooks

Optional safety hooks are a host convenience. Keep authorization and the full
validation gate in effect whether or not a host loads them. The application can
run independently of the hooks, which neither grant permission nor provide a
complete security boundary.

Follow [private security reporting](../../SECURITY.md) for vulnerabilities.
