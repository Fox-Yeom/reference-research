/**
 * evidence — runs, notes, sources, claims, deltas and the optional plan layer (v2).
 *
 * Deltas (all computed, nothing stored on claims):
 *   A  run delta       what a run added / revised / refuted / confirmed
 *   C  category delta  across a collection's products: common tags (table stakes) vs. tags only one product has
 *   T  time delta      member refs whose re-capture changed, and members not re-checked for a long time
 *   P  plan delta      (plans/<plan>.json) plan items × linked claims → verdicts, plus embedding suggestions
 */
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { axisOf, readAxes, tagIndex } from "./axes.mjs";
import {
  CLAIM_KINDS, FILES, POSITIONS, SCREEN_TYPES, SOURCE_TYPES, TYPE_CRED, abs, addMember, bad, cites, collectionDir, collectionName,
  confidence, daysSince, ensureCollection, findRef, latestSnapshot, nextId, normUrl, readClaims, readCollection, readRefs,
  readRuns, recomputeConfidence, refSlug, saveClaims, saveRefs, saveRuns, splitLabel, writeCollection,
} from "./store.mjs";

const STALE_DAYS = 90;
const CITE_RE = /\[((?:[SC]\d+)(?:\s*,\s*[SC]\d+)*)\]/g;
const ITEM_PREFIX = { feature: "F", assumption: "A", constraint: "K", metric: "M" };

export async function mustCollection(name) {
  const c = await readCollection(collectionName(name));
  if (!c) bad(`collection not found: ${name} (ref list)`);
  return c;
}

const claimLine = (c) =>
  `- ${c.id} [${c.kind}, ${c.confidence}${c.status !== "active" ? `, ${c.status}→${c.replacedBy}` : ""}] ${c.subject ? c.subject + ": " : ""}${c.text} ${cites(c.sources)}`;

export const formatClaims = (claims) => (claims.length ? claims.map(claimLine).join("\n") : "(no claims)");

/** Claims recorded in this collection, and active claims from other collections that cite its members. */
export function collectionClaims(col, claims) {
  const members = new Set(col.members.map((m) => m.ref));
  const own = claims.filter((c) => (c.collections ?? []).includes(col.name));
  const related = claims.filter((c) => !own.includes(c) && c.status === "active" && c.sources.some((s) => members.has(s)));
  return { own, related };
}

// ---------- runs ----------

export async function startRun(params, findRelated) {
  const col = await ensureCollection(params.collection ?? params.project, { kind: params.kind, domain: params.domain, title: params.title, description: params.description ?? params.project_description });
  const runs = await readRuns();
  const run = { id: nextId("R", runs), collection: col.name, goal: params.goal ?? null, domain: col.domain, kind: col.kind ?? null, startedAt: new Date().toISOString() };
  await saveRuns([run]);
  col.currentRun = run.id;
  // the category's own purpose (board header): first run's goal unless set explicitly; audience/question when given
  if (params.goal && !col.goal) col.goal = params.goal;
  if (params.audience) col.audience = params.audience;
  if (params.question) col.question = params.question;
  await writeCollection(col);

  const [refs, claims] = await Promise.all([readRefs(), readClaims()]);
  const byId = new Map(refs.map((r) => [r.id, r]));
  const { own, related: relClaims } = collectionClaims(col, claims);
  const active = own.filter((c) => c.status === "active");
  const stale = col.members.map((m) => byId.get(m.ref)).filter((r) => r?.snapshots?.length && daysSince(r.lastCaptured) > STALE_DAYS);
  const lines = [
    `Started ${run.id} (${col.domain}) for ${col.name}: ${run.goal ?? ""}`,
    `Baseline: ${col.members.length} refs · ${active.length} active claims here · ${relClaims.length} claims from other categories citing these refs`,
  ];
  if (active.length) lines.push("", "Claims (confirm / revise / refute instead of re-adding):", ...active.map(claimLine));
  if (relClaims.length) lines.push("", "From other categories (same refs):", ...relClaims.map((c) => `${claimLine(c)}  ‹${(c.collections ?? []).join(", ")}›`));
  if (stale.length) lines.push("", `Stale members (> ${STALE_DAYS}d since capture — re-capture with "force":true to refresh):`, ...stale.map((r) => `- ${r.id} ${r.label} (${Math.floor(daysSince(r.lastCaptured))}d)`));
  if (findRelated) {
    try {
      const rel = await findRelated(col, run.goal);
      const fmt = (x) => {
        const r = byId.get(x.id);
        return `- ${x.id} ${r?.label ?? r?.url} ‹${(r?.categories ?? []).join(", ")}› ${x.score.toFixed(3)}`;
      };
      if (rel.byGoal.length || rel.byCentroid.length)
        lines.push(
          "",
          "Library refs from OTHER categories close to this run (ranked, not judged — `ref collect` the ones on the same axis):",
          ...(rel.byGoal.length ? ["by goal:", ...rel.byGoal.map(fmt)] : []),
          ...(rel.byCentroid.length ? ["by category centroid:", ...rel.byCentroid.map(fmt)] : []),
        );
    } catch (e) {
      lines.push("", `(related-reference search skipped: ${e.message.split("\n")[0]})`);
    }
  }
  return lines.join("\n");
}

