/**
 * report — README.md + index.html board for one collection (category), and the library home <LIB>/index.html.
 * Data is gathered here; HTML is rendered by board.mjs.
 */
import { promises as fs, readFileSync } from "node:fs";
import * as path from "node:path";
import { collectionClaims, citeCheck, delta, formatCiteCheck, formatClaims, mustCollection } from "./evidence.mjs";
import { LIB, bad, coverageTypes, abs, collectionDir, daysSince, latestSnapshot, listCollections, readClaims, readRefs, readRuns, saveRuns, writeCollection } from "./store.mjs";
import { axisOf, readAxes, tagIndex, tagLabel } from "./axes.mjs";
import { renderBoard, renderHome, splitSummary } from "./board.mjs";
import { run } from "./capture.mjs";

export function coverage(members, domain = "design") {
  if (!members.length) return "(no references)";
  const TYPES = coverageTypes(domain);
  const prods = new Map();
  for (const { r } of members) {
    const p = r.product ?? r.label ?? r.id;
    const set = prods.get(p) ?? new Set();
    for (const t of r.screens ?? []) set.add(t);
    prods.set(p, set);
  }
  const head = `| product | ${TYPES.join(" | ")} |\n|---|${TYPES.map(() => ":-:").join("|")}|`;
  const rows = [...prods].filter(([, s]) => domain !== "curriculum" || s.size).map(([p, s]) => `| ${p} | ${TYPES.map((t) => (s.has(t) ? "●" : "")).join(" | ")} |`);
  const marketing = new Set(["landing", "features", "pricing"]);
  const thin = [...prods].filter(([, s]) => s.size && ![...s].some((t) => !marketing.has(t))).map(([p]) => p);
  if (domain === "curriculum") {
    const noSyl = [...prods].filter(([, s]) => s.size && !s.has("syllabus")).map(([p]) => p);
    return [head, ...rows, "", noSyl.length ? `⚠ no syllabus page (모듈·시간 확인 불가): ${noSyl.join(", ")}` : ""].filter((l, i, a) => l || i < a.length - 1).join("\n");
  }
  const noUi = ![...prods.values()].some((s) => s.has("app-ui"));
  return [
    head,
    ...rows,
    "",
    thin.length ? `⚠ marketing pages only (no in-app UI/onboarding/help/store): ${thin.join(", ")}` : "",
    noUi ? "⚠ NO in-app UI screens — use `ref store` and help-center/docs/feature-tour pages" : "",
  ]
    .filter((l, i, a) => l || i < a.length - 2)
    .join("\n");
}

