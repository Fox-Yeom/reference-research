#!/usr/bin/env bash
# Install the plugin's core npm deps (MCP SDK, zod, puppeteer-core — ~80 MB) once per plugin version.
# All output goes to stderr: the MCP server's stdout carries JSON-RPC.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$ROOT/node_modules/.ref-deps"
WANT="$(cksum < "$ROOT/package.json" | cut -d' ' -f1)"
if [[ -f "$STAMP" && "$(cat "$STAMP")" == "$WANT" ]]; then exit 0; fi
command -v node >/dev/null || { echo "reference-research: Node.js 20+ is required (https://nodejs.org)" >&2; exit 1; }
echo "reference-research: installing core dependencies (one time, ~80 MB)…" >&2
(cd "$ROOT" && npm install --omit=dev --no-audit --no-fund --loglevel=error 1>&2)
echo "$WANT" > "$STAMP"
