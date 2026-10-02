/**
 * capture — Aside page captures and App Store screens, written as snapshots of global references.
 *
 * Re-encounter rule: a URL already in the library is never duplicated. The reference joins the current
 * collection (category added); it is re-captured only when its last snapshot is older than `refresh_days`
 * (default 30) or `force` is set, and the new snapshot is diffed against the previous one (time delta).
 */
import { execFile } from "node:child_process";
import { promises as fs, existsSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { readAxes, tagIndex } from "./axes.mjs";
import {
  FILES, ROLES, SCREEN_TYPES, TYPE_CRED, abs, addMember, bad, daysSince, ensureCollection, findRef, latestSnapshot,
  nextId, normUrl, readRefs, refSlug, rel, saveRefs, splitLabel, stamp, writeCollection,
} from "./store.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IMGTOOLS = path.join(HERE, "imgtools.py");
const REPL_TIMEOUT_MS = 115_000;
const MARK = "__REF_RESULT__";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const META_KEEP = ["title", "description", "ogImage", "lang", "headings", "nav", "ctas", "fonts", "topColors", "viewport", "pageHeight", "innerScroller"];

export function run(cmd, args, timeout) {
  return new Promise((resolve) => {
    const child = execFile(cmd, args, { timeout, maxBuffer: 32 * 1024 * 1024, cwd: os.tmpdir() }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === "number" ? err.code : 1) : 0;
      resolve({ code, stdout: String(stdout), stderr: String(stderr) });
    });
    child.stdin?.end();
  });
}

const httpGet = (url) => fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(30_000) });

