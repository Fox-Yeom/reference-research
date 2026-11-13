# Surface: collection board + library home

Mode: operate. Build path: code (operate surfaces are code-led).
Issue #13 asks for three built drafts instead of one locked direction, so the decision page was replaced by three HTML drafts in `docs/drafts/`; the maintainer picks one from the rendered pages.

## Direction contract (three candidates, one to be chosen)

Grounded list (resonance order): 1 Seoul metro line map · 2 library call-number spine labels · 3 benchmarking slide deck (category rut) · 4 annotated case-law margins · 5 exhibition catalogue plates · 6 approval-form stamp row · 7 proofreading galley with proof marks.
FORM: seed:365109a4e0db727a, assigned index 7.

### A — proof galley (assigned, #7)
THESIS: the conclusion is galley text under review; every judgment on it (strength, counter-evidence, hypothesis, new since last run) is a proof mark in a margin column. Refuses the card dashboard.
OWN-WORLD: cool white galley on blue-grey desk; blue pencil for IDs and citations, green tick for strong evidence, amber half-tick for medium, red pencil only for counter-evidence and contradictions. Marks differ by shape as well as colour.
STORY: read question and answer, see at a glance which evidence is contested, open captures, copy IDs.
FIRST VIEWPORT: top bar (brand, board/home switch, search, section links); galley column with question, answer, proposal, evidence rows; margin column with marks aligned to each row.
RAISES: from boarding pass, "new since last run" marks persist; from exposure record, contradiction readable without colour.

### B — metro line map (impeccable's pick, #1)
THESIS: the library is a network; each collection is a coloured line, each run a station, a reference shared by collections is a transfer station. Refuses the plain sidebar list.
OWN-WORLD: white ground, saturated line colours per collection, white station dots with dark rings, double ring for transfers, round line badges.
FIRST VIEWPORT: left rail whose section links sit on a vertical line as stations; header band in the collection's line colour; conclusion first, captures next.

### C — tabbed binder (challenger rw-manual-acetate-tab-board, competitive on clarity)
THESIS: each section has a full-strength hue and a fore-edge tab whose height is proportional to how much it holds, so length is visible before scrolling. Refuses equal-weight navigation that hides where the bulk is.
OWN-WORLD: section hues (orange, yellow, green, teal, ultramarine, sienna; no violet), solid white leaves, vermilion reserved for counter-evidence errata slips; tab change is a 90ms two-step.
FIRST VIEWPORT: command-first header (search and Claude prompts), leaf with conclusion, right-edge stepped tab rail.

Declined challengers: character goods catalogue, labanotation, Emigre bitmap specimen, exposure record (lost both axes). Boarding pass and gate board: competitive (change state), kept as a raise in A.

## Round 2 (maintainer feedback, 2026-11-13)

Feedback: A's feel and layout and B's composition and shapes work; all three read too static. Reference the ponytail board (dark dashboard: KPI cards with sparklines, hover crosshair chart, toggleable legend chips, searchable table, activity heatmap, theme switch). Three more drafts mix interaction with legibility. Rule kept for all: state changes animate in 150-250 ms, nothing moves at rest, dimming never lowers text contrast (tone change instead of opacity).

### D — live proof galley (A + B's line in the margin)
A's galley and margin marks; evidence rows joined by a green line in the margin with a red dashed counter branch. Hovering a row lights the captures it cites in a sticky capture rail. KPI cards jump and filter; captures flip through frames on hover; claim sort and filters animate in place (FLIP). Home: sparkline KPIs, run-day calendar, collection-to-shared-reference rail that lights on hover. Light and dark.

### E — metro dashboard (B + ponytail board)
Dark by default. Sidebar of collections as coloured lines; KPI cards with sparklines and bars; one big card switching between the evidence line (stations open details) and pattern lines (hover a stop for its capture, legend chips hide lines); sortable claim table with strength pills; home timeline of collections on a date axis with a hover crosshair, period switch and legend toggles.

### F — evidence map (node-link explorer)
A's paper and margin marks for the detail panel, B's lines for edges. Columns question/answer, evidence, claims, captures; selecting a node lights its connected chain and recedes the rest by tone; arrow keys walk the columns. Home: topic, collection, shared pattern, shared reference columns.

## Round 3 (maintainer choice, 2026-11-13)

Maintainer chose to merge D and E with a neon look taken from ponytail screenshots (glowing hex activity heatmap, list rows with glowing gradient underline bars, sparkline cards with glowing strokes and faded fills, glowing status dots). Diagrams and node-link views follow the diagram-design skill. Titles, section names and labels are glossary-style nouns, never descriptive phrases.

### G — neon mix (D + E)
E's dark sidebar, KPI sparkline cards, pattern lines, sortable claim table; D's galley with margin marks as the conclusion, with cited captures lighting beside it. Glow on shapes only, never on text; inside diagrams only the 1-2 accents glow (counter-evidence edge, latest real collection bar) — the maintainer picked this over glowing everything. Evidence map split into overview (6 nodes) and detail (selected node, its claims and captures, at most 9) to stay within the diagram-design node budget; home timeline as a Gantt, shared references as a dependency graph with one hop. Dark only for now.