// ---------- refs without captures, membership, notes ----------

export async function addSources(params) {
  const list = params.sources ?? [params];
  if (!list.length) bad("sources[] is required");
  const col = params.collection ? await mustCollection(params.collection) : null;
  const refs = await readRefs();
  const now = new Date().toISOString();
  const touched = new Map();
  const out = [];
  for (const it of list) {
    if (!it.url) bad("each source needs url");
    if (it.type && !SOURCE_TYPES.includes(it.type)) bad(`source type must be one of ${SOURCE_TYPES.join(", ")}`);
    if (it.credibility && !["A", "B", "C", "D"].includes(it.credibility)) bad("credibility must be A, B, C or D");
    let r = findRef(refs, it.url);
    const isNew = !r;
    if (!r) {
      const { product, page } = splitLabel(it.label ?? it.title ?? "");
      r = { id: nextId("S", refs), slug: refSlug(refs, it.url), url: it.url, normUrl: normUrl(it.url), aliases: [], label: it.label ?? it.title ?? null, product: product || null, page, screens: [], tags: [], categories: [], notes: [], snapshots: [], changes: [], firstSeen: now, run: col?.currentRun ?? null };
      refs.push(r);
    }
    for (const k of ["title", "publisher", "published", "label", "description", "summary"]) if (it[k] !== undefined) r[k] = it[k]; // summary = one-line 요지 shown in the board's 자료 목록
    if (it.type) r.type = it.type;
    r.type ??= "other";
    if (it.credibility) Object.assign(r, { credibility: it.credibility, credibilitySet: true });
    else if (!r.credibilitySet) r.credibility = TYPE_CRED[r.type];
    if (it.tags) {
      r.screens = [...new Set([...(r.screens ?? []), ...it.tags.filter((t) => SCREEN_TYPES.includes(t))])];
      r.tags = [...new Set([...r.tags, ...it.tags.filter((t) => !SCREEN_TYPES.includes(t) && !["direct", "indirect", "analogous"].includes(t))])];
    }
    if (it.note) r.notes.push({ at: now, collection: col?.name ?? null, run: col?.currentRun ?? null, text: it.note });
    r.lastSeen = now;
    const added = col ? addMember(col, r, it.role ?? (it.tags ?? []).find((t) => ["direct", "indirect", "analogous"].includes(t)), col.currentRun) : false;
    touched.set(r.id, r);
    out.push(`${r.id}${isNew ? "" : " (updated)"} [${r.type}/${r.credibility}] ${r.label ?? r.title ?? r.url}${r.categories.length ? ` ‹${r.categories.join(", ")}›` : ""}${added && !isNew ? `  (+${col.name})` : ""}`);
  }
  await saveRefs([...touched.values()]);
  if (col) await writeCollection(col);
  const changed = await recomputeConfidence();
  if (changed.length) out.push(`confidence updated: ${changed.join(", ")}`);
  return out.join("\n");
}

/** Add existing refs to a collection = add a category to them. */
export async function collect(params) {
  const col = await ensureCollection(params.collection, { kind: params.kind, domain: params.domain, title: params.title, description: params.description });
  const refs = await readRefs();
  const out = [];
  const touched = [];
  for (const id of params.refs ?? []) {
    const r = refs.find((x) => x.id === id);
    if (!r) bad(`ref not found: ${id}`);
    const added = addMember(col, r, params.role, col.currentRun);
    if (params.note) r.notes.push({ at: new Date().toISOString(), collection: col.name, run: col.currentRun ?? null, text: params.note });
    touched.push(r);
    out.push(`${r.id} ${r.label ?? r.url} ‹${r.categories.join(", ")}›${added ? "  (+" + col.name + ")" : "  (already member)"}`);
  }
  await saveRefs(touched);
  await writeCollection(col);
  return out.join("\n");
}

export async function uncollect(name, id) {
  const col = await mustCollection(name);
  const refs = await readRefs();
  const r = refs.find((x) => x.id === id);
  if (!r) bad(`ref not found: ${id}`);
  col.members = col.members.filter((m) => m.ref !== id);
  r.categories = (r.categories ?? []).filter((c) => c !== col.name);
  await saveRefs([r]);
  await writeCollection(col);
  return `${id} removed from ${col.name} (ref and its snapshots kept; categories now: ${r.categories.join(", ") || "none"})`;
}

