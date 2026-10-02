/**
 * embed — local embeddings (transformers.js, multilingual-e5-small, no API) for refs, claims and categories.
 *
 * Vectors are derived data in <LIB>/.vectors/<model>.json (git-ignored), updated incrementally by text hash.
 * e5 scores cluster around 0.75–0.9, so callers rank by score and never use an absolute threshold.
 */
import { createHash } from "node:crypto";
import { promises as fs, existsSync } from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { FILES, REF_HOME, latestSnapshot, readClaims, readRefs } from "./store.mjs";

export const MODEL = process.env.REF_EMBED_MODEL || "Xenova/multilingual-e5-small";
const VFILE = path.join(FILES.vectorsDir, MODEL.replace(/[^\w.-]+/g, "_") + ".json");
const BATCH = 16;
let extractor;

/** Embeddings are optional (~700 MB): installed by `ref setup --embeddings` into REF_HOME, not into the plugin. */
export async function loadTransformers() {
  try {
    const entry = createRequire(path.join(REF_HOME, "package.json")).resolve("@huggingface/transformers");
    return await import(pathToFileURL(entry).href);
  } catch {
    try {
      return await import("@huggingface/transformers"); // dev checkout with it in node_modules
    } catch {
      throw new Error("embeddings not installed — run `ref setup --embeddings` (optional, ~700 MB)");
    }
  }
}

async function model() {
  if (!extractor) {
    const tf = await loadTransformers();
    tf.env.cacheDir = path.join(REF_HOME, "models");
    extractor = await tf.pipeline("feature-extraction", MODEL, { dtype: "q8" });
  }
  return extractor;
}

async function vecs(texts) {
  const ex = await model();
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) out.push(...(await ex(texts.slice(i, i + BATCH), { pooling: "mean", normalize: true })).tolist());
  return out;
}

const hash = (s) => createHash("sha1").update(s).digest("hex").slice(0, 12);
const enc = (v) => Buffer.from(new Float32Array(v).buffer).toString("base64");
const dec = (s) => {
  const b = Buffer.from(s, "base64"); // may be a view into Node's shared pool → copy out its own bytes
  return Array.from(new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)));
};
export const cos = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

