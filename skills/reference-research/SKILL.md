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
| category | collection name | a research theme (`budget-app-category`, `ai-agent-terminal-category`). Members = refs + role (direct/indirect/trend; older members may still read analogous) |
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
| `ref brief set '<json>'` / `ref brief show <collection>` | the category's confirmed brief; a later change needs a `reason` and goes on its history |
| `ref run start '<json>'` | start a run with its `brief` → baseline (claims here + claims from other categories on the same refs + stale members + related refs from other categories) |
| `ref run round '<json>'` / `ref run show <collection>` | record one search round; the CLI counts what is new and decides the stop · rounds, totals and the longlist newest first |
| `ref date <S#\|url> [--at YYYY-MM[-DD]]` | first web-archive snapshot (lower bound of an unknown date) · closest snapshot to a date (유지 여부) |
| `ref capture '<json>'` / `ref store '<json>'` | capture pages / App Store screens (reuse · refresh · new) |
| `ref source add '<json>'` | text-only refs (articles, docs, papers, threads read via WebFetch) |
| `ref collect '<json>'` / `ref uncollect <collection> <S#>` | add / remove existing refs in a category |
| `ref note '<json>'` | note on a ref (`ref`) or on the category; attributed to the category |
| `ref claim add '<json>'` / `ref claim list [collection] [--status] [--kind] [--run]` | findings (create / confirm / revise / refute) |
| `ref delta <collection> [--run R#]` | **A** run delta · **C** category delta (common vs. one-product tags, shared refs) · **T** time delta (re-capture changes, stale members) → `DELTA.md` |
| `ref cite <collection> [--file f]` | every finding line cites known, active `[S#]`/`[C#]`; also warns on key claims citing only 지난 자료 |
| `ref fresh <collection>` | 신선 / 지난 자료 / 날짜 미상 split, key claims citing only 지난 자료, undated refs in the order to fill them |
| `ref channels <collection>` | refs per channel (1차 · 해석 · 반응 · 이유) and Korean sources; warns on what is missing |
| `ref report '<json>'` | category board `<collection>/index.html` — 목적 블록 + 숫자 타일 · 한눈에 보기 · (커리큘럼 비교) · 패턴 비교 · 레퍼런스(검색 `/`, 역할·패턴·회차·정렬, 보기 3종: 격자 · 제품별 · **흐름**(한 페이지의 화면을 순서대로), 화면 뷰어 + 정보 패널; 캡처 없는 자료는 **자료 목록** 표) · 발견과 근거(제목/내용/메타 3단, 근거 화면 썸네일, 회차·근거 세기 필터) · 조사 기록 · 출처(인용된 것만, 등급·종류 필터) — ids are copy buttons. Plus library home `~/references/index.html` and `README.md`. One template (`scripts/board.mjs`) for every board: change it, re-run `ref report` per collection. The goal block reads `collection.goal`, else the last run's goal, else the summary's "목표" line |
| `ref plan set\|show\|link\|delta` | optional plan layer (see §8) |
| `ref course set '<json>'` / `ref course show <collection>` | curriculum mode: a course's structure (modules · topics · hours) / comparison: topic coverage, usual order, gaps vs. basis (see §9) |
| `ref axes show [collection]` · `ref axes suggest [collection]` · `ref axes set '<json>'` | axes with products/categories · candidate groupings for unmapped tags · define/merge axes |
| `ref embed [--rebuild]` · `ref compact` | refresh vectors (automatic in run/similar) · rewrite JSONL |