/** structured note fields (SKILL §5) — stored next to the markdown text, rendered as a definition list in the viewer */
export const NOTE_FIELDS = { structure: "구조", copy: "카피/CTA", visual: "비주얼", ui: "UI 패턴", adopt: "차용할 점", avoid: "피할 점" };

export async function addNote(params) {
  const fields = params.fields && typeof params.fields === "object" ? Object.fromEntries(Object.entries(params.fields).filter(([k, v]) => NOTE_FIELDS[k] && String(v ?? "").trim())) : null;
  if (params.fields) {
    const unknown = Object.keys(params.fields).filter((k) => !NOTE_FIELDS[k]);
    if (unknown.length) bad(`fields: unknown key(s) ${unknown.join(", ")} — use ${Object.keys(NOTE_FIELDS).join(", ")}`);
  }
  if (!params.note && !fields) bad("note (markdown) or fields {structure, copy, visual, ui, adopt, avoid} is required");
  params.note = params.note ?? Object.entries(fields).map(([k, v]) => `**${NOTE_FIELDS[k]}**: ${String(v).trim()}`).join("\n");
  const col = await mustCollection(params.collection ?? params.project);
  const now = new Date().toISOString();
  const refId = params.ref ?? params.entry_id;
  let target = "collection";
  if (refId) {
    const refs = await readRefs();
    const r = refs.find((x) => x.id === refId);
    if (!r) bad(`ref not found: ${refId}`);
    r.notes.push({ at: now, collection: col.name, run: col.currentRun ?? null, text: params.note, tags: params.tags ?? [], ...(fields ? { fields } : {}) });
    if (params.tags) r.tags = [...new Set([...r.tags, ...params.tags])];
    await saveRefs([r]);
    target = `${r.id} (${r.label ?? r.url})`;
  }
  await fs.appendFile(
    path.join(collectionDir(col.name), "NOTES.md"),
    `\n### ${refId ?? "(collection)"} — ${now}${params.tags?.length ? `  \`${params.tags.join("` `")}\`` : ""}\n\n${params.note.trim()}\n`,
  );
  const idx = tagIndex(await readAxes());
  const unmapped = refId ? (params.tags ?? []).filter((t) => !idx.has(t)) : []; // collection notes (search-log …) are not pattern tags
  return `Saved note to ${target}${unmapped.length ? `\n⚠ tags not on any axis yet: ${unmapped.join(", ")} — reuse an existing tag name, or \`ref axes suggest ${col.name}\` then \`ref axes set\`` : ""}`;
}

export async function showRef(id) {
  const [refs, claims] = await Promise.all([readRefs(), readClaims()]);
  const r = refs.find((x) => x.id === id) ?? findRef(refs, id);
  if (!r) bad(`ref not found: ${id}`);
  const snap = latestSnapshot(r);
  const citing = claims.filter((c) => c.sources.includes(r.id));
  return {
    text: [
      `${r.id} ${r.label ?? ""} — ${r.title ?? ""}`,
      `url: ${r.url}${r.aliases?.length ? ` (aliases: ${r.aliases.join(", ")})` : ""}`,
      `type ${r.type}/${r.credibility} · publisher ${r.publisher ?? "-"} · categories: ${(r.categories ?? []).join(", ") || "-"}`,
      `screens: ${(r.screens ?? []).join(", ") || "-"} · tags: ${(r.tags ?? []).join(", ") || "-"}`,
      `snapshots: ${r.snapshots?.length ?? 0}${snap ? ` (latest ${snap.at.slice(0, 10)}, ${snap.dir})` : ""} · first seen ${r.firstSeen?.slice(0, 10)}`,
      ...(r.changes?.length ? ["changes:", ...r.changes.map((c) => `  ${c.at.slice(0, 10)} vs ${c.from.slice(0, 10)}: ${c.lines.length ? c.lines.join(" · ") : "none visible"}`)] : []),
      ...(r.notes?.length ? ["notes:", ...r.notes.map((n) => `  ‹${n.collection ?? "-"} ${n.at.slice(0, 10)}› ${n.text.replace(/\n/g, " ").slice(0, 300)}`)] : []),
      ...(citing.length ? ["cited by:", ...citing.map(claimLine)] : []),
    ].join("\n"),
    images: [snap?.files?.preview, snap?.files?.framesSheet].filter(Boolean).map(abs),
  };
}

// ---------- claims ----------

/**
 * claims[]: { text, kind, subject?, sources:["S1"], tags?, key?, asOf?:"YYYY-MM-DD", scope? }
 *   or { confirms:"C3", sources:[…] } · { revises:"C3" | refutes:"C3", text, kind, sources }
 *   or { update:"C3", subject?, key?, asOf?, scope? } — metadata only, text/sources never change this way
 * subject = short title the board shows (5–12 chars); key = headline finding; asOf = the date a price/number was true.
 * Validated as a batch before anything is written. Plan positions live in the plan layer (`ref plan link`).
 */
export async function addClaims(params) {
  const list = params.claims ?? [params];
  const col = await mustCollection(params.collection ?? params.project);
  const run = col.currentRun ?? null;
  const [claims, refs] = await Promise.all([readClaims(), readRefs()]);
  const refById = new Map(refs.map((r) => [r.id, r]));
  const byId = new Map(claims.map((c) => [c.id, c]));
  const now = new Date().toISOString();
  const errors = [];
  const warnings = [];
  const META = ["subject", "key", "asOf", "scope"];
  list.forEach((c, i) => {
    const at = `claims[${i}]`;
    if (c.asOf != null && (!/^\d{4}-\d{2}-\d{2}$/.test(String(c.asOf)) || Number.isNaN(Date.parse(c.asOf)))) errors.push(`${at}: asOf must be a real YYYY-MM-DD date`);
    if (c.update) {
      if (!byId.has(c.update)) errors.push(`${at}: update ${c.update} not found`);
      else if (!META.some((k) => c[k] !== undefined)) errors.push(`${at}: update needs one of ${META.join(", ")}`);
      return;
    }
    const unknown = (c.sources ?? []).filter((s) => !refById.has(s));
    if (unknown.length) errors.push(`${at}: unknown ref id(s) ${unknown.join(", ")} — add them with \`ref source add\` first`);
    if (c.context) errors.push(`${at}: plan positions live in the plan layer — use \`ref plan link\``);
    for (const k of ["confirms", "revises", "refutes"]) {
      if (c[k] && !byId.has(c[k])) errors.push(`${at}: ${k} ${c[k]} not found`);
      else if (c[k] && byId.get(c[k]).status !== "active") errors.push(`${at}: ${c[k]} is already ${byId.get(c[k]).status}`);
    }
    if (c.confirms) {
      if (!c.sources?.length) errors.push(`${at}: confirms needs the source(s) that re-verified it`);
      return;
    }
    if (!c.text?.trim()) errors.push(`${at}: text is required`);
    if (!c.subject?.trim()) warnings.push(`${at}: no subject — the board will cut a title from the text; give a 5–12 char subject`);
    if (!CLAIM_KINDS.includes(c.kind)) errors.push(`${at}: kind must be one of ${CLAIM_KINDS.join(", ")}`);
    if (c.kind !== "hypothesis" && !c.sources?.length) errors.push(`${at}: needs ≥1 source (or kind "hypothesis")`);
  });
  if (errors.length) bad(errors.join("\n"));

  const write = [];
  const out = [];
  const all = [...claims];
  for (const c of list) {
    if (c.update) {
      const old = byId.get(c.update);
      if (c.subject !== undefined) old.subject = c.subject || null;
      if (c.key !== undefined) old.key = !!c.key;
      if (c.asOf !== undefined) old.asOf = c.asOf || null;
      if (c.scope !== undefined) old.scope = c.scope || null;
      old.updatedAt = now;
      write.push(old);
      out.push(`${old.id} updated (${META.filter((k) => c[k] !== undefined).join(", ")})`);
      continue;
    }
    if (c.confirms) {
      const old = byId.get(c.confirms);
      old.sources = [...new Set([...old.sources, ...c.sources])];
      old.collections = [...new Set([...(old.collections ?? []), col.name])];
      old.events = [...(old.events ?? []), { run, collection: col.name, type: "confirmed", at: now, sources: c.sources }];
      old.confidence = confidence(old, refById);
      old.updatedAt = now;
      write.push(old);
      out.push(`${old.id} confirmed → ${old.confidence} ${cites(old.sources)}`);
      continue;
    }
    const prevId = c.revises ?? c.refutes;
    const claim = {
      id: nextId("C", all),
      text: c.text.trim(),
      kind: c.kind,
      subject: c.subject?.trim() || null,
      sources: [...new Set(c.sources ?? [])],
      tags: c.tags ?? [],
      ...(c.key ? { key: true } : {}),
      ...(c.asOf ? { asOf: c.asOf } : {}),
      ...(c.scope ? { scope: c.scope } : {}),
      collections: [col.name],
      status: "active",
      run,
      createdAt: now,
      updatedAt: now,
      events: [{ run, collection: col.name, type: c.refutes ? "refutes" : c.revises ? "revises" : "created", at: now, ...(prevId ? { of: prevId } : {}) }],
      ...(c.revises ? { revises: c.revises } : {}),
      ...(c.refutes ? { refutes: c.refutes } : {}),
    };
    claim.confidence = confidence(claim, refById);
    all.push(claim);
    byId.set(claim.id, claim);
    write.push(claim);
    if (prevId) {
      const old = byId.get(prevId);
      old.status = c.refutes ? "refuted" : "superseded";
      old.replacedBy = claim.id;
      old.events = [...(old.events ?? []), { run, collection: col.name, type: old.status, at: now, by: claim.id }];
      old.updatedAt = now;
      write.push(old);
    }
    out.push(`${claim.id} ${prevId ? `(${c.refutes ? "refutes" : "revises"} ${prevId}) ` : ""}[${claim.kind}, ${claim.confidence}] ${claim.text.slice(0, 90)} ${cites(claim.sources)}`);
  }
  await saveClaims(write);
  return [...out, ...warnings.map((w) => `⚠ ${w}`)].join("\n");
}