export function refText(r) {
  const m = latestSnapshot(r)?.meta ?? {};
  return [
    `${r.product ?? ""} — ${r.page ?? ""}. ${r.title ?? ""}. ${r.description ?? m.description ?? ""}`,
    (m.headings ?? []).slice(0, 12).map((h) => h.replace(/^H\d: /, "")).join(" · "),
    r.tags?.length ? `tags: ${r.tags.join(", ")}` : "",
    r.notes?.length ? r.notes.slice(-2).map((n) => n.text).join(" ").slice(0, 700) : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const claimText = (c) => `${c.subject ? c.subject + ": " : ""}${c.text}${c.tags?.length ? ` (tags: ${c.tags.join(", ")})` : ""}`;

async function load() {
  try {
    return JSON.parse(await fs.readFile(VFILE, "utf8"));
  } catch {
    return { model: MODEL, items: {} };
  }
}

/** Embed new/changed refs and claims. Returns { store, updated }. */
export async function update({ rebuild = false } = {}) {
  const store = rebuild ? { model: MODEL, items: {} } : await load();
  const [refs, claims] = await Promise.all([readRefs(), readClaims()]);
  const want = [
    ...refs.map((r) => [`ref:${r.id}`, refText(r)]),
    ...claims.filter((c) => c.status === "active").map((c) => [`claim:${c.id}`, claimText(c)]),
  ];
  const todo = want.filter(([k, t]) => store.items[k]?.h !== hash(t));
  if (todo.length) {
    const vs = await vecs(todo.map(([, t]) => "passage: " + t));
    todo.forEach(([k, t], i) => (store.items[k] = { h: hash(t), v: enc(vs[i]) }));
  }
  const live = new Set(want.map(([k]) => k));
  for (const k of Object.keys(store.items)) if (/^(ref|claim):/.test(k) && !live.has(k)) delete store.items[k]; // tag:* is managed by tagVectors
  if (todo.length || rebuild) {
    await fs.mkdir(FILES.vectorsDir, { recursive: true });
    await fs.writeFile(VFILE, JSON.stringify(store));
  }
  return { store, updated: todo.length };
}

const vectorOf = (store, key) => (store.items[key] ? dec(store.items[key].v) : null);

function centroid(vs) {
  if (!vs.length) return null;
  const c = vs[0].map((_, i) => vs.reduce((s, v) => s + v[i], 0) / vs.length);
  const n = Math.hypot(...c);
  return c.map((x) => x / n);
}

/** query: free text, "S12" or "C3". scope: refs|claims|all. exclude: Set of ids. */
export async function similar(query, { scope = "all", k = 8, exclude = new Set() } = {}) {
  const { store } = await update();
  let qv;
  let self = null;
  if (/^[SC]\d+$/.test(query)) {
    self = query;
    qv = vectorOf(store, `${query.startsWith("S") ? "ref" : "claim"}:${query}`);
    if (!qv) return [];
  } else qv = (await vecs(["query: " + query]))[0];
  return Object.keys(store.items)
    .filter((key) => (scope === "all" ? /^(ref|claim):/.test(key) : key.startsWith(scope === "refs" ? "ref:" : "claim:")))
    .map((key) => ({ id: key.split(":")[1], kind: key.split(":")[0], score: cos(qv, vectorOf(store, key)) }))
    .filter((x) => x.id !== self && !exclude.has(x.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** Category vectors = centroid of member refs. Returns [{ name, size, near: [{name, score, shared}] }]. */
export async function categoryMap(collections) {
  const { store } = await update();
  const cents = collections
    .map((c) => ({ c, v: centroid(c.members.map((m) => vectorOf(store, `ref:${m.ref}`)).filter(Boolean)) }))
    .filter((x) => x.v);
  return cents.map(({ c, v }) => ({
    name: c.name,
    size: c.members.length,
    near: cents
      .filter((o) => o.c.name !== c.name)
      .map((o) => ({ name: o.c.name, score: cos(v, o.v), shared: c.members.filter((m) => o.c.members.some((x) => x.ref === m.ref)).length }))
      .sort((a, b) => b.score - a.score),
    v,
  }));
}

/** Refs outside a collection that sit close to it (by goal text and by centroid) — candidates to add as a category. */
export async function relatedOutside(col, goal, k = 8) {
  const members = new Set(col.members.map((m) => m.ref));
  const byGoal = goal ? await similar(goal, { scope: "refs", k, exclude: members }) : [];
  const { store } = await update();
  const cv = centroid(col.members.map((m) => vectorOf(store, `ref:${m.ref}`)).filter(Boolean));
  const byCentroid = cv
    ? Object.keys(store.items)
        .filter((key) => key.startsWith("ref:") && !members.has(key.slice(4)))
        .map((key) => ({ id: key.slice(4), kind: "ref", score: cos(cv, vectorOf(store, key)) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
    : [];
  return { byGoal, byCentroid };
}

/** Vectors for tag names ("limit-gauge-pace" → "limit gauge pace"), cached under tag:*. Returns Map(tag → vector). */
export async function tagVectors(tags) {
  const store = await load();
  const text = (t) => "passage: " + t.replace(/[-_]+/g, " ");
  const todo = tags.filter((t) => store.items[`tag:${t}`]?.h !== hash(text(t)));
  if (todo.length) {
    const vs = await vecs(todo.map(text));
    todo.forEach((t, i) => (store.items[`tag:${t}`] = { h: hash(text(t)), v: enc(vs[i]) }));
    await fs.mkdir(FILES.vectorsDir, { recursive: true });
    await fs.writeFile(VFILE, JSON.stringify(store));
  }
  return new Map(tags.map((t) => [t, vectorOf(store, `tag:${t}`)]));
}

export const hasModelCache = () => existsSync(VFILE);
