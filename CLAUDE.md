# reference-research — maintainer guide

Claude Code plugin (skill + read-only MCP + SessionStart hook) for source-linked reference research.
Distributed through a **public GitHub plugin marketplace** (repo public since 2026-10-19): `Fox-Yeom/reference-research` → marketplace `reference-research-beta`. Anyone can install; "testers" below = people we asked for feedback.

**This repo is canonical.** The maintainer's own install (`~/.claude/skills/reference-research`) is generated from it by `dev/sync-local.sh` — never edit that copy.

Start here in a new session:
1. `git status && git log --oneline | head` — where things stand
2. `docs/ROADMAP.md` — what's next · `docs/DECISIONS.md` — why things are the way they are
3. `CLAUDE.local.md` (not committed) — testers, machine-specific notes

## Layout
| path | what | shipped to testers |
|---|---|---|
| `.claude-plugin/plugin.json` | plugin manifest; declares MCP `reference-library` → `scripts/run-mcp.sh` | yes |
| `.claude-plugin/marketplace.json` | marketplace manifest (`source: "./"`) | yes |
| `skills/reference-research/SKILL.md` | the agent workflow (§0–10). Calls `ref` via `~/.reference-research/plugin/scripts/ref` | yes |
| `hooks/hooks.json` → `scripts/session-start.sh` | links `~/.reference-research/plugin` → current plugin root; installs deps in background | yes |
| `scripts/` | CLI + libraries (see `docs/ARCHITECTURE.md`). `ref` / `run-mcp.sh` call `ensure-deps.sh` first | yes |
| `scripts/seed/axes.json` | default axes for a new library (copied from the maintainer's library) | yes |
| `assets/` | README logo + tour screenshots (from `dev/demo.sh`) | yes |
| `dev/` | maintainer tools: `test.sh` · `bump.sh` · `sync-local.sh` · `demo.sh` · `shots.mjs` | yes (harmless) |
| `docs/` | architecture, decisions, release, roadmap | yes |

Top-level `bin/` is not allowed for plugins on claude.ai/Cowork → scripts live in `scripts/`.

## Dev loop
```bash
# edit scripts/ or SKILL.md, then:
dev/test.sh                 # syntax · manifest validate · doctor · Chrome capture · board · MCP — in a throwaway library
claude --plugin-dir .       # try it interactively (use scratch REF_LIBRARY/REF_HOME to keep the real library clean)
dev/sync-local.sh           # refresh the maintainer's own skill from this repo (commits there; refuses if it has local edits)
```
Release: `docs/RELEASE.md` (bump all three versions — installed plugins update only when the version changes).

## Rules
- **Never test against `~/references`** (the maintainer's real library) — set `REF_LIBRARY`/`REF_HOME` to a scratch dir. `dev/test.sh` and `dev/demo.sh` do this.
- **Never put the real library in this repo or the README.** It holds third-party captures and private project research. README screenshots come only from `dev/demo.sh` (neutral topic).
- Captures stay read-only: no form submit, sign-up, payment, posting, consent clicks — in both backends.
- MCP stdout is JSON-RPC: anything printed by `run-mcp.sh`/`ensure-deps.sh`/dependencies must go to stderr.
- Commits here use the GitHub noreply identity (repo-local git config) — don't switch to the global (work) email.
- Push over HTTPS with gh credentials (the default SSH key belongs to another account):
  `git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin main`
- Board UI (scripts/board.mjs) — maintainer preferences: plain Korean wording, comparisons phrased as questions, in-page image viewer, no empty table shells on search, **no monochrome**, not too sparse; verify with a rendered screenshot, not just the DOM.
- Claims in demos/README must match what the captures show.
- User-facing text (README, CHANGELOG, doctor fixes) in Korean; code/comments in English.