// ---------- deltas ----------

export async function delta(name, runArg) {
  const col = await mustCollection(name);
  const [claims, refs, runs] = await Promise.all([readClaims(), readRefs(), readRuns()]);
  const byId = new Map(refs.map((r) => [r.id, r]));
  const runId = runArg ?? col.currentRun;
  const run = runs.find((r) => r.id === runId);
  const { own, related } = collectionClaims(col, claims);
  const active = own.filter((c) => c.status === "active");
  const evIn = (c, types) => (c.events ?? []).some((e) => e.run === runId && types.includes(e.type));
  const section = (title, list, fmt = claimLine) => (list.length ? [`\n#### ${title} (${list.length})`, ...list.map(fmt)] : []);
  const members = col.members.map((m) => ({ ...m, r: byId.get(m.ref) })).filter((m) => m.r);
  const md = [`# ${col.name} — delta`, `생성: ${new Date().toISOString()}`];

  // A. run
  md.push(`\n## A. 실행 델타 — ${runId ?? "(no run)"}${run ? ` · ${run.domain} · ${run.goal ?? ""}` : ""}`);
  if (!runId) md.push("⚠ no run started — `ref run start` before research so changes can be attributed.");
  else {
    const newRefs = members.filter((m) => m.run === runId);
    md.push(
      ...section("새로 알게 된 것", own.filter((c) => evIn(c, ["created"]))),
      ...section("정정 — 수정", own.filter((c) => evIn(c, ["revises"])), (c) => `${claimLine(c)} ← ${c.revises}: ${claims.find((x) => x.id === c.revises)?.text ?? ""}`),
      ...section("정정 — 반증", own.filter((c) => evIn(c, ["refutes"])), (c) => `${claimLine(c)} ✕ ${c.refutes}: ${claims.find((x) => x.id === c.refutes)?.text ?? ""}`),
      ...section("재확인", claims.filter((c) => (c.events ?? []).some((e) => e.run === runId && e.type === "confirmed"))),
      `\n이번 실행에 추가된 레퍼런스: ${newRefs.length}개${newRefs.length ? " — " + newRefs.map((m) => `${m.r.id}${m.r.categories.length > 1 ? `‹+${m.r.categories.filter((x) => x !== col.name).join(", ")}›` : ""}`).join(" ") : ""}`,
    );
  }
  md.push(...section("⚠ 근거 약함 (low — 출처 추가 필요)", active.filter((c) => c.confidence === "low")));

  // C. category — by axis (normalized tags); facet "pattern" only, other facets listed separately
  md.push(`\n## C. 카테고리 델타 — 제품 간 공통점·차이점 (축 기준)`);
  const axes = await readAxes();
  const idx = tagIndex(axes);
  const products = new Map();
  for (const m of members) {
    const p = m.r.product ?? m.r.label ?? m.r.id;
    const e = products.get(p) ?? new Map(); // axis id → tags used
    for (const t of m.r.tags ?? []) {
      const id = axisOf(idx, t);
      e.set(id, [...new Set([...(e.get(id) ?? []), t])]);
    }
    products.set(p, e);
  }
  const facetOf = (id) => (id.startsWith("#") ? "pattern" : (axes.axes.find((x) => x.id === id)?.facet ?? "pattern"));
  const label = (id) => (id.startsWith("#") ? `\`${id.slice(1)}\` (미정규화)` : `**${axes.axes.find((x) => x.id === id)?.label ?? id}**`);
  const axisProducts = new Map();
  for (const [p, e] of products) for (const id of e.keys()) axisProducts.set(id, [...(axisProducts.get(id) ?? []), p]);
  const n = products.size;
  const patt = [...axisProducts].filter(([id]) => facetOf(id) === "pattern");
  const common = patt.filter(([, ps]) => ps.length >= Math.max(2, Math.ceil(n * 0.3))).sort((a, b) => b[1].length - a[1].length);
  const shared2 = patt.filter(([id, ps]) => ps.length >= 2 && !common.some(([x]) => x === id)).sort((a, b) => b[1].length - a[1].length);
  const uniqueBy = new Map();
  for (const [id, ps] of patt) if (ps.length === 1) uniqueBy.set(ps[0], [...(uniqueBy.get(ps[0]) ?? []), id]);
  const unmapped = patt.filter(([id]) => id.startsWith("#")).length;
  md.push(`제품 ${n}개 · 패턴 축 ${patt.length - unmapped}개 + 미정규화 태그 ${unmapped}개${unmapped ? " (`ref axes suggest " + col.name + "`)" : ""}`);
  const who = (id, ps) => ps.map((p) => `${p}${(products.get(p).get(id) ?? []).length && !id.startsWith("#") ? `(${products.get(p).get(id).join(",")})` : ""}`).join(", ");
  if (common.length) md.push("", `**공통 (≥30% 제품 — 필수 기본기 후보)**`, ...common.map(([id, ps]) => `- ${label(id)} ${ps.length}/${n}: ${who(id, ps)}`));
  if (shared2.length) md.push("", `**일부 공유 (2개 이상 제품)**`, ...shared2.map(([id, ps]) => `- ${label(id)} ${ps.length}/${n}: ${who(id, ps)}`));
  if (uniqueBy.size) md.push("", `**한 제품만 (차별점 후보)**`, ...[...uniqueBy].map(([p, ids]) => `- ${p}: ${ids.map(label).join(" · ")}`));
  const facets = [...axisProducts].filter(([id]) => !["pattern", "topic"].includes(facetOf(id)));
  if (facets.length) md.push("", `**시장·플랫폼·포지셔닝**`, ...facets.map(([id, ps]) => `- ${facetOf(id)} ${label(id)}: ${ps.join(", ")}`));
  if (!axisProducts.size) md.push("⚠ 태그 없음 — `ref note` 에 패턴 태그를 달면 이 섹션이 채워짐");
  // axes this category shares with other categories
  const refs2 = refs.filter((r) => !(r.categories ?? []).includes(col.name));
  const elsewhere = new Map();
  for (const r of refs2) for (const t of r.tags ?? []) {
    const id = axisOf(idx, t);
    if (!id.startsWith("#") && axisProducts.has(id)) for (const c of r.categories ?? []) elsewhere.set(id, new Set([...(elsewhere.get(id) ?? []), c]));
  }
  if (elsewhere.size) md.push("", `**다른 카테고리에도 있는 축** (\`ref axes show\`)`, ...[...elsewhere].map(([id, cs]) => `- ${label(id)} ‹${[...cs].join(", ")}›`));
  const shared = members.filter((m) => m.r.categories.length > 1);
  if (shared.length) md.push("", `**다른 카테고리와 공유하는 레퍼런스**`, ...shared.map((m) => `- ${m.r.id} ${m.r.label ?? m.r.url} ‹${m.r.categories.filter((x) => x !== col.name).join(", ")}›`));
  md.push(...section("다른 카테고리에서 이 레퍼런스들을 인용한 claim", related, (c) => `${claimLine(c)} ‹${(c.collections ?? []).join(", ")}›`));

  // T. time
  md.push(`\n## T. 시간 델타 — 현행화`);
  const changed = members.flatMap((m) => (m.r.changes ?? []).filter((c) => daysSince(c.at) <= STALE_DAYS).map((c) => ({ r: m.r, c })));
  if (changed.length) md.push(...changed.map(({ r, c }) => `- ${r.id} ${r.label ?? ""} ${c.at.slice(0, 10)} vs ${c.from.slice(0, 10)}: ${c.lines.length ? c.lines.join(" · ") : "변화 없음"}`));
  else md.push(`최근 ${STALE_DAYS}일 재캡처로 확인된 변화 없음`);
  const stale = members.filter((m) => m.r.snapshots?.length && daysSince(m.r.lastCaptured) > STALE_DAYS);
  if (stale.length) md.push("", `⚠ ${STALE_DAYS}일 넘게 재확인 안 됨: ${stale.map((m) => `${m.r.id}(${Math.floor(daysSince(m.r.lastCaptured))}d)`).join(", ")}`);
  const noSnap = members.filter((m) => !m.r.snapshots?.length);
  if (noSnap.length) md.push(`캡처 없는 출처(텍스트로만 참조): ${noSnap.map((m) => m.r.id).join(", ")}`);

  const text = md.join("\n");
  await fs.writeFile(path.join(collectionDir(col.name), "DELTA.md"), text + "\n");
  return text;
}

