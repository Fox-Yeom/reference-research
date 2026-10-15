# Roadmap

Goal frame: references must serve 5 purposes (시행착오 절감 · 벤치마크 · 차별화 · 커뮤니케이션 · 근거·신뢰) across 3 domains (디자인/기획 · 개발 · 연구/논문).

## Beta (now)
- [x] 0.1.0-beta.1 — plugin packaging, Chrome fallback, doctor/setup, optional embeddings, README tour
- [x] Board readability phase 1 (2026-10-15, `docs/BOARD-REDESIGN.md` §3): goal block + stat tiles, 3-line claim cards with run/date/source mix, text-only refs as a table, limited lists, copyable ids, scrollspy, home goal lines. Largest real board 73,000px → 29,000px first load.
- [ ] Board phase 2 (`BOARD-REDESIGN.md` E1·E2·E3·E6 + A2·A3·D2·D3·C4·G1): collection goal/highlights/openQuestions, claim key/asOf, subject warning in `claim add`, SUMMARY section contract → key takeaways + open questions on top, "다시 확인" / "이어서 하기" prompt copy, finding-kind tabs, viewer tabs
- [ ] Board phase 3 (E4·E5·E7·E8·E9 + F1·F2·F4·D8): structured notes, text-ref summaries, run timeline, axis verdicts, research-domain evidence table, `ref://` URIs
- [ ] Release 0.1.0-beta.2 after phase 1 feedback (bump all three versions — `docs/RELEASE.md`)
- [ ] Collect tester feedback (Issues, label `beta`) → triage into this file
- [ ] Localize remaining English board/CLI messages testers see (coverage warning, doctor lines)
- [ ] Windows/Linux: Chrome path detection, shell wrappers (`scripts/ref` is bash)
- [ ] Consider moving to a free Organization for read-only tester access (see DECISIONS)

## Next modes
- [ ] **dev mode** (`domain: dev`): library/architecture comparison — repos, docs, benchmarks, issues as sources; anti-pattern claims
- [ ] **research mode** (`domain: research`): papers — prior work, research gaps, citation-grade sources

## Library content (maintainer's own, not shipped)
- [ ] `budget-app-category`: 17 refs, 0 claims — write claims
- [ ] optional: design-visualization research for boards
