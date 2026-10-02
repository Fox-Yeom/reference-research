/**
 * store — library layout and records for the ref CLI (v2, reference-centric).
 *
 *   <LIB>/refs.jsonl              S#  one record per reference (URL). Belongs to any number of categories (collections).
 *   <LIB>/refs/<slug>/<stamp>/        capture snapshots of that reference (images + meta.json)
 *   <LIB>/claims.jsonl            C#  findings, cite S#, global across categories
 *   <LIB>/runs.jsonl              R#  research sessions (one collection each)
 *   <LIB>/<collection>/collection.json   category: kind, domain, members [{ref, role}]
 *   <LIB>/<collection>/{NOTES,SUMMARY,DELTA,README}.md, index.html
 *   <LIB>/plans/<plan>.json            optional plan layer: items + links to claims (positions live here, not on claims)
 *   <LIB>/.vectors/                    local embeddings (derived, git-ignored)
 *
 * All stored paths are relative to LIB so the library works after a git clone elsewhere.
 * JSONL files are append-only with upsert-by-id (later line wins); `compact` rewrites them.
 */
import { promises as fs, existsSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const LIB = process.env.REF_LIBRARY || path.join(os.homedir(), "references");
/** per-user tool data outside the plugin folder (survives plugin updates): optional embedding deps, model cache */
export const REF_HOME = process.env.REF_HOME || path.join(os.homedir(), ".reference-research");
export const FILES = {
  refs: path.join(LIB, "refs.jsonl"),
  claims: path.join(LIB, "claims.jsonl"),
  runs: path.join(LIB, "runs.jsonl"),
  learnings: path.join(LIB, "LEARNINGS.md"),
  refsDir: path.join(LIB, "refs"),
  plansDir: path.join(LIB, "plans"),
  vectorsDir: path.join(LIB, ".vectors"),
};
const RESERVED = new Set(["refs", "plans", "node_modules"]);

/** coverage tags per domain (what kinds of pages a product should be seen through) */
export const COVERAGE = {
  design: ["landing", "features", "pricing", "app-ui", "onboarding", "help", "store"],
  curriculum: ["landing", "syllabus", "sample-lesson", "project", "assessment", "reviews", "pricing"],
};
export const SCREEN_TYPES = [...new Set(Object.values(COVERAGE).flat())];
export const coverageTypes = (domain) => COVERAGE[domain] ?? COVERAGE.design;
export const ROLES = ["direct", "indirect", "analogous"];
export const DOMAINS = ["design", "dev", "research", "curriculum"];
// framework: competency frameworks / official curricula (UNESCO, 교육부 …) · survey: learner/employer surveys · job-posting: demand evidence
export const SOURCE_TYPES = ["official", "docs", "store", "repo", "paper", "report", "press", "framework", "survey", "job-posting", "community", "blog", "listicle", "capture", "other"];
export const TYPE_CRED = { official: "A", docs: "A", store: "A", repo: "A", paper: "A", framework: "A", report: "B", press: "B", survey: "B", capture: "B", "job-posting": "C", community: "C", blog: "C", listicle: "C", other: "C" };
export const CRED_SCORE = { A: 3, B: 2, C: 1, D: 0 };
export const CLAIM_KINDS = ["fact", "pattern", "benchmark", "failure", "gap", "opinion", "hypothesis"];
export const POSITIONS = ["table-stakes", "duplicate", "below-bar", "differentiator", "gap", "validates", "contradicts"];

export class RefError extends Error {}
export const bad = (msg) => {
  throw new RefError(msg);
};

// ---------- small helpers ----------

export function slugify(s, max = 60) {
  const out = String(s)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return out || "item";
}

export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function normUrl(u) {
  try {
    const x = new URL(u);
    x.hash = "";
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|ref$|ref_src$|fbclid$|gclid$|ajs_|mt$|uo$)/.test(k)) x.searchParams.delete(k);
    return (x.host.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "") + (x.search || "")).toLowerCase();
  } catch {
    return String(u).trim().toLowerCase();
  }
}

export function hostOf(u) {
  try {
    return new URL(u).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return String(u);
  }
}

/** "Warp — landing" → { product: "Warp", page: "landing" } */
export function splitLabel(label) {
  const [product, ...rest] = String(label ?? "").split(/\s+[—-]\s+/);
  return { product: product.trim(), page: rest.join(" — ").trim() || null };
}

export const rel = (p) => (p ? path.relative(LIB, p) : p);
export const abs = (p) => (p ? (path.isAbsolute(p) ? p : path.join(LIB, p)) : p);
export const daysSince = (iso) => (iso ? (Date.now() - Date.parse(iso)) / 864e5 : Infinity);
export const cites = (ids) => (ids?.length ? `[${ids.join(", ")}]` : "");

export function nextId(prefix, items) {
  const n = items.reduce((m, x) => {
    const k = String(x.id ?? "").match(new RegExp(`^${prefix}(\\d+)$`));
    return k ? Math.max(m, Number(k[1])) : m;
  }, 0);
  return `${prefix}${n + 1}`;
}

const numOf = (id) => Number(String(id).replace(/^\D+/, "")) || 0;
export const byNum = (a, b) => numOf(a.id) - numOf(b.id);

// ---------- JSONL ----------

export async function readJsonl(f) {
  if (!existsSync(f)) return [];
  const map = new Map();
  for (const line of (await fs.readFile(f, "utf8")).split("\n")) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      map.set(o.id, o);
    } catch {
      /* skip bad line */
    }
  }
  return [...map.values()].sort(byNum);
}