// ---------- plans (optional layer, outside the categories) ----------

const planFile = (name) => path.join(FILES.plansDir, `${collectionName(name)}.json`);

export async function readPlan(name) {
  try {
    return JSON.parse(await fs.readFile(planFile(name), "utf8"));
  } catch {
    return null;
  }
}

async function writePlan(p) {
  await fs.mkdir(FILES.plansDir, { recursive: true });
  p.updatedAt = new Date().toISOString();
  await fs.writeFile(planFile(p.name), JSON.stringify(p, null, 2));
}

export async function setPlan(params) {
  const name = collectionName(params.plan);
  const p = (await readPlan(name)) ?? { name, items: [], links: [], createdAt: new Date().toISOString() };
  for (const k of ["goal", "audience", "repo", "collections"]) if (params[k] !== undefined) p[k] = params[k];
  for (const it of params.items ?? []) {
    const prev = it.id ? p.items.find((x) => x.id === it.id) : p.items.find((x) => x.text === it.text);
    if (it.id && !prev && !it.text) bad(`plan item not found: ${it.id}`);
    if (prev) {
      Object.assign(prev, Object.fromEntries(Object.entries(it).filter(([k, v]) => k !== "id" && v !== undefined)));
      continue;
    }
    const type = it.type ?? "feature";
    if (!(type in ITEM_PREFIX)) bad(`plan item type must be one of ${Object.keys(ITEM_PREFIX).join(", ")}`);
    p.items.push({ id: it.id ?? nextId(ITEM_PREFIX[type], p.items), type, text: it.text });
  }
  for (const id of params.remove ?? []) {
    p.items = p.items.filter((x) => x.id !== id);
    p.links = p.links.filter((l) => l.item !== id);
  }
  await writePlan(p);
  return formatPlan(p);
}

