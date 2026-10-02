#!/usr/bin/env bash
# Smoke test in a throwaway library: deps, doctor, Chrome capture, board, MCP handshake, manifest validation.
# Never touches ~/references or ~/.reference-research.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d -t ref-test)"
export REF_HOME="$T/home" REF_LIBRARY="$T/lib" REF_CAPTURE="${REF_CAPTURE:-chrome}"
R="$ROOT/scripts/ref"
step() { printf '\n== %s\n' "$*"; }
step "syntax";   for f in "$ROOT"/scripts/*.mjs; do node --check "$f"; done; echo ok
step "manifest"; (cd "$ROOT" && claude plugin validate . && claude plugin validate .claude-plugin/plugin.json) | grep -E '✔|✘|⚠'
step "doctor";   "$R" doctor
step "capture ($REF_CAPTURE)"
"$R" setup --git >/dev/null
"$R" run start '{"collection":"smoke","goal":"smoke test","domain":"design","kind":"category"}' >/dev/null
"$R" capture '{"collection":"smoke","urls":[{"url":"https://example.com","label":"Example — landing","tags":["landing","direct"]}]}' | grep -E '^- S|Fail|backend'
step "report";   "$R" report '{"collection":"smoke","open":false}' | grep -c index.html
step "mcp"
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_collections","arguments":{}}}' \
  | "$ROOT/scripts/run-mcp.sh" 2>/dev/null | grep -q '\\"name\\": \\"smoke\\"' && echo "list_collections ok"
echo; echo "PASS — scratch: $T"
