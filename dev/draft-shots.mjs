#!/usr/bin/env node
// Screenshots + measurements for the board drafts (issue #13): node dev/draft-shots.mjs [docs/drafts]
// For every draft x view (board, home) x width: a capped full-page JPEG, text contrast (WCAG 2.x), sideways overflow.
// Writes <dir>/shots/*.webp and <dir>/measure.json.
import { writeFileSync, mkdirSync, readdirSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import { findChrome } from "../scripts/capture.mjs";

const dir = path.resolve(process.argv[2] ?? "docs/drafts");
const WIDTHS = [390, 768, 1280, 1600];
const CAP = 9000; // px of page height kept per screenshot: whole page at every width, still bounded
const drafts = readdirSync(dir).filter((f) => /^[a-z]-.+\.html$/.test(f)).sort();
mkdirSync(path.join(dir, "shots"), { recursive: true });

// Runs in the page: every visible element with its own text, contrast against the first opaque background behind it.
const AUDIT = () => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const mix = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  // backgrounds behind an element: every gradient stop of the nearest painted layer is a candidate, and the worst one counts
  const bgsOf = (el) => {
    const stack = [];
    let grad = null;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e), img = cs.backgroundImage;
      if (img && img.includes("gradient")) { grad = [...img.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])).filter((c) => c.a >= 0.5); if (grad.length) break; grad = null; }
      const c = parse(cs.backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; }
    }
    const base = grad ? grad.map((g) => ({ ...g, a: 1 })) : [{ r: 255, g: 255, b: 255, a: 1 }];
    return base.map((b0) => stack.reduceRight((bg, c) => mix(c, bg), b0));
  };
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    // disabled controls are exempt from WCAG 1.4.3 (inactive UI components)
    if (el.closest("dialog:not([open]), [hidden], script, style, :disabled")) continue;
    const svgText = el.tagName === "text" || el.tagName === "tspan";
    if (el.closest("svg") && !svgText) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    // svg text paints with fill, html text with color
    const fg0 = parse(svgText ? cs.fill : cs.color); if (!fg0) continue;
    // opacity on the element or any ancestor fades the text toward what is behind it
    for (let e = el; e; e = e.parentElement) fg0.a *= +getComputedStyle(e).opacity;
    const ratio = Math.min(...bgsOf(svgText ? el.closest("svg").parentElement : el).map((bg) => { const fg = mix(fg0, bg), L1 = lum(fg), L2 = lum(bg); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); }));
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    out.push({ ratio: +ratio.toFixed(2), size, large, text: el.textContent.trim().slice(0, 40), cls: el.className?.toString().slice(0, 30) });
  }
  const body = out.filter((o) => !o.large);
  const fails = out.filter((o) => o.ratio < (o.large ? 3 : 4.5));
  const min = (a) => (a.length ? Math.min(...a.map((o) => o.ratio)) : null);
  return { texts: out.length, minBody: min(body), minLarge: min(out.filter((o) => o.large)), fails: fails.length, failSamples: fails.slice(0, 6),
    overflowX: document.documentElement.scrollWidth > innerWidth + 1, height: document.documentElement.scrollHeight };
};

// audit at the top and at a few scroll positions (sticky navs light their current section only after scrolling), merged worst-case
async function sweep(p) {
  const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const runs = [];
  for (const f of [0, 0.35, 0.7]) {
    await p.evaluate((y) => scrollTo(0, y), Math.round(H * f));
    await new Promise((r) => setTimeout(r, 250));
    runs.push(await p.evaluate(AUDIT));
  }
  await p.evaluate(() => scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 150));
  const min = (k) => { const v = runs.map((x) => x[k]).filter((x) => x != null); return v.length ? Math.min(...v) : null; };
  const samples = runs.flatMap((x) => x.failSamples).filter((s, i, a) => a.findIndex((t) => t.text === s.text && t.ratio === s.ratio) === i);
  return { ...runs[0], minBody: min("minBody"), minLarge: min("minLarge"), fails: Math.max(...runs.map((x) => x.fails)), failSamples: samples.slice(0, 6), overflowX: runs.some((x) => x.overflowX) };
}

const browser = await puppeteer.launch({ executablePath: process.env.REF_CHROME || findChrome(), headless: true });
const result = {};
for (const f of drafts) {
  const name = f.replace(/\.html$/, "");
  for (const view of ["board", "home"]) {
    for (const w of WIDTHS) {
      const p = await browser.newPage();
      await p.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
      await p.goto(pathToFileURL(path.join(dir, f)).href + (view === "home" ? "#home" : ""), { waitUntil: "networkidle0" });
      // lazy images below the fold would shoot as empty frames: load them all first
      await p.evaluate(async () => { const imgs = [...document.images]; imgs.forEach((i) => (i.loading = "eager")); await Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))); });
      await new Promise((r) => setTimeout(r, 300));
      const m = await sweep(p);
      const h = Math.min(m.height, CAP);
      await p.screenshot({ path: path.join(dir, "shots", `${name}-${view}-${w}.webp`), type: "webp", quality: 55, clip: { x: 0, y: 0, width: w, height: h }, captureBeyondViewport: true });
      (result[name] ??= {})[`${view}-${w}`] = m;
      // drafts with a theme switch: measure the dark theme too (contrast only, no screenshot)
      if (await p.$("#theme")) {
        const cur = await p.evaluate(() => document.documentElement.dataset.theme);
        await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, cur === "dark" ? "light" : "dark");
        await new Promise((r) => setTimeout(r, 300));
        result[name][`${view}-${cur === "dark" ? "light" : "dark"}-${w}`] = await sweep(p);
        await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, cur);
        await new Promise((r) => setTimeout(r, 300));
      }
      if (view === "board" && (w === 1280 || w === 390)) {
        await p.evaluate(() => document.querySelector("[data-open]")?.click());
        await new Promise((r) => setTimeout(r, 400));
        const vm = await p.evaluate(AUDIT);
        result[name][`viewer-${w}`] = vm;
        await p.screenshot({ path: path.join(dir, "shots", `${name}-viewer-${w}.webp`), type: "webp", quality: 55 });
      }
      await p.close();
      console.log(`${name} ${view} ${w}: minBody ${m.minBody} fails ${m.fails} overflowX ${m.overflowX} height ${m.height}`);
    }
  }
}
await browser.close();
writeFileSync(path.join(dir, "measure.json"), JSON.stringify(result, null, 1) + "\n");
const failing = Object.entries(result).flatMap(([d, v]) => Object.entries(v).filter(([, m]) => m.fails || m.overflowX).map(([k]) => `${d} ${k}`));
if (failing.length) { console.error(`AA 미달 또는 가로 넘침: ${failing.join(", ")}`); process.exitCode = 1; }
