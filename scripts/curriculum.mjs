/**
 * curriculum — course structure records and curriculum comparison (domain "curriculum").
 *
 * A course is recorded on one ref (usually its syllabus or landing page) as `ref.course`:
 *   { title, provider, audience, level: intro|beginner|intermediate|advanced, prerequisites:[…], hours, weeks,
 *     format: self-paced|live-online|cohort|offline|hybrid, price, currency, language, credential, assessment:[…],
 *     modules:[{ title, topics:["prompt-basics", …], hours, hands_on:true|false }] }
 * Module topics are tags: they are added to ref.tags so axes.json (facet "topic") normalizes them across courses.
 * Basis refs (type framework | survey | job-posting | report) tagged with topics say what *should* be taught.
 */
import { axisOf, readAxes, tagIndex, tagLabel } from "./axes.mjs";
import { mustCollection } from "./evidence.mjs";
import { bad, readRefs, saveRefs } from "./store.mjs";

export const LEVELS = { intro: "입문", beginner: "초급", intermediate: "중급", advanced: "고급" };
export const FORMATS = { "self-paced": "자율 학습(VOD)", "live-online": "실시간 온라인", cohort: "기수제", offline: "오프라인", hybrid: "혼합" };
const BASIS_TYPES = new Set(["framework", "survey", "job-posting", "report"]);
const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

