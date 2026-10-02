#!/usr/bin/env bash
# Read-only MCP server over the reference library (stdio).
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
"$DIR/ensure-deps.sh" || exit 1
exec node "$DIR/mcp.mjs"
