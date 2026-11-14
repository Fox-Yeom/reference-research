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
  FILES, LIB, ROLES, SCREEN_TYPES, TYPE_CRED, collectionDir, confidence, hostOf, idsFromUrl, listCollections, normName, readEntities, readState, readTopics, sameWork, writeEntities, looksLikeArticle, readClaims, readRefs, recomputeConfidence, saveRefs, nextId, normUrl, readJsonl, rel, slugify, splitLabel, stamp, writeCollection, writeJsonl,
} from "./store.mjs";
import { readAxes, tagUsage } from "./axes.mjs";

const ROLE_SET = new Set(ROLES);
const SCREEN_SET = new Set(SCREEN_TYPES);
const PAGE_META = ["title", "description", "ogImage", "lang", "headings", "nav", "ctas", "fonts", "topColors", "viewport", "pageHeight", "innerScroller", "hiddenOverlays", "frameYs"];

/** analogous → indirect (docs/RESEARCH-FLOW-REDESIGN.md Q7); the old value stays in roleWas. Safe to run twice. */
export async function migrateRoles({ dryRun = false } = {}) {
  const log = [];
  for (const c of await listCollections()) {
    const hit = c.members.filter((m) => m.role === "analogous");
    if (!hit.length) continue;
    log.push(`${c.name}: ${hit.length}`);
    if (dryRun) continue;
    for (const m of hit) Object.assign(m, { role: "indirect", roleWas: "analogous" });
    await writeCollection(c);
  }
  if (!log.length) return "nothing to migrate (no analogous members)";
  return [`${dryRun ? "would move" : "moved"} analogous → indirect:`, ...log.map((l) => `- ${l}`), ...(dryRun ? [] : ["Re-run `ref report` per collection to refresh the boards."])].join("\n");
}

/** Captures whose tag made an article official or docs: move them to blog (grade C), keep typeWas, re-evaluate confidence. `keep` = a company's own announcements: their grade is pinned. Safe to run twice. */
export async function migrateGrades({ dryRun = false, keep = [] } = {}) {
  const refs = await readRefs();
  const hits = refs.filter((r) => ["official", "docs"].includes(r.type) && r.snapshots?.length && !r.credibilitySet && looksLikeArticle(r.url));
  const kept = hits.filter((r) => keep.includes(r.id)).map((r) => ({ ...r, credibilitySet: true }));
  const moved = hits.filter((r) => !keep.includes(r.id)).map((r) => ({ ...r, typeWas: r.type, type: "blog", credibility: TYPE_CRED.blog }));
  if (!moved.length) return "nothing to move";
  const byId = new Map([...refs, ...moved].map((r) => [r.id, r]));
  const shifts = {};
  for (const c of await readClaims()) {
    const next = confidence(c, byId);
    if (c.status === "active" && next !== c.confidence) shifts[`${c.confidence} → ${next}`] = (shifts[`${c.confidence} → ${next}`] ?? 0) + 1;
  }
  const hosts = {};
  for (const r of moved) hosts[new URL(r.url).hostname] = (hosts[new URL(r.url).hostname] ?? 0) + 1;
  const top = Object.entries(hosts).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([h, n]) => `${h} ${n}`);
  if (!dryRun) {
    await saveRefs([...moved, ...kept]);
    await recomputeConfidence();
  }
  return [`${dryRun ? "would move" : "moved"} ${moved.length} refs${kept.length ? ` (kept ${kept.length})` : ""} of ${refs.filter((r) => ["official", "docs"].includes(r.type)).length} official/docs → blog (grade C)`, `hosts: ${top.join(" · ")}`, `claim confidence: ${Object.entries(shifts).map(([k, n]) => `${k} ${n}`).join(" · ") || "no change"}`].join("\n");
}

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

