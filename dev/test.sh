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
fails grep -q 'Paper' <<<"$("$R" entity show)"   # a paper's label is not a product (#23)
"$R" report '{"collection":"smoke","open":false}' | grep -c index.html
step "judgment board (observations, options, memo; S# chips)"
cat > "$T/sum.md" <<'MD'
## 판단 자료
- 질문: smoke question?
- 관찰: two skimmed sources [C1] [S3]
- 반대 관찰: 관찰 1 — the paper speaks against it [S2]
- 관찰: reading unrecorded [C2]
- 선택지: plan A — first option · 받침 [C1] · 반대 [C2] · 확인: is it enough?
- 에이전트 메모: a reading, not a decision [C1]
MD
"$R" report "{\"collection\":\"smoke\",\"summary_file\":\"$T/sum.md\",\"open\":false}" >/dev/null
B="$REF_LIBRARY/smoke/index.html"
grep -q 'id="judge"' "$B"; grep -q 'class="otbl"' "$B"; grep -q 'data-pd="op0"' "$B"; grep -q '에이전트 메모 (참고)' "$B"
grep -q 'class="ob counter"' "$B"
grep -q 'data-src="S2"' "$B"   # no capture: details beside the chip instead of a jump
fails grep -q 'id="map"' "$B"
fails grep -q 'class="lab">답<' "$B"
echo "judgment board ok"
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
grep -q '열람 미기록' "$V2/old/index.html"; echo "v2 board renders (reading unrecorded)"
printf '%s\n' '## 핵심 결론' '- 질문: q?' '- 답: old answer [C1]' '- 제안: old proposal [C1]' '- 근거: old finding [C1] [S1]' > "$V2/old/SUMMARY.md"
REF_LIBRARY="$V2" "$R" report '{"collection":"old","open":false}' >/dev/null
grep -q '에이전트 메모 (참고)' "$V2/old/index.html"; grep -q '해석: old answer' "$V2/old/index.html"; grep -q '다음 단계 후보: old proposal' "$V2/old/index.html"
fails grep -q 'class="lab">답<' "$V2/old/index.html"
fails grep -q 'class="otbl"' "$V2/old/index.html"
echo "old summary: 답 folded into the agent memo, no options table"
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
grep -q '10.1000/xyz' "$T/mcp-v3.txt"; grep -q '\\"against\\": \[' "$T/mcp-v3.txt"; grep -q '\\"read\\"' "$T/mcp-v3.txt"; echo "mcp v3 fields ok"
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_conclusion","arguments":{"collection":"smoke"}}}' \
  | "$ROOT/scripts/run-mcp.sh" 2>/dev/null > "$T/mcp-concl.txt"
