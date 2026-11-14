#!/usr/bin/env bash
# Smoke test in a throwaway library: deps, doctor, Chrome capture, connectors, board, MCP handshake, manifest validation.
# Never touches ~/references or ~/.reference-research.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d -t ref-test)"
export REF_HOME="$T/home" REF_LIBRARY="$T/lib" REF_CAPTURE="${REF_CAPTURE:-chrome}"
R="$ROOT/scripts/ref"
step() { printf '\n== %s\n' "$*"; }
# `! cmd` does not stop a `set -e` script, so expected failures need an explicit check
fails() { if "$@" >/dev/null 2>&1; then echo "expected to fail: $*"; exit 1; fi; }
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
fails "$R" run round '{"collection":"smoke","queries":[{"q":"smoke","via":"web"}]}'
"$R" migrate roles --dry-run
"$R" migrate grades --dry-run
"$R" fresh smoke | head -1
"$R" channels smoke | head -1
step "connectors"
node "$ROOT/dev/test-connectors.mjs"
"$R" fetch list | grep -q '^hn'
"$R" fetch list | grep -q '^github'
"$R" fetch list | grep -q '^speakerdeck'
"$R" fetch list | grep -q '^appstore'
library_hash() { (cd "$REF_LIBRARY" && find . -path ./.git -prune -o -type f -print0 | sort -z | xargs -0 shasum | shasum); }
before="$(library_hash)"
"$R" fetch hn '{"q":"design system","limit":3}' | head -2 || echo "(hn unreachable: read-only check still runs)"
[ "$before" = "$(library_hash)" ] && echo "library untouched"
step "report";   "$R" report '{"collection":"smoke","open":false}' | grep -c index.html
step "v3 model (topics, entities, ids, read, against, migration)"
"$R" topic set '{"topics":[{"id":"smoke-topic","label":"스모크"}],"assign":{"smoke":"smoke-topic"}}' | grep -q 'smoke → smoke-topic'
fails "$R" topic set '{"assign":{"smoke":"no-such-topic"}}'
"$R" entity set '{"entities":[{"kind":"product","name":"Example","aliases":["example.com"]}],"link":{"S1":"example.com"}}' | grep -q 'S1.entity → E1'
"$R" source add '{"collection":"smoke","url":"https://doi.org/10.1000/xyz","label":"Paper — p","type":"paper"}' | grep -q '^S2 '
"$R" source add '{"url":"https://example.org/mirror","ids":{"doi":"10.1000/XYZ"}}' | grep -q '^S2 (updated)'   # same work, other address
"$R" source add '{"collection":"smoke","sources":[{"url":"https://a.example/x","label":"A — x","type":"official","read":"snippet"},{"url":"https://b.example/x","label":"B — x","type":"official","read":"snippet"}]}' >/dev/null
"$R" claim add '{"collection":"smoke","text":"two skimmed sources","kind":"fact","subject":"s","sources":["S3","S4"],"against":["S2"],"about":["E1"]}' | grep -q 'C1 \[fact, medium\]'   # snippet-only: at most medium
"$R" source add '{"url":"https://a.example/x","read":"full"}' | grep -q 'C1→high'
fails "$R" claim add '{"collection":"smoke","text":"x","kind":"fact","sources":["S3"],"against":["S3"]}'
"$R" source add '{"collection":"smoke","sources":[{"url":"https://c.example/x","label":"C — x","type":"official"},{"url":"https://d.example/x","label":"D — x","type":"official"}]}' >/dev/null
"$R" claim add '{"collection":"smoke","text":"two sources, reading unrecorded","kind":"fact","subject":"u","sources":["S5","S6"]}' | grep -q 'C2 \[fact, high\]'   # no read record: old rule
"$R" migrate v3 --dry-run | grep -q 'dry run'
"$R" migrate v3 >/dev/null
"$R" migrate v3 | grep -q 'product entities: 0 new · 0 refs linked'   # second run changes nothing
"$R" report '{"collection":"smoke","open":false}' | grep -c index.html
step "v2 library read as-is"
V2="$T/v2"; mkdir -p "$V2/old"
cat > "$V2/old/collection.json" <<'JSON'
{"name":"old","domain":"design","kind":"category","title":"Old","goal":"g","question":"q?","members":[{"ref":"S1","role":"direct"},{"ref":"S2","role":"indirect"}]}
JSON
printf '%s\n' '{"id":"S1","slug":"a","url":"https://a.example/p","normUrl":"a.example/p","aliases":[],"label":"A — p","product":"A","type":"official","credibility":"A","tags":[],"categories":["old"],"notes":[],"snapshots":[],"changes":[]}' \
  '{"id":"S2","slug":"b","url":"https://b.example/p","normUrl":"b.example/p","aliases":[],"label":"B — p","product":"B","type":"official","credibility":"A","tags":[],"categories":["old"],"notes":[],"snapshots":[],"changes":[]}' > "$V2/refs.jsonl"
printf '%s\n' '{"id":"C1","text":"old finding","kind":"pattern","subject":"s","sources":["S1","S2"],"collections":["old"],"status":"active","confidence":"high","events":[]}' > "$V2/claims.jsonl"
REF_LIBRARY="$V2" "$R" claim list old | grep -q 'C1 \[pattern, high\]'
REF_LIBRARY="$V2" "$R" report '{"collection":"old","open":false}' | grep -q index.html
grep -q '열람 미기록' "$V2/old/index.html" && echo "v2 board renders (reading unrecorded)"
step "mcp"
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_collections","arguments":{}}}' \
  | "$ROOT/scripts/run-mcp.sh" 2>/dev/null | grep -q '\\"name\\": \\"smoke\\"' && echo "list_collections ok"
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_brief","arguments":{"collection":"smoke"}}}' \
  | "$ROOT/scripts/run-mcp.sh" 2>/dev/null | grep -q 'smoke test' && echo "get_brief ok"
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_reference","arguments":{"id":"S2"}}}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_findings","arguments":{"query":"skimmed"}}}' \
  | "$ROOT/scripts/run-mcp.sh" 2>/dev/null > "$T/mcp-v3.txt"
grep -q '10.1000/xyz' "$T/mcp-v3.txt" && grep -q '\\"against\\": \[' "$T/mcp-v3.txt" && grep -q '\\"read\\"' "$T/mcp-v3.txt" && echo "mcp v3 fields ok"
echo; echo "PASS — scratch: $T"
