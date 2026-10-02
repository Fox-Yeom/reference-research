---
name: reference-research
description: Collect and manage references (similar products, competitor screens, design inspiration, service teardowns) in a git-backed library of global references that belong to multiple categories. Uses WebSearch/WebFetch to find candidates, captures real pages (the user's Aside browser, or headless Chrome) and App Store / Mac App Store screens, reuses and refreshes references already in the library (adds the new category, records what changed), links related references across categories with local embeddings, records source-linked claims, and builds a cited board per category — all via the bundled `ref` CLI. Also compares courses for curriculum design (modules, topics, hours, order, gaps vs. competency frameworks). Use when the user asks for references, benchmarks, competitor screens, design inspiration, a service teardown, or course/curriculum benchmarking ("레퍼런스", "벤치마킹", "경쟁 서비스 분석", "커리큘럼 레퍼런스", "강의 비교").
---

# Reference Research (Claude Code plugin)

- CLI: `ref` = `~/.reference-research/plugin/scripts/ref` (link kept by the plugin's SessionStart hook; same as `${CLAUDE_PLUGIN_ROOT}/scripts/ref`). `ref help` lists everything
- **First use in a session**: run `ref doctor` — it reports the capture backend (Aside → headless Chrome → none), Pillow, embeddings and whether the library is a git repo. Tell the user anything marked ⚠ with its fix; `ref setup --git` makes the library a git repo
- Library: `~/references/` (override `REF_LIBRARY`) — **a git repo**; commit at the end of every session
- Web discovery: Claude Code `WebSearch` / `WebFetch`
- Images: commands print image paths after `IMAGES:` → open them with the **Read** tool
- Reply in the user's language (default Korean)

```bash
# zsh does not word-split "$REF" → use a function (define it in the same Bash call; shell state does not persist)
ref() { "$HOME/.reference-research/plugin/scripts/ref" "$@"; }
# if that link is missing (hook did not run): ref() { "${CLAUDE_PLUGIN_ROOT}/scripts/ref" "$@"; }
```

**Why we collect references** — ① 시행착오 절감 (검증된 패턴·남의 실패) ② 벤치마크 (잘 만든 것의 수준) ③ 차별화 (기존 것의 강점/약점) ④ 커뮤니케이션 (실물로 방향 정렬) ⑤ 근거·신뢰 (출처 있는 주장).

## Model

| thing | id | what |
|---|---|---|
| reference | `S#` | one URL, **global**. Snapshots (captures over time), notes from every category, change history. Belongs to any number of categories |
| category | collection name | a research theme (`budget-app-category`, `ai-agent-terminal-category`). Members = refs + role (direct/indirect/analogous) |
| claim | `C#` | one finding citing ≥1 `S#`; global, remembers which categories recorded/confirmed it |
| run | `R#` | one research session in one category |
| axis | `axes.json` | **tag normalization**: free-form pattern tags grouped into global axes (`limit-gauge-pace` + `traffic-light-limits` + `pace-line-chart` → 남은 한도·예산 게이지). facet `pattern` drives comparisons; `market` / `platform` / `positioning` are listed apart |
| plan | `plans/<name>.json` | **optional** — a product plan's items linked to claims with positions. Kept outside the categories so references stay reusable |

**The re-encounter rule** — references are never duplicated. When research B meets something research A already collected:
- same URL (any tracking params / redirect alias) → `capture`/`store`/`source add` **reuse** it, add B's category, merge tags. If its last snapshot is older than `refresh_days` (default 30) it is **re-captured** and the change vs. the previous snapshot is recorded (title, headings, CTAs, nav, colors, fonts; store: version, rating, screenshots). `"force":true` re-captures anyway.
- same *axis* but a different URL (e.g. limit gauges in a budget app and in a dev tool) → `ref run start` lists library refs from **other** categories that are close to this run (local embeddings, ranked by goal and by category centroid). Review them and `ref collect` the ones on the same axis — that adds B's category to them, and their notes/claims from A become visible in B.

## Commands

| Command | Use |
|---|---|
| `ref learn read` / `ref learn add <source\|search\|capture\|pattern\|process> "<lesson>"` | accumulated lessons — **read first** |
| `ref list` · `ref list <collection>` · `ref list [collection] --query "a b"` | categories · members + coverage + evidence · text search |
| `ref show <S#\|url>` | one ref: categories, snapshots, changes, notes from every category, citing claims |
| `ref similar <S#\|C#\|"text"> [--scope refs\|claims\|all] [--k 8]` | semantic neighbours across the whole library |
| `ref categories` | category vectors: nearest categories + number of shared refs |
| `ref run start '<json>'` | start a run → baseline (claims here + claims from other categories on the same refs + stale members + related refs from other categories) |
| `ref capture '<json>'` / `ref store '<json>'` | capture pages / App Store screens (reuse · refresh · new) |
| `ref source add '<json>'` | text-only refs (articles, docs, papers, threads read via WebFetch) |
| `ref collect '<json>'` / `ref uncollect <collection> <S#>` | add / remove existing refs in a category |
| `ref note '<json>'` | note on a ref (`ref`) or on the category; attributed to the category |
| `ref claim add '<json>'` / `ref claim list [collection] [--status] [--kind] [--run]` | findings (create / confirm / revise / refute) |
| `ref delta <collection> [--run R#]` | **A** run delta · **C** category delta (common vs. one-product tags, shared refs) · **T** time delta (re-capture changes, stale members) → `DELTA.md` |
| `ref cite <collection> [--file f]` | every finding line cites known, active `[S#]`/`[C#]` |
| `ref report '<json>'` | category board `<collection>/index.html` — 한눈에 보기 · (커리큘럼 비교) · 패턴 비교 · 레퍼런스(검색 `/`, 역할·패턴·정렬, 보기 3종: 격자 · 제품별 · **흐름**(한 페이지의 화면을 순서대로), 화면 뷰어 + 정보 패널) · 발견과 근거(근거 화면 썸네일) · 조사 기록 · 출처 — plus library home `~/references/index.html` and `README.md`. One template (`scripts/board.mjs`) for every board: change it, re-run `ref report` per collection |
| `ref plan set\|show\|link\|delta` | optional plan layer (see §8) |
| `ref course set '<json>'` / `ref course show <collection>` | curriculum mode: a course's structure (modules · topics · hours) / comparison: topic coverage, usual order, gaps vs. basis (see §9) |
| `ref axes show [collection]` · `ref axes suggest [collection]` · `ref axes set '<json>'` | axes with products/categories · candidate groupings for unmapped tags · define/merge axes |
| `ref embed [--rebuild]` · `ref compact` | refresh vectors (automatic in run/similar) · rewrite JSONL |

### JSON params
```jsonc
// run start — domain: design | dev | research ("related": false skips the embedding search)
{"collection":"…","goal":"which decision this run supports","domain":"design","kind":"category","description":"…"}

// capture (≤ 6 URLs per call; each new capture ~10–40 s; Bash timeout 600000)
{"collection":"…","urls":[{"url":"https://…","label":"Warp — landing","tags":["landing","direct","vertical-tabs"]},
                          {"url":"https://…","label":"Warp — docs agents","tags":["help","app-ui"],"force":true}],
 "refresh_days":30,"wait_ms":1500,"max_frames":16,"frame_wait_ms":800}

// store — "platform":"mac" for desktop apps; "app_id" instead of "app"; "include_ipad":true
{"collection":"…","app":"Toss","country":"kr","label":"토스 — App Store","tags":["direct"],"max_screens":10}

// source add — type: official|docs|store|repo|paper|report|press|community|blog|listicle|other ; credibility A–D (default from type)
{"collection":"…","sources":[{"url":"…","label":"VoiceMode — GitHub README","type":"repo","publisher":"VoiceMode","published":"2026-05-01","note":"…","role":"analogous"}]}

// collect
{"collection":"…","refs":["S5","S18"],"role":"indirect","note":"why it belongs here"}

// note — "ref" omitted = category note; tags = pattern names, they feed the category delta
{"collection":"…","ref":"S12","note":"markdown…","tags":["limit-gauge-pace"]}

// claim add — kind: fact|pattern|benchmark|failure|gap|opinion|hypothesis
{"collection":"…","claims":[
  {"text":"…","kind":"pattern","subject":"Warp","sources":["S2","S9"],"tags":["vertical-tabs"]},
  {"confirms":"C3","sources":["S12"]},
  {"revises":"C4","text":"corrected finding","kind":"fact","sources":["S13"]},
  {"refutes":"C5","text":"what is actually true","kind":"fact","sources":["S14"]}]}

// report
{"collection":"…","summary_file":"/path/to/summary.md","open":false}
```
Tag vocabulary: screen tags `landing, features, pricing, app-ui, onboarding, help, store` (coverage) · role `direct, indirect, analogous` (per category) · anything else = **pattern tag** (kebab-case). Before inventing a tag, `ref axes show` and reuse a tag already on the right axis.

```jsonc
// axes set — merged by id; listed tags MOVE into this axis; "remove":[ids], "untag":[tags]
{"axes":[{"id":"remaining-gauge","label":"남은 한도·예산 게이지","facet":"pattern","description":"…","tags":["limit-gauge-pace","traffic-light-limits"]}]}
```

Confidence is computed: **high** ≥2 independent publishers and score ≥4 (A=3, B=2, C=1, D=0) · **medium** score ≥2 · **low** otherwise · `gap` (absence) caps at medium. Independence = `publisher` if set, else GitHub owner, else host → set `publisher` when one company spans several domains.

## 0. Load memory
1. `ref learn read` — apply every lesson.
2. `ref list` — is there a category for this already? Reuse it instead of creating a near-duplicate (check `ref categories` for close ones).

## 1. Classify and start
- **kind**: *category* ("X 앱 만들기 전" → similar products, `<category>-category`) or *service* ("Y 서비스 분석" → one service + rivals, `<service>-service`).
- **domain**: `design` (디자인/기획 — sections 2–7) · `curriculum` (교육과정·강의 설계 — **§9**) · `dev` (개발: 아키텍처·라이브러리·안티패턴 — planned; meanwhile use sources/claims with WebFetch, skip screen coverage) · `research` (연구/논문 — planned; record papers as `type:"paper"` sources).
- Write a one-line goal (which decision these references support). Pick a reasonable scope if vague; ask only if truly ambiguous.
- `ref run start` → read the whole baseline:
  - claims already here → confirm / revise / refute them, don't re-add
  - claims from other categories on the same refs → reuse what applies
  - stale members → re-capture with `"force":true` if they matter for this goal
  - **related refs from other categories** → open the promising ones (`ref show S#`, look at the preview), `ref collect` those on the same axis with a one-line reason

## 2. Discover candidates (WebSearch → WebFetch) — required minimums
- **≥ 8 WebSearch queries**, **≥ 3 Korean and ≥ 3 English**, covering all 5 angles: listicle/best-of · alternatives/vs · community (reddit, `site:news.ycombinator.com`, 긱뉴스, velog/디스콰이엇) · open source (`github`, `awesome …`) · KR market/local players
- if earlier runs set a direction, **≥ 2 queries aimed at products not yet in the library**
- `ref list --query <name>` before capturing a candidate — it may already be a ref in another category
- **Longlist before shortlist**: every candidate **with its URL** (name · type · URL · source query · one line), aim for ≥ 12; then select 3–5 direct, 1–2 indirect, 1–2 analogous with reasons. Candidates you will cite but not capture → `ref source add` (so they are refs, not just names)
- **Search log**: queries + longlist + selection as a category note tagged `search-log`. The final answer states query count (KR/EN) and longlist size

## 3. Screen coverage — do NOT stop at landing pages
| tag | what | how |
|---|---|---|
| `landing` | home / hero | `capture` |
| `features` / `pricing` | feature tour, plans | `capture` (URLs from `nav:`; pricing is often an in-page section) |
| `app-ui` + `store` | real product screens | `store` (iOS, or `"platform":"mac"`) |
| `help` / `app-ui` | docs / help articles with real UI screenshots | WebSearch `<product> docs <feature>` → `capture` |
| `onboarding` | signup / first-run | store shots, docs, changelog/blog posts with screenshots |
Same product name before " — " in labels (`Warp — landing`). `ref list <collection>` after capturing; fix ⚠ "marketing pages only" before analysis. Desktop/dev tools rarely have store listings → docs, GitHub READMEs, changelogs.

## 4. Capture
- Output per URL: `NEW` (new ref), `REUSED` (already in library — category added, preview printed; read its earlier notes with `ref show`), `REFRESHED` (re-captured; read the printed changes).
- Defaults: wait_ms 1500, max_frames 16, frame_wait_ms 800. Heavy SPAs: wait_ms 3000–5000; scroll-animated: frame_wait_ms 1200; long READMEs: max_frames ≥ 20.
- Opens tabs in the user's **Aside** browser (logged-in sessions). Read-only: never submit forms, sign up, pay, post, or click consent buttons (overlays are hidden, not clicked).
- Retry failures once separately with higher wait_ms; record a lesson if a site keeps failing. Desktop viewport only — mobile UI comes from `store`.

## 5. Analyze — look at the images
Read every printed image. For each new or refreshed ref, `ref note` (with `ref`) covering:
- **구조**: layout, section/screen order, information hierarchy
- **카피/CTA**: headline, value prop, CTA wording & placement
- **비주얼**: palette (`colors:`), typography (`fonts:`), imagery
- **UI 패턴** (app-ui): navigation, key components, states, data density
- **차용할 점 / 피할 점**
Give the note **pattern tags** — through their axes they drive the category delta (common vs. one-product) and cross-category links. Reuse existing tag names (`ref axes show`).
For a REUSED ref, add only what is new for this category's angle. Only state what is visible; mark guesses 추정.

## 6. Claims and deltas
Turn every finding you would put in a summary into a claim, written **from the images/pages you looked at in this session** (not from memory of older notes):
- `pattern` · `benchmark` (price, rating, count, speed) · `failure` (complaints, shutdowns, pitfalls) · `gap` (nobody does it — needs a query aimed at it first) · `fact` · `opinion` · `hypothesis` (no source)
- cite every supporting ref; prefer ≥2 independent publishers
- baseline claim seen again → `confirms`; partly wrong → `revises`; wrong → `refutes`
**Normalize tags** whenever `note`/`capture` warns "tags not on any axis": `ref axes suggest <collection>` proposes mutual-nearest pairs and nearest axes from tag names only — expect surface matches (scroll-storytelling ~ scrollback-context). Judge against the notes (same *solution*, not same words), then `ref axes set` (add to an existing axis, or create one with a Korean label + one-line description). An axis may span categories — that is the point (AI 한도 게이지 ≈ 가계부 예산 게이지).
Then `ref delta <collection>`: A tells what this run changed, C what is common / partly shared / one-product **by axis** and which axes other categories share, T what changed on re-captured refs and what is stale. `ref categories` shows shared refs and shared axes between categories.

## 7. Report, learnings, commit
- Summary markdown (scratch file): 목표 · 대상 제품 · **이번 실행에서 바뀐 것** (delta A + T) · 핵심 발견 · **공통 vs 차별** (delta C, by axis) · **다른 카테고리와 공유하는 축** · 추천 방향 · 열린 질문. Every finding line ends with `[C#]`/`[S#]`; inferences say 추정/가설.
- `ref cite <collection> --file <summary>` → fix every ⚠ → `ref report` with `summary_file`. The summary is rendered as markdown (tables, lists, `[C#]` chips) — write it for a human reader: short sections, tables for product lists.
- `ref learn add` for each reusable, verified lesson.
- **Commit**: `git -C ~/references add -A && git -C ~/references commit -m "<collection>: <run goal>"` (end the message with the session's attribution line). Do not push unless the user asks. If the library is not a git repo, skip and suggest `ref setup --git`. **Never push the library anywhere** unless the user asks — it holds captures of third-party pages.
- Final answer: summary, board path (`open ~/references/<collection>/index.html`; library home `open ~/references/index.html`), query count (KR/EN) + longlist size, refs NEW / REUSED / REFRESHED, categories added to existing refs, claims (by confidence) + what changed vs. baseline, coverage gaps, failures, next captures.

## 8. Plans (optional)
Only when research feeds a concrete product plan. The plan lives in `plans/<plan>.json` (`"repo"` points at the product's repo); categories stay plan-agnostic.
- `ref plan set` `{"plan":"my-app","goal":"…","audience":"…","repo":"~/…","collections":["…"],"items":[{"type":"feature","text":"…"},{"type":"assumption","text":"…"}]}` (types feature F# · assumption A# · constraint K# · metric M#)
- `ref plan link` `{"plan":"my-app","links":[{"item":"F1","claim":"C20","position":"duplicate","note":"…"}]}` — positions: `table-stakes · duplicate · below-bar · differentiator · gap` (features) · `validates · contradicts` (assumptions)
- `ref plan delta <plan>` → items × positions → verdicts (근거 없음 · 이미 있음 · 기준 미달 · 차별 가능 · 가정 충돌 …), flags links whose claim was later corrected, and suggests unlinked claims per item by similarity (suggestions are unjudged — confirm before linking).

## 9. Curriculum mode (`domain: "curriculum"`)
For references that feed a course or curriculum design ("AI 교육 커리큘럼 만들기 전"). Sections 0–7 still apply; this replaces the screen-oriented parts.

**Start**: `ref run start '{"collection":"ai-literacy-office-workers","title":"직장인 AI 활용 교육","domain":"curriculum","kind":"category","goal":"비전공 직장인 대상 AI 활용 커리큘럼 설계 — 무엇을·어떤 순서로·몇 시간"}'`. Put the **audience** in the goal; every judgment below is relative to it.

**Discovery angles** (same minimums: ≥ 8 queries, ≥ 3 KR, ≥ 3 EN; longlist ≥ 12 with URLs):
| angle | example queries | becomes |
|---|---|---|
| 글로벌 입문 강의 | `AI for everyone course syllabus`, `generative AI for non-technical professionals course`, `Google AI Essentials modules`, `DeepLearning.AI short course generative AI for everyone` | course refs |
| 국내 강의 플랫폼 | `직장인 생성형 AI 활용 강의 커리큘럼`, `비전공자 AI 업무 활용 교육 과정` (인프런·패스트캠퍼스·클래스101·K-MOOC·멀티캠퍼스·휴넷) | course refs |
| 기업·공공 교육 | `기업 AI 리터러시 교육 커리큘럼`, `공공기관 생성형 AI 교육 과정`, `K-디지털 기초역량 AI` | course refs |
| 근거 — 역량 기준 | `UNESCO AI competency framework`, `DigComp 2.2 AI`, `교육부 AI 역량 기준`, `디지털 역량 프레임워크 직장인` | `type:"framework"` |
| 근거 — 수요 | `직장인 생성형 AI 활용 실태 조사`, `AI 교육 수요 조사 기업`, job postings asking for "AI 활용 능력" | `type:"survey"` / `"job-posting"` / `"report"` |
| 후기·실패 | `<강의명> 후기`, `AI 강의 수강 후기 어려웠던 점`, `직장인 AI 교육 효과 없는 이유` | `reviews` pages → `failure` claims |

**Coverage tags**: `landing`, **`syllabus` (required — no syllabus, no module comparison)**, `sample-lesson`, `project`, `assessment`, `reviews`, `pricing`. `ref list <collection>` warns on courses without a syllabus page.

**Course structure** — for every course, read the syllabus (WebFetch the page; capture it too for the board) and record:
```jsonc
// ref course set — hours/price are numbers (price in KRW unless "currency":"USD"); omit what the page does not state
{"collection":"…","ref":"S40","source":"page","course":{"title":"…","provider":"…","audience":"비전공 직장인","level":"intro",
 "prerequisites":["코딩 불필요"],"hours":12,"weeks":4,"format":"self-paced","price":99000,"language":"ko","credential":"수료증",
 "assessment":["퀴즈","실습 과제"],
 "modules":[{"title":"생성형 AI 이해","topics":["ai-basics"],"hours":2},
            {"title":"업무 문서 자동화","topics":["doc-automation"],"hours":3,"hands_on":true}]}}
```
`level`: intro · beginner · intermediate · advanced. `format`: self-paced · live-online · cohort · offline · hybrid. Never guess hours; if you estimate, set `"source":"estimate"` and say so in the summary.

**Topics** = module tags at the grain of a *learning outcome* (프롬프트 작성, 업무 문서 자동화, 데이터 정리·분석, 이미지·발표자료 생성, 결과 검증(할루시네이션), AI 윤리, 개인정보·보안, 직무별 활용 …). Reuse existing topic tags; normalize new ones with `ref axes set` using `"facet":"topic"` and add Korean `tag_labels`. Topic axes are global, so later curriculum research reuses them.

**Basis** — frameworks, surveys, job postings: `ref source add` with the type and **topic tags** (what they say should be taught or is in demand). Topics present in basis but taught by < 30 % of courses show up as **빈틈**.

**For non-technical office workers**, check and note per course: coding required or not, weekly time load, whether practice uses the learner's *own* work documents, which tools (ChatGPT / Copilot / Gemini / 사내 도구), job-specific tracks (영업·마케팅·인사·재무), security/policy guidance for company data, follow-up support after the course.

**Read the comparison**: `ref course show <collection>` (text) / board section **커리큘럼 비교** (강의 개요 · 주제별 커버리지 · 강의들의 평균 순서 · 빈틈 · 강의별 흐름).
**Claims**: `benchmark` (총 시간·가격 중앙값, 실습 비중), `pattern` (공통 순서, 공통 실습 방식), `gap` (근거엔 있는데 안 가르침), `failure` (후기 불만: 너무 쉬움/어려움, 실습 부족, 업무 적용 안 됨).
**Summary**: 대상 · 비교한 강의 · 공통 필수 주제 · 권장 순서와 시간 배분 · 빈틈 · 실패 사례 · 우리 커리큘럼 제안 — each line cited. Optionally put the draft curriculum's modules in a plan (§8) and link claims.

## 10. Agents read the library over MCP
`scripts/mcp.mjs` is a **read-only** MCP server, started by the plugin as `reference-library`.
Tools: `list_collections` · `search_references` (semantic + keyword, returns preview image paths) · `get_reference` (notes from every collection, snapshot images, changes, citing findings) · `search_findings` (claims with evidence + confidence) · `get_patterns` (axis → how each product solves it, across collections) · `get_board` (summary + findings).
- Before starting new research, an agent can call `search_references` / `get_patterns` to reuse what the library already knows (complements `ref run start`).
- Outside a research session (planning, design, writing), use these tools to ground answers in prior references; open returned image paths with Read.
- Writing stays in the `ref` CLI — the server never changes the library.

## Notes
- Requirements: Node 20+, `python3` with Pillow, and a capture backend — `aside` CLI (logged in; captures with the user's logins) or Google Chrome / Chromium / Edge (headless, no logins; `REF_CHROME=<path>` for other locations, `REF_CAPTURE=aside|chrome|none` to force). Core npm deps install themselves on first `ref`. Embeddings are optional: `ref setup --embeddings` (~700 MB into `~/.reference-research`); model `Xenova/multilingual-e5-small` downloads once (~120 MB). Scores cluster 0.75–0.9 — compare ranks, not absolute values.
- Without Aside, captures run in headless Chrome: logged-in pages and some bot-protected sites fail or show a login wall — note it in the report and record them with `ref source add`. With no backend at all: WebFetch text + `ref source add` only (no screenshots); say so in the report.
- Login-only flows the user explicitly wants explored (Aside only): `aside exec "<task>"`; never perform irreversible actions.
- Library layout and record formats: header comment of `scripts/store.mjs`. v1 libraries: `ref migrate` (commit first).
