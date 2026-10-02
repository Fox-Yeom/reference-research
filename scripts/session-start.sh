#!/usr/bin/env bash
# SessionStart: keep a stable path to this plugin version (~/.reference-research/plugin) for the skill's `ref` function,
# and install core deps in the background so the first `ref` call is fast.
ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
HOME_DIR="${REF_HOME:-$HOME/.reference-research}"
mkdir -p "$HOME_DIR"
ln -sfn "$ROOT" "$HOME_DIR/plugin"
("$ROOT/scripts/ensure-deps.sh" >/dev/null 2>&1 &)
exit 0
