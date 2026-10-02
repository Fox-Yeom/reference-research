#!/usr/bin/env bash
# Set the version in all three manifests: dev/bump.sh 0.1.0-beta.2
# Claude Code updates installed plugins only when this version changes.
set -euo pipefail
V="${1:?usage: dev/bump.sh <version>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node -e '
const fs=require("fs"), v=process.argv[1];
for (const f of ["package.json",".claude-plugin/plugin.json"]) { const j=JSON.parse(fs.readFileSync(f)); j.version=v; fs.writeFileSync(f, JSON.stringify(j,null,2)+"\n"); }
const m=JSON.parse(fs.readFileSync(".claude-plugin/marketplace.json")); m.plugins[0].version=v; fs.writeFileSync(".claude-plugin/marketplace.json", JSON.stringify(m,null,2)+"\n");
' "$V"
sed -i '' -E "s/release-[0-9A-Za-z.-]+-orange/release-$(echo "$V" | sed 's/-/--/g')-orange/" README.md
grep -n "\"version\"" package.json .claude-plugin/*.json; grep -o 'release-[^)]*orange' README.md
echo "next: add a '## $V — $(date +%F)' section to CHANGELOG.md"
