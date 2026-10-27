#!/bin/bash
# Optional host wrapper. The portable Node guard owns input inspection.

NODE_BIN=$(command -v node 2>/dev/null || command -v node.exe 2>/dev/null || true)

if [ -z "$NODE_BIN" ]; then
  echo "Safety hook requires Node.js; command blocked because input cannot be inspected." >&2
  exit 2
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd) || exit 2
SCRIPT_PATH="$SCRIPT_DIR/block-dangerous.mjs"

case "$NODE_BIN" in
  *.exe)
    if command -v wslpath >/dev/null 2>&1; then
      SCRIPT_PATH=$(wslpath -w "$SCRIPT_PATH") || exit 2
    elif command -v cygpath >/dev/null 2>&1; then
      SCRIPT_PATH=$(cygpath -w "$SCRIPT_PATH") || exit 2
    fi
    ;;
esac

exec "$NODE_BIN" "$SCRIPT_PATH"