### JSON params
```jsonc
// run start — domain: design | dev | strategy | voice | travel | research | curriculum ("related": false skips the embedding search)
// brief = the confirmed table (§1): keys purpose, audience, problem, success, value_types, scope, fixed, exclude, assumptions. purpose and audience also land on the category (board header: 목적 · 대상); "goal" overrides the run's goal
{"collection":"…","brief":{"purpose":"which decision this run supports","audience":"who the result is for","problem":"…","success":"…","value_types":["디자인·UX"],"scope":["direct","trend"],"fixed":"…","exclude":"…","assumptions":["…"]},"question":"one-line question","domain":"design","kind":"category","description":"…"}

// brief set — a change after round 0; reason goes on the history
{"collection":"…","brief":{"scope":["direct"]},"reason":"0바퀴 뒤 직접 경쟁으로 좁힘"}

// run round — after every round. lang is inferred when omitted; published only as a full date from the page; new_axes = patterns seen this round, repeats are dropped by the CLI
{"collection":"…","queries":[{"q":"…","lang":"ko"}],"candidates":[{"url":"…","title":"…","published":"2026-09-30"}],"new_axes":["무료 한도"],"dropped":[{"channel":"reaction","ref":"S41","reason":"G2 표본에 화면 의견 없음"}]}

// capture (≤ 6 URLs per call; each new capture ~10–40 s; Bash timeout 600000)
{"collection":"…","urls":[{"url":"https://…","label":"Warp — landing","tags":["landing","direct","vertical-tabs"]},
                          {"url":"https://…","label":"Warp — docs agents","tags":["help","app-ui"],"force":true}],
 "refresh_days":30,"wait_ms":1500,"max_frames":16,"frame_wait_ms":800}

// store — "platform":"mac" for desktop apps; "app_id" instead of "app"; "include_ipad":true
{"collection":"…","app":"Toss","country":"kr","label":"토스 — App Store","tags":["direct"],"max_screens":10}

// source add — type: official|docs|store|repo|paper|report|press|community|blog|listicle|other ; credibility A–D (default from type)
// channel: primary|interpretation|reaction|rationale (default from type) · published = a full YYYY-MM-DD the page states, else leave it out
// capture reads the date from the page and prints `published:`. If it prints unknown, set it on the same URL: {"sources":[{"url":"…","published":"2026-09-30"}]}
{"collection":"…","sources":[{"url":"…","label":"VoiceMode — GitHub README","type":"repo","publisher":"VoiceMode","published":"2026-05-01","summary":"one-line 요지 (board 자료 목록)","note":"…","role":"trend"}]}

// collect
{"collection":"…","refs":["S5","S18"],"role":"indirect","note":"why it belongs here"}

// note — "ref" omitted = category note; tags = pattern names, they feed the category delta
// analysis = "fields", one key per part of §5; the viewer renders them as labels. why needs why_basis: official|signal|guess. Send fields or note, not both
{"collection":"…","ref":"S12","fields":{"feature":"…","context":"…","why":"… [S3]","why_basis":"official","alternatives":"… [S7]","result":"…","implication":"차용 — … (조건: …)"},"tags":["limit-gauge-pace"]}

// claim add — kind: fact|pattern|benchmark|failure|gap|opinion|hypothesis
// subject = 5–12 char title the board shows (always give one) · key = headline finding (board 핵심 결론) · asOf = date a price/number was true · scope = where it applies; "원리" = a principle about human cognition or theory (freshness rule, §2)
{"collection":"…","claims":[
  {"text":"…","kind":"pattern","subject":"세로 탭 상태","sources":["S2","S9"],"tags":["vertical-tabs"]},
  {"text":"개인 유료 첫 단계 월 5–14천원","kind":"benchmark","subject":"개인 유료 가격","asOf":"2026-10-15","key":true,"sources":["S1","S2"]},
  {"update":"C7","subject":"기업 단계","key":true},
  {"confirms":"C3","sources":["S12"]},
  {"revises":"C4","text":"corrected finding","kind":"fact","sources":["S13"]},
  {"refutes":"C5","text":"what is actually true","kind":"fact","sources":["S14"]}]}

// report — header fields are optional and stored on the category; without them the board reads the summary's 핵심 결론 / 열린 질문 / 추천 sections
// result = one-line outcome of this run (closes it in 조사 기록) · view = default reference view grid|rows|flow
{"collection":"…","summary_file":"/path/to/summary.md","open":false,
 "highlights":["C12","C3","C8"],"open_questions":["…"],"next_steps":["…"],"audience":"…","result":"…"}
```
Tag vocabulary: screen tags `landing, features, pricing, app-ui, onboarding, help, store` (coverage) · role `direct, indirect, trend` (per category) · anything else = **pattern tag** (kebab-case). Before inventing a tag, `ref axes show` and reuse a tag already on the right axis.

```jsonc
// axes set — merged by id; listed tags MOVE into this axis; "remove":[ids], "untag":[tags]
// verdict = the one-line conclusion for this pattern (shown on the card): 기본기인가, 선택인가, 차별점인가 — cite [C#]
{"axes":[{"id":"remaining-gauge","label":"남은 한도·예산 게이지","facet":"pattern","description":"…","verdict":"게이지는 기본기 — 따라간다 [C4]","tags":["limit-gauge-pace","traffic-light-limits"]}]}
```

