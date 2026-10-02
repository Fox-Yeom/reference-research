/**
 * axes — tag normalization. Free-form pattern tags (written per product, so synonyms abound) are grouped into
 * global axes in <LIB>/axes.json (git-tracked, judged by the agent; embeddings only propose groups).
 *
 *   { "axes": [ { "id": "limit-gauge", "label": "한도 게이지", "question": "남은 한도를 어떻게 보여주나?", "facet": "pattern",
 *                 "description": "…", "tags": ["limit-gauge-pace", …] } ],
 *     "tagLabels": { "limit-gauge-pace": "남은 %·리셋 카운트다운·페이스" } }   ← what a product does, in plain words
 *
 * facet: pattern (default — UI/product/copy patterns, used by the category delta) · market · platform · positioning
 * A tag belongs to at most one axis; unmapped tags count as their own axis "#tag" until grouped.
 */
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { LIB, bad, readClaims, readRefs, slugify } from "./store.mjs";

export const AXES_FILE = path.join(LIB, "axes.json");
export const FACETS = ["pattern", "topic", "market", "platform", "positioning"]; // topic: what a course teaches (curriculum mode)

const SEED = path.join(path.dirname(fileURLToPath(import.meta.url)), "seed", "axes.json");

/** The library's axes; a new library starts from the bundled seed vocabulary (patterns, topics, plain-words labels). */
export async function readAxes() {
  for (const f of [AXES_FILE, SEED]) {
    try {
      return JSON.parse(await fs.readFile(f, "utf8"));
    } catch {
      /* try next */
    }
  }
  return { axes: [] };
}

async function writeAxes(a) {
  a.axes.sort((x, y) => (x.facet ?? "pattern").localeCompare(y.facet ?? "pattern") || x.id.localeCompare(y.id));
  a.updatedAt = new Date().toISOString();
  await fs.writeFile(AXES_FILE, JSON.stringify(a, null, 2) + "\n");
}

/** tag → axis */
export function tagIndex(a) {
  const m = new Map();
  for (const ax of a.axes) for (const t of ax.tags) m.set(t, ax);
  return m;
}

/** axis id for a tag ("#tag" when unmapped) */
export const axisOf = (idx, t) => idx.get(t)?.id ?? `#${t}`;
export const axisLabel = (idx, a, id) => (id.startsWith("#") ? id : `${a.axes.find((x) => x.id === id)?.label ?? id}`);
/** human label for a tag (tagLabels, else the tag's words) */
export const tagLabel = (a, t) => a.tagLabels?.[t] ?? t.replace(/[-_]+/g, " ");

/** Where every tag is used: refs, products, categories, claims. */
export async function tagUsage() {
  const [refs, claims] = await Promise.all([readRefs(), readClaims()]);
  const use = new Map();
  const get = (t) => use.get(t) ?? (use.set(t, { refs: new Set(), products: new Set(), categories: new Set(), claims: new Set() }), use.get(t));
  for (const r of refs)
    for (const t of r.tags ?? []) {
      const u = get(t);
      u.refs.add(r.id);
      u.products.add(r.product ?? r.id);
      for (const c of r.categories ?? []) u.categories.add(c);
    }
  for (const c of claims.filter((x) => x.status === "active"))
    for (const t of c.tags ?? []) {
      const u = get(t);
      u.claims.add(c.id);
      for (const col of c.collections ?? []) u.categories.add(col);
    }
  return use;
}

/**
 * axes[]: { id?, label, facet?, description?, tags:[…] } — merged by id (id defaults to slug of label);
 * listed tags are moved into this axis (removed from any other). remove: [axis ids]. untag: [tags] (unmap).
 */
export async function setAxes(params) {
  const a = await readAxes();
  const use = await tagUsage();
  const out = [];
  for (const it of params.axes ?? []) {
    if (!it.label && !it.id) bad("each axis needs label (or id to update)");
    const id = it.id ?? slugify(it.label, 40);
    if (it.facet && !FACETS.includes(it.facet)) bad(`facet must be one of ${FACETS.join(", ")}`);
    let ax = a.axes.find((x) => x.id === id);
    if (!ax) {
      ax = { id, label: it.label ?? id, facet: it.facet ?? "pattern", description: it.description ?? null, tags: [] };
      a.axes.push(ax);
    }
    for (const k of ["label", "facet", "description", "question"]) if (it[k] !== undefined) ax[k] = it[k];
    for (const t of it.tags ?? []) {
      if (!use.has(t)) out.push(`⚠ ${id}: tag "${t}" is not used anywhere (kept, will match future notes)`);
      for (const other of a.axes) if (other !== ax) other.tags = other.tags.filter((x) => x !== t);
      if (!ax.tags.includes(t)) ax.tags.push(t);
    }
  }
  if (params.tag_labels) a.tagLabels = { ...(a.tagLabels ?? {}), ...params.tag_labels };
  for (const id of params.remove ?? []) a.axes = a.axes.filter((x) => x.id !== id);
  for (const t of params.untag ?? []) for (const ax of a.axes) ax.tags = ax.tags.filter((x) => x !== t);
  a.axes = a.axes.filter((x) => x.tags.length || (params.axes ?? []).some((i) => (i.id ?? slugify(i.label, 40)) === x.id));
  await writeAxes(a);
  const noLabel = [...use.keys()].filter((t) => !a.tagLabels?.[t]);
  out.push(`${a.axes.length} axes · ${a.axes.reduce((s, x) => s + x.tags.length, 0)} tags mapped · ${[...use.keys()].filter((t) => !tagIndex(a).has(t)).length} unmapped · ${noLabel.length} without a plain-words label${noLabel.length ? ` (${noLabel.slice(0, 8).join(", ")}${noLabel.length > 8 ? "…" : ""} — "tag_labels")` : ""}`);
  return out.join("\n");
}

