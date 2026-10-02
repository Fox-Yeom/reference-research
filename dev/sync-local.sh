#!/usr/bin/env bash
# Rebuild the maintainer's own non-plugin install (~/.claude/skills/reference-research, MCP `reference-library`
# registered at user scope → bin/mcp.mjs) from this repo. This repo is canonical; never edit the local copy.
# The local copy is a git repo: this script commits the result there so every sync can be rolled back.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
L="${LOCAL_SKILL:-$HOME/.claude/skills/reference-research}"
[[ -d "$L/.git" ]] || { echo "no git repo at $L" >&2; exit 1; }
if [[ -n "$(git -C "$L" status --porcelain)" ]]; then echo "uncommitted changes in $L — commit or discard them first" >&2; exit 1; fi
rsync -a --delete --exclude node_modules "$ROOT/scripts/" "$L/bin/"
rm -f "$L/bin/ref" "$L/bin/run-mcp.sh" "$L/bin/session-start.sh" "$L/bin/ensure-deps.sh"
sed -e 's|^- CLI: `ref` = .*|- CLI: `node ~/.claude/skills/reference-research/bin/ref.mjs <command> …` (below: `ref`; `ref help` lists everything)|' \
    -e 's|^ref() { "$HOME/.reference-research/plugin/scripts/ref" "$@"; }|ref() { node "$HOME/.claude/skills/reference-research/bin/ref.mjs" "$@"; }|' \
    -e '/^# if that link is missing (hook did not run)/d' \
    -e 's|`scripts/|`bin/|g' \
    -e 's|started by the plugin as `reference-library`|registered at user scope as `reference-library` (`claude mcp add reference-library -s user -- node ~/.claude/skills/reference-research/bin/mcp.mjs`)|' \
    "$ROOT/skills/reference-research/SKILL.md" > "$L/SKILL.md"
# local install keeps embeddings in its own node_modules
node -e '
const fs=require("fs"), [src,dst]=process.argv.slice(1);
const p=JSON.parse(fs.readFileSync(src)); const deps={...p.dependencies, ...p.optionalEmbeddings};
const out={name:"reference-research-cli",private:true,type:"module",description:"ref CLI for the reference-research skill (synced from the plugin repo)",version:p.version,dependencies:deps};
fs.writeFileSync(dst, JSON.stringify(out,null,2)+"\n");' "$ROOT/package.json" "$L/package.json"
(cd "$L" && npm install --no-audit --no-fund --loglevel=error >/dev/null)
grep -n 'reference-research/plugin\|CLAUDE_PLUGIN_ROOT' "$L/SKILL.md" && { echo "plugin-only paths left in local SKILL.md" >&2; exit 1; }
node "$L/bin/ref.mjs" doctor | sed -n '1,12p'
git -C "$L" add -A
git -C "$L" commit -q -m "sync from plugin repo $(git -C "$ROOT" rev-parse --short HEAD)" && echo "local skill synced + committed ($(git -C "$L" rev-parse --short HEAD))" || echo "local skill already up to date"
