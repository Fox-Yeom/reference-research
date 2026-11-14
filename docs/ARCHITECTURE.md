# Architecture

## Runtime paths
| env | default | holds |
|---|---|---|
| `REF_LIBRARY` | `~/references` | the library (user's data, should be a git repo — `ref setup --git`) |
| `REF_HOME` | `~/.reference-research` | tool data: `plugin` symlink, optional `node_modules` for embeddings, `models/` cache |
| `REF_CAPTURE` | auto | force `aside` · `chrome` · `none` |
| `REF_CHROME` | auto | Chrome/Chromium/Edge binary path |
| `REF_EMBED_MODEL` | `Xenova/multilingual-e5-small` | embedding model |

Plugin root (`${CLAUDE_PLUGIN_ROOT}`) is a versioned, replaceable cache dir. `CLAUDE_PLUGIN_ROOT` is **not** set in the agent's Bash tool, so the skill reaches the CLI through the stable symlink `~/.reference-research/plugin` kept by the SessionStart hook.

## Dependencies
- Core (auto-installed into the plugin root by `ensure-deps.sh`, ~80 MB, re-run when `package.json` changes): `@modelcontextprotocol/sdk`, `zod`, `puppeteer-core`.
- Optional embeddings (`ref setup --embeddings`, ~700 MB, into `REF_HOME`): `@huggingface/transformers`. `embed.mjs#loadTransformers` resolves it from `REF_HOME` first, then normal resolution (the local non-plugin install keeps it in its own `node_modules`). Without it: related-reference search is skipped, MCP search is keyword-only.
- System: Node 20+, `python3` + Pillow (`imgtools.py`: preview, sheet, stitch), a capture backend.

## Scripts
| file | role |
|---|---|
| `ref.mjs` | CLI entry: command parsing, `doctor`, `setup`, run/claim/note/collect/source commands |
| `store.mjs` | library layout + JSONL records (header comment = format spec). Paths stored relative to LIB |
| `capture.mjs` | page capture: one script string runs in Aside's REPL **or** in puppeteer (`chromeRun` injects `openTab/closeTab/sleep/fs/path/console`); scroll frames, stitching, meta, re-encounter/refresh, snapshot deltas; App Store screens |
| `evidence.mjs` | claims (create/confirm/revise/refute), confidence (≥2 independent publishers & score ≥4 = high), deltas A/C/T, cite check |
| `axes.mjs` | tag normalization → `axes.json` (falls back to `seed/axes.json`); `axis.broader` = one parent axis |
| `registry.mjs` | v3 registries: topics (`topics.json`, one topic per collection) and entities (`entities.json`, products and organizations) |
| `embed.mjs` | local embeddings, vectors in `<LIB>/.vectors` (derived, git-ignored) |
| `report.mjs` | board data, SUMMARY/README/DELTA, library home |
| `board.mjs` | the single HTML template for every board + home (board G: dark neon, KPI cards, conclusion galley with margin marks, evidence map, timeline, activity, viewer, search) |
| `diagram.mjs` | static SVG figures for the board/home (evidence map overview + detail, shared references, timeline, activity hexes, sparklines) in the diagram-design grammar |
| `curriculum.mjs` | curriculum mode: course records, topic coverage, order, gaps |
| `mcp.mjs` | read-only MCP: list_collections, search_references, get_reference, search_findings, get_patterns, get_board |
| `migrate.mjs` | v1 → v2 library migration (LIB-relative moves only); `ref migrate v3` fills read/ids/product entities and prints a review list |
| `imgtools.py` | Pillow helpers |
| `ref`, `run-mcp.sh`, `ensure-deps.sh`, `session-start.sh` | shell entry points |

## Data model (library)
S# reference (global URL, snapshots, notes per category, change history; v3: `ids`, `read`, `entity`, `org`) · C# claim (cites S#; v3: `against`, `about`) · R# run · category = `<collection>/collection.json` (members + role; v3: `topic`) · axes.json (v3: `broader`) · `topics.json` · `entities.json` · optional `plans/`. Design notes: `docs/DATA-MODEL.md` (§14 decisions). Full spec: header of `scripts/store.mjs` and SKILL.md "Model".
