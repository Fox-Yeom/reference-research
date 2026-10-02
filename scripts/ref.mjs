#!/usr/bin/env node
/**
 * ref — reference library CLI for Claude Code (v2: global references, categories, local embeddings).
 *
 * Collect
 *   ref capture '<json>' | -          capture URLs (Aside or headless Chrome) → refs (re-encounter: reuse + add category, refresh if stale)
 *   ref store   '<json>' | -          App Store / Mac App Store screens
 *   ref source add '<json>'           text-only refs (articles, docs, papers, threads)
 *   ref collect '<json>'              add existing refs to a collection (= add a category)
 *   ref uncollect <collection> <S#>
 *   ref note '<json>'                 note on a ref (attributed to the collection) or on the collection
 * Look
 *   ref list [collection] [--query "a b"]     collections / members + coverage / global text search
 *   ref show <S#|url>                 one ref: categories, snapshots, changes, notes from every category, citing claims
 *   ref similar <S#|C#|"text"> [--scope refs|claims|all] [--k 8]   local-embedding neighbours
 *   ref categories                    category vectors: nearest categories + shared refs
 *   ref embed [--rebuild]             update local embeddings (.vectors/, git-ignored)
 *   ref axes show [collection] | suggest [collection] | set '<json>'   tag normalization → axes.json
 *   ref course set '<json>' | show <collection>   course structure (curriculum mode): modules, topics, hours
 * Evidence
 *   ref run start '<json>'            {collection, goal, domain, kind} → R#, baseline + related refs from other categories
 *   ref claim add '<json>' | list [collection] [--status s] [--kind k] [--run R#]
 *   ref delta <collection> [--run R#] run / category / time delta → DELTA.md
 *   ref cite <collection> [--file f]  every finding line cites known, active [S#]/[C#]
 *   ref report '<json>'               README.md + index.html board for a collection
 * Plans (optional, outside the categories)
 *   ref plan set '<json>' | show <plan> | link '<json>' | delta <plan>
 * Setup
 *   ref doctor                        check Node, Python+Pillow, capture backend (Aside/Chrome), embeddings, library
 *   ref setup [--embeddings] [--git]  install optional embeddings (~700 MB, into ~/.reference-research) · git-init the library
 * Maintenance
 *   ref learn read | add <source|search|capture|pattern|process> "<lesson>"
 *   ref migrate [--dry-run] [--plan name]     one-time v1 → v2
 *   ref compact                       rewrite JSONL files without superseded lines
 *
 * "-" reads JSON from stdin. Images worth looking at are printed after "IMAGES:" — open them with the Read tool.
 * Library: $REF_LIBRARY or ~/references (a git repo — commit after a research session).
 */
import { promises as fs, existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { capture, storeScreens } from "./capture.mjs";
import * as ev from "./evidence.mjs";
import { report, coverage } from "./report.mjs";
import { migrate } from "./migrate.mjs";
import { FILES, LIB, REF_HOME, RefError, collectionName, compactAll, latestSnapshot, listCollections, readClaims, readRefs } from "./store.mjs";
import { spawnSync } from "node:child_process";

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function print(text, images = []) {
  console.log(text);
  if (images.length) console.log(`\nIMAGES:\n${images.join("\n")}`);
}

async function jsonArg(a) {
  let raw = a;
  if (a === "-" || a === undefined) {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    raw = Buffer.concat(chunks).toString("utf8");
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`invalid JSON params: ${e.message}`);
  }
}

function flag(args, name) {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}

function bool(args, name) {
  const i = args.indexOf(name);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
}

const embed = () => import("./embed.mjs");

// ---------- list / learn ----------