/** JS executed inside `aside repl` for one URL. Prints MARK + JSON. */
export function captureScript(url, waitMs, frames, scroll, hideOverlays, maxFrames = 16, frameWaitMs = 800) {
  const u = JSON.stringify(url);
  // Hide (never click) cookie/consent overlays so the user's real consent state is untouched.
  const hide = hideOverlays
    ? `__out.hiddenOverlays = (__out.hiddenOverlays || 0) + await __p.evaluate(() => {
    const re = /cookie|consent|onetrust|gdpr|didomi|truste|usercentrics|cookiebot|\\uCFE0\\uD0A4|\\uAC1C\\uC778\\uC815\\uBCF4|\\uB3D9\\uC758 \\uBC30\\uB108/i;
    let n = 0;
    const hideEl = (el) => { el.style.setProperty('display', 'none', 'important'); n++; };
    for (const sel of ['#onetrust-consent-sdk', '#CybotCookiebotDialog', '#usercentrics-root', '#didomi-host', '.osano-cm-window', '.fc-consent-root', '#truste-consent-track', '#cookie-law-info-bar']) {
      document.querySelectorAll(sel).forEach(hideEl);
    }
    for (const el of document.querySelectorAll('body *')) {
      if (el.tagName === 'HEADER' || el.tagName === 'NAV') continue;
      const s = getComputedStyle(el);
      if (s.display === 'none' || (s.position !== 'fixed' && s.position !== 'sticky')) continue;
      const sig = el.id + ' ' + (typeof el.className === 'string' ? el.className : '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.innerText || '').slice(0, 400);
      if (re.test(sig)) hideEl(el);
    }
    for (const e of [document.documentElement, document.body]) {
      if (getComputedStyle(e).overflow === 'hidden') e.style.setProperty('overflow', 'visible', 'important');
    }
    return n;
  });`
    : "";
  return `
let __p;
const __out = { ok: false, url: ${u} };
try {
  __p = await openTab(${u});
  await sleep(${Math.max(0, Math.min(waitMs, 15000))});
  await fs.mkdir('./artifacts', { recursive: true });
  const __id = Date.now().toString(36);
  ${hide}
  await __p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo({ top: 0, behavior: 'instant' }); });
  await __p.screenshot({ path: './artifacts/' + __id + '-fold.png' });
  __out.fold = path.resolve('./artifacts/' + __id + '-fold.png');
  ${
    scroll
      ? `await __p.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    const h = () => document.documentElement.scrollHeight;
    for (let y = 0, i = 0; y < h() && i < 40; y += Math.max(400, innerHeight * 0.8), i++) {
      scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 150));
    }
    scrollTo({ top: 0, behavior: 'instant' }); await new Promise(r => setTimeout(r, 500));
  });`
      : ""
  }
  __out.meta = await __p.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const txt = (e) => (e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim();
    const cs = (e) => e ? getComputedStyle(e) : null;
    const btn = q('button, a[class*=btn], a[class*=button], [role=button]');
    const colors = {};
    for (const e of [...document.querySelectorAll('body, header, nav, main, section, footer, button, a, h1, h2')].slice(0, 300)) {
      const s = getComputedStyle(e);
      for (const c of [s.color, s.backgroundColor]) {
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') colors[c] = (colors[c] || 0) + 1;
      }
    }
    return {
      title: document.title,
      description: q('meta[name="description"]')?.content || q('meta[property="og:description"]')?.content || null,
      ogImage: q('meta[property="og:image"]')?.content || null,
      lang: document.documentElement.lang || null,
      headings: [...document.querySelectorAll('h1, h2, h3')].map(e => e.tagName + ': ' + txt(e)).filter(s => s.length > 4).slice(0, 25),
      nav: [...document.querySelectorAll('header a, nav a')].map(e => ({ text: txt(e).slice(0, 60), href: e.href })).filter(a => a.text).slice(0, 40),
      ctas: [...document.querySelectorAll('button, a[class*=btn], a[class*=button], [role=button]')].map(txt).filter(Boolean).slice(0, 20),
      fonts: { body: cs(document.body)?.fontFamily, h1: cs(q('h1'))?.fontFamily, button: cs(btn)?.fontFamily },
      topColors: Object.entries(colors).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, n]) => c + ' x' + n),
      viewport: { w: innerWidth, h: innerHeight },
      pageHeight: document.documentElement.scrollHeight,
      innerScroller: (() => {
        if (document.documentElement.scrollHeight > innerHeight * 1.2) return false;
        const el = [...document.querySelectorAll('body *')].filter(e => {
          const s = getComputedStyle(e);
          return /(auto|scroll)/.test(s.overflowY) && e.clientHeight > innerHeight * 0.5 && e.scrollHeight > e.clientHeight * 1.5;
        }).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
        if (!el) return false;
        el.setAttribute('data-ref-scroller', '1');
        return true;
      })(),
    };
  });
  __out.finalUrl = __p.url();
  ${hide}
  ${
    frames
      ? `const __info = await __p.evaluate(() => {
    const s = document.querySelector('[data-ref-scroller]');
    return s ? { H: s.scrollHeight, vh: s.clientHeight } : { H: document.documentElement.scrollHeight, vh: innerHeight };
  });
  const __total = Math.max(1, Math.ceil(__info.H / __info.vh));
  const __n = Math.min(${maxFrames}, __total);
  __out.contiguous = __total <= ${maxFrames};
  const __step = __out.contiguous ? __info.vh : (__info.H - __info.vh) / Math.max(1, __n - 1);
  __out.frames = []; __out.frameYs = []; __out.vh = __info.vh; __out.vw = await __p.evaluate(() => innerWidth);
  for (let i = 0; i < __n; i++) {
    const y = Math.round(i * __step);
    const actual = await __p.evaluate((y) => {
      const s = document.querySelector('[data-ref-scroller]');
      if (s) { s.scrollTop = y; return s.scrollTop; }
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo({ top: y, behavior: 'instant' });
      return scrollY;
    }, y);
    if (i > 0 && actual === __out.frameYs[__out.frameYs.length - 1]) break;
    await sleep(${frameWaitMs});
    const f = './artifacts/' + __id + '-f' + String(i).padStart(2, '0') + '.png';
    await __p.screenshot({ path: f });
    __out.frames.push(path.resolve(f)); __out.frameYs.push(actual);
    __out.hiddenBars = (__out.hiddenBars || 0) + await __p.evaluate(() => {
      let n = 0;
      for (const el of document.querySelectorAll('body *')) {
        const s = getComputedStyle(el);
        if (s.position !== 'fixed' && s.position !== 'sticky') continue;
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.height < 220 && (r.top < 40 || r.bottom > innerHeight - 40)) { el.style.setProperty('opacity', '0', 'important'); n++; }
      }
      return n;
    });
  }`
      : ""
  }
  __out.ok = true;
} catch (e) {
  __out.error = String(e && e.message || e);
} finally {
  try { if (__p) await closeTab(__p); } catch {}
}
console.log(${JSON.stringify(MARK)} + JSON.stringify(__out));
`;
}