export async function showAxes(collection) {
  const a = await readAxes();
  const use = await tagUsage();
  const idx = tagIndex(a);
  const lines = [];
  for (const facet of FACETS) {
    const list = a.axes.filter((x) => (x.facet ?? "pattern") === facet);
    if (!list.length) continue;
    lines.push(`\n## ${facet}`);
    for (const ax of list) {
      const products = new Set();
      const cats = new Set();
      for (const t of ax.tags) for (const p of use.get(t)?.products ?? []) products.add(p);
      for (const t of ax.tags) for (const c of use.get(t)?.categories ?? []) cats.add(c);
      if (collection && !cats.has(collection)) continue;
      lines.push(`- ${ax.id} — ${ax.label} · ${products.size} products · ${[...cats].join(", ") || "-"}${ax.description ? `\n    ${ax.description}` : ""}\n    tags: ${ax.tags.join(", ")}`);
    }
  }
  const unmapped = [...use].filter(([t, u]) => !idx.has(t) && (!collection || u.categories.has(collection)));
  if (unmapped.length) lines.push(`\n## unmapped (${unmapped.length}) — ref axes suggest`, unmapped.map(([t, u]) => `${t}(${[...u.products].join("/")})`).join(", "));
  return lines.join("\n").trim() || "(no axes)";
}

/**
 * Candidates for unmapped tags: mutual-nearest tag pairs and the nearest existing axes (by axis centroid).
 * Tag names alone are short, so expect surface matches (scroll-storytelling ~ scrollback-context) —
 * proposals only; judge them against the notes (`ref show S#`), then `ref axes set`.
 */
export async function suggestAxes({ collection, k = 3 } = {}) {
  const { tagVectors, cos } = await import("./embed.mjs");
  const a = await readAxes();
  const use = await tagUsage();
  const idx = tagIndex(a);
  const all = [...use.keys()];
  const vec = await tagVectors(all);
  const unmapped = all.filter((t) => !idx.has(t) && (!collection || use.get(t).categories.has(collection)));
  if (!unmapped.length) return "all tags are mapped to axes";
  const norm = (v) => {
    const n = Math.hypot(...v);
    return v.map((x) => x / n);
  };
  const cents = a.axes
    .map((ax) => ({ ax, v: ax.tags.filter((t) => vec.has(t)).map((t) => vec.get(t)) }))
    .filter((x) => x.v.length)
    .map(({ ax, v }) => ({ ax, v: norm(v[0].map((_, i) => v.reduce((s, x) => s + x[i], 0))) }));
  const nn = new Map(unmapped.map((t) => [t, unmapped.filter((o) => o !== t).map((o) => ({ o, s: cos(vec.get(t), vec.get(o)) })).sort((x, y) => y.s - x.s).slice(0, k)]));
  // mutual nearest neighbours (each is the other's #1) → pairs, merged when they share a tag.
  // Chaining k-NN neighbours explodes into one giant group because e5 scores are compressed.
  const parent = new Map(unmapped.map((t) => [t, t]));
  const find = (t) => (parent.get(t) === t ? t : (parent.set(t, find(parent.get(t))), parent.get(t)));
  for (const [t, ns] of nn) if (ns[0] && nn.get(ns[0].o)[0]?.o === t) parent.set(find(t), find(ns[0].o));
  const groups = new Map();
  for (const t of unmapped) groups.set(find(t), [...(groups.get(find(t)) ?? []), t]);
  const fmt = (t) => `${t}(${[...use.get(t).products].join("/")})`;
  const lines = [`${unmapped.length} unmapped tags${collection ? ` in ${collection}` : ""} · ${a.axes.length} axes`, ""];
  const multi = [...groups.values()].filter((g) => g.length > 1).sort((x, y) => y.length - x.length);
  if (multi.length) lines.push("Candidate pairs (each other's nearest tag — judge against the notes, do not accept blindly):", ...multi.map((g) => `- ${g.map(fmt).join(", ")}`), "");
  if (cents.length) {
    lines.push("Nearest existing axis per tag:");
    for (const t of unmapped) {
      const best = cents.map((c) => ({ id: c.ax.id, s: cos(vec.get(t), c.v) })).sort((x, y) => y.s - x.s).slice(0, 2);
      lines.push(`- ${fmt(t)} → ${best.map((b) => `${b.id} ${b.s.toFixed(3)}`).join(" | ")}`);
    }
  } else lines.push("Nearest tags:", ...unmapped.map((t) => `- ${fmt(t)} → ${nn.get(t).map(({ o, s }) => `${o} ${s.toFixed(3)}`).join(" | ")}`));
  return lines.join("\n");
}
