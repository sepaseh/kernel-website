#!/bin/bash
# Optional task-completion aid: lint and types for a project with changed TS/TSX.
# This is a focused fast check; npm run validate -- full remains required.

PROJECT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd "$PROJECT_DIR" || exit 2
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Quality helper requires this project's Git checkout." >&2
  exit 2
fi
TRACKED=$(git diff --name-only --diff-filter=ACMR HEAD -- .) || exit 2
UNTRACKED=$(git ls-files --others --exclude-standard) || exit 2
if ! printf '%s\n%s\n' "$TRACKED" "$UNTRACKED" | grep -Eq '\.(ts|tsx)$'; then
  exit 0
fi
npm run lint || exit 2
npm run typecheck || exit 2