grep -q 'plan A' "$T/mcp-concl.txt"; grep -q '\\"observations\\"' "$T/mcp-concl.txt"; grep -q '\\"agent_memo\\"' "$T/mcp-concl.txt"; echo "get_conclusion ok"
step "capture after source add (#21)"
# a reference first recorded by `source add` has no snapshot: capturing it must save (#21)
"$R" source add '{"collection":"smoke","url":"https://example.net/","label":"Example net — home","type":"official"}' >/dev/null
out="$("$R" capture '{"collection":"smoke","urls":[{"url":"https://example.net/","label":"Example net — home"}]}')"
grep -q 'first capture of an existing reference' <<<"$out" || { echo "$out"; exit 1; }
node -e 'const r=require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse).filter(x=>x.url==="https://example.net/").at(-1);if(r.snapshots.length!==1)process.exit(1)' "$REF_LIBRARY/refs.jsonl"
echo "capture after source add ok (snapshot saved)"
step "unreachable page is not saved (#34)"
out="$("$R" capture '{"collection":"smoke","urls":[{"url":"https://nonexistent.invalid/","label":"Bad — home"}]}' 2>&1 || true)"   # every URL failed: non-zero exit is expected
grep -q 'page did not load' <<<"$out" || { echo "$out"; exit 1; }
fails grep -q 'chrome-error' "$REF_LIBRARY/refs.jsonl"
fails grep -q 'nonexistent.invalid' "$REF_LIBRARY/refs.jsonl"
[ ! -e "$REF_LIBRARY/refs/chromewebdata" ]; echo "unreachable page reported, nothing saved"
step "merge a duplicate reference (#22)"
mcp() { printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' '{"jsonrpc":"2.0","method":"notifications/initialized"}' "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$2}}" | "$ROOT/scripts/run-mcp.sh" 2>/dev/null; }
ids=($("$R" source add '{"collection":"smoke","sources":[{"url":"https://dup.example/a","label":"Dup — a","type":"official"},{"url":"https://dup.example/b","label":"Dup — b","type":"official"},{"url":"https://dup.example/c","label":"Dup — c","type":"official"}]}' | awk '/^S[0-9]+ /{print $1}'))
KEEP=${ids[0]}; DROP=${ids[1]}; THIRD=${ids[2]}
"$R" claim add "{\"collection\":\"smoke\",\"text\":\"cites the duplicate\",\"kind\":\"fact\",\"subject\":\"d\",\"sources\":[\"$DROP\"]}" >/dev/null
fails "$R" source merge "{\"keep\":\"$KEEP\",\"drop\":\"$DROP\"}"   # no shared work id: needs "force"
fails "$R" source merge --dry-run                                    # no JSON argument: usage, not a wait on stdin
before="$(library_hash)"
"$R" source merge "{\"keep\":\"$KEEP\",\"drop\":\"$DROP\",\"force\":true}" --dry-run | grep -q 'dry run'
[ "$before" = "$(library_hash)" ]; echo "dry run wrote nothing"
"$R" source merge "{\"keep\":\"$KEEP\",\"drop\":\"$DROP\",\"force\":true}" | grep -q "merged $DROP → $KEEP"
node -e '
const fs=require("fs"),[lib,keep,drop]=process.argv.slice(1),last=(f)=>{const m=new Map();for(const l of fs.readFileSync(f,"utf8").trim().split("\n")){const o=JSON.parse(l);m.set(o.id,o)}return m};
const refs=last(lib+"/refs.jsonl"),claims=last(lib+"/claims.jsonl"),col=JSON.parse(fs.readFileSync(lib+"/smoke/collection.json"));
const p=refs.get(drop);
const ok=p.mergedInto===keep&&!p.notes&&!p.tags&&refs.get(keep).aliases.includes("dup.example/b")&&[...claims.values()].every(c=>!(c.sources||[]).includes(drop))&&!col.members.some(m=>m.ref===drop)&&col.members.some(m=>m.ref===keep);
if(!ok)process.exit(1)' "$REF_LIBRARY" "$KEEP" "$DROP"
fails grep -q "^- $DROP " <<<"$("$R" source list smoke)"
"$R" source add '{"url":"https://dup.example/b"}' | grep -q "^$KEEP (updated)"   # the old URL finds the kept ref
fails "$R" source merge "{\"keep\":\"$KEEP\",\"drop\":\"$DROP\",\"force\":true}"   # already merged
# the dropped id still works as input and lands on the kept ref
"$R" collect "{\"collection\":\"smoke2\",\"refs\":[\"$DROP\"]}" | grep -q "^$KEEP "
fails "$R" claim add "{\"collection\":\"smoke\",\"text\":\"x\",\"kind\":\"fact\",\"sources\":[\"$KEEP\"],\"against\":[\"$DROP\"]}"
# chain: merge the kept ref into a third one; the old pointer follows
"$R" source merge "{\"keep\":\"$THIRD\",\"drop\":\"$KEEP\",\"force\":true}" | grep -q "pointers $DROP now lead to $THIRD"
mcp get_reference "{\"id\":\"$DROP\"}" | grep -q "was merged into $THIRD"
s="$(mcp search_references '{"query":"Dup"}')"; grep -q "\\\\\"$THIRD\\\\\"" <<<"$s"; fails grep -q "\\\\\"$DROP\\\\\"" <<<"$s"
"$R" report '{"collection":"smoke","open":false}' >/dev/null; fails grep -q "id=\"$DROP\"" "$REF_LIBRARY/smoke/index.html"
# retired ids are never reused: drop the newest ref, then add one more
top=$("$R" source add '{"collection":"smoke","url":"https://dup.example/top","label":"Dup — top","type":"official"}' | awk '/^S[0-9]+ /{print $1}')
"$R" source merge "{\"keep\":\"$THIRD\",\"drop\":\"$top\",\"force\":true}" >/dev/null
new=$("$R" source add '{"collection":"smoke","url":"https://dup.example/new","label":"Dup — new","type":"official"}' | awk '/^S[0-9]+ /{print $1}')
[ -n "$new" ] && [ "$new" != "$top" ]
# same work id (an older library recorded the same DOI on two refs): merges without force
pair=($("$R" source add '{"collection":"smoke","sources":[{"url":"https://work.example/x","label":"Work — x","type":"paper"},{"url":"https://work.example/y","label":"Work — y","type":"paper"}]}' | awk '/^S[0-9]+ /{print $1}'))
"$R" source add '{"url":"https://work.example/x","ids":{"doi":"10.9999/same"}}' >/dev/null
"$R" source add '{"url":"https://work.example/y","ids":{"doi":"10.9999/same"}}' >/dev/null
"$R" source merge "{\"keep\":\"${pair[0]}\",\"drop\":\"${pair[1]}\"}" | grep -q 'same work id'
"$R" show "${pair[1]}" | grep -q "was merged into ${pair[0]}"
echo "merge ok: $DROP → $KEEP → $THIRD"
step "entity cleanup (#23)"
E="$T/ent"; export REF_LIBRARY="$E"
"$R" run start '{"collection":"ent","goal":"entity rule","domain":"design","kind":"category"}' >/dev/null
"$R" source add '{"collection":"ent","sources":[{"url":"https://acme.example/pricing","label":"Acme — pricing","type":"official"},{"url":"https://news.example/acme","label":"Acme 리뷰 (Daily News)","type":"press","publisher":"Daily News"},{"url":"https://journal.example/2015/s","label":"Journal 2015 — study","type":"paper"},{"url":"https://acme.example/pro","label":"Acme Pro — home","type":"official"},{"url":"https://blog.example/acme","label":"Acme — a look","type":"blog"},{"url":"https://beta.example/","label":"Beta — home","type":"capture","role":"direct"}]}' >/dev/null
m="$("$R" migrate v3)"
grep -q 'product entities: 3 new · 4 refs linked · 2 refs not a product page' <<<"$m"   # Acme, Acme Pro, Beta (capture + direct); the blog links to Acme
grep -q -- '- Daily News (1): S2' <<<"$m"   # the outlet goes to the org candidates
ents="$("$R" entity show)"; fails grep -q 'Journal' <<<"$ents"; fails grep -q 'Daily' <<<"$ents"; grep -q 'E1 \[product\] Acme — 2 refs: S1, S5' <<<"$ents"
# entities an older rule made: an article title linked to a paper, one nothing points at
"$R" entity set '{"entities":[{"kind":"product","name":"Journal 2015"},{"kind":"product","name":"Orphan"}],"link":{"S3":"Journal 2015"}}' >/dev/null
"$R" claim add '{"collection":"ent","text":"pro tier","kind":"fact","subject":"p","sources":["S4"],"about":["E2"]}' >/dev/null
before="$(library_hash)"
rv="$("$R" entity review --out "$T/review.md")"
grep -q -- '- E4 Journal 2015 — S3 (paper)' <<<"$rv"; grep -q -- '- E5 \[product\] Orphan' <<<"$rv"; grep -q 'E1 Acme (2 refs) ← E2 Acme Pro' <<<"$rv"
grep -q "ref entity set '{\"link\":{\"S3\":null}}'" "$T/review.md"; grep -q 'ref entity remove E4 E5' "$T/review.md"
"$R" entity merge '{"keep":"E1","drop":"E2"}' --dry-run | grep -q 'dry run'
"$R" entity remove E5 --dry-run | grep -q 'would remove E5'
[ "$before" = "$(library_hash)" ]; echo "review and dry runs wrote nothing"
fails "$R" entity remove E4 E5   # E4 still linked: nothing removed, E5 included
grep -q '"Orphan"' "$E/entities.json"
fails "$R" entity merge '{"keep":"E1","drop":"E1"}'
"$R" entity merge '{"keep":"E1","drop":"E2"}' | grep -q 'merged E2 Acme Pro → E1 Acme'
node -e '
const fs=require("fs"),lib=process.argv[1],last=(f)=>{const m=new Map();for(const l of fs.readFileSync(f,"utf8").trim().split("\n")){const o=JSON.parse(l);m.set(o.id,o)}return m};
const refs=last(lib+"/refs.jsonl"),claims=last(lib+"/claims.jsonl"),ents=JSON.parse(fs.readFileSync(lib+"/entities.json")).entities,e=(id)=>ents.find(x=>x.id===id);
const ok=refs.get("S4").entity==="E1"&&refs.get("S1").entity==="E1"&&claims.get("C1").about.join()==="E1"&&e("E2").mergedInto==="E1"&&e("E1").aliases.includes("Acme Pro")&&![...refs.values()].some(r=>r.entity==="E2");
if(!ok)process.exit(1)' "$E"
fails grep -q '^- E2 ' <<<"$("$R" entity show)"
fails "$R" entity merge '{"keep":"E1","drop":"E2"}'   # already merged
fails "$R" entity remove E1                            # still linked (refs, claim, merged id)
"$R" entity set '{"link":{"S6":"E2"}}' | grep -q 'S6.entity → E1'   # a merged id lands on the kept entity
"$R" entity set '{"link":{"S3":null}}' >/dev/null
"$R" entity remove E4 E5 | grep -q 'removed E5'
fails grep -q '"Journal 2015"' "$E/entities.json"
echo "entity cleanup ok"
echo; echo "PASS — scratch: $T"