/**
 * v2 → v3 (docs/DATA-MODEL.md §14, issue #19): fills what can be derived, lists what needs a person.
 * Applied: ref.read = full where a note, summary or snapshot shows the source was read · ref.ids from URLs ·
 *          product entities from exact product names (one entity per normalized name, variants kept as aliases).
 * Review only (never written): topics per collection, counter-evidence candidates from SUMMARY "반대 근거" lines,
 *          same-work duplicates, products split across one host, missing head fields, members without role, axes without description.
 * Safe to run twice: the second run changes nothing. Run on a git-committed library; one commit reverts it.
 */
export async function migrateV3({ dryRun = false, out = null } = {}) {
  const [refs, claims, cols, entities, topics, axes, use] = await Promise.all([readRefs(), readClaims(), listCollections(), readEntities(), readTopics(), readAxes(), tagUsage()]);
  const changed = new Map();
  const touch = (r) => changed.set(r.id, r);
  const count = { read: 0, ids: 0, entityNew: 0, entityLinked: 0 };

  // read level: a note, a summary or a capture means someone looked at the source itself
  for (const r of refs) {
    if (r.read || !(r.notes?.length || r.summary || r.snapshots?.length)) continue;
    r.read = "full";
    count.read++;
    touch(r);
  }
  // identifiers on the face of the URL or its aliases
  for (const r of refs) {
    const ids = Object.assign({}, ...[r.url, ...(r.aliases ?? []).map((a) => `https://${a}`)].map(idsFromUrl));
    const add = Object.fromEntries(Object.entries(ids).filter(([k]) => !r.ids?.[k]));
    if (!Object.keys(add).length) continue;
    r.ids = { ...(r.ids ?? {}), ...add };
    count.ids++;
    touch(r);
  }
  // product entities: exact normalized names only; fuzzy matches go to the review list
  const groups = new Map();
  for (const r of refs) if (r.product && !r.entity) (groups.get(normName(r.product)) ?? groups.set(normName(r.product), []).get(normName(r.product))).push(r);
  for (const [key, rs] of groups) {
    if (!key) continue;
    let ent = entities.find((e) => e.kind === "product" && (normName(e.name) === key || (e.aliases ?? []).some((a) => normName(a) === key)));
    if (!ent) {
      const names = Object.entries(rs.reduce((m, r) => ({ ...m, [r.product]: (m[r.product] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).map(([n]) => n);
      ent = { id: nextId("E", entities), kind: "product", name: names[0], aliases: names.slice(1) };
      entities.push(ent);
      count.entityNew++;
    }
    for (const r of rs) {
      r.entity = ent.id;
      count.entityLinked++;
      touch(r);
    }
  }

  // ---- review lists ----
  const dupes = [];
  for (let i = 0; i < refs.length; i++) for (let j = i + 1; j < refs.length; j++) if (refs[i].ids && refs[j].ids && sameWork(refs[i].ids, refs[j].ids)) dupes.push(`${refs[i].id} = ${refs[j].id} (${Object.entries(refs[i].ids).map(([k, v]) => `${k}:${v}`).join(" ")})`);
  const byHost = new Map();
  for (const r of refs) if (r.entity) {
    const h = hostOf(r.url);
    (byHost.get(h) ?? byHost.set(h, new Set()).get(h)).add(r.entity);
  }
  const split = [...byHost].filter(([, s]) => s.size > 1).map(([h, s]) => `${h}: ${[...s].map((id) => `${id} ${entities.find((e) => e.id === id)?.name}`).join(" · ")}`);
  const counter = [];
  for (const c of cols) {
    const sum = await fs.readFile(path.join(collectionDir(c.name), "SUMMARY.md"), "utf8").catch(() => "");
    for (const line of sum.split("\n").filter((l) => /반대 근거/.test(l))) {
      const ids = [...line.matchAll(/\b([SC]\d+)\b/g)].map((m) => m[1]);
      if (ids.length) counter.push(`${c.name}: ${line.replace(/^[-*\s]+/, "").slice(0, 120)}  → cited ${ids.join(", ")}`);
    }
  }
  const noTopic = cols.filter((c) => !c.topic || !topics.some((t) => t.id === c.topic));
  const head = cols.map((c) => [c.name, ["title", "goal", "question"].filter((k) => !c[k])]).filter(([, m]) => m.length);
  const noRole = cols.map((c) => [c.name, c.members.filter((m) => !m.role).length]).filter(([, n]) => n);
  const noDesc = axes.axes.filter((a) => !a.description).map((a) => a.id);
  const unused = axes.axes.filter((a) => !a.tags.some((t) => use.has(t)) && !axes.axes.some((x) => x.broader === a.id)).map((a) => a.id);
  const byId = new Map(refs.map((r) => [r.id, r]));
  const active = claims.filter((c) => c.status === "active");
  const states = active.reduce((m, c) => ({ ...m, [readState(c, byId)]: (m[readState(c, byId)] ?? 0) + 1 }), {});
  const shifts = {};
  for (const c of active) {
    const next = confidence(c, byId);
    if (next !== c.confidence) shifts[`${c.confidence} → ${next}`] = (shifts[`${c.confidence} → ${next}`] ?? 0) + 1;
  }

  const lines = [
    `# ref migrate v3 ${dryRun ? "(dry run — nothing written)" : "(applied)"}`,
    "",
    "## Applied",
    `- read = full: ${count.read} refs (note, summary or capture present)`,
    `- identifiers from URLs: ${count.ids} refs`,
    `- product entities: ${count.entityNew} new · ${count.entityLinked} refs linked`,
    `- claim strength changes: ${Object.entries(shifts).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}`,
    `- reading of cited sources (active claims): full ${states.full ?? 0} · snippet ${states.snippet ?? 0} · unrecorded ${states.unknown ?? 0} (board marks unrecorded as 열람 미기록)`,
    "",
    "## Review (not written)",
    `### Topics: ${noTopic.length} collections without one`,
    ...noTopic.map((c) => `- ${c.name} · ${c.title ?? ""} · ${c.goal ?? c.description ?? ""}`),
    noTopic.length ? `\nFill and run: ref topic set '${JSON.stringify({ topics: topics.length ? [] : [{ id: "<topic-id>", label: "<주제 이름>" }], assign: Object.fromEntries(noTopic.map((c) => [c.name, "<topic-id>"])) })}'` : "",
    `### Counter-evidence candidates: ${counter.length} SUMMARY lines (set with ref claim add {update:"C#", against:["S#"]})`,
    ...counter.map((l) => `- ${l}`),
    `### Same work, separate refs: ${dupes.length}`,
    ...dupes.map((l) => `- ${l}`),
    `### One host, several products: ${split.length} (merge with aliases or set parent via ref entity set)`,
    ...split.slice(0, 60).map((l) => `- ${l}`),
    split.length > 60 ? `- … ${split.length - 60} more` : "",
    `### Board head missing fields: ${head.length}`,
    ...head.map(([n, m]) => `- ${n}: ${m.join(", ")}`),
    `### Members without role: ${noRole.reduce((s, [, n]) => s + n, 0)} in ${noRole.length} collections`,
    ...noRole.map(([n, k]) => `- ${n}: ${k}`),
    `### Axes without description: ${noDesc.length}${noDesc.length ? ` — ${noDesc.join(", ")}` : ""}`,
    `### Unused axes: ${unused.length}${unused.length ? ` — ${unused.join(", ")} (remove with ref axes set {remove:[…]})` : ""}`,
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "");
  if (!dryRun) {
    if (count.entityNew) await writeEntities(entities);
    if (changed.size) await saveRefs([...changed.values()]);
    if (changed.size) await recomputeConfidence();
  }
  const text = lines.join("\n");
  if (out) await fs.writeFile(out, text + "\n");
  return text + (dryRun ? "" : "\n\nCommit the library now; re-run `ref report` per collection to refresh boards.");
}
