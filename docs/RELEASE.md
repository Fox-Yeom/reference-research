# Release

Releases follow the repo's branch flow: the version change is a Task PR to `develop`, it reaches `main` through a promotion PR, and the tag goes on `main`. Steps marked **(human)** run only when the maintainer says so: promotion PRs, tags, GitHub releases and tester notices are outward-facing.

1. **Release Task.** Open an Issue for the release and work on its branch (`docs/<n>-release-<version>` from `origin/develop`).
   - `dev/test.sh` passes (for capture changes, also try a real page with `REF_CAPTURE=aside` and `chrome`).
   - `dev/bump.sh <version>` sets `package.json`, `plugin.json`, `marketplace.json` and the README badge. Beta versions: `0.1.0-beta.N`.
   - `CHANGELOG.md`: a new section on top, in Korean, with user-visible changes only. Name breaking changes (MCP fields, summary format) and how an existing library moves over.
   - If the board or README visuals changed: `dev/demo.sh` → check the images → commit `assets/` (or rebuild from a demo library as the board PRs did).
   - Commit by purpose, push the Task branch, open the Task PR to `develop`, review, merge.
2. **Promotion (human).** Promotion PR `develop` → `main` with the release in its 포함 PR list; merge it when the maintainer names it.
3. **Tag and release (human)**, on the `main` merge commit of that promotion, never on `develop`:
   ```bash
   git fetch origin && git switch main && git merge --ff-only origin/main
   git tag -a v<version> -m "reference-research <version>"
   git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin v<version>
   gh release create v<version> --title "reference-research <version>" --notes-file <changelog-section.md> --prerelease
   ```
   Notes = that CHANGELOG section; pre-release while in beta.
4. **Verify the install path** in a throwaway config (does not touch the real `~/.claude`):
   ```bash
   C=$(mktemp -d); CLAUDE_CONFIG_DIR=$C claude plugin marketplace add Fox-Yeom/reference-research
   CLAUDE_CONFIG_DIR=$C claude plugin install reference-research@reference-research-beta; rm -rf $C
   ```
5. `dev/sync-local.sh` so the maintainer's own install matches.
6. **Tell testers (human):** `/plugin marketplace update reference-research-beta`, then restart Claude Code. Link the CHANGELOG section.

A hotfix goes to `main` and `develop` with the same branch (two PRs) before it is tagged.

## Adding a tester
The repo is public (2026-10-19): anyone can install with the README "설치" steps — no invitation needed. Collaborator access (write) is only for people who should push:
```bash
gh api -X PUT repos/Fox-Yeom/reference-research/collaborators/<github-id>   # personal repo → write permission (no read role)
gh api repos/Fox-Yeom/reference-research/invitations --jq '.[].invitee.login'  # pending
```
Record them in `CLAUDE.local.md`.