async function makePreview(src, dest) {
  const r = await run("python3", [IMGTOOLS, "preview", src, dest], 60_000);
  return r.code === 0 && existsSync(dest);
}

// ---------- capture backends: Aside (user's logged-in browser) → local Chrome (headless, via puppeteer-core) → none ----------

const CHROMES = [
  process.env.REF_CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/microsoft-edge",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

export const findChrome = () => CHROMES.find((p) => existsSync(p)) ?? null;

/** "aside" | "chrome" | "none" — REF_CAPTURE forces one */
export async function captureBackend() {
  if (process.env.REF_CAPTURE) return process.env.REF_CAPTURE;
  if ((await run("aside", ["--version"], 15_000)).code === 0) return "aside";
  if (findChrome()) return "chrome";
  return "none";
}

let browserP = null;

/** Run the same capture script Aside's REPL runs, against a headless local Chrome. */
async function chromeRun(script) {
  const puppeteer = (await import("puppeteer-core")).default;
  browserP ??= puppeteer.launch({ executablePath: findChrome(), headless: true, defaultViewport: { width: 1440, height: 900 }, args: ["--hide-scrollbars", "--lang=ko-KR"] });
  const browser = await browserP;
  const art = await fs.mkdtemp(path.join(os.tmpdir(), "ref-cap-"));
  let printed = "";
  const con = { log: (...a) => (printed += a.join(" ") + "\n"), error: () => {}, warn: () => {} };
  const openTab = async (url) => {
    const p = await browser.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await p.goto(url, { waitUntil: "networkidle2", timeout: 45_000 }).catch(() => {});
    return p;
  };
  const closeTab = (p) => p.close();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const body = script.replaceAll("'./artifacts", `'${art.replace(/'/g, "\\'")}`);
  await new AsyncFunction("openTab", "closeTab", "sleep", "fs", "path", "console", body)(openTab, closeTab, sleep, fs, path, con);
  return { code: 0, stdout: printed, stderr: "" };
}

async function closeBrowser() {
  if (browserP) {
    await (await browserP).close().catch(() => {});
    browserP = null;
  }
}

async function makeSheet(out, cellWidth, imgs) {
  const r = await run("python3", [IMGTOOLS, "sheet", out, String(cellWidth), ...imgs], 120_000);
  return r.code === 0 && existsSync(out);
}

// ---------- time delta ----------

const setDiff = (a = [], b = []) => {
  const A = new Set(a);
  const B = new Set(b);
  return { added: [...B].filter((x) => !A.has(x)), removed: [...A].filter((x) => !B.has(x)) };
};

/** What changed between two snapshots' meta (page or store). Returns short lines; empty = no visible change. */
export function snapshotDelta(prev = {}, cur = {}) {
  const out = [];
  for (const k of ["title", "description", "version", "price", "seller"]) {
    if (prev[k] !== undefined && cur[k] !== undefined && prev[k] !== cur[k]) out.push(`${k}: "${String(prev[k]).slice(0, 80)}" → "${String(cur[k]).slice(0, 80)}"`);
  }
  if (prev.rating !== undefined && cur.rating !== undefined && Math.abs((prev.rating ?? 0) - (cur.rating ?? 0)) >= 0.05)
    out.push(`rating: ${Number(prev.rating).toFixed(2)} (${prev.ratingCount}) → ${Number(cur.rating).toFixed(2)} (${cur.ratingCount})`);
  for (const [k, label] of [["headings", "headings"], ["ctas", "CTAs"]]) {
    const d = setDiff(prev[k], cur[k]);
    if (d.added.length) out.push(`${label} +: ${d.added.slice(0, 6).join(" | ")}`);
    if (d.removed.length) out.push(`${label} −: ${d.removed.slice(0, 6).join(" | ")}`);
  }
  const navT = (m) => (m.nav ?? []).map((a) => a.text);
  const nd = setDiff(navT(prev), navT(cur));
  if (nd.added.length || nd.removed.length) out.push(`nav: +${nd.added.slice(0, 5).join(", ") || "-"} / −${nd.removed.slice(0, 5).join(", ") || "-"}`);
  const top = (m) => (m.topColors ?? []).slice(0, 3).map((c) => c.replace(/ x\d+$/, ""));
  if (prev.topColors && cur.topColors && top(prev).join() !== top(cur).join()) out.push(`colors: ${top(prev).join(", ")} → ${top(cur).join(", ")}`);
  if (prev.fonts && cur.fonts && JSON.stringify(prev.fonts) !== JSON.stringify(cur.fonts)) out.push(`fonts: ${prev.fonts.h1 ?? "-"} → ${cur.fonts.h1 ?? "-"}`);
  if (prev.screens !== undefined && cur.screens !== undefined && prev.screens !== cur.screens) out.push(`screenshots: ${prev.screens} → ${cur.screens}`);
  if (prev.releaseNotes && cur.releaseNotes && prev.releaseNotes !== cur.releaseNotes) out.push(`release notes: ${cur.releaseNotes.slice(0, 120)}`);
  return out;
}

// ---------- ref bookkeeping ----------

function inferType(url, screens) {
  const h = new URL(url).host;
  if (screens.includes("store") || /apps\.apple\.com|play\.google\.com/.test(h)) return "store";
  if (h.endsWith("github.com")) return "repo";
  if (screens.includes("help")) return "docs";
  if (screens.some((t) => ["landing", "features", "pricing", "syllabus", "sample-lesson", "project", "assessment"].includes(t))) return "official";
  if (screens.includes("reviews")) return "community";
  return "capture";
}

function splitTags(tags = []) {
  return {
    screens: tags.filter((t) => SCREEN_TYPES.includes(t)),
    role: tags.find((t) => ROLES.includes(t)) ?? null,
    other: tags.filter((t) => !SCREEN_TYPES.includes(t) && !ROLES.includes(t)),
  };
}

/** New or existing ref for a URL + label; mutates `refs` and returns { ref, isNew }. */
function upsertRef(refs, url, finalUrl, item, ctx) {
  let ref = findRef(refs, url) ?? (finalUrl ? findRef(refs, finalUrl) : undefined);
  const isNew = !ref;
  const { screens, other } = splitTags(item.tags);
  const { product, page } = splitLabel(item.label ?? "");
  if (!ref) {
    ref = {
      id: nextId("S", refs),
      slug: refSlug(refs, finalUrl ?? url),
      url: finalUrl ?? url,
      normUrl: normUrl(finalUrl ?? url),
      aliases: [],
      label: item.label ?? null,
      product: product || null,
      page,
      title: null,
      description: null,
      type: item.type ?? inferType(finalUrl ?? url, screens),
      publisher: item.publisher ?? product ?? null,
      published: null,
      credibility: null,
      screens: [],
      tags: [],
      categories: [],
      notes: [],
      snapshots: [],
      changes: [],
      firstSeen: ctx.now,
      run: ctx.run,
    };
    ref.credibility = TYPE_CRED[ref.type] ?? "C";
    refs.push(ref);
  }
  for (const u of [url, finalUrl]) if (u && normUrl(u) !== ref.normUrl && !ref.aliases.includes(normUrl(u))) ref.aliases.push(normUrl(u));
  ref.screens = [...new Set([...ref.screens, ...screens])];
  ref.tags = [...new Set([...ref.tags, ...other])];
  if (item.label && !ref.label) Object.assign(ref, { label: item.label, product, page });
  ref.lastSeen = ctx.now;
  return { ref, isNew };
}

function addSnapshot(ref, snap, ctx) {
  const prev = latestSnapshot(ref);
  ref.snapshots.push(snap);
  ref.lastCaptured = snap.at;
  if (snap.meta?.title) ref.title = snap.meta.title;
  if (snap.meta?.description) ref.description = snap.meta.description;
  if (!prev) return [];
  const lines = snapshotDelta(prev.meta, snap.meta);
  ref.changes.push({ at: snap.at, from: prev.at, run: ctx.run, collection: ctx.collection, lines });
  return lines;
}

const preview = (snap) => (snap?.files?.preview ? abs(snap.files.preview) : null);

// ---------- capture ----------

export async function capture(params) {
  if (!Array.isArray(params.urls) || !params.urls.length) bad("capture needs collection and urls[]");
  const col = await ensureCollection(params.collection ?? params.project, { kind: params.kind, domain: params.domain, title: params.title, description: params.description ?? params.project_description });
  const refs = await readRefs();
  const ctx = { now: new Date().toISOString(), run: col.currentRun ?? null, collection: col.name };
  const backend = await captureBackend();
  if (backend === "none")
    bad("no capture backend: install Aside (https://releases.aside.com/install.sh) or Google Chrome/Chromium/Edge, or set REF_CHROME=/path/to/chrome. Without one, record pages as text sources with `ref source add`.");
  const o = {
    full: params.full_page ?? true,
    wait: params.wait_ms ?? 1500,
    scroll: params.scroll ?? true,
    hide: params.hide_overlays ?? true,
    maxFrames: params.max_frames ?? 16,
    frameWait: params.frame_wait_ms ?? 800,
    refreshDays: params.refresh_days ?? 30,
  };
  const touched = new Map();
  const lines = [];
  const failures = [];
  const images = [];

  for (const [i, item] of params.urls.entries()) {
    if (!/^https?:\/\//i.test(item.url)) {
      failures.push(`${item.url}: not an http(s) URL`);
      continue;
    }
    const existing = findRef(refs, item.url);
    if (existing && !params.force && !item.force && daysSince(existing.lastCaptured) < o.refreshDays) {
      const { ref } = upsertRef(refs, item.url, null, item, ctx);
      const added = addMember(col, ref, item.role ?? splitTags(item.tags).role, ctx.run);
      touched.set(ref.id, ref);
      lines.push(
        `- ${ref.id} REUSED ${ref.label ?? ref.url} — captured ${Math.floor(daysSince(ref.lastCaptured))}d ago, categories: ${ref.categories.join(", ")}${added ? `  (+${col.name})` : ""}` +
          (ref.notes.length ? `\n  earlier notes: ${ref.notes.length} (ref show ${ref.id})` : ""),
      );
      if (preview(latestSnapshot(ref))) images.push(preview(latestSnapshot(ref)));
      continue;
    }
    console.error(`[${i + 1}/${params.urls.length}] capturing ${item.url} ...`);
    const script = captureScript(item.url, o.wait, o.full, o.scroll, o.hide, o.maxFrames, o.frameWait);
    const r = backend === "aside" ? await run("aside", ["repl", script], REPL_TIMEOUT_MS) : await chromeRun(script).catch((e) => ({ code: 1, stdout: "", stderr: String(e?.message ?? e) }));
    const line = (r.stdout + "\n" + r.stderr).split("\n").find((l) => l.includes(MARK));
    let out;
    try {
      out = line ? JSON.parse(line.slice(line.indexOf(MARK) + MARK.length)) : null;
    } catch {
      out = null;
    }
    if (!out) {
      failures.push(`${item.url}: ${backend} capture failed (exit ${r.code}) ${(r.stderr || r.stdout).slice(-400)}`);
      continue;
    }
    if (!out.ok) {
      failures.push(`${item.url}: ${out.error ?? "unknown error"}`);
      continue;
    }
    const { ref, isNew } = upsertRef(refs, item.url, out.finalUrl, item, ctx);
    const at = new Date().toISOString();
    const dir = path.join(FILES.refsDir, ref.slug, stamp());
    await fs.mkdir(dir, { recursive: true });
    const files = {};
    if (out.fold && existsSync(out.fold)) {
      files.fold = path.join(dir, "fold.png");
      await fs.copyFile(out.fold, files.fold);
      if (await makePreview(files.fold, path.join(dir, "preview.jpg"))) files.preview = path.join(dir, "preview.jpg");
    }
    const frameSrc = (out.frames ?? []).filter((p) => existsSync(p));
    if (frameSrc.length) {
      const fr = await run("python3", [IMGTOOLS, "frames", path.join(dir, "frames"), path.join(dir, "frames-sheet.jpg"), ...frameSrc], 180_000);
      try {
        files.frames = JSON.parse(fr.stdout.trim());
        if (existsSync(path.join(dir, "frames-sheet.jpg"))) files.framesSheet = path.join(dir, "frames-sheet.jpg");
      } catch {
        failures.push(`${item.url}: frame conversion failed ${fr.stderr.slice(-200)}`);
      }
      if (out.contiguous && frameSrc.length > 1) {
        const st = await run("python3", [IMGTOOLS, "stitch", path.join(dir, "full"), String(out.vw), out.frameYs.join(","), ...frameSrc], 180_000);
        try {
          const parts = JSON.parse(st.stdout.trim());
          files.full = parts[0];
          if (parts.length > 1) files.fullParts = parts;
        } catch {
          failures.push(`${item.url}: stitch failed ${st.stderr.slice(-200)}`);
        }
      } else if (!out.contiguous) failures.push(`${item.url}: page too long for ${o.maxFrames} frames — sampled, no stitched full page`);
    }
    for (const p of [out.fold, ...(out.frames ?? [])]) if (p && p.startsWith(os.tmpdir())) await fs.rm(p, { force: true });

    const meta = Object.fromEntries(META_KEEP.map((k) => [k, out.meta?.[k]]).filter(([, v]) => v !== undefined));
    meta.hiddenOverlays = out.hiddenOverlays ?? 0;
    meta.frameYs = out.frameYs;
    const relFiles = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, Array.isArray(v) ? v.map(rel) : rel(v)]));
    const snap = { at, dir: rel(dir), files: relFiles, url: item.url, finalUrl: out.finalUrl, run: ctx.run, collection: col.name, meta };
    await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify({ ref: ref.id, ...snap }, null, 2));
    const delta = addSnapshot(ref, snap, ctx);
    const added = addMember(col, ref, item.role ?? splitTags(item.tags).role, ctx.run);
    touched.set(ref.id, ref);
    const m = meta;
    lines.push(
      [
        `- ${ref.id} ${isNew ? "NEW" : "REFRESHED"} ${ref.label ?? ""} — ${ref.title ?? ""}`,
        `  url: ${out.finalUrl ?? item.url}`,
        `  categories: ${ref.categories.join(", ")}${added && !isNew ? `  (+${col.name})` : ""}`,
        !isNew ? `  changes since ${ref.changes.at(-1).from.slice(0, 10)}: ${delta.length ? "\n    " + delta.join("\n    ") : "none visible"}` : "",
        m.description ? `  description: ${m.description}` : "",
        m.headings?.length ? `  headings: ${m.headings.slice(0, 8).join(" | ")}` : "",
        m.nav?.length ? `  nav: ${m.nav.slice(0, 12).map((a) => a.text).join(" | ")}` : "",
        m.ctas?.length ? `  CTAs: ${m.ctas.slice(0, 8).join(" | ")}` : "",
        m.fonts ? `  fonts: ${JSON.stringify(m.fonts)}` : "",
        m.topColors?.length ? `  colors: ${m.topColors.slice(0, 6).join(", ")}` : "",
        files.frames?.length ? `  frames: ${files.frames.length}${files.full ? ", stitched full page" : ""}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    for (const p of [files.preview, files.framesSheet]) if (p) images.push(p);
  }
  await saveRefs([...touched.values()]);
  await writeCollection(col);
  const idx = tagIndex(await readAxes());
  const unmapped = [...new Set(params.urls.flatMap((u) => splitTags(u.tags).other))].filter((t) => !idx.has(t) && !["macos", "ios"].includes(t));
  if (unmapped.length) lines.push(`\n⚠ tags not on any axis yet: ${unmapped.join(", ")} — \`ref axes suggest ${col.name}\``);
  await closeBrowser();
  return {
    text: [`Collection: ${col.name}`, `Capture backend: ${backend}${backend === "chrome" ? " (headless local Chrome — no logged-in sessions)" : ""}`, `Processed: ${touched.size}/${params.urls.length}`, "", ...lines, failures.length ? `\nFailures:\n${failures.map((f) => "- " + f).join("\n")}` : ""].join("\n"),
    images,
    ok: touched.size > 0,
  };
}

