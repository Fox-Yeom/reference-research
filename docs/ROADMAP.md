# Roadmap

Goal frame: references must serve 5 purposes (시행착오 절감 · 벤치마크 · 차별화 · 커뮤니케이션 · 근거·신뢰) across 3 domains (디자인/기획 · 개발 · 연구/논문).

## Beta (now)
- [x] 0.1.0-beta.1 — plugin packaging, Chrome fallback, doctor/setup, optional embeddings, README tour
- [x] Board readability phase 1 (2026-10-15, `docs/BOARD-REDESIGN.md` §3): goal block + stat tiles, 3-line claim cards with run/date/source mix, text-only refs as a table, limited lists, copyable ids, scrollspy, home goal lines. Largest real board 73,000px → 29,000px first load.
- [x] Board phase 2 (2026-10-15): collection goal/audience/question/highlights/openQuestions/nextSteps, claim key/asOf/scope + `update` form + subject warning, SUMMARY heading contract → 핵심 결론 + 열린 질문 section, "다시 확인" / "이어서 하기" prompt copy, finding-kind tabs, viewer 발견 tab. Largest board 29,300px → 23,000px.
- [ ] Phase 2 follow-ups: `ref show C#` for the "다시 확인" prompt (agent reads one claim with its sources); home cards show the collection's highlights
- [x] Board phase 3 (2026-10-19): folded summary with TOC (B2), research pattern cards as grade chips (F1), axis `verdict` on cards + home table (E8·F4-lite), run timeline with `result`/`endedAt` (E7), note `fields` (E4·B4), source `summary` (E5), default view `view` / rows when ≥10 captured products (E9·F2). acne board 23,000px → 20,700px; tokyo summary folds.
- [ ] Phase 3 leftovers: `ref://<collection>/<id>` URIs resolved by the skill (D8); home shared-axes as cards (F4 full); research findings × source-grade matrix if chips are not enough
- [x] Release 0.1.0-beta.2 (2026-10-19) — board phases 1–3
- [ ] Library home redesign (`docs/HOME-REDESIGN.md`): phase 1 = stat tiles, prompts, recent-first cards with conclusion line, shared-axis cards; phase 2 = recent activity, open questions, findings search; phase 3 = search scopes, verdict coverage
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