Confidence is computed: **high** ≥2 independent publishers and score ≥4 (A=3, B=2, C=1, D=0) · **medium** score ≥2 · **low** otherwise · `gap` (absence) caps at medium. Independence = `publisher` if set, else GitHub owner, else host → set `publisher` when one company spans several domains.

## 0. Load memory
1. `ref learn read` — apply every lesson.
2. `ref list` — is there a category for this already? Reuse it instead of creating a near-duplicate (check `ref categories` for close ones).

## 1. Question loop, then start
Ask before searching. Models are weak at noticing a vague request on their own, and a request copied straight into the goal makes a run drift. The brief below is a hypothesis: §2 rechecks it after round 0.

**Round 1 — always, minus what the request already answers.** Use **AskUserQuestion** (≤ 4 questions, 2–4 options each; "Other" is automatic) and write the options as concrete guesses from the request. Without that tool, ask the same questions in text, still ≤ 4 per round.
| slot | question |
|---|---|
| 문제 | 지금 무엇이 안 되고 있어서 이 조사를 하나요? |
| 목표 | 조사 결과로 무엇을 결정하거나 만드나요? 누가 보나요? |
| 가치 유형 | 전략·비즈니스 / 디자인·UX / 사용자 반응·시장 / 여행·동선 / 기술·개발 / 교육과정 — offer the 3–4 likeliest as a multi-select |
| 성공 모습 | 조사가 끝났을 때 손에 무엇이 있으면 성공인가요? |

**Avoidance requests** ("~티 안 나게", "~처럼", "세련되게"): an avoidance condition is not a goal, so never copy it into `goal`. Ask this ladder + 가치 유형 instead of the table above (대신 무엇 stands in for 성공 모습), and write `goal` from the answers:
| step | question |
|---|---|
| 왜 | 그게 왜 문제인가요? 보는 사람이 어떻게 느끼나요? |
| 어디서 | 어느 부분에서 그렇게 느껴지나요? (색 · 배치 · 말투 · 도형 …) |
| 대신 무엇 | 대신 어떤 느낌이면 성공인가요? 예시가 있나요? |

**Round 2 — only if round 1 did not settle the scope:**
| 범위 | 뜻 |
|---|---|
| 직접 (`direct`) | 같은 문제를 같은 방식으로 푸는 것 |
| 간접 (`indirect`) | 같은 문제를 다른 방식으로, 또는 같은 방식으로 다른 고객을. 다른 업종이지만 구조가 같은 것도 여기 넣는다 |
| 트렌드 (`trend`) | 해외·최신 흐름. 이 분야가 어디로 가는지 |

**Brief**: turn the answers into a table (목적 · 대상 · 문제 · 성공 기준 · 가치 유형 · 범위 · 고정할 것 · 뺄 것 · 가정). Fill blanks yourself and mark them **가정**; scope unknown → all three scopes, marked 가정.
- **Confirm it before searching**: AskUserQuestion, one single-select question "이 개요로 시작할까요?", options `이대로 시작` / `고칠 곳 있음`, with the full table in each option's `preview`. `고칠 곳 있음` → AskUserQuestion again, one question per 가정 slot (≤ 4): the current value first, then 1–3 concrete alternatives. Update the table and confirm again. A prose summary does not count. Without that tool, print the full table.
- **Print the full table instead, then start**, when the user said "알아서" (in the request or as an answer), or when no slot is 가정.
- The request already states 문제, 목표 and 가치 유형 → skip round 1 and go straight to the brief.

