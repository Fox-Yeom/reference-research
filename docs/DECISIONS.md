# Decisions

Newest first. One line of context, the decision, why.

## 2026-11-04 · Connectors: paths follow docs or robots; three of five changed
Re-measuring before implementation (`docs/CONNECTORS.md`): robots disallows Speaker Deck account feeds and the App Store review RSS, the RSS returned 0 entries for 6 apps, and GeekNews has no keyword path while WebSearch limited to its domain worked. → (1) Documented APIs follow their docs; undocumented paths follow `robots.txt` `User-agent: *`, so `ref store`'s documented iTunes Search API stays. (2) No GeekNews connector; SKILL.md gives a WebSearch instruction. (3) Speaker Deck reads account and deck pages. (4) App Store gives the rating distribution plus the reviews the page shows, labelled as neither newest-first nor a sample; newest reviews are given up. (5) `store` defaults to the `primary` channel so `reaction` no longer counts store pages; old collections may get a new warning from `ref channels`.

## 2026-11-04 · Board head is a structured panel; progress goes through a hook
Real-use feedback on the indigo head: "not structured, just a blue background with loud color". → The board head is one white panel: a question/answer/decision/evidence/counter table beside evidence-strength, freshness and channel stats; the home head follows. This narrows, not reverses, 2026-10-02: indigo stays the structural accent, semantic colors carry meaning. Separately, agents did not relay CLI output (brief table, round lines, capture backend) in 5 of 5 and 3 of 3 runs, whatever the wording. → `ref` writes such lines to `announce.log`, and a PostToolUse hook in the SKILL frontmatter shows them as `systemMessage`; verified in a real terminal. A file, because agents also filter stdout.

## 2026-11-04 · Research flow v2: phases, roles, freshness
A real design research drifted for four rounds because the request ("make it not look AI-made") became the goal, and old sources served as exemplars (`docs/RESEARCH-FLOW-REDESIGN.md`). → (1) Ship in two phases: SKILL.md first (plus the `trend` role constant), then CLI/board/MCP. (2) Drop the `analogous` role; scope is direct · indirect · trend, and existing analogous members migrate to indirect with `roleWas` kept. (3) One freshness threshold, 12 months: older or undated sources serve only as principles or before/after comparison; key claims citing only those get a warning unless `scope:"원리"`. The board keeps indigo + semantic colors (2026-10-02 decision); v2 only enforces one meaning per color.

## 2026-10-19 · Repository made public
Private-beta friction (invites, `gh auth` for install) outweighed the benefit once the library stays local anyway. → Repo is public; README drops the invite steps; marketplace name stays `reference-research-beta`. The library (`~/references`) is still never pushed. License: MIT (`LICENSE`, 2026-10-19) — captures in `assets/` remain the property of their sites; see README 고지.

## 2026-10-19 · GitHub account renamed Y-jae-heon → Fox-Yeom
The account was renamed; the old address still redirects. → All docs, manifests (`author.name`, `repository`), the git remote and the noreply author use `Fox-Yeom`. Testers who added the marketplace under the old name keep working through the redirect; new testers use `/plugin marketplace add Fox-Yeom/reference-research`. Older entries below keep the old name as written at the time.

## 2026-10-02 · Plugin repo is canonical; local skill is generated
Two copies (local skill `bin/`, plugin `scripts/`) drifted on day one. → Edit only this repo; `dev/sync-local.sh` regenerates `~/.claude/skills/reference-research` (rewrites paths, keeps `bin/` so the user-scope MCP registration still works) and commits there.

## 2026-10-02 · Testers invited with write permission
Personal-account private repos have no read role; branch protection on private repos needs GitHub Pro. → Invite as-is, ask testers to give feedback only via Issues. Alternative if needed: move the repo to a free Organization (Read role), which changes the install address.

## 2026-10-02 · Fresh history for the distributed repo
The skill's history had the global (work) email as author and mentions of a private project. → `main` started as a single orphan commit; repo-local author = GitHub noreply. Original history stays in the local skill repo.

## 2026-10-02 · Private GitHub plugin marketplace for the beta
Testers ≥2, may not have Aside, repo on the personal account. → `.claude-plugin/marketplace.json` at repo root, `source: "./"`; install with `/plugin marketplace add Y-jae-heon/reference-research`. Updates follow the version field.

## 2026-10-02 · Capture backends: Aside → headless Chrome → none
Testers may not have Aside. → Same capture script runs in puppeteer-core with the system Chrome (temp profile, no logins). No Chrome download (puppeteer-core, not puppeteer).

## 2026-10-02 · Embeddings optional
transformers + onnxruntime + model ≈ 700 MB. → Core install ~80 MB; `ref setup --embeddings` installs into `REF_HOME`. Every embedding caller degrades to keyword search.

## 2026-10-02 · Pillow instead of `sips`
macOS-only `sips` blocked other OSes. → `imgtools.py preview`.

## 2026-10-02 · Board colors are the maintainer's preference, not reference-based
Research suggested a monochrome/editorial board (C49 → revised C60); the maintainer rejected monochrome. → Indigo layout + semantic colors. Don't "fix" this back from research findings.

## Earlier (skill v2)
- Library = git repo, no remote; local embeddings (e5-small) first.
- Re-encounter rule: never duplicate a reference — reuse, add the category, refresh if > 30 days and record the change.
- Plans are optional and live outside categories so references stay reusable.
- Confidence computed from independent publishers and source grade, gaps capped at medium.
