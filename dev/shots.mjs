// Screenshot a board for README assets: node dev/shots.mjs <board index.html> <out dir>
import puppeteer from "puppeteer-core";
import { findChrome } from "../scripts/capture.mjs";
const [file, out] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: process.env.REF_CHROME || findChrome(), headless: true });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
await p.goto("file://" + file, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));
const shot = (name, clip) => p.screenshot({ path: `${out}/${name}.png`, clip, captureBeyondViewport: true });
// sections sit right of the 268px sticky sidebar
const box = (sel) => p.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: 268, y: r.top + scrollY - 16, width: innerWidth - 268, height: Math.min(r.height + 32, 1100) }; });
await shot("tour-overview", { x: 0, y: 0, width: 1440, height: 900 });
for (const [n, s] of [["tour-patterns", "#axes"], ["tour-refs", "#refs"], ["tour-claims", "#claims"]]) await shot(n, await box(s));
// 판단 자료 with the evidence panel open (the panel is fixed, so this one is a viewport shot)
await p.evaluate(() => { const o = document.querySelector("#judge .obs"); scrollTo({ top: o.getBoundingClientRect().top + scrollY - 120, behavior: "instant" }); });
await p.click("#judge .jmore");
await new Promise((r) => setTimeout(r, 700));
await p.screenshot({ path: `${out}/tour-key.png` });
await p.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 400));
await p.evaluate(() => document.querySelector('.card [data-view]').click());
await new Promise((r) => setTimeout(r, 900));
await p.screenshot({ path: `${out}/tour-viewer.png` });
// library home (one collection in the demo, but it shows the tiles, prompts, recent activity and open questions)
await p.goto("file://" + file.replace(/[^/]+\/index\.html$/, "index.html"), { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));
await shot("tour-home", { x: 0, y: 0, width: 1440, height: 900 });
await b.close();