// ---------- App Store ----------

export async function storeScreens(params) {
  if (!params.app && !params.app_id) bad("store needs collection and app or app_id");
  const col = await ensureCollection(params.collection ?? params.project, { kind: params.kind, domain: params.domain, title: params.title, description: params.description ?? params.project_description });
  const countries = [...new Set([(params.country ?? "kr").toLowerCase(), "us"])];
  const mac = (params.platform ?? "ios") === "mac";
  let app;
  let candidates = [];
  let usedCountry = countries[0];
  for (const c of countries) {
    const url = params.app_id
      ? `https://itunes.apple.com/lookup?id=${encodeURIComponent(params.app_id)}&country=${c}`
      : `https://itunes.apple.com/search?term=${encodeURIComponent(params.app)}&entity=${mac ? "macSoftware" : "software"}&country=${c}&limit=6`;
    const res = await httpGet(url);
    if (!res.ok) continue;
    const results = (await res.json()).results ?? [];
    if (!results.length) continue;
    candidates = results;
    app = results[0];
    usedCountry = c;
    if ((app.screenshotUrls ?? []).length) break;
  }
  if (!app) bad(`no ${mac ? "Mac " : ""}App Store result for ${params.app ?? params.app_id}`);
  const storeUrl = String(app.trackViewUrl).split("?")[0];
  const refs = await readRefs();
  const ctx = { now: new Date().toISOString(), run: col.currentRun ?? null, collection: col.name };
  const label = params.label ?? `${app.trackName} — ${mac ? "Mac App Store" : "App Store"}`;
  const item = { label, tags: ["store", "app-ui", mac ? "macos" : "ios", ...(params.tags ?? [])], role: params.role, publisher: app.sellerName, type: "store" };
  const existing = findRef(refs, storeUrl);
  const others = candidates.slice(1, 5).map((c) => `  - ${c.trackName} (${c.sellerName}) id=${c.trackId}`).join("\n");
  if (existing && !params.force && daysSince(existing.lastCaptured) < (params.refresh_days ?? 30)) {
    const { ref } = upsertRef(refs, storeUrl, null, item, ctx);
    const added = addMember(col, ref, item.role ?? splitTags(item.tags).role, ctx.run);
    await saveRefs([ref]);
    await writeCollection(col);
    return { text: `${ref.id} REUSED ${ref.label} — captured ${Math.floor(daysSince(ref.lastCaptured))}d ago, categories: ${ref.categories.join(", ")}${added ? `  (+${col.name})` : ""}`, images: [preview(latestSnapshot(ref))].filter(Boolean), ok: true };
  }
  const max = params.max_screens ?? 10;
  const big = (u) => (mac ? u : u.replace(/\/[^/]+\.(jpg|jpeg|png|webp)$/i, "/1290x2796bb.jpg"));
  const urls = [...(app.screenshotUrls ?? []), ...(params.include_ipad ? (app.ipadScreenshotUrls ?? []) : [])].slice(0, max);
  if (!urls.length) bad(`${app.trackName}: no screenshots in store listing`);
  const { ref, isNew } = upsertRef(refs, storeUrl, null, item, ctx);
  const dir = path.join(FILES.refsDir, ref.slug, stamp());
  const sdir = path.join(dir, "screens");
  await fs.mkdir(sdir, { recursive: true });
  const screens = [];
  for (const [i, u] of urls.entries()) {
    try {
      let res = await httpGet(big(u));
      if (!res.ok) res = await httpGet(u);
      if (!res.ok) continue;
      const p = path.join(sdir, `${String(i + 1).padStart(2, "0")}.jpg`);
      await fs.writeFile(p, Buffer.from(await res.arrayBuffer()));
      screens.push(p);
    } catch {
      /* skip */
    }
  }
  if (!screens.length) bad("all screenshot downloads failed");
  const files = { screens };
  const sheet = path.join(dir, "preview.jpg");
  if (await makeSheet(sheet, mac ? 480 : 300, screens)) Object.assign(files, { sheet, preview: sheet });
  const meta = {
    title: app.trackName,
    description: String(app.description ?? "").replace(/\s+/g, " ").slice(0, 300),
    source: mac ? "mac-app-store" : "app-store",
    country: usedCountry,
    trackId: app.trackId,
    seller: app.sellerName,
    rating: app.averageUserRating,
    ratingCount: app.userRatingCount,
    price: app.formattedPrice,
    genres: app.genres,
    version: app.version,
    updated: app.currentVersionReleaseDate,
    releaseNotes: String(app.releaseNotes ?? "").slice(0, 400),
    screens: screens.length,
  };
  const relFiles = { screens: screens.map(rel), ...(files.sheet ? { sheet: rel(files.sheet), preview: rel(files.preview) } : {}) };
  const snap = { at: new Date().toISOString(), dir: rel(dir), files: relFiles, url: storeUrl, run: ctx.run, collection: col.name, meta };
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify({ ref: ref.id, ...snap }, null, 2));
  const delta = addSnapshot(ref, snap, ctx);
  ref.published = meta.updated ?? ref.published;
  const added = addMember(col, ref, item.role ?? splitTags(item.tags).role, ctx.run);
  await saveRefs([ref]);
  await writeCollection(col);
  return {
    text: [
      `${ref.id} ${isNew ? "NEW" : "REFRESHED"} ${ref.label} — categories: ${ref.categories.join(", ")}${added && !isNew ? `  (+${col.name})` : ""}`,
      `  seller: ${app.sellerName} · rating ${Number(app.averageUserRating ?? 0).toFixed(2)} (${app.userRatingCount ?? 0}) · ${app.formattedPrice ?? ""} · store ${usedCountry}`,
      `  screens: ${screens.length} saved in ${sdir}`,
      !isNew ? `  changes: ${delta.length ? delta.join(" · ") : "none visible"}` : "",
      others && !params.app_id ? `Other search matches (verify the right app was chosen):\n${others}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    images: files.sheet ? [files.sheet] : [],
    ok: true,
  };
}
