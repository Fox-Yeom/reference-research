#!/usr/bin/env node
// One board as a single HTML file, images inlined, so it opens anywhere: node dev/bundle-board.mjs <board index.html> <out.html>
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";

const [src, out] = process.argv.slice(2);
const dir = path.dirname(src);
// the example lives in git: smaller images, still readable in the viewer
const SHRINK = `import base64, io, sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
if im.width > 1100: im = im.resize((1100, int(im.height * 1100 / im.width)), Image.LANCZOS)
b = io.BytesIO(); im.save(b, "JPEG", quality=68, optimize=True)
print(base64.b64encode(b.getvalue()).decode())`;
const cache = new Map();
const inline = (p) => {
  if (!cache.has(p)) cache.set(p, `data:image/jpeg;base64,${execFileSync("python3", ["-c", SHRINK, path.join(dir, p)], { maxBuffer: 1 << 26 }).toString().trim()}`);
  return cache.get(p);
};
const html = readFileSync(src, "utf8").replace(/\.\.\/refs\/[^"&\s<>]+?\.(?:jpe?g|png)/g, inline).replaceAll('href="../index.html"', 'href="#"');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1048576).toFixed(1)} MB, ${cache.size} images`);
