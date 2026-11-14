#!/usr/bin/env bash
# Rebuild the README demo board ("메모·할 일 앱 요금제 비교") in a scratch library and refresh assets/tour-*.jpg.
# Neutral topic on purpose — never screenshot the maintainer's real library for the README.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
D="${1:-$(mktemp -d -t ref-demo)}"
export REF_HOME="$D/home" REF_LIBRARY="$D/lib" REF_CAPTURE=chrome
R="$ROOT/scripts/ref"
"$R" setup --git >/dev/null
"$R" run start '{"collection":"note-app-pricing","title":"메모 앱 요금제 비교 (예시)","brief":{"purpose":"메모·할 일 앱 요금제를 비교해 우리 앱의 무료/유료 구성을 정한다","audience":"요금제를 처음 설계하는 1인 개발자","problem":"무료 범위를 어디까지 둘지 정하지 못함","success":"무료/유료 경계 안 1개와 가격 구간","value_types":["디자인·UX","전략·비즈니스"],"scope":["direct","indirect"],"exclude":"기업용 계약 조건","assumptions":["개인 사용자 중심 앱"]},"question":"첫 유료 단계를 어디에 두고, 무엇을 유료로 묶을까?","domain":"design","kind":"category","description":"메모·할 일 앱 요금제 페이지 비교"}' >/dev/null
"$R" capture '{"collection":"note-app-pricing","wait_ms":2500,"max_frames":6,"urls":[
{"url":"https://www.notion.com/pricing","label":"Notion — 요금제","tags":["pricing","direct","freemium-compare","annual-monthly-equivalent","dense-table"]},
{"url":"https://www.todoist.com/pricing","label":"Todoist — 요금제","tags":["pricing","direct","two-tier","freemium-compare","annual-monthly-equivalent"]},
{"url":"https://evernote.com/compare-plans","label":"Evernote — 요금제 비교","tags":["pricing","direct","annual-monthly-equivalent"]},
{"url":"https://obsidian.md/pricing","label":"Obsidian — 요금제","tags":["pricing","indirect","why-pay-section"]},
{"url":"https://www.craft.do/pricing","label":"Craft — 요금제","tags":["pricing","indirect","freemium-compare","annual-monthly-equivalent","illustration-hero"]}]}' | grep -E '^- S|Fail'
# The queries are illustrative (the board says so); the candidates are the pages captured above.
"$R" run round '{"collection":"note-app-pricing","queries":["note taking app pricing 2026","todo app pricing comparison 2026","메모 앱 요금제 비교 2026","할 일 앱 유료 구독 2026"],"candidates":[{"url":"https://www.notion.com/pricing","title":"Notion"},{"url":"https://www.todoist.com/pricing","title":"Todoist"},{"url":"https://evernote.com/compare-plans","title":"Evernote"}],"new_axes":["월간/연간 토글","무료 + 유료 비교표"]}' >/dev/null
"$R" run round '{"collection":"note-app-pricing","queries":["obsidian sync pricing latest","craft docs pricing plans 2026","메모 앱 동기화 유료"],"candidates":[{"url":"https://obsidian.md/pricing","title":"Obsidian"},{"url":"https://www.craft.do/pricing","title":"Craft"}],"new_axes":["기능 단위 판매"]}' >/dev/null
"$R" run round '{"collection":"note-app-pricing","queries":["note app family plan pricing"],"new_axes":[]}' >/dev/null
for j in \
'{"collection":"note-app-pricing","ref":"S1","fields":{"feature":"Free ₩0 · Plus ₩14,000 · Business ₩30,000 · Enterprise 4단, 연간 결제 토글에 Save up to 20% 문구 [S1]","context":"개인과 팀을 한 표에서 고르는 화면","why":"Business에만 Recommended 배지를 달아 팀 단계로 시선을 모은다 [S1]","why_basis":"signal","alternatives":"Evernote는 개인용과 팀용을 두 묶음으로 나눈다 [S3]","result":"효과 수치는 페이지에 없다","implication":"변형 — 추천 단계 하나만 강조한다 (조건: 유료 단계가 2개 이상일 때)"},"tags":["freemium-compare"]}' \
'{"collection":"note-app-pricing","ref":"S2","fields":{"feature":"비기너 $0 · 프로 $5 · 비지니스 $8, 연간 토글에 20% 할인 표시 [S2]","implication":"차용 — 무료와 유료 기능을 표 하나로 비교한다"},"tags":["freemium-compare"]}' \
'{"collection":"note-app-pricing","ref":"S3","fields":{"feature":"개인용 Starter · Advanced와 팀용 Flexible · Enterprise를 두 묶음으로 나눈다. Enterprise는 영업팀 문의 [S3]","implication":"변형 — 개인과 팀을 나누되 무료 단계는 표에 남긴다"},"tags":["annual-monthly-equivalent"]}' \
'{"collection":"note-app-pricing","ref":"S4","fields":{"feature":"Free without limits, 가입 없이 사용. Sync $4 · Publish $8를 부가 서비스로 판매 [S4]","context":"개인 노트 앱, 앱 자체에는 요금 단계가 없다","why":"페이지가 100% user-supported라고 밝히고 부가 서비스와 Catalyst·Commercial 라이선스를 판다 [S4]","why_basis":"official","alternatives":"Notion은 기능 단계를 나눠 판다 [S1]","result":"효과 수치는 페이지에 없다","implication":"변형 — 핵심 기능은 무료로 두고 동기화만 유료로 묶는다 (조건: 서버 비용이 동기화에 몰릴 때)"},"tags":["why-pay-section"]}' \
'{"collection":"note-app-pricing","ref":"S5","fields":{"feature":"Starter ₩0 · Plus ₩7,250 · Team $5/멤버(최소 3명) · Enterprise 상담. 비교표에 최대 6명 플랜도 있다 [S5]","implication":"피할 점 없음 — 구름 일러스트 배경은 브랜드 표현이라 그대로 따르지 않는다"},"tags":["illustration-hero"]}'; do "$R" note "$j" >/dev/null; done
# Claims must match what the captures show — re-check prices/notes against the new frames before committing.
"$R" claim add '{"collection":"note-app-pricing","claims":[
{"text":"요금제 페이지 5곳 모두 월간/연간 결제 토글을 둔다","kind":"pattern","subject":"결제 주기","key":true,"sources":["S1","S2","S3","S4","S5"]},
{"text":"무료 단계를 맨 왼쪽에 두고 유료 단계를 나란히 비교하는 구성이 많다","kind":"pattern","subject":"단계 구성","key":true,"sources":["S1","S2","S5"]},
{"text":"팀·기업 최상위 단계는 가격 대신 문의로 분리한다","kind":"pattern","subject":"기업 단계","sources":["S3","S5"]},
{"text":"Obsidian은 앱을 무료로 두고 동기화·게시를 부가 서비스로 판매한다","kind":"fact","subject":"Obsidian","key":true,"sources":["S4"]},
{"text":"개인 유료 첫 단계는 Todoist $5 · Craft ₩7,250 · Notion ₩14,000(월, 연간 결제 기준) 수준이다","kind":"benchmark","subject":"개인 유료 가격","asOf":"'"$(date +%F)"'","sources":["S1","S2","S5"]},
{"text":"Evernote 요금표 첫 화면의 플랜 4개에는 ₩0 단계가 없다","kind":"fact","subject":"Evernote 무료 단계","sources":["S3"]}]}' >/dev/null
"$R" axes set '{"axes":[{"id":"pricing-justification","verdict":"월간/연간 토글은 기본기 — 따라간다 [C1]"}]}' >/dev/null
# v3: topic, counter-evidence on the claim it contests (Evernote's first table has no ₩0 plan), product entities
"$R" topic set '{"topics":[{"id":"pricing","label":"요금·수익"}],"assign":{"note-app-pricing":"pricing"}}' >/dev/null
"$R" claim add '{"collection":"note-app-pricing","update":"C2","against":["S3"]}' >/dev/null
"$R" migrate v3 >/dev/null
"$R" report "{\"collection\":\"note-app-pricing\",\"summary_file\":\"$ROOT/dev/demo-summary.md\",\"open\":false,\"result\":\"무료 1단 + 개인 유료 1단으로 시작하고 동기화를 유료 경계 후보로 둔다\"}" >/dev/null
node "$ROOT/dev/bundle-board.mjs" "$D/lib/note-app-pricing/index.html" "$ROOT/docs/example/board.html"
node "$ROOT/dev/shots.mjs" "$D/lib/note-app-pricing/index.html" "$D"
python3 - "$D" "$ROOT/assets" <<'PY'
import sys
from PIL import Image
src, dst = sys.argv[1:]
for n in ["tour-overview", "tour-key", "tour-patterns", "tour-refs", "tour-claims", "tour-viewer", "tour-home"]:
    im = Image.open(f"{src}/{n}.png").convert("RGB")
    if im.width > 1600: im = im.resize((1600, int(im.height * 1600 / im.width)), Image.LANCZOS)
    im.save(f"{dst}/{n}.jpg", quality=86, optimize=True)
PY
echo "demo library: $D/lib — previews: $D/lib/refs/*/*/preview.jpg (check them before committing assets/)"
