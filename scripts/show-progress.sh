#!/usr/bin/env bash
# PostToolUse hook (SKILL.md frontmatter): shows what `ref` announced. Agents do not reliably repeat tool output in chat,
# and they filter it, so `ref` writes these lines to a file of their own (store.mjs `announce`).
log="${REF_HOME:-$HOME/.reference-research}/announce.log"
[ -s "$log" ] || exit 0
taken="$log.$$"
mv "$log" "$taken" 2>/dev/null || exit 0
node -e '
const fs = require("fs");
const fresh = fs.readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean).map((l) => l.split("\t")).filter(([t]) => Date.now() - Number(t) < 600000);
if (fresh.length) process.stdout.write(JSON.stringify({ systemMessage: fresh.map((x) => x.slice(1).join("\t").replace(/\\n/g, "\n")).join("\n") }));
' "$taken"
rm -f "$taken"