**Start**
- **kind**: *category* ("X 앱 만들기 전", or a topic → similar products, `<category>-category`) or *service* ("Y 서비스 분석" → one service + rivals, `<service>-service`).
- **domain**: `design` (디자인·UX — sections 2–7) · `curriculum` (교육과정 — **§9**) · `dev` (기술·개발: 아키텍처·라이브러리·안티패턴 — planned; meanwhile use sources/claims with WebFetch, skip screen coverage) · `strategy` (전략·비즈니스) · `voice` (사용자 반응·시장) · `travel` (여행·동선) · `research` (연구/논문; record papers as `type:"paper"` sources). The last four are source-led: skip screen coverage, capture only pages that are evidence themselves.
- `ref run start`, after the brief is confirmed, with `purpose` = the decision (not the request's wording), `brief`, `question` = the one question the decision hinges on. Read the whole baseline:
  - claims already here → confirm / revise / refute them, don't re-add
  - claims from other categories on the same refs → reuse what applies
  - stale members → re-capture with `"force":true` if they matter for this goal
  - **related refs from other categories** → open the promising ones (`ref show S#`, look at the preview), `ref collect` those on the same axis with a one-line reason

## 2. Discover candidates (WebSearch → WebFetch) — newest first, in rounds
**Gate: no WebSearch until the brief is confirmed or printed as a full table, and `ref run start` has stored it (§1).**

Read newest first and let the newest sources rewrite the next queries. WebSearch has no date sort or filter, so dates come from the queries and from the pages you open.

### Freshness rule (12 months back from today)
| status | meaning | may be used for |
|---|---|---|
| 신선 | published or updated within 12 months | anything: exemplars, key claims |
| 지난 자료 | older, or date unknown | only a principle (human cognition, theory) or a before/after comparison |

Date unknown → look for it on the page, then `ref date <S#>` for a lower bound. Never invent a month or day: a year alone counts as unknown.

### Channels by value type — choose before round 0
| 가치 유형 | 1차 (사실·실물) | 해석 | 반응 | 이유 근거 | 편향 주의 | 남길 것 |
|---|---|---|---|---|---|---|
| 전략·비즈니스 | DART·SEC 공시, IR·실적 발표, 가격·약관 | 증권사·업계 리포트, 언론 | 고객 리뷰, 커뮤니티 | 실적 발표 질의응답, 대표 인터뷰, 채용 공고 | IR은 회사 관점 | 수익 구조·가격·성장 수치 (기준일 필수) |
| 디자인·UX | 실제 제품 화면(캡처·앱스토어·실서비스 화면 라이브러리), 공식 디자인 시스템·브랜드 가이드 | 템플릿 플랫폼 본문, 디자인 매체 리뷰 | 리뷰 중 화면 관련 의견 | 체인지로그, 디자인 블로그·발표 | 콘셉트 샷은 '영감'으로만 | 화면 흐름, 색·글꼴 체계, 상태 화면 |
| 사용자 반응·시장 | 앱스토어·플레이 리뷰(버전·날짜별), G2·Capterra | 리뷰 분석 리포트 | Reddit·HN·GitHub 이슈, 국내 커뮤니티 | 회사의 답글·공지 | 불만 많은 사용자 과대표, 체험단·광고 | 원문 인용 + URL + 날짜 + 작성자 유형 |
| 여행·동선 | 공식(관광청·시설 영업시간·요금), 지도 앱의 영업시간·이동 시간 | 큐레이션 앱·가이드북 | 최근 6개월 방문 후기 | — | 협찬·체험단, 폐업·시간 변경 | 동선·시간표, 장소마다 마지막 확인일 |
| 기술·개발 | 공식 문서, GitHub 릴리스·이슈, 표준 | 엔지니어링 블로그, 벤치마크 | HN·Reddit·이슈 토론 | RFC·설계 문서·릴리스 노트 | 벤치마크 조건 차이 | 버전 기준 비교 |
| 교육과정 (§9) | 강의계획서 | 역량 프레임워크·수요 조사 | 수강 후기 | — | 판매 페이지 과장 | 모듈·시간·순서 |

- Per value type, see ≥ 1 primary, ≥ 1 reaction and ≥ 1 rationale channel (where the table has one), including ≥ 1 Korean channel.
- To drop a channel, sample one item from it first and pass its channel, S# and reason in `dropped` of `ref run round`. `ref channels <collection>` checks all of this before analysis, for the category as a whole.
- Several value types → give the main one more queries. Splitting channels across subagents is possible but costly: only when the user asks.

### Rounds — widen → read → narrow, at most 3 rounds including round 0
1. **Round 0**: queries carrying this year and last year, `latest`, `changelog`, `release notes`, recent announcements. Note each candidate's published date; sort the longlist newest first.
2. **Recheck, after round 0 only**: AskUserQuestion (or one line of text), "최신 자료를 보니 X 쪽으로 좁혀집니다. 맞나요?". Record a changed answer with `ref brief set` and a `reason`. If the user said "알아서", state the narrowing as 가정 and continue.
3. **Clues**: from the newest 5–10 candidates, pull repeated names, terms and patterns → the next round's queries.
4. **Branch**: follow good sources backward (what they reference) and forward (what came after, what copied them).
5. **Stop**: `ref run round` says 멈춤 when a round adds no new pattern, or at round 3.

End every round, round 1 included, with `ref run round` and copy the first line it prints into the chat as is, so the loop is visible.

### Minimums, across all rounds
- **≥ 8 WebSearch queries**, **≥ 3 Korean and ≥ 3 English**, covering all 5 angles: listicle/best-of · alternatives/vs · community (reddit, `site:news.ycombinator.com`, 긱뉴스, velog/디스콰이엇) · open source (`github`, `awesome …`) · KR market/local players
- if earlier runs set a direction, **≥ 2 queries aimed at products not yet in the library**
- `ref list --query <name>` before capturing a candidate — it may already be a ref in another category
- Capture only URLs seen in search or fetch results; never guess one
- WebFetch refused or blocked (403, bot check) → `ref capture` that URL before settling for a secondary source
- **Longlist before shortlist**: every candidate **with its URL** (name · type · URL · published date or 미상 · source query · one line), newest first, aim for ≥ 12; then select 3–5 direct, 1–2 indirect, 1–2 trend with reasons. Exemplars must be 신선. Candidates you will cite but not capture → `ref source add` (so they are refs, not just names)
- **Search log**: `ref run round` keeps queries, candidates, new patterns and dropped channels. Note the selection with its reasons as a category note tagged `search-log`. Take every count in the final answer from `ref run show <collection>`: query count (KR/EN), rounds and longlist size

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
- Opens tabs in the user's **Aside** browser (logged-in sessions). Read-only: never submit forms, sign up, pay, post, or click consent buttons (cookie banners and modal popups are hidden, not clicked; `"hide_overlays":false` keeps them).
- `bot check not passed` = nothing was saved. A Chrome capture already retried through Aside. Never solve a check: ask the user to open the page, or record it with `ref source add`.
- Keep the `Capture backend:` line when filtering the output, and say it in chat (`캡처: Aside 4건`). `Notes:` lines are warnings, not failures: the page was captured.
- Retry failures once separately with higher wait_ms; record a lesson if a site keeps failing. Desktop viewport only — mobile UI comes from `store`.

## 5. Analyze — look at the images, then trace why
Read every printed image. Do not stop at what is on screen: trace why it was built this way, with evidence. For each new or refreshed ref, `ref note` (with `ref`, as `fields`):
| part (key) | asks | evidence rule |
|---|---|---|
| 기능 (`feature`, or `structure` `copy` `visual` `ui`) | what is visible, as is: 구조 · 카피/CTA · 비주얼 (`colors:`, `fonts:`) · UI 패턴 | capture S# and screen number required |
| 맥락 (`context`) | for whom, under what constraints (고객 · 시장 · 시기 · 플랫폼) | S# if sourced, else 추정 |
| 왜 (`why`, `why_basis`) | why it was built this way | required basis: `official` 공식 (the company said so: blog, changelog, talk, interview) / `signal` 정황 (job ads, price changes, repetition across products) / `guess` 추정 (hypothesis) |
| 대안 (`alternatives`) | how others solved the same problem | ≥ 1 other S# |
| 결과 (`result`) | did it work | official numbers, user reaction, 유지 여부 (still there a year later: re-capture changes, web archive), spread (did others copy it) |
| 시사점 (`implication`) | what it means for the brief's goal | one of 차용 · 변형 · 회피, plus its condition |
All six parts only for the 3–5 key refs; the rest get 기능 + 시사점. Write 회피 for a combination in its context, never as a blanket ban on one element.
Give the note **pattern tags** — through their axes they drive the category delta (common vs. one-product) and cross-category links. Reuse existing tag names (`ref axes show`).
For a REUSED ref, add only what is new for this category's angle. Only state what is visible; mark guesses 추정.

## 6. Claims and deltas
Turn every finding you would put in a summary into a claim, written **from the images/pages you looked at in this session** (not from memory of older notes):
- `pattern` · `benchmark` (price, rating, count, speed) · `failure` (complaints, shutdowns, pitfalls) · `gap` (nobody does it — needs a query aimed at it first) · `fact` · `opinion` · `hypothesis` (no source)
- **always a `subject`** (5–12 chars — the board's title line; `claim add` warns without one) · `asOf` on every price/number · `key:true` on the 2–4 findings a reader must not miss (`{"update":"C#","key":true}` for existing ones)
- cite every supporting ref; prefer ≥2 independent publishers
- **key claims**: need ≥ 1 신선 source unless `scope:"원리"`; `ref fresh <collection>` lists the ones that do not, and what to fix. A key claim also cannot rest on a 왜 or 결과 that is only 추정: check that yourself
- baseline claim seen again → `confirms`; partly wrong → `revises`; wrong → `refutes`
**Normalize tags** whenever `note`/`capture` warns "tags not on any axis": `ref axes suggest <collection>` proposes mutual-nearest pairs and nearest axes from tag names only — expect surface matches (scroll-storytelling ~ scrollback-context). Judge against the notes (same *solution*, not same words), then `ref axes set` (add to an existing axis, or create one with a Korean label + one-line description). An axis may span categories — that is the point (AI 한도 게이지 ≈ 가계부 예산 게이지).
Then `ref delta <collection>`: A tells what this run changed, C what is common / partly shared / one-product **by axis** and which axes other categories share, T what changed on re-captured refs and what is stale. `ref categories` shows shared refs and shared axes between categories.

## 7. Report, learnings, commit
- Summary markdown (scratch file), conclusion first, with **these `##` headings, in this order** (the board reads them):
| heading | content |
|---|---|
| `## 목표` | the decision this run supports |
| `## 핵심 결론` | bullets, in order: the question answered · the answer in one sentence · the proposed decision · the strongest counter-evidence · 3 evidence bullets (claim headline + `[C#]`, with `[S#]` of the representative screen) |
| `## 왜 이렇게 만들었나` | 3–5 key refs: 왜 with its basis (공식·정황·추정) + 결과 |
| `## 공통 vs 차별` | delta C by axis: 기본기 · 선택지 · 차별점; include 다른 카테고리와 공유하는 축 |
| `## 피할 것` | combinations in their context |
| `## 추천` | next actions |
| `## 열린 질문` | bullets |
| `## 이번 실행에서 바뀐 것` | delta A + T |
| `## 조사 과정` | short prose, no bullets: brief, channels, rounds, how many sources are 신선 vs 지난 자료 |
- Writing rules: a headline is a claim sentence of about 40 characters, not a topic label · C#/S# appear only as trailing chips, never inside the prose · ≤ 3 sentences per paragraph · inside a section use bullets or tables, because the board reads a line starting with `**` as a heading · every finding line ends with `[C#]`/`[S#]`; inferences say 추정/가설.
- `ref fresh <collection>` and `ref cite <collection> --file <summary>` → fix every ⚠ → `ref report` with `summary_file`, plus `highlights` (the C# of 핵심 결론, or rely on `key:true`), `open_questions`, `next_steps`. The board shows them as 핵심 결론 / 열린 질문 under the header; the summary is rendered as markdown (tables, lists, `[C#]` chips) — write it for a human reader: short sections, tables for product lists.
- After `ref delta`, give each pattern axis with ≥2 products a `verdict` (`ref axes set`): 기본기 / 선택지 / 차별점 후보, cited. Pass the run's one-line outcome as `result` to `ref report`.
- `ref learn add` for each reusable, verified lesson.
- **Commit**: `git -C <library> add -A && git -C <library> commit -m "<collection>: <run goal>"`, with `<library>` from the `library:` line of `ref doctor` (end the message with the session's attribution line). Do not push unless the user asks. If the library is not a git repo, skip and suggest `ref setup --git`. **Never push the library anywhere** unless the user asks — it holds captures of third-party pages.
- Final answer: summary, board path (`open ~/references/<collection>/index.html`; library home `open ~/references/index.html`), query count (KR/EN) + rounds + longlist size, refs NEW / REUSED / REFRESHED, categories added to existing refs, claims (by confidence) + what changed vs. baseline, coverage gaps, failures, next captures.

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
- Library layout and record formats: header comment of `scripts/store.mjs`. v1 libraries: `ref migrate` (commit first). Members still marked `analogous`: `ref migrate roles --dry-run`, then without the flag (commit first).