export function formatPlan(p) {
  if (!p) return "(no plan)";
  return [
    `plan ${p.name}${p.repo ? ` · repo ${p.repo}` : ""}${p.collections?.length ? ` · collections ${p.collections.join(", ")}` : ""}`,
    `goal: ${p.goal ?? "-"}`,
    `audience: ${p.audience ?? "-"}`,
    ...p.items.map((i) => `- ${i.id} (${i.type}) ${i.text}  ${p.links.filter((l) => l.item === i.id).map((l) => `${l.claim}:${l.position}`).join(" ")}`),
  ].join("\n");
}

export async function linkPlan(params) {
  const p = await readPlan(params.plan);
  if (!p) bad(`plan not found: ${params.plan} (ref plan set)`);
  const claims = await readClaims();
  const errors = [];
  for (const [i, l] of (params.links ?? []).entries()) {
    if (!POSITIONS.includes(l.position)) errors.push(`links[${i}]: position must be one of ${POSITIONS.join(", ")}`);
    if (!claims.some((c) => c.id === l.claim)) errors.push(`links[${i}]: claim ${l.claim} not found`);
    if (l.item && !p.items.some((x) => x.id === l.item)) errors.push(`links[${i}]: item ${l.item} not in plan`);
    if (!l.item && l.position !== "gap") errors.push(`links[${i}]: item is required unless position is "gap"`);
  }
  if (errors.length) bad(errors.join("\n"));
  for (const l of params.links ?? []) {
    p.links = p.links.filter((x) => !(x.item === (l.item ?? null) && x.claim === l.claim));
    p.links.push({ item: l.item ?? null, claim: l.claim, position: l.position, note: l.note ?? null, at: l.at ?? new Date().toISOString() });
  }
  if (params.unlink) p.links = p.links.filter((x) => !params.unlink.some((u) => u.item === x.item && u.claim === x.claim));
  await writePlan(p);
  return formatPlan(p);
}

