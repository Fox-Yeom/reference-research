# Release

1. `dev/test.sh` passes (and, for capture changes, try a real page with `REF_CAPTURE=aside` and `chrome`).
2. `dev/bump.sh <version>` — sets `package.json`, `plugin.json`, `marketplace.json`, README badge. Beta versions: `0.1.0-beta.N`.
3. `CHANGELOG.md`: new section on top, Korean, user-visible changes only.
4. If the board or README visuals changed: `dev/demo.sh` → check the images → commit `assets/`.
5. Commit, then push over HTTPS (see CLAUDE.md "Rules").
6. Verify the install path in a throwaway config (does not touch the real `~/.claude`):
   ```bash
   C=$(mktemp -d); CLAUDE_CONFIG_DIR=$C claude plugin marketplace add Y-jae-heon/reference-research
   CLAUDE_CONFIG_DIR=$C claude plugin install reference-research@reference-research-beta; rm -rf $C
   ```
7. `dev/sync-local.sh` so the maintainer's own install matches.
8. Tell testers: `/plugin marketplace update reference-research-beta`, then restart Claude Code. Link the CHANGELOG section.

## Adding a tester
```bash
gh api -X PUT repos/Y-jae-heon/reference-research/collaborators/<github-id>   # personal repo → write permission (no read role)
gh api repos/Y-jae-heon/reference-research/invitations --jq '.[].invitee.login'  # pending
```
Record them in `CLAUDE.local.md`. Send the install steps from README "설치".
