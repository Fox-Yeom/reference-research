#!/usr/bin/env bash
# Rebuild the README demo board ("메모·할 일 앱 요금제 비교") in a scratch library and refresh assets/tour-*.jpg.
# Neutral topic on purpose — never screenshot the maintainer's real library for the README.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
D="${1:-$(mktemp -d -t ref-demo)}"
export REF_HOME="$D/home" REF_LIBRARY="$D/lib" REF_CAPTURE=chrome
R="$ROOT/scripts/ref"
"$R" setup --git >/dev/null
"$R" run start '{"collection":"note-app-pricing","goal":"메모·할 일 앱 요금제 페이지를 비교해 우리 앱의 무료/유료 구성을 정한다","audience":"요금제를 처음 설계하는 1인 개발자","domain":"design","kind":"category","description":"메모·할 일 앱 요금제 페이지 비교"}' >/dev/null
"$R" capture '{"collection":"note-app-pricing","urls":[
{"url":"https://www.notion.com/pricing","label":"Notion — 요금제","tags":["pricing","direct","freemium-compare","annual-monthly-equivalent","dense-table"]},
{"url":"https://www.todoist.com/pricing","label":"Todoist — 요금제","tags":["pricing","direct","two-tier","freemium-compare","annual-monthly-equivalent"]},
{"url":"https://evernote.com/compare-plans","label":"Evernote — 요금제 비교","tags":["pricing","direct","freemium-compare","free-trial"]},
{"url":"https://obsidian.md/pricing","label":"Obsidian — 요금제","tags":["pricing","indirect","why-pay-section"]},
{"url":"https://www.craft.do/pricing","label":"Craft — 요금제","tags":["pricing","analogous","two-tier","annual-monthly-equivalent","illustration-hero"]}]}' | grep -E '^- S|Fail'
for j in \
'{"collection":"note-app-pricing","ref":"S1","note":"무료 · Plus · Business · Enterprise 4단. 월간/연간 토글(**연간 최대 20% 할인**), 원화 표시. Business에 추천 배지."}' \
'{"collection":"note-app-pricing","ref":"S2","note":"비기너(무료) · 프로 · 비즈니스 3단. 연간 토글, 유료 단계에 **무료 체험 시작** 버튼."}' \
'{"collection":"note-app-pricing","ref":"S3","note":"개인용(Starter · Advanced)과 팀(Flexible · Enterprise)을 **두 묶음으로 나눔**. Enterprise는 영업팀 문의."}' \
'{"collection":"note-app-pricing","ref":"S4","note":"앱 자체는 무료(가입 없음). **동기화 · 게시를 부가 서비스로 판매** — 요금제 대신 기능 단위 과금."}' \
'{"collection":"note-app-pricing","ref":"S5","note":"무료 · Plus · Family · Team. **가족 요금제**가 따로 있음. 일러스트 배경에 카드형 요금표."}'; do "$R" note "$j" >/dev/null; done
# Claims must match what the captures show — re-check prices/notes against the new frames before committing.
"$R" claim add '{"collection":"note-app-pricing","claims":[
{"text":"요금제 페이지 5곳 모두 월간/연간 결제 토글을 두고, 연간 결제를 기본 또는 할인으로 강조한다","kind":"pattern","subject":"결제 주기","key":true,"sources":["S1","S2","S3","S4","S5"]},
{"text":"무료 단계를 맨 왼쪽에 두고 유료 2~3단을 나란히 비교하는 구성이 표준이다","kind":"pattern","subject":"단계 구성","key":true,"sources":["S1","S2","S5"]},
{"text":"팀·기업 단계는 가격 대신 영업 문의로 분리한다","kind":"pattern","subject":"기업 단계","sources":["S1","S3"]},
{"text":"Obsidian은 앱을 무료로 두고 동기화·게시만 부가 서비스로 판매한다","kind":"fact","subject":"Obsidian","sources":["S4"]},
{"text":"개인 유료 첫 단계는 Todoist $5 · Craft ₩9,667 · Notion ₩14,000(월, 연간 결제 기준) 수준이다","kind":"benchmark","subject":"개인 유료 가격","key":true,"asOf":"'"$(date +%F)"'","sources":["S1","S2","S5"]}]}' >/dev/null
"$R" axes set '{"axes":[{"id":"pricing-justification","verdict":"월간/연간 토글과 연간 할인은 기본기 — 따라간다 [C1]"}]}' >/dev/null
"$R" report "{\"collection\":\"note-app-pricing\",\"summary_file\":\"$ROOT/dev/demo-summary.md\",\"open\":false,\"open_questions\":[\"가족 요금제가 우리 사용자층에도 필요한가 [C5]\",\"동기화를 유료로 묶으면 무료 사용자의 이탈이 얼마나 되나 [C4]\"],\"next_steps\":[\"무료 + 개인 유료 1단으로 시작, 팀 단계는 문의형 [C2, C3]\",\"동기화를 유료 기능으로 묶는 안도 검토 [C4]\"]}" >/dev/null
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