export async function report(params) {
  const col = await mustCollection(params.collection ?? params.project);
  const dir = collectionDir(col.name);
  const [refs, claims] = await Promise.all([readRefs(), readClaims()]);
  const byId = new Map(refs.map((r) => [r.id, r]));
  const members = col.members
    .map((m) => ({ ...m, r: byId.get(m.ref) }))
    .filter((m) => m.r)
    .sort((a, b) => String(a.r.product ?? "").localeCompare(String(b.r.product ?? "")) || a.r.id.localeCompare(b.r.id));
  // header fields (docs/BOARD-REDESIGN.md E1): explicit params win, stored on the collection
  const HEAD = { goal: "goal", audience: "audience", question: "question", highlights: "highlights", open_questions: "openQuestions", next_steps: "nextSteps", view: "view" };
  let touched = false;
  for (const [p, k] of Object.entries(HEAD))
    if (params[p] !== undefined) {
      const v = params[p];
      if (["highlights", "openQuestions", "nextSteps"].includes(k) && !Array.isArray(v)) bad(`${p} must be an array`);
      if (k === "highlights") {
        const ids = new Set(claims.map((c) => c.id));
        const unknown = v.filter((id) => !ids.has(id));
        if (unknown.length) bad(`highlights: unknown claim id(s) ${unknown.join(", ")}`);
      }
      if (k === "view" && !["grid", "rows", "flow"].includes(v)) bad("view must be grid, rows or flow");
      col[k] = v;
      touched = true;
    }
  if (touched) await writeCollection(col);
  // result = one-line outcome of the current run; closes it (endedAt) for the 조사 기록 timeline
  if (params.result !== undefined) {
    const run = (await readRuns()).find((r) => r.id === col.currentRun);
    if (!run) bad("result: no current run on this collection — start one with `ref run start`");
    await saveRuns([{ ...run, result: String(params.result), endedAt: new Date().toISOString() }]);
  }
  let summary = params.summary ?? (params.summary_file ? readFileSync(params.summary_file, "utf8") : undefined);
  if (summary) await fs.writeFile(path.join(dir, "SUMMARY.md"), summary);
  else summary = await fs.readFile(path.join(dir, "SUMMARY.md"), "utf8").catch(() => "");
  const notes = await fs.readFile(path.join(dir, "NOTES.md"), "utf8").catch(() => "");
  const deltaMd = await delta(col.name);
  const cite = summary ? formatCiteCheck(await citeCheck(summary)) : "";
  const { own, related } = collectionClaims(col, claims);
  const cited = new Set([...own, ...related].flatMap((c) => c.sources));
  const sources = refs.filter((r) => cited.has(r.id) || col.members.some((m) => m.ref === r.id));
  const cov = coverage(members, col.domain);
  const relp = (p) => (p ? path.relative(dir, abs(p)) : "");

  // ---- markdown (git-friendly copy of the board) ----
  const md = [
    `# ${col.title ?? col.name} — reference board`,
    `생성: ${new Date().toISOString()} · ${members.length} refs · ${col.kind ?? ""} · ${col.domain}`,
    summary ? `\n## 요약 / 가이드\n\n${summary}` : "",
    cite ? `\n> 인용 점검: ${cite.replace(/\n/g, "\n> ")}` : "",
    own.length ? `\n## Claims (이 카테고리)\n\n${formatClaims(own)}` : "",
    related.length ? `\n## Claims (다른 카테고리, 같은 레퍼런스)\n\n${formatClaims(related)}` : "",
    `\n${deltaMd.replace(/^# .*\n생성: .*\n/, "").replace(/^## /gm, "## 델타 ")}`,
    `\n## Coverage\n\n${cov}`,
    `\n## References`,
    ...members.map(({ r, role }) => {
      const s = latestSnapshot(r);
      const f = s?.files ?? {};
      const other = (r.categories ?? []).filter((c) => c !== col.name);
      return [
        `\n### [${r.id}] ${r.label ?? r.title ?? r.url}`,
        `- URL: ${r.url}`,
        `- ${[role, r.type + "/" + r.credibility, ...(r.screens ?? [])].filter(Boolean).join(" · ")}${other.length ? ` · 다른 카테고리: ${other.join(", ")}` : ""}`,
        r.tags?.length ? `- 태그: ${r.tags.join(", ")}` : "",
        s ? `- 캡처: ${r.snapshots.length}회, 최신 ${s.at.slice(0, 10)}` : "- 캡처 없음 (텍스트 출처)",
        f.preview ? `\n![${r.id}](${relp(f.preview)})` : "",
        f.full ? "\n" + (f.fullParts ?? [f.full]).map((p, i, a) => `[전체 페이지${a.length > 1 ? ` ${i + 1}/${a.length}` : ""}](${relp(p)})`).join(" · ") : "",
        f.screens?.length ? `\n스크린샷 ${f.screens.length}장: ${f.screens.map((p, i) => `[${i + 1}](${relp(p)})`).join(" ")}` : "",
        f.frames?.length ? `\n스크롤 프레임 ${f.frames.length}장${f.framesSheet ? ` · [한눈에 보기](${relp(f.framesSheet)})` : ""}` : "",
        r.changes?.length ? `\n**변화**: ${r.changes.map((c) => `${c.at.slice(0, 10)} ${c.lines.length ? c.lines.join(" · ") : "없음"}`).join(" / ")}` : "",
        r.notes?.length ? `\n**분석**\n\n${r.notes.map((n) => `${n.collection && n.collection !== col.name ? `‹${n.collection}› ` : ""}${n.text}`).join("\n\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }),
    notes ? `\n## 카테고리 노트\n${notes}` : "",
    `\n## 출처 (Sources)\n\n${sources.map((r) => `- ${r.id} [${r.type}/${r.credibility}] ${r.label ?? r.title ?? ""} — ${r.url}${r.published ? ` (${String(r.published).slice(0, 10)})` : ""}`).join("\n")}`,
  ].join("\n");
  await fs.writeFile(path.join(dir, "README.md"), md);

  // ---- html ----
  const html = renderBoard(await boardData(col, members, refs, claims, summary, cite, cov, relp));
  const htmlPath = path.join(dir, "index.html");
  await fs.writeFile(htmlPath, html);
  const home = await writeHome();
  let opened = "";
  if (params.open) {
    const r = await run("open", [htmlPath], 15_000);
    opened = r.code === 0 ? "\nOpened in the default browser." : `\nOpen failed: ${r.stderr}`;
  }
  return `Report built:\n- ${htmlPath}\n- ${home} (library home)\n- ${path.join(dir, "README.md")}\n- ${path.join(dir, "DELTA.md")}${opened}${cite ? `\n\nCitation check:\n${cite}` : ""}`;
}

// ---------- board data ----------

const ROLE_ORDER = { direct: 0, indirect: 1, analogous: 2 };

async function boardData(col, members, refs, claims, summary, cite, cov, relp) {
  const axes = await readAxes();
  const idx = tagIndex(axes);
  const runs = (await readRuns()).filter((r) => r.collection === col.name);
  const { own, related } = collectionClaims(col, claims);
  const byId = new Map(refs.map((r) => [r.id, r]));
  const titles = new Map((await listCollections()).map((c) => [c.name, c.title ?? c.name]));
  const facetOf = (id) => (id.startsWith("#") ? "pattern" : (axes.axes.find((x) => x.id === id)?.facet ?? "pattern"));

  // members with resolved files and pattern axes
  const ms = members.map((m) => {
    const s = latestSnapshot(m.r);
    const f = s?.files ?? {};
    const ax = [...new Set((m.r.tags ?? []).map((t) => axisOf(idx, t)))].filter((id) => facetOf(id) === "pattern" && !id.startsWith("#"));
    return {
      ...m,
      axes: ax,
      thumb: relp(f.preview),
      full: relp(f.full ?? f.fold),
      fullParts: (f.fullParts ?? (f.full ? [f.full] : [])).map(relp),
      frames: (f.frames ?? []).map(relp),
      framesSheet: relp(f.framesSheet),
      screens: (f.screens ?? []).map(relp),
    };
  });

  // products (grouped, direct first)
  const pmap = new Map();
  for (const m of ms) {
    const name = m.r.product ?? m.r.label ?? m.r.id;
    const p = pmap.get(name) ?? { name, role: m.role, members: [] };
    p.role ??= m.role;
    p.members.push(m);
    pmap.set(name, p);
  }
  const products = [...pmap.values()].sort((a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3) || a.name.localeCompare(b.name));

  // pattern axes: per product, what it does (plain-words tag labels) and which ref shows it
  const rowsMap = new Map();
  const facetMap = new Map();
  let unmapped = 0;
  for (const p of products)
    for (const m of p.members)
      for (const t of m.r.tags ?? []) {
        const id = axisOf(idx, t);
        if (id.startsWith("#")) {
          unmapped++;
          continue;
        }
        const ax = axes.axes.find((x) => x.id === id);
        if (facetOf(id) === "topic") continue; // topics have their own curriculum section
        if (facetOf(id) !== "pattern") {
          const f = facetMap.get(id) ?? { label: ax.label, facet: ax.facet, products: [] };
          if (!f.products.includes(p.name)) f.products.push(p.name);
          facetMap.set(id, f);
          continue;
        }
        const row = rowsMap.get(id) ?? { id, label: ax.label, question: ax.question, verdict: ax.verdict, description: ax.description, products: [], tagsBy: {}, how: {}, refBy: {}, other: [] };
        if (!row.products.includes(p.name)) row.products.push(p.name);
        row.tagsBy[p.name] = [...new Set([...(row.tagsBy[p.name] ?? []), t])];
        row.how[p.name] = row.tagsBy[p.name].map((x) => tagLabel(axes, x));
        row.refBy[p.name] ??= m.r.id;
        rowsMap.set(id, row);
      }
  // the same axis found in other categories: which products there
  for (const r of refs)
    if (!(r.categories ?? []).includes(col.name))
      for (const t of r.tags ?? []) {
        const row = rowsMap.get(axisOf(idx, t));
        if (!row) continue;
        for (const c of r.categories ?? []) {
          let o = row.other.find((x) => x.name === c);
          if (!o) row.other.push((o = { name: c, title: titles.get(c) ?? c, products: [] }));
          const pn = r.product ?? r.label ?? r.id;
          if (!o.products.includes(pn)) o.products.push(pn);
        }
      }
  const rows = [...rowsMap.values()].sort((a, b) => b.products.length - a.products.length || a.label.localeCompare(b.label));
  const axisProducts = products.filter((p) => rows.some((r) => r.tagsBy[p.name])).map((p) => p.name);

  // runs and current run delta
  const evIn = (c, run, types) => (c.events ?? []).some((e) => e.run === run && types.includes(e.type));
  const runRows = runs.map((r) => ({
    ...r,
    counts: {
      created: own.filter((c) => evIn(c, r.id, ["created"])).length,
      revised: own.filter((c) => evIn(c, r.id, ["revises"])).length,
      refuted: own.filter((c) => evIn(c, r.id, ["refutes"])).length,
      confirmed: claims.filter((c) => evIn(c, r.id, ["confirmed"])).length,
    },
  }));
  const cr = col.currentRun;
  const current = cr
    ? {
        run: cr,
        created: own.filter((c) => evIn(c, cr, ["created"])),
        revised: own.filter((c) => evIn(c, cr, ["revises"])),
        refuted: own.filter((c) => evIn(c, cr, ["refutes"])),
        confirmed: claims.filter((c) => evIn(c, cr, ["confirmed"])),
      }
    : null;

  const cited = new Set([...own, ...related].flatMap((c) => c.sources));
  const sources = refs.filter((r) => cited.has(r.id) || col.members.some((m) => m.ref === r.id));
  const citeWarn = cite && !cite.includes("✓") ? cite.split("\n").filter((l) => l.startsWith("⚠")).map((l) => l.split(":")[0]).join(" · ") + " — `ref cite`로 확인" : "";
  const coverageWarn = cov.split("\n").filter((l) => l.startsWith("⚠")).join(" ");
  const titleOf = (id) => (id.startsWith("C") ? (claims.find((c) => c.id === id)?.text ?? "") : (byId.get(id)?.label ?? byId.get(id)?.url ?? ""));
  return {
    col,
    members: ms,
    products,
    summary,
    citeWarn,
    coverageWarn,
    axes: { rows, products: axisProducts, facets: [...facetMap.values()], unmapped },
    claims: { own, related },
    runs: runRows,
    current,
    changes: ms.flatMap((m) => (m.r.changes ?? []).map((c) => ({ r: m.r, c }))),
    stale: ms.filter((m) => m.r.snapshots?.length && daysSince(m.r.lastCaptured) > 90).map((m) => m.r),
    sources,
    titleOf,
    catTitle: (n) => titles.get(n) ?? n,
    curriculum: col.domain === "curriculum" ? await (await import("./curriculum.mjs")).curriculumData(col, refs) : null,
  };
}

const RUN_CLOSE_SINCE = "2026-10-19"; // first release whose `ref report` closes runs (result → endedAt)
const safeRead = (f) => {
  try {
    return readFileSync(f, "utf8");
  } catch {
    return "";
  }
};

/** <LIB>/index.html — every category and the patterns they share. */
export async function writeHome() {
  const [cols, refs, claims, axes, runs] = await Promise.all([listCollections(), readRefs(), readClaims(), readAxes(), readRuns()]);
  const idx = tagIndex(axes);
  const byId = new Map(refs.map((r) => [r.id, r]));
  const cats = cols.map((c) => {
    const rs = c.members.map((m) => byId.get(m.ref)).filter(Boolean);
    const axisCount = new Map();
    for (const r of rs)
      for (const id of new Set((r.tags ?? []).map((t) => axisOf(idx, t)))) {
        const ax = axes.axes.find((x) => x.id === id);
        if (ax && (ax.facet ?? "pattern") === "pattern") axisCount.set(ax.label, (axisCount.get(ax.label) ?? 0) + 1);
      }
    const own = claims.filter((x) => (x.collections ?? []).includes(c.name) && x.status === "active");
    const kinds = {};
    for (const x of own) kinds[x.kind] = (kinds[x.kind] ?? 0) + 1;
    const lastRun = runs.filter((r) => r.collection === c.name).at(-1);
    // one-line conclusion, same rule as the board's 핵심 결론: highlights → key → strongest
    const CONF = { high: 0, medium: 1, low: 2, hypothesis: 3 };
    const pick = (list) => list.slice().sort((a, b) => (CONF[a.confidence] ?? 9) - (CONF[b.confidence] ?? 9) || b.sources.length - a.sources.length)[0];
    const conclusion = (c.highlights ?? []).map((id) => own.find((x) => x.id === id)).find(Boolean) ?? pick(own.filter((x) => x.key)) ?? pick(own) ?? null;
    const sum = splitSummary(safeRead(path.join(collectionDir(c.name), "SUMMARY.md")));
    const openQ = c.openQuestions?.length ? c.openQuestions.length : sum.open ? sum.open.split("\n").filter((l) => /^\s*([-*]|\d+\.)\s+/.test(l)).length : 0;
    const cur = runs.find((r) => r.id === c.currentRun);
    return {
      name: c.name,
      title: c.title ?? c.name,
      description: c.description,
      goal: c.goal ?? c.question ?? lastRun?.goal ?? null,
      lastRun: lastRun?.startedAt?.slice(0, 10) ?? null,
      lastRunAt: lastRun?.startedAt ?? c.updatedAt ?? c.createdAt ?? "",
      conclusion: conclusion ? { id: conclusion.id, subject: conclusion.subject, text: conclusion.text, confidence: conclusion.confidence, sources: conclusion.sources.length, key: !!conclusion.key || (c.highlights ?? []).includes(conclusion.id) } : null,
      openQ,
      // runs only get endedAt since 0.1.0-beta.2 (`ref report` result) — older open runs are not "in progress"
      inProgress: !!cur && !cur.endedAt && cur.startedAt >= RUN_CLOSE_SINCE && daysSince(cur.startedAt) <= 14,
      kind: c.kind,
      domain: c.domain,
      refs: rs.length,
      products: new Set(rs.map((r) => r.product ?? r.id)).size,
      claims: own.length,
      kinds,
      run: c.currentRun,
      thumbs: rs.map((r) => latestSnapshot(r)?.files?.preview).filter(Boolean).slice(0, 1),
      topAxes: [...axisCount].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l]) => l),
    };
  });
  const axRows = axes.axes.map((ax) => {
    const counts = {};
    for (const c of cols) {
      const prods = new Set(c.members.map((m) => byId.get(m.ref)).filter((r) => r && (r.tags ?? []).some((t) => ax.tags.includes(t))).map((r) => r.product ?? r.id));
      if (prods.size) counts[c.name] = prods.size;
    }
    return { id: ax.id, label: ax.label, question: ax.question, verdict: ax.verdict, description: ax.description, facet: ax.facet ?? "pattern", cats: counts };
  });
  const lastRunAll = runs.at(-1);
  const html = renderHome({
    cats,
    axes: axRows.filter((a) => Object.keys(a.cats).length),
    totals: { refs: refs.length, claims: claims.filter((c) => c.status === "active").length, runs: runs.length, lastRun: lastRunAll?.startedAt?.slice(0, 10) ?? null, sharedRefs: refs.filter((r) => (r.categories ?? []).length > 1).length },
  });
  const file = path.join(LIB, "index.html");
  await fs.writeFile(file, html);
  return file;
}