export async function planDelta(name, suggest) {
  const p = await readPlan(name);
  if (!p) bad(`plan not found: ${name}`);
  const claims = await readClaims();
  const byId = new Map(claims.map((c) => [c.id, c]));
  const live = (id) => {
    let c = byId.get(id);
    while (c && c.status !== "active" && c.replacedBy) c = byId.get(c.replacedBy); // follow corrections
    return c;
  };
  const cols = POSITIONS.filter((x) => x !== "gap");
  const md = [`# plan ${p.name} — 기획 대비 델타`, `생성: ${new Date().toISOString()}`, `목표: ${p.goal ?? "-"}${p.audience ? ` · 대상: ${p.audience}` : ""}`, "", `| 항목 | ${cols.join(" | ")} | 판단 |`, `|---|${cols.map(() => ":-:").join("|")}|---|`];
  const moved = [];
  for (const it of p.items) {
    const links = p.links
      .filter((l) => l.item === it.id)
      .map((l) => ({ ...l, c: live(l.claim) }))
      .filter((l, i, a) => l.c && a.findIndex((x) => x.c?.id === l.c.id && x.position === l.position) === i);
    for (const l of links) if (l.c.id !== l.claim) moved.push(`${it.id}: ${l.claim} → ${l.c.id} (원 claim이 정정됨, 위치 재판정 필요)`);
    const by = (pos) => links.filter((l) => l.position === pos).map((l) => l.c.id + (l.c.id !== l.claim ? "*" : ""));
    const verdict = !links.length
      ? "⚠ 근거 없음"
      : by("contradicts").length
        ? "⚠ 가정과 충돌"
        : by("below-bar").length
          ? "⚠ 기준 미달"
          : by("duplicate").length && !by("differentiator").length
            ? "⚠ 이미 있음 — 차별 근거 필요"
            : by("differentiator").length
              ? "차별 가능"
              : by("table-stakes").length
                ? "필수 기본기"
                : by("validates").length
                  ? "가정 지지"
                  : "-";
    md.push(`| ${it.id} ${it.text} | ${cols.map((c) => by(c).join(" ")).join(" | ")} | ${verdict} |`);
  }
  const gaps = p.links.filter((l) => l.position === "gap").map((l) => live(l.claim)).filter(Boolean);
  if (gaps.length) md.push("", "**시장 빈틈 (gap)**", ...gaps.map(claimLine));
  if (moved.length) md.push("", "**⚠ 정정된 claim에 걸린 링크** (* 표시)", ...moved.map((x) => "- " + x));
  if (suggest) {
    md.push("", "**연결 제안 (임베딩 유사도 순, 미판정 — 맞으면 `ref plan link`)**");
    for (const it of p.items) {
      const linked = new Set(p.links.filter((l) => l.item === it.id).map((l) => live(l.claim)?.id));
      const s = (await suggest(it.text)).filter((x) => !linked.has(x.id)).slice(0, 3);
      if (s.length) md.push(`- ${it.id}: ${s.map((x) => `${x.id}(${x.score.toFixed(3)})`).join(" ")}`);
    }
  }
  const text = md.join("\n");
  await fs.writeFile(path.join(FILES.plansDir, `${p.name}-DELTA.md`), text + "\n");
  return text;
}