export async function appendJsonl(f, objs) {
  if (!objs.length) return;
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.appendFile(f, objs.map((o) => JSON.stringify(o)).join("\n") + "\n");
}

export async function writeJsonl(f, objs) {
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, objs.map((o) => JSON.stringify(o)).join("\n") + (objs.length ? "\n" : ""));
}

export const readRefs = () => readJsonl(FILES.refs);
export const saveRefs = (list) => appendJsonl(FILES.refs, list);
export const readClaims = () => readJsonl(FILES.claims);
export const saveClaims = (list) => appendJsonl(FILES.claims, list);
export const readRuns = () => readJsonl(FILES.runs);
export const saveRuns = (list) => appendJsonl(FILES.runs, list);

export function findRef(refs, url) {
  const n = normUrl(url);
  return refs.find((r) => r.normUrl === n || (r.aliases ?? []).includes(n));
}

export function refSlug(refs, url) {
  const base = slugify(normUrl(url), 60);
  let slug = base;
  for (let i = 2; refs.some((r) => r.slug === slug) || existsSync(path.join(FILES.refsDir, slug)); i++) slug = `${base}-${i}`;
  return slug;
}

export const latestSnapshot = (ref) => (ref.snapshots?.length ? ref.snapshots[ref.snapshots.length - 1] : null);

// ---------- collections (categories) ----------

export function collectionName(name) {
  if (!name) bad("collection is required");
  const n = slugify(name, 50);
  if (RESERVED.has(n) || n.startsWith(".")) bad(`"${n}" is a reserved name`);
  return n;
}

export const collectionDir = (name) => path.join(LIB, name);

export async function readCollection(name) {
  try {
    return JSON.parse(await fs.readFile(path.join(collectionDir(name), "collection.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function writeCollection(c) {
  await fs.mkdir(collectionDir(c.name), { recursive: true });
  c.updatedAt = new Date().toISOString();
  await fs.writeFile(path.join(collectionDir(c.name), "collection.json"), JSON.stringify(c, null, 2));
}

export async function ensureCollection(name, opts = {}) {
  const n = collectionName(name);
  const c = (await readCollection(n)) ?? { name: n, createdAt: new Date().toISOString(), domain: "design", members: [] };
  if (opts.kind) c.kind = opts.kind;
  if (opts.domain) {
    if (!DOMAINS.includes(opts.domain)) bad(`domain must be one of ${DOMAINS.join(", ")}`);
    c.domain = opts.domain;
  }
  if (opts.description) c.description = opts.description;
  if (opts.title) c.title = opts.title;
  await writeCollection(c);
  return c;
}

export async function listCollections() {
  if (!existsSync(LIB)) return [];
  const out = [];
  for (const d of await fs.readdir(LIB, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith(".") || RESERVED.has(d.name)) continue;
    const c = await readCollection(d.name);
    if (c) out.push(c);
  }
  return out;
}

/** Add ref to collection (idempotent). Returns true when the category is new for that ref. */
export function addMember(col, ref, role, run) {
  const m = col.members.find((x) => x.ref === ref.id);
  if (m) {
    if (role && ROLES.includes(role)) m.role = role;
  } else col.members.push({ ref: ref.id, role: ROLES.includes(role) ? role : null, addedAt: new Date().toISOString(), run: run ?? null });
  ref.categories = [...new Set([...(ref.categories ?? []), col.name])];
  return !m;
}

// ---------- confidence ----------

/** Who stands behind a source: explicit publisher > GitHub owner > host. Same publisher on two domains counts once. */
export function publisherKey(r) {
  const h = hostOf(r.url);
  if (r.publisher && r.publisher.toLowerCase() !== h) return r.publisher.trim().toLowerCase();
  if (h === "github.com") {
    try {
      return "github.com/" + new URL(r.url).pathname.split("/")[1].toLowerCase();
    } catch {
      /* fall through */
    }
  }
  return h;
}

/** high: ≥2 independent publishers and score ≥4 (gap: capped at medium) · medium: score ≥2 · low: otherwise. */
export function confidence(claim, refById) {
  if (claim.kind === "hypothesis") return "hypothesis";
  const best = new Map();
  for (const sid of claim.sources) {
    const r = refById.get(sid);
    if (!r) continue;
    const k = publisherKey(r);
    best.set(k, Math.max(best.get(k) ?? 0, CRED_SCORE[r.credibility] ?? 0));
  }
  const score = [...best.values()].reduce((a, b) => a + b, 0);
  // absence ("nobody does X") is bounded by the search, not by the sources → never high
  if (best.size >= 2 && score >= 4) return claim.kind === "gap" ? "medium" : "high";
  if (score >= 2) return "medium";
  return "low";
}

/** Ref edits (type, credibility, publisher) change claim confidence — re-evaluate every claim. */
export async function recomputeConfidence() {
  const [claims, refs] = await Promise.all([readClaims(), readRefs()]);
  const byId = new Map(refs.map((r) => [r.id, r]));
  const changed = claims.filter((c) => confidence(c, byId) !== c.confidence).map((c) => ({ ...c, confidence: confidence(c, byId) }));
  await saveClaims(changed);
  return changed.map((c) => `${c.id}→${c.confidence}`);
}

/** Rewrite JSONL files without superseded lines. */
export async function compactAll() {
  for (const f of [FILES.refs, FILES.claims, FILES.runs]) await writeJsonl(f, await readJsonl(f));
}
