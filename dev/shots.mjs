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
for (const [n, s] of [["tour-key", "#key"], ["tour-patterns", "#axes"], ["tour-refs", "#refs"], ["tour-claims", "#claims"]]) await shot(n, await box(s));
await p.evaluate(() => document.querySelector('[data-open-ref="S2"]').click());
await new Promise((r) => setTimeout(r, 900));
await p.screenshot({ path: `${out}/tour-viewer.png` });
await b.close();