// ---------- citation check ----------

export async function citeCheck(text) {
  const [claims, refs] = await Promise.all([readClaims(), readRefs()]);
  const known = new Set([...claims.map((c) => c.id), ...refs.map((r) => r.id)]);
  const inactive = new Map(claims.filter((c) => c.status !== "active").map((c) => [c.id, c]));
  const unknown = new Set();
  const outdated = new Set();
  const uncited = [];
  let cited = 0;
  let exempt = false;
  let prev = null; // a table row directly above a |---| separator is a header, not a finding
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (/^\|[-:| ]+\|$/.test(l) && prev && uncited.at(-1) === prev.slice(0, 120)) uncited.pop();
    prev = l;
    if (/^#+\s|^\*\*[^*]+\*\*:?$/.test(l)) {
      exempt = /목표|goal|질문|question|대상|coverage|커버리지|출처|sources/i.test(l);
      continue;
    }
    const ids = [...l.matchAll(CITE_RE)].flatMap((m) => m[1].split(/\s*,\s*/));
    for (const id of ids) {
      if (!known.has(id)) unknown.add(id);
      else if (inactive.has(id)) outdated.add(`${id}→${inactive.get(id).replacedBy}`);
    }
    const finding = /^([-*]|\d+\.)\s+\S/.test(l) || (/^\|/.test(l) && !/^\|[-:| ]+\|$/.test(l));
    if (!finding || l.length < 8) continue;
    if (ids.length) cited++;
    else if (!exempt && !/추정|가설|unverified|\?$/.test(l)) uncited.push(l.slice(0, 120));
  }
  return { unknown: [...unknown], outdated: [...outdated], uncited: uncited.filter((l) => !/^\|\s*(유형|제품|product|항목)\s*\|/i.test(l)), cited };
}

export function formatCiteCheck(r) {
  return [
    `cited lines: ${r.cited}`,
    r.unknown.length ? `⚠ unknown ids: ${r.unknown.join(", ")}` : "",
    r.outdated.length ? `⚠ cites superseded/refuted claims: ${r.outdated.join(", ")}` : "",
    r.uncited.length ? `⚠ ${r.uncited.length} finding line(s) without [S#]/[C#]:\n${r.uncited.map((l) => "  - " + l).join("\n")}` : "",
    !r.unknown.length && !r.outdated.length && !r.uncited.length ? "✓ all finding lines cite known, active ids" : "",
  ]
    .filter(Boolean)
    .join("\n");
}
