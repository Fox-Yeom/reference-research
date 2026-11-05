#!/usr/bin/env bash
# Smoke test in a throwaway library: deps, doctor, Chrome capture, connectors, board, MCP handshake, manifest validation.
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
step "flow"
"$R" brief set '{"collection":"smoke","brief":{"purpose":"smoke test"}}' | grep -q '목적'
"$R" run round '{"collection":"smoke","queries":["스모크 2026","smoke 2026"],"candidates":[{"url":"https://example.com","published":"2026-01-02"}],"new_axes":["a"]}' | grep '바퀴 끝'
"$R" run round '{"collection":"smoke","queries":[{"q":"smoke","via":"hn"}],"candidates":[{"url":"https://news.ycombinator.com/item?id=1","via":"hn"}],"new_axes":["b"]}' | grep -q '커넥터 1'
"$R" run show smoke | grep -q '커넥터 후보: hn 1'
"$R" run show smoke | grep -q '질의 2개 (최소 8)'
! "$R" run round '{"collection":"smoke","queries":[{"q":"smoke","via":"web"}]}' 2>/dev/null
"$R" migrate roles --dry-run
"$R" migrate grades --dry-run
"$R" fresh smoke | head -1
"$R" channels smoke | head -1
step "connectors"
node "$ROOT/dev/test-connectors.mjs"
"$R" fetch list | grep -q '^hn'
"$R" fetch list | grep -q '^github'
"$R" fetch list | grep -q '^speakerdeck'
library_hash() { (cd "$REF_LIBRARY" && find . -path ./.git -prune -o -type f -print0 | sort -z | xargs -0 shasum | shasum); }
before="$(library_hash)"
"$R" fetch hn '{"q":"design system","limit":3}' | head -2 || echo "(hn unreachable: read-only check still runs)"
[ "$before" = "$(library_hash)" ] && echo "library untouched"
step "report";   "$R" report '{"collection":"smoke","open":false}' | grep -c index.html
step "mcp"
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_collections","arguments":{}}}' \
  | "$ROOT/scripts/run-mcp.sh" 2>/dev/null | grep -q '\\"name\\": \\"smoke\\"' && echo "list_collections ok"
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_brief","arguments":{"collection":"smoke"}}}' \
  | "$ROOT/scripts/run-mcp.sh" 2>/dev/null | grep -q 'smoke test' && echo "get_brief ok"
echo; echo "PASS — scratch: $T"