export async function setCourse(params) {
  const col = await mustCollection(params.collection);
  const refs = await readRefs();
  const r = refs.find((x) => x.id === params.ref);
  if (!r) bad(`ref not found: ${params.ref}`);
  if (!(r.categories ?? []).includes(col.name)) bad(`${r.id} is not in ${col.name} (ref collect first)`);
  const c = { ...(r.course ?? {}), ...(params.course ?? {}) };
  if (c.level && !(c.level in LEVELS)) bad(`level must be one of ${Object.keys(LEVELS).join(", ")}`);
  if (c.format && !(c.format in FORMATS)) bad(`format must be one of ${Object.keys(FORMATS).join(", ")}`);
  for (const k of ["hours", "weeks", "price"]) if (c[k] !== undefined) c[k] = num(c[k]);
  if (c.modules) {
    if (!Array.isArray(c.modules)) bad("modules must be an array");
    c.modules = c.modules.map((m, i) => {
      if (!m.title) bad(`modules[${i}]: title is required`);
      return { title: m.title, topics: m.topics ?? [], hours: num(m.hours), hands_on: m.hands_on ?? null };
    });
  }
  c.source = params.source ?? c.source ?? "page"; // where the structure was read from (page / syllabus PDF / estimate)
  c.updatedAt = new Date().toISOString();
  r.course = c;
  r.tags = [...new Set([...(r.tags ?? []), ...(c.modules ?? []).flatMap((m) => m.topics)])];
  await saveRefs([r]);
  const idx = tagIndex(await readAxes());
  const topics = [...new Set((c.modules ?? []).flatMap((m) => m.topics))];
  const unmapped = topics.filter((t) => !idx.has(t));
  const sumH = (c.modules ?? []).reduce((s, m) => s + (m.hours ?? 0), 0);
  return [
    `${r.id} course: ${c.title ?? r.label} · ${c.modules?.length ?? 0} modules · ${c.hours ?? "?"}h${sumH && c.hours && Math.abs(sumH - c.hours) > 0.5 ? ` (modules sum ${sumH}h — check)` : ""} · topics ${topics.length}`,
    unmapped.length ? `⚠ topics not on a topic axis yet: ${unmapped.join(", ")} — reuse existing topic tags (\`ref axes show\`) or \`ref axes set\` with "facet":"topic"` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const median = (xs) => {
  const s = xs.filter((x) => typeof x === "number" && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Everything the board and `ref course show` need. */
export async function curriculumData(col, refsArg) {
  const refs = refsArg ?? (await readRefs());
  const axes = await readAxes();
  const idx = tagIndex(axes);
  const members = new Set(col.members.map((m) => m.ref));
  const inCol = refs.filter((r) => members.has(r.id));
  const topicKey = (t) => {
    const ax = idx.get(t);
    return ax && ax.facet === "topic" ? { id: ax.id, label: ax.label, question: ax.question } : ax ? null : { id: `#${t}`, label: tagLabel(axes, t) };
  };

  const courses = inCol
    .filter((r) => r.course)
    .map((r) => {
      const c = r.course;
      const mods = c.modules ?? [];
      const totalMod = mods.reduce((s, m) => s + (m.hours ?? 0), 0);
      const handsH = mods.filter((m) => m.hands_on).reduce((s, m) => s + (m.hours ?? 0), 0);
      return {
        id: r.id,
        product: r.product ?? r.label ?? r.id,
        title: c.title ?? r.label,
        provider: c.provider ?? r.publisher ?? r.product,
        audience: c.audience ?? null,
        level: c.level ?? null,
        prerequisites: c.prerequisites ?? [],
        hours: c.hours ?? (totalMod || null),
        weeks: c.weeks ?? null,
        format: c.format ?? null,
        price: c.price ?? null,
        currency: c.currency ?? (c.price !== null && c.price !== undefined ? "KRW" : null),
        language: c.language ?? null,
        credential: c.credential ?? null,
        assessment: c.assessment ?? [],
        handsOn: totalMod ? handsH / totalMod : mods.length ? mods.filter((m) => m.hands_on).length / mods.length : null,
        source: c.source,
        modules: mods.map((m, i) => ({ ...m, pos: mods.length > 1 ? i / (mods.length - 1) : 0, n: i + 1, labels: [...new Set(m.topics.map((t) => topicKey(t)?.label ?? tagLabel(axes, t)))] })),
      };
    });

  // topic coverage: per topic, which courses teach it, where (module order) and how long
  const topics = new Map();
  const get = (k) => topics.get(k.id) ?? (topics.set(k.id, { ...k, courses: {}, basis: [] }), topics.get(k.id));
  for (const c of courses)
    for (const m of c.modules)
      for (const t of m.topics) {
        const k = topicKey(t);
        if (!k) continue;
        const e = get(k);
        const cc = e.courses[c.id] ?? (e.courses[c.id] = { modules: [], hours: 0, pos: [] });
        if (cc.modules.includes(m.n)) continue; // two tags of one module on the same topic count once
        cc.modules.push(m.n);
        const keys = new Set(m.topics.map((x) => topicKey(x)?.id).filter(Boolean));
        cc.hours += m.hours ? m.hours / Math.max(1, keys.size) : 0;
        cc.pos.push(m.pos);
      }
  // basis: frameworks / surveys / job postings tagged with topics
  const basis = inCol.filter((r) => BASIS_TYPES.has(r.type));
  for (const b of basis)
    for (const t of b.tags ?? []) {
      const k = topicKey(t);
      if (k) get(k).basis.push(b.id);
    }
  const n = courses.length;
  const rows = [...topics.values()].map((t) => {
    const cs = Object.values(t.courses);
    return {
      ...t,
      basis: [...new Set(t.basis)],
      coverage: cs.length,
      avgPos: cs.length ? cs.reduce((s, x) => s + Math.min(...x.pos), 0) / cs.length : null,
      medianHours: median(cs.map((x) => x.hours).filter((h) => h > 0)),
    };
  });
  rows.sort((a, b) => b.coverage - a.coverage || (a.avgPos ?? 1) - (b.avgPos ?? 1));
  const common = (t) => n > 0 && t.coverage >= Math.max(2, Math.ceil(n * 0.5));
  return {
    courses,
    rows,
    basis,
    n,
    order: rows.filter((t) => t.coverage >= 2).sort((a, b) => a.avgPos - b.avgPos),
    common: rows.filter(common),
    gaps: rows.filter((t) => t.basis.length && t.coverage < Math.max(2, Math.ceil(n * 0.3))),
    unique: rows.filter((t) => t.coverage === 1),
    stats: {
      hours: median(courses.map((c) => c.hours)),
      hoursRange: courses.map((c) => c.hours).filter((h) => h != null),
      // prices only compare within one currency (KRW by default); others are listed per course
      price: median(courses.filter((c) => (c.currency ?? "KRW") === "KRW").map((c) => c.price)),
      priceRange: courses.filter((c) => (c.currency ?? "KRW") === "KRW").map((c) => c.price).filter((p) => p != null),
      otherPrices: courses.filter((c) => c.price != null && c.currency && c.currency !== "KRW").map((c) => `${c.product} ${c.currency} ${c.price}`),
      handsOn: median(courses.map((c) => c.handsOn)),
    },
    missing: inCol.filter((r) => !r.course && !BASIS_TYPES.has(r.type) && (r.screens ?? []).some((s) => ["syllabus", "landing"].includes(s))).map((r) => r.id),
  };
}

const where = (p) => (p == null ? "-" : p < 0.34 ? "초반" : p < 0.67 ? "중반" : "후반");

export async function showCourses(name) {
  const col = await mustCollection(name);
  const d = await curriculumData(col);
  if (!d.courses.length) return "no course records yet — `ref course set` after reading each syllabus";
  const L = [
    `${d.n} courses · median ${d.stats.hours ?? "?"}h · median price ${d.stats.price ?? "?"} KRW (n=${d.stats.priceRange.length})${d.stats.otherPrices.length ? ` + ${d.stats.otherPrices.join(", ")}` : ""} · median hands-on ${d.stats.handsOn != null ? Math.round(d.stats.handsOn * 100) + "%" : "?"}`,
    "",
    ...d.courses.map((c) => `- ${c.id} ${c.product}: ${c.title} · ${LEVELS[c.level] ?? "-"} · ${c.hours ?? "?"}h · ${FORMATS[c.format] ?? "-"} · ${c.price ?? "?"} · 모듈 ${c.modules.length}`),
    "",
    "Topics (coverage · usual position · basis):",
    ...d.rows.map((t) => `- ${t.label}${t.id.startsWith("#") ? " (unmapped)" : ""}: ${t.coverage}/${d.n} · ${where(t.avgPos)}${t.medianHours ? ` · ~${t.medianHours.toFixed(1)}h` : ""}${t.basis.length ? ` · basis ${t.basis.join(",")}` : ""}`),
    d.gaps.length ? `\nGaps (in basis, rarely taught): ${d.gaps.map((t) => t.label).join(", ")}` : "",
    d.missing.length ? `\n⚠ course pages without a course record: ${d.missing.join(", ")}` : "",
  ];
  return L.filter((x) => x !== "").join("\n");
}

export { where };
