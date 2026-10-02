# Decisions

Newest first. One line of context, the decision, why.

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
