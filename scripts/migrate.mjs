/**
 * migrate — one-time v1 → v2 library conversion (project-scoped captures → global references).
 *
 * v1: <LIB>/index.jsonl (entries with absolute paths), <project>/<entry>/…, <project>/{project,context}.json,
 *     <project>/{sources,claims,runs}.jsonl
 * v2: see store.mjs. Existing S#/C#/R# ids are kept so summaries that cite them stay valid.
 * Snapshot folders are moved (not copied) into refs/<slug>/<stamp>/. Run on a git-committed library.
 */
import { promises as fs, existsSync } from "node:fs";
import * as path from "node:path";
import {
  FILES, LIB, ROLES, SCREEN_TYPES, TYPE_CRED, nextId, normUrl, readJsonl, rel, slugify, splitLabel, stamp, writeJsonl,
} from "./store.mjs";

const ROLE_SET = new Set(ROLES);
const SCREEN_SET = new Set(SCREEN_TYPES);
const PAGE_META = ["title", "description", "ogImage", "lang", "headings", "nav", "ctas", "fonts", "topColors", "viewport", "pageHeight", "innerScroller", "hiddenOverlays", "frameYs"];

export async function migrate({ dryRun = false, plan = null } = {}) {
  const v1Index = path.join(LIB, "index.jsonl");
  if (!existsSync(v1Index)) return "nothing to migrate (no index.jsonl)";
  if (existsSync(FILES.refs)) return "refs.jsonl already exists — library is already v2";
  const entries = await readJsonl(v1Index);
  const projects = [...new Set(entries.map((e) => e.project))];
  const log = [];

  // v1 per-project evidence (only the projects that had it)
  const v1 = {};
  for (const p of projects) {
    const dir = path.join(LIB, p);
    v1[p] = {
      pj: JSON.parse(await fs.readFile(path.join(dir, "project.json"), "utf8").catch(() => "{}")),
      sources: await readJsonl(path.join(dir, "sources.jsonl")),
      claims: await readJsonl(path.join(dir, "claims.jsonl")),
      runs: await readJsonl(path.join(dir, "runs.jsonl")),
      context: JSON.parse(await fs.readFile(path.join(dir, "context.json"), "utf8").catch(() => "null")),
    };
  }

  // keep existing S# for entries that already have one; number the rest after them
  const sByEntry = new Map();
  const extraSources = [];
  for (const p of projects) for (const s of v1[p].sources) s.entry_id ? sByEntry.set(s.entry_id, s) : extraSources.push({ ...s, project: p });
  const refs = [];
  const used = new Set([...sByEntry.values()].map((s) => s.id));
  const order = [...entries].sort((a, b) => {
    const sa = sByEntry.get(a.id);
    const sb = sByEntry.get(b.id);
    if (sa && sb) return Number(sa.id.slice(1)) - Number(sb.id.slice(1));
    if (sa) return -1;
    if (sb) return 1;
    return a.capturedAt.localeCompare(b.capturedAt);
  });
  const col = new Map(projects.map((p) => [p, { name: p, kind: v1[p].pj.kind ?? null, domain: v1[p].pj.domain ?? "design", description: v1[p].pj.description ?? null, createdAt: v1[p].pj.createdAt ?? null, currentRun: v1[p].pj.currentRun ?? null, members: [] }]));
  let nextS = Math.max(0, ...[...used].map((id) => Number(id.slice(1))));
  const moves = [];

  for (const e of order) {
    // v1 stored absolute paths; never trust them (a copied library still points at the original) — rebuild from LIB
    const srcDir = path.join(LIB, e.project, path.basename(e.dir));
    const s = sByEntry.get(e.id);
    const url = e.finalUrl ?? e.url;
    const n = normUrl(url);
    let r = refs.find((x) => x.normUrl === n || x.aliases.includes(normUrl(e.url)));
    const tags = e.tags ?? [];
    const { product, page } = splitLabel(e.label ?? e.title ?? "");
    if (!r) {
      const id = s?.id ?? `S${++nextS}`;
      let slug = slugify(n, 60);
      while (refs.some((x) => x.slug === slug)) slug += "-2";
      const type = s?.type ?? (tags.includes("store") ? "store" : "capture");
      r = {
        id, slug, url, normUrl: n, aliases: e.url && normUrl(e.url) !== n ? [normUrl(e.url)] : [],
        label: e.label ?? null, product: product || null, page, title: e.title ?? null, description: e.description ?? null,
        type, publisher: s?.publisher ?? product ?? null, published: s?.published ?? e.meta?.updated ?? null,
        credibility: s?.credibility ?? TYPE_CRED[type] ?? "C", ...(s && !s.auto ? { credibilitySet: true } : {}),
        screens: [], tags: [], categories: [], notes: [], snapshots: [], changes: [],
        firstSeen: e.capturedAt, lastSeen: e.capturedAt, run: s?.run ?? null,
      };
      refs.push(r);
    }
    r.screens = [...new Set([...r.screens, ...tags.filter((t) => SCREEN_SET.has(t))])];
    r.tags = [...new Set([...r.tags, ...tags.filter((t) => !SCREEN_SET.has(t) && !ROLE_SET.has(t))])];
    r.categories = [...new Set([...r.categories, e.project])];
    for (const t of e.notes ?? []) r.notes.push({ at: e.capturedAt, collection: e.project, run: null, text: t });
    const c = col.get(e.project);
    if (!c.members.some((m) => m.ref === r.id)) c.members.push({ ref: r.id, role: tags.find((t) => ROLE_SET.has(t)) ?? null, addedAt: e.capturedAt, run: s?.run ?? null });

    // snapshot: move the entry folder under refs/<slug>/<stamp>
    const dest = path.join(FILES.refsDir, r.slug, stamp(new Date(e.capturedAt)));
    const re = (p) => (p ? rel(path.join(dest, path.relative(e.dir, p))) : p); // e.dir only as the base the stored file paths were made from
    const files = Object.fromEntries(Object.entries(e.files ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.map(re) : re(v)]));
    const meta = e.meta?.source
      ? { ...e.meta, title: e.title, description: e.description, screens: e.files?.screens?.length }
      : Object.fromEntries(PAGE_META.map((k) => [k, e.meta?.[k]]).filter(([, v]) => v !== undefined));
    r.snapshots.push({ at: e.capturedAt, dir: rel(dest), files, url: e.url, finalUrl: e.finalUrl, run: null, collection: e.project, meta, v1Entry: e.id });
    r.lastCaptured = e.capturedAt;
    moves.push([srcDir, dest, r, e]);
  }

  // text-only v1 sources (no capture)
  for (const s of extraSources) {
    const r = { id: used.has(s.id) || refs.some((x) => x.id === s.id) ? `S${++nextS}` : s.id, slug: slugify(normUrl(s.url), 60), url: s.url, normUrl: normUrl(s.url), aliases: [], label: s.title ?? null, ...splitLabel(s.title ?? ""), title: s.title ?? null, type: s.type, publisher: s.publisher ?? null, published: s.published ?? null, credibility: s.credibility, screens: [], tags: [], categories: [s.project], notes: s.note ? [{ at: s.accessedAt, collection: s.project, run: s.run ?? null, text: s.note }] : [], snapshots: [], changes: [], firstSeen: s.accessedAt, lastSeen: s.accessedAt, run: s.run ?? null };
    refs.push(r);
    col.get(s.project).members.push({ ref: r.id, role: null, addedAt: s.accessedAt, run: s.run ?? null });
  }

  // claims / runs → global, plan positions → plans/<plan>.json
  const claims = [];
  const runs = [];
  const plans = [];
  for (const p of projects) {
    for (const r of v1[p].runs) runs.push({ ...r, collection: p, kind: v1[p].pj.kind ?? null });
    for (const c of v1[p].claims) {
      const { context, ...rest } = c;
      claims.push({ ...rest, tags: c.tags ?? [], collections: [p], events: (c.events ?? []).map((ev) => ({ ...ev, collection: p })) });
    }
    if (v1[p].context) {
      const ctx = v1[p].context;
      const name = plan ?? `${p}-plan`;
      plans.push({
        name, goal: ctx.goal ?? null, audience: ctx.audience ?? null, collections: [p], items: ctx.items ?? [],
        // only active claims: a superseded/refuted claim's position described the old wording
        links: v1[p].claims.filter((c) => c.context && c.status === "active").map((c) => ({ item: c.context.ref ?? null, claim: c.id, position: c.context.position, note: c.context.note ?? null, at: c.createdAt })),
        createdAt: ctx.updatedAt ?? new Date().toISOString(),
      });
    }
  }

  log.push(`refs ${refs.length} (from ${entries.length} entries + ${extraSources.length} text sources) · claims ${claims.length} · runs ${runs.length} · plans ${plans.map((x) => x.name).join(", ") || "-"}`);
  for (const [p, c] of col) log.push(`- ${p}: ${c.members.length} members`);
  if (dryRun) return log.join("\n") + "\n(dry run — nothing written)";

  const inside = (p) => path.resolve(p).startsWith(path.resolve(LIB) + path.sep);
  for (const [from, to] of moves) if (!inside(from) || !inside(to)) throw new Error(`refusing to move outside the library: ${from} → ${to}`);
  for (const [from, to] of moves) {
    if (!existsSync(from)) {
      log.push(`⚠ missing capture folder ${from}`);
      continue;
    }
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);
  }
  for (const [, to, r, e] of moves) {
    const snap = r.snapshots.find((s) => s.v1Entry === e.id);
    if (existsSync(to)) await fs.writeFile(path.join(to, "meta.json"), JSON.stringify({ ref: r.id, ...snap }, null, 2));
  }
  await writeJsonl(FILES.refs, refs.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1))));
  await writeJsonl(FILES.claims, claims);
  await writeJsonl(FILES.runs, runs);
  for (const [p, c] of col) {
    await fs.writeFile(path.join(LIB, p, "collection.json"), JSON.stringify({ ...c, updatedAt: new Date().toISOString() }, null, 2));
    for (const f of ["project.json", "context.json", "sources.jsonl", "claims.jsonl", "runs.jsonl"]) await fs.rm(path.join(LIB, p, f), { force: true });
  }
  if (plans.length) {
    await fs.mkdir(FILES.plansDir, { recursive: true });
    for (const pl of plans) await fs.writeFile(path.join(FILES.plansDir, `${pl.name}.json`), JSON.stringify({ ...pl, updatedAt: new Date().toISOString() }, null, 2));
  }
  await fs.rm(v1Index);
  log.push("moved snapshot folders into refs/, wrote refs/claims/runs.jsonl, collection.json, plans/; removed v1 files");
  return log.join("\n");
}

export { nextId };