async function list(name, query, limit) {
  const [refs, claims] = await Promise.all([readRefs(), readClaims()]);
  if (query) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = refs.filter((r) => {
      if (name && !(r.categories ?? []).includes(collectionName(name))) return false;
      const m = latestSnapshot(r)?.meta ?? {};
      const hay = [r.id, r.label, r.title, r.url, r.description, ...(r.tags ?? []), ...(r.categories ?? []), ...(r.notes ?? []).map((n) => n.text), ...(m.headings ?? [])].join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    return print(`${hits.length} match(es)\n` + hits.slice(0, limit).map((r) => `- ${r.id} ${r.label ?? r.url} ‹${(r.categories ?? []).join(", ")}›`).join("\n") + `\n(semantic search: ref similar "${query}")`);
  }
  if (!name) {
    const cols = await listCollections();
    return print(
      `Library: ${LIB} · ${refs.length} refs · ${claims.filter((c) => c.status === "active").length} active claims\n` +
        (cols.length
          ? cols
              .map((c) => {
                const own = claims.filter((x) => (x.collections ?? []).includes(c.name) && x.status === "active").length;
                const shared = c.members.filter((m) => (refs.find((r) => r.id === m.ref)?.categories ?? []).length > 1).length;
                return `- ${c.name} (${c.members.length} refs${shared ? `, ${shared} shared` : ""}, ${own} claims) — ${[c.kind, c.domain, c.currentRun, c.description].filter(Boolean).join(" · ")}`;
              })
              .join("\n")
          : "(no collections)"),
    );
  }
  const col = await ev.mustCollection(name);
  const byId = new Map(refs.map((r) => [r.id, r]));
  const members = col.members.map((m) => ({ ...m, r: byId.get(m.ref) })).filter((m) => m.r);
  const own = claims.filter((c) => (c.collections ?? []).includes(col.name) && c.status === "active");
  print(
    [
      `${col.name} — ${[col.kind, col.domain, col.currentRun, col.description].filter(Boolean).join(" · ")}`,
      ...members.map(({ r, role }) => {
        const s = latestSnapshot(r);
        const other = (r.categories ?? []).filter((c) => c !== col.name);
        return `- ${r.id} ${r.label ?? r.url}${role ? ` (${role})` : ""} · ${s ? `captured ${s.at.slice(0, 10)}${r.snapshots.length > 1 ? ` ×${r.snapshots.length}` : ""}` : "text"}${other.length ? ` ‹also: ${other.join(", ")}›` : ""}`;
      }),
      "",
      "Coverage:",
      coverage(members, col.domain),
      "",
      `Evidence: ${own.length} active claims (high ${own.filter((c) => c.confidence === "high").length} / medium ${own.filter((c) => c.confidence === "medium").length} / low ${own.filter((c) => c.confidence === "low").length})`,
    ].join("\n"),
  );
}

async function learn(action, category, lesson) {
  await fs.mkdir(LIB, { recursive: true });
  if (!existsSync(FILES.learnings)) await fs.writeFile(FILES.learnings, "# Reference research learnings\n\n자동 누적되는 학습 메모. 각 줄: 날짜 [category] lesson\n\n");
  if (action === "read") {
    const txt = await fs.readFile(FILES.learnings, "utf8");
    return print(txt.length > 30000 ? txt.slice(-30000) : txt);
  }
  if (action !== "add") fail('usage: ref learn read | ref learn add <category> "<lesson>"');
  const cats = ["source", "search", "capture", "pattern", "process"];
  if (!cats.includes(category)) fail(`category must be one of ${cats.join(", ")}`);
  if (!lesson?.trim()) fail("lesson is required");
  if ((await fs.readFile(FILES.learnings, "utf8")).includes(lesson.trim())) return print("Lesson already recorded.");
  const line = `- ${new Date().toISOString().slice(0, 10)} [${category}] ${lesson.trim().replace(/\n+/g, " ")}\n`;
  await fs.appendFile(FILES.learnings, line);
  print(`Recorded: ${line.trim()}`);
}

// ---------- doctor / setup ----------

async function doctor() {
  const lines = [];
  const ok = (m) => lines.push(`✓ ${m}`);
  const warn = (m, fix) => lines.push(`⚠ ${m}${fix ? `\n    → ${fix}` : ""}`);
  const major = Number(process.versions.node.split(".")[0]);
  major >= 20 ? ok(`Node ${process.versions.node}`) : warn(`Node ${process.versions.node} (20+ needed)`, "install Node 22 LTS");
  for (const [mod, label] of [["@modelcontextprotocol/sdk/server/mcp.js", "MCP SDK"], ["puppeteer-core", "puppeteer-core (Chrome capture)"], ["zod", "zod"]]) {
    try {
      await import(mod);
      ok(label);
    } catch {
      warn(`${label} missing`, "run the plugin's scripts/ref once (it installs core deps), or `npm install` in the plugin folder");
    }
  }
  const py = spawnSync("python3", ["-c", "import PIL;print(PIL.__version__)"], { encoding: "utf8" });
  py.status === 0 ? ok(`Python + Pillow ${py.stdout.trim()}`) : warn("python3 with Pillow not found (images: previews, scroll frames, stitching)", "pip3 install pillow");
  const { captureBackend, findChrome } = await import("./capture.mjs");
  const backend = await captureBackend();
  if (backend === "aside") ok("capture: Aside (your logged-in browser)");
  else if (backend === "chrome") ok(`capture: headless Chrome (${findChrome()}) — ${process.env.REF_CAPTURE ? "forced by REF_CAPTURE" : "Aside not found"}, so pages are captured without your logins`);
  else warn("capture: no backend — screenshots unavailable; research still works with text sources", "install Google Chrome, or Aside: curl -fsSL https://releases.aside.com/install.sh | bash");
  try {
    await (await import("./embed.mjs")).loadTransformers();
    ok("embeddings (related-reference search, MCP semantic search)");
  } catch {
    warn("embeddings not installed — optional; text search still works", "ref setup --embeddings   (~700 MB, one time)");
  }
  const { existsSync } = await import("node:fs");
  ok(`library: ${LIB}${existsSync(LIB) ? "" : " (created on first capture)"}`);
  existsSync(`${LIB}/.git`) ? ok("library is a git repo") : warn("library is not a git repo — no history to roll back to", "ref setup --git");
  lines.push(`tool data: ${REF_HOME}`);
  return lines.join("\n");
}

async function setup(args) {
  const out = [];
  if (args.includes("--embeddings")) {
    await fs.mkdir(REF_HOME, { recursive: true });
    const pj = path.join(REF_HOME, "package.json");
    if (!existsSync(pj)) await fs.writeFile(pj, JSON.stringify({ name: "reference-research-data", private: true }, null, 2));
    console.error("installing @huggingface/transformers into " + REF_HOME + " (~700 MB) …");
    const r = spawnSync("npm", ["install", "--no-audit", "--no-fund", "@huggingface/transformers@^4.3.0"], { cwd: REF_HOME, stdio: ["ignore", 2, 2] });
    out.push(r.status === 0 ? "✓ embeddings installed (the model, ~120 MB, downloads on first use)" : "⚠ npm install failed — see the log above");
  }
  if (args.includes("--git")) {
    await fs.mkdir(LIB, { recursive: true });
    if (existsSync(path.join(LIB, ".git"))) out.push("library already a git repo");
    else {
      await fs.writeFile(path.join(LIB, ".gitignore"), ".DS_Store\n.vectors/\nfold.png\n");
      const r = spawnSync("git", ["init", "-q"], { cwd: LIB });
      out.push(r.status === 0 ? `✓ git repo created in ${LIB}` : "⚠ git init failed");
    }
  }
  return out.join("\n") || "usage: ref setup [--embeddings] [--git]";
}

// ---------- main ----------

const [cmd, ...args] = process.argv.slice(2);
const needsV2 = !["learn", "migrate", "doctor", "setup", undefined, "help", "--help"].includes(cmd);
if (needsV2 && existsSync(path.join(LIB, "index.jsonl")) && !existsSync(FILES.refs)) fail("library is v1 — run `ref migrate` first (commit the library to git before)");

try {
  switch (cmd) {
    case "capture": {
      const r = await capture(await jsonArg(args[0]));
      print(r.text, r.images);
      if (!r.ok) process.exit(1);
      break;
    }
    case "store": {
      const r = await storeScreens(await jsonArg(args[0]));
      print(r.text, r.images);
      break;
    }
    case "source": {
      const sub = args.shift();
      if (sub === "add") print(await ev.addSources(await jsonArg(args[0])));
      else if (sub === "list") {
        const refs = await readRefs();
        const name = args[0] ? collectionName(args[0]) : null;
        print(refs.filter((r) => !name || (r.categories ?? []).includes(name)).map((r) => `- ${r.id} [${r.type}/${r.credibility}] ${r.label ?? r.title ?? ""} — ${r.url} ‹${(r.categories ?? []).join(", ")}›`).join("\n") || "(none)");
      } else fail("usage: ref source add '<json>' | ref source list [collection]");
      break;
    }
    case "collect":
      print(await ev.collect(await jsonArg(args[0])));
      break;
    case "uncollect":
      print(await ev.uncollect(args[0], args[1]));
      break;
    case "note":
      print(await ev.addNote(await jsonArg(args[0])));
      break;
    case "show": {
      const r = await ev.showRef(args[0]);
      print(r.text, r.images);
      break;
    }
    case "list": {
      const query = flag(args, "--query");
      const limit = Number(flag(args, "--limit") ?? 50);
      await list(args[0], query, limit);
      break;
    }
    case "similar": {
      const scope = flag(args, "--scope") ?? "all";
      const k = Number(flag(args, "--k") ?? 8);
      const { similar } = await embed();
      const hits = await similar(args.join(" "), { scope, k });
      const [refs, claims] = await Promise.all([readRefs(), readClaims()]);
      print(
        hits
          .map((h) => {
            if (h.kind === "ref") {
              const r = refs.find((x) => x.id === h.id);
              return `${h.score.toFixed(3)}  ${h.id} ${r?.label ?? r?.url} ‹${(r?.categories ?? []).join(", ")}›`;
            }
            const c = claims.find((x) => x.id === h.id);
            return `${h.score.toFixed(3)}  ${h.id} [${c?.kind}] ${c?.text.slice(0, 100)} ‹${(c?.collections ?? []).join(", ")}›`;
          })
          .join("\n") || "(no vectors)",
      );
      break;
    }
    case "categories": {
      const { categoryMap } = await embed();
      const { readAxes, tagIndex, axisOf } = await import("./axes.mjs");
      const cols = await listCollections();
      const [map, refs, axes] = await Promise.all([categoryMap(cols), readRefs(), readAxes()]);
      const idx = tagIndex(axes);
      const pattern = (id) => !id.startsWith("#") && (axes.axes.find((x) => x.id === id)?.facet ?? "pattern") === "pattern";
      const axesOf = (name) => new Set(refs.filter((r) => (r.categories ?? []).includes(name)).flatMap((r) => (r.tags ?? []).map((t) => axisOf(idx, t))).filter(pattern));
      const sets = new Map(cols.map((c) => [c.name, axesOf(c.name)]));
      const label = (id) => axes.axes.find((x) => x.id === id)?.label ?? id;
      print(
        map
          .map((c) => {
            const mine = sets.get(c.name);
            return [
              `- ${c.name} (${c.size} refs, ${mine.size} pattern axes)`,
              ...c.near.map((n) => {
                const both = [...mine].filter((a) => sets.get(n.name).has(a));
                return `    ${n.name}: centroid ${n.score.toFixed(3)} · shared refs ${n.shared} · shared axes ${both.length}${both.length ? ` (${both.map(label).join(", ")})` : ""}`;
              }),
            ].join("\n");
          })
          .join("\n") || "(no categories with vectors)",
      );
      break;
    }
    case "embed": {
      const { update, MODEL } = await embed();
      const r = await update({ rebuild: bool(args, "--rebuild") });
      print(`${MODEL}: ${Object.keys(r.store.items).length} vectors (${r.updated} updated)`);
      break;
    }
    case "run": {
      if (args.shift() !== "start") fail("usage: ref run start '<json>'");
      const p = await jsonArg(args[0]);
      const findRelated = p.related === false ? null : async (col, goal) => (await embed()).relatedOutside(col, goal);
      print(await ev.startRun(p, findRelated));
      break;
    }
    case "claim": {
      const sub = args.shift();
      if (sub === "add") print(await ev.addClaims(await jsonArg(args[0])));
      else if (sub === "list") {
        const status = flag(args, "--status");
        const kind = flag(args, "--kind");
        const run = flag(args, "--run");
        const name = args[0] ? collectionName(args[0]) : null;
        const claims = (await readClaims()).filter(
          (c) => (!name || (c.collections ?? []).includes(name)) && (!status || c.status === status) && (!kind || c.kind === kind) && (!run || (c.events ?? []).some((e) => e.run === run)),
        );
        print(ev.formatClaims(claims));
      } else fail("usage: ref claim add '<json>' | ref claim list [collection] [--status s] [--kind k] [--run R#]");
      break;
    }
    case "delta": {
      const run = flag(args, "--run");
      print(await ev.delta(args[0], run));
      break;
    }
    case "cite": {
      const f = flag(args, "--file");
      const target = f ?? path.join(LIB, collectionName(args[0] ?? fail("usage: ref cite <collection> [--file f]")), "SUMMARY.md");
      if (!existsSync(target)) fail(`no file to check: ${target}`);
      print(ev.formatCiteCheck(await ev.citeCheck(readFileSync(target, "utf8"))));
      break;
    }
    case "report":
      print(await report(await jsonArg(args[0])));
      break;
    case "plan": {
      const sub = args.shift();
      if (sub === "set") print(await ev.setPlan(await jsonArg(args[0])));
      else if (sub === "show") print(ev.formatPlan(await ev.readPlan(args[0])));
      else if (sub === "link") print(await ev.linkPlan(await jsonArg(args[0])));
      else if (sub === "delta") {
        const noSuggest = bool(args, "--no-suggest");
        const suggest = noSuggest ? null : async (text) => (await embed()).similar(text, { scope: "claims", k: 6 });
        print(await ev.planDelta(args[0], suggest));
      } else fail("usage: ref plan set '<json>' | show <plan> | link '<json>' | delta <plan> [--no-suggest]");
      break;
    }
    case "course": {
      const cu = await import("./curriculum.mjs");
      const sub = args.shift();
      if (sub === "set") print(await cu.setCourse(await jsonArg(args[0])));
      else if (sub === "show") print(await cu.showCourses(args[0]));
      else fail("usage: ref course set '<json>' | ref course show <collection>");
      break;
    }
    case "axes": {
      const ax = await import("./axes.mjs");
      const sub = args.shift();
      if (sub === "show" || !sub) print(await ax.showAxes(args[0] ? collectionName(args[0]) : null));
      else if (sub === "suggest") print(await ax.suggestAxes({ collection: args[0] ? collectionName(args[0]) : null, k: Number(flag(args, "--k") ?? 3) }));
      else if (sub === "set") print(await ax.setAxes(await jsonArg(args[0])));
      else fail("usage: ref axes show [collection] | suggest [collection] [--k 3] | set '<json>'");
      break;
    }
    case "doctor":
      print(await doctor());
      break;
    case "setup":
      print(await setup(args));
      break;
    case "learn":
      await learn(args[0], args[1], args.slice(2).join(" "));
      break;
    case "migrate": {
      const dryRun = bool(args, "--dry-run");
      print(await migrate({ dryRun, plan: flag(args, "--plan") }));
      break;
    }
    case "compact":
      await compactAll();
      print("compacted refs/claims/runs.jsonl");
      break;
    default:
      console.log(((h) => h.slice(2, h.indexOf(" */")))(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n")).join("\n").replace(/^ \* ?/gm, ""));
      process.exit(cmd && cmd !== "help" && cmd !== "--help" ? 1 : 0);
  }
} catch (e) {
  if (e instanceof RefError) fail(e.message);
  throw e;
}
