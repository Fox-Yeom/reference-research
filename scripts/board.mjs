/**
 * board — the HTML template for every collection board and the library home (self-contained, dark neon: board draft G, docs/BOARD-DRAFTS.md).
 *
 * Board: 한눈에 보기 · (커리큘럼 비교) · 패턴 비교 · 레퍼런스 · 발견과 근거 · 조사 기록 · 출처
 * Design follows the reference-library research: search-first [C42], one filter row
 * [C43], image-first cards + product rows [C44], insights traced to evidence [C45], library size as one sentence
 * [C46], editorial tone [C49], no popups/ads [C48].
 */

import { FRESH_KO, SOURCE_LED, freshness, readState, refDate } from "./store.mjs";
import { detail as dgDetail, gantt, hexes, overview as dgOverview, sharedGraph, spark } from "./diagram.mjs";

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- minimal markdown (headings, lists, tables, quotes, bold, code, strike, links, [S#]/[C#] citations) ----------

function inline(s, cite) {
  let h = esc(s);
  const codes = [];
  h = h.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  h = h
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\[((?:[SC]\d+)(?:\s*,\s*[SC]\d+)*)\]/g, (_, ids) => `<span class="cites">${ids.split(/\s*,\s*/).map(cite).join("")}</span>`);
  return h.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

export function md(src, cite = (id) => `<a class="cite" href="#${id}">${id}</a>`) {
  const lines = String(src ?? "").replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  const isTable = (l) => /^\s*\|.*\|\s*$/.test(l);
  const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
      const lv = Math.min(4, m[1].length + 2);
      out.push(`<h${lv}>${inline(m[2], cite)}</h${lv}>`);
      i++;
    } else if (isTable(l)) {
      const rows = [];
      while (i < lines.length && isTable(lines[i])) rows.push(lines[i++]);
      const body = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r));
      const [head, ...rest] = body;
      out.push(
        `<div class="tablewrap"><table><thead><tr>${cells(head).map((c) => `<th>${inline(c, cite)}</th>`).join("")}</tr></thead><tbody>${rest
          .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c, cite)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`,
      );
    } else if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, "");
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) item += " " + lines[i++].trim();
        items.push(`<li>${inline(item, cite)}</li>`);
      }
      out.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
    } else if (/^>\s?/.test(l)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${md(q.join("\n"), cite)}</blockquote>`);
    } else {
      const p = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*\||\s*([-*]|\d+\.)\s+|>)/.test(lines[i])) p.push(lines[i++]);
      if (!p.length) p.push(lines[i++]);
      const text = p.join(" ");
      out.push(/^\*\*[^*]+\*\*:?$/.test(text.trim()) ? `<h4>${inline(text.replace(/\*\*/g, "").replace(/:$/, ""), cite)}</h4>` : `<p>${inline(text, cite)}</p>`);
    }
  }
  return out.join("\n");
}

// ---------- shared shell ----------

const CSS = `
:root{color-scheme:dark;--bg:#08080a;--page:#08080a;--mat:#0e0e11;--panel:#111114;--panel2:#17171b;--inner:#17171b;--paper:#0e0e11;--text:#f2f2f4;--muted:#a6a6af;--faint:#8e8e98;--line:#222227;--line2:#2c2c32;--chip:#1b1b21;--chip-on:var(--accent);--chip-on-text:#0b0b18;--gray-soft:#1b1b21;--on-accent:#0b0b18;
--accent:#8c98ff;--accent-soft:#1d2050;--accent-2:#4a55b8;--sel-fill:#16172a;--edge:#6d6d78;
--green:#4fe3a5;--green-soft:#0f2a1f;--amber:#ffbe5c;--amber-soft:#2b2010;--coral:#ff7a66;--coral-soft:#2c1512;
--blue:var(--accent);--blue-soft:var(--accent-soft);--violet:#c77dff;--violet-soft:#26173a;--teal:#45d6e0;--teal-soft:#0f2a2d;
--good:var(--green);--warn:var(--amber);--bad:var(--coral);--radius:12px;
--side-bg:#0b0b0d;--side-text:#f2f2f4;--side-muted:#a6a6af;--side-line:#1e1e22;
--hex-0:#18181c;--hex-1:#1f6a4c;--hex-2:#2fae78;--hex-3:#4fe3a5;
--v-bg:#060607;--v-panel:#0e0e11;--v-btn:#17171b;--v-btn-hover:#222228;--v-line:#1e1e22;--v-text:#f2f2f4;--v-muted:#a6a6af;--v-soft:#cfcfd6;--v-accent:#8c98ff}
*{box-sizing:border-box}[hidden]{display:none!important}html{scroll-behavior:smooth;scroll-padding-top:24px}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.65 -apple-system,BlinkMacSystemFont,"Pretendard","Apple SD Gothic Neo","Noto Sans KR","Inter",sans-serif;word-break:keep-all;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased;font-feature-settings:"tnum"}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline;text-underline-offset:3px}
.num{font-variant-numeric:tabular-nums}
/* frame: left index column + content (C57) */
.frame{display:grid;grid-template-columns:272px minmax(0,1fr);min-height:100vh}
.side{position:sticky;top:0;height:100vh;overflow:auto;padding:32px 28px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:22px}
.side .brand{font-weight:600;color:var(--text);text-decoration:none;letter-spacing:-.01em}.side .brand::before{content:"";display:inline-block;width:10px;height:10px;border-radius:3px;background:linear-gradient(135deg,var(--accent),var(--violet));margin-right:8px;vertical-align:0}.side .brand span{color:var(--muted)}
.side .about{color:var(--muted);font-size:14px;line-height:1.6}.side .about strong{color:var(--text);font-weight:500}
.side nav{display:flex;flex-direction:column;gap:2px}.side nav a{text-decoration:none;color:var(--muted);font-size:14px;padding:3px 0}.side nav a:hover,.side nav a.on{color:var(--accent)}
.side .foot{margin-top:auto;color:var(--faint);font-size:12.5px;line-height:1.6}
.search{position:relative}.search input{width:100%;font:inherit;font-size:14px;padding:9px 34px 9px 12px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--text);outline:none}
.search input:focus{border-color:var(--accent);background:var(--panel);box-shadow:0 0 0 3px var(--accent-soft)}.search kbd{position:absolute;right:10px;top:50%;transform:translateY(-50%)}
.content{min-width:0;padding:0 48px 80px}
.searchinfo{display:none;position:sticky;top:0;z-index:5;background:var(--bg);padding:12px 0;color:var(--muted);font-size:14px;border-bottom:1px solid var(--line)}.searching .searchinfo{display:block}
.hidden-by-search,.search-collapsed{display:none!important}.search-empty > :not(.sechead):not(.nomatch){display:none!important}.nomatch{color:var(--muted);font-size:14px;margin:0 0 0 52px}
.topbar{display:none}
/* hero (C58) */
.hero{padding:56px 0 36px;max-width:880px}
.eyebrow{font-size:13px;color:var(--muted)}
h1{font-size:44px;line-height:1.15;font-weight:500;letter-spacing:-.03em;margin:10px 0 16px}
.lead{color:var(--muted);font-size:17px;line-height:1.6;margin:0 0 22px}
.stats{font-size:17px;line-height:1.7;margin:0;color:var(--muted)}.stats b{color:var(--text);font-weight:600;background:linear-gradient(transparent 62%,var(--accent-soft) 62%)}
/* sections */
section{padding:40px 0 44px;border-top:1px solid var(--line)}
.sechead{display:grid;grid-template-columns:44px 1fr;column-gap:8px;margin:0 0 22px}
.sechead .n{color:var(--accent);font-size:13px;font-weight:600;padding-top:6px}.sechead h2{font-size:22px;font-weight:500;letter-spacing:-.015em;margin:0}
.sechead p{grid-column:2;margin:6px 0 0;color:var(--muted);font-size:14px;max-width:760px}
h3{font-size:16px;font-weight:500;margin:28px 0 12px}h4{font-size:15px;font-weight:500;margin:18px 0 6px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:22px 26px}
.prose p,.prose li,.prose h4{max-width:74ch}.prose p{margin:8px 0}.prose ul,.prose ol{margin:6px 0 12px;padding-left:20px}.prose li{margin:4px 0}.prose h4:first-child{margin-top:0}.prose strong{font-weight:600}
.prose blockquote{margin:10px 0;padding:4px 14px;border-left:2px solid var(--line);color:var(--muted)}
code,kbd{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--chip);padding:1px 6px;border-radius:5px;color:var(--muted)}
kbd{border:1px solid var(--line);background:var(--panel)}
.tablewrap{overflow-x:auto;margin:10px 0}table{border-collapse:collapse;width:100%;font-size:14px}
th,td{border-bottom:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top;word-break:keep-all;overflow-wrap:break-word}th{color:var(--muted);font-weight:500;font-size:12.5px;white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
.cites{white-space:nowrap}.cite{display:inline-block;font-size:11px;font-weight:600;line-height:1;padding:3px 6px;margin:0 2px;border-radius:999px;background:var(--accent-soft);color:var(--accent);text-decoration:none;vertical-align:1px}.cite:hover{text-decoration:none;background:var(--accent);color:var(--on-accent)}
.chip{display:inline-block;font-size:12px;line-height:1.5;padding:2px 9px;margin:2px 4px 2px 0;border-radius:999px;background:var(--chip);color:var(--muted)}
.badge{font-size:12px;color:var(--muted);white-space:nowrap}
.conf{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:2px 9px 2px 8px;border-radius:999px;white-space:nowrap;background:var(--gray-soft);color:var(--muted)}.conf::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.conf.high{background:var(--green-soft);color:var(--green)}.conf.medium{background:var(--amber-soft);color:var(--amber)}.conf.low{background:var(--coral-soft);color:var(--coral)}
.note{background:var(--amber-soft);color:var(--amber);border-radius:8px;padding:10px 14px;font-size:14px;margin:12px 0}
.role{display:inline-block;font-size:11.5px;font-weight:600;padding:1px 8px;border-radius:999px;white-space:nowrap}.r-direct{background:var(--accent-soft);color:var(--accent)}.r-indirect{background:var(--gray-soft);color:var(--muted)}.r-analogous,.r-trend{background:transparent;color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent-2)}.fr-fresh{background:var(--green-soft);color:var(--green)}.fr-stale{background:var(--gray-soft);color:var(--muted)}.fr-unknown{background:var(--amber-soft);color:var(--amber)}
.kdot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:2px;vertical-align:0}.k-pattern{background:var(--blue)}.k-benchmark{background:var(--violet)}.k-fact{background:var(--teal)}.k-gap{background:var(--amber)}.k-failure{background:var(--coral)}.k-opinion,.k-hypothesis{background:var(--faint)}
.muted{color:var(--muted)}.small{font-size:13px}
.prod{font:inherit;font-size:13.5px;font-weight:500;background:none;border:0;padding:0;color:var(--accent);cursor:zoom-in;text-align:left}.prod:hover{text-decoration:underline;text-underline-offset:3px}
/* pattern cards */
.groupcap{display:flex;align-items:baseline;gap:10px;margin:28px 0 12px}.groupcap h3{margin:0}.groupcap span{color:var(--muted);font-size:13px}
.axcards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.axcard{border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px;display:flex;flex-direction:column;background:var(--panel);border-top:1px solid var(--accent-2)}
.g-common .axcard{border-top-color:var(--green)}.g-unique .axcard{border-top-color:var(--amber)}.g-partial .axcard{border-top-color:var(--accent-2)}
.groupcap .gdot{width:10px;height:10px;border-radius:50%;display:inline-block}.g-common .gdot{background:var(--green)}.g-unique .gdot{background:var(--amber)}.g-partial .gdot{background:var(--accent-2)}
.axcard header{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.axcard header strong{font-size:15.5px;font-weight:500}
.axcard .count{font-size:12.5px;color:var(--faint);white-space:nowrap}.axcard .count b{color:var(--text);font-weight:600}
.axcard .q{margin:2px 0 12px;color:var(--muted);font-size:14px}
.how{list-style:none;margin:0;padding:0}.how li{display:grid;grid-template-columns:150px 1fr;gap:14px;padding:7px 0;border-top:1px solid var(--line);font-size:14px}.how li:first-child{border-top:0}.how li span{color:var(--muted)}
.how .prod{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.also{margin:14px 0 0;font-size:13px;color:var(--violet);background:var(--violet-soft);border-radius:8px;padding:8px 12px}.also a{color:var(--violet);font-weight:600}
/* references (C53 C54 C56) */
.toolbar{position:sticky;top:0;z-index:10;background:var(--bg);padding:12px 0;margin:-8px 0 20px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-bottom:1px solid var(--line)}
.seg{display:inline-flex;gap:4px}
.seg button{font:inherit;font-size:13px;border:0;border-radius:999px;background:var(--chip);color:var(--muted);padding:5px 13px;cursor:pointer}.seg button:hover{color:var(--text)}.seg button.on{background:var(--chip-on);color:var(--chip-on-text)}
.toolbar select,.stoolbar select{font:inherit;font-size:13px;padding:5px 28px 5px 12px;border:0;border-radius:999px;background:var(--chip);color:var(--text);appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);background-position:calc(100% - 15px) 52%,calc(100% - 10px) 52%;background-size:5px 5px;background-repeat:no-repeat}
.toolbar .spacer{flex:1}.toolbar .shown{font-size:13px;color:var(--faint)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:36px 24px}
.card{display:flex;flex-direction:column;gap:10px;min-width:0}
.thumb{display:block;position:relative;width:100%;border:0;cursor:zoom-in;aspect-ratio:4/3;background:var(--mat);border-radius:8px;padding:16px;overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:cover;object-position:top;display:block;border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,.06)}
.thumb .count{position:absolute;left:10px;bottom:6px;font-size:11.5px;line-height:16px;color:var(--text);background:rgba(8,8,10,.82);border-radius:5px;padding:0 6px;font-weight:600}
.thumb .go{position:absolute;right:10px;bottom:10px;width:26px;height:26px;border-radius:50%;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;font-size:13px;opacity:0;transition:opacity .15s;box-shadow:0 0 0 1px var(--line)}
.card:hover .thumb .go{opacity:1}
.thumb.empty{display:grid;place-items:center;color:var(--faint);font-size:13px;cursor:default}
.cap{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.cap .t{min-width:0}.cap .t div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cap .t .p{font-size:14.5px}.cap .t .s{font-size:13px;color:var(--muted)}
.cap .r{font-size:12px;color:var(--faint);white-space:nowrap;text-align:right}
.rows .row{display:grid;grid-template-columns:200px 1fr;gap:20px;align-items:start;padding:20px 0;border-top:1px solid var(--line)}.rows .row:first-child{border-top:0;padding-top:0}
.rows .row h4{margin:0 0 4px}.strip{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px}
.strip .thumb{flex:none;width:240px;padding:10px}.strip .label{font-size:12.5px;color:var(--muted);margin-top:6px;width:240px}
.flow{padding:22px 0;border-top:1px solid var(--line)}.flow:first-child{border-top:0;padding-top:0}
.flow .fh{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px}.flow .fh .p{font-size:15px}.flow .fh .s{color:var(--muted);font-size:13px}
.seq{display:flex;align-items:center;gap:6px;overflow-x:auto;padding-bottom:8px}
.seq .step{flex:none;width:168px}.seq .step .thumb{padding:8px;aspect-ratio:3/4}.seq .step .thumb.wide{aspect-ratio:16/10}.seq .step .n{font-size:12px;color:var(--faint);margin-top:6px}
.seq .arrow{flex:none;color:var(--faint);font-size:14px}
/* rich components: collage, stat band, bars, tracks, timelines */
.collage{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:32px 0 0}
.collage .thumb{aspect-ratio:16/10;padding:10px}.collage .thumb:nth-child(n+9){display:none}
.band{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-top:1px solid var(--accent);border-bottom:1px solid var(--line);margin:4px 0 30px}
.band div{padding:16px 18px 18px 0;border-right:1px solid var(--line);margin-right:18px}.band div:last-child{border-right:0}
.band b{display:block;font-size:40px;line-height:1.1;font-weight:300;letter-spacing:-.03em}.band b small{font-size:16px;font-weight:400;margin-left:2px;color:var(--muted);letter-spacing:0}
.band span{display:block;margin-top:6px;font-size:12.5px;color:var(--muted)}
.bar{display:inline-block;vertical-align:middle;width:calc(100% - 78px);max-width:220px;height:6px;border-radius:3px;background:var(--chip);overflow:hidden;margin-right:8px}
.bar{background:var(--accent-soft)}.bar .fill{display:block;height:100%;background:var(--accent);border-radius:3px}td .bar.hands .fill,.bar.hands .fill{background:var(--teal)}td .bar.hands{background:var(--teal-soft)}
.barv{font-size:12.5px;color:var(--muted);white-space:nowrap}
.pill{display:inline-block;font-size:12px;font-weight:600;padding:1px 9px;border-radius:999px;white-space:nowrap;background:var(--violet-soft);color:var(--violet)}
table.viz td{vertical-align:middle}
.topics{border-top:1px solid var(--accent)}
.trow{display:grid;grid-template-columns:minmax(200px,1.3fr) minmax(140px,1fr) minmax(200px,1.6fr) 90px;gap:18px;align-items:start;padding:12px 0;border-bottom:1px solid var(--line)}.trow > div:not(.tl){padding-top:3px}.nowrap{white-space:nowrap}
.trow.thead{font-size:12px;color:var(--muted);padding:8px 0}
.trow .tl strong{font-weight:500;display:block}.trow .tl .basis{font-size:12px;color:var(--muted)}
.trow .tc .bar{width:calc(100% - 46px)}
.track{position:relative;height:18px;border-left:1px solid var(--line);border-right:1px solid var(--line)}
.track::before{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px dashed var(--line)}
.track .dot{position:absolute;top:50%;border-radius:50%;background:var(--accent);opacity:.8;box-shadow:0 0 0 2px var(--bg);display:grid;place-items:center;font-size:10px;font-weight:600;color:var(--bg);line-height:1}.track .dot.many{opacity:.85}
.tchips{grid-column:auto}
.trackhead{display:flex;justify-content:space-between}
.tdetail{margin-top:2px}.tdetail summary{font-size:12px;color:var(--faint);cursor:pointer;width:max-content;list-style:none}.tdetail summary::before{content:"+ "}.tdetail[open] summary::before{content:"− "}.tdetail[open] summary{color:var(--muted)}
.tchips{display:flex;flex-wrap:wrap;gap:6px 8px;margin-top:8px}
ol.steps{list-style:none;counter-reset:st;margin:0;padding:0}
ol.steps li{counter-increment:st;display:grid;grid-template-columns:38px 1fr;gap:10px;padding:9px 0;border-top:1px solid var(--line)}ol.steps li:first-child{border-top:0}
ol.steps .sn::before{content:counter(st,decimal-leading-zero);font-size:20px;font-weight:400;color:var(--accent)}
ol.steps strong{font-weight:500;display:block}
ul.plain{list-style:none;margin:0;padding:0}ul.plain li{padding:9px 0;border-top:1px solid var(--line)}ul.plain li:first-child{border-top:0}ul.plain strong{font-weight:500;display:block}
.timeline{display:flex;gap:2px;height:10px;margin:4px 0 12px;border-radius:3px;overflow:hidden}.timeline .seg{background:var(--accent-soft);min-width:3px}.timeline .seg.on{background:var(--teal)}
.mini{display:inline-block;width:42px;height:28px;border-radius:4px;background:var(--mat);overflow:hidden;vertical-align:middle;margin-right:10px;flex:none}
.mini img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.how .prod{display:flex;align-items:center;min-width:0}.how .prod .pn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--accent)}
.how li{grid-template-columns:190px 1fr;align-items:center}
.cflow .fh{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
@media (max-width:1100px){.collage{grid-template-columns:repeat(2,minmax(0,1fr))}.collage .thumb:nth-child(n+5){display:none}.band{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:760px){.trow{grid-template-columns:1fr 1fr}.track{grid-column:1/-1}.band{grid-template-columns:repeat(2,minmax(0,1fr))}.how li{grid-template-columns:1fr}}
/* claims */
.kindgroup{margin:0 0 26px}.kindgroup h3{display:flex;gap:10px;align-items:baseline}.kindgroup h3 span{color:var(--faint);font-weight:400;font-size:13px}
.claim{display:grid;grid-template-columns:1fr auto;gap:10px 20px;padding:16px 0;border-top:1px solid var(--line)}.claim:first-child{border-top:0;padding-top:0}
.claim .text .subj{font-weight:500}.claim .side2{display:flex;flex-direction:column;align-items:flex-end;gap:4px}.claim .cid{font-size:11.5px;color:var(--faint)}
.evidence{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ev{display:inline-flex;align-items:center;gap:6px;background:var(--mat);border:0;border-radius:6px;padding:3px 9px 3px 3px;font:inherit;font-size:12px;color:var(--muted);cursor:zoom-in;text-decoration:none}
.ev img{width:46px;height:30px;object-fit:cover;object-position:top;border-radius:4px}.ev.noimg{padding:4px 9px}.ev:hover{color:var(--text)}
details.corrections summary{cursor:pointer;color:var(--muted);font-size:14px}
/* curriculum & misc */
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.topics{list-style:none;margin:0;padding:6px 22px}.topic{padding:13px 0;border-top:1px solid var(--line)}.topic:first-child{border-top:0}
.topic .th{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.topic .th strong{font-weight:500}.topic .cnt{font-size:13px;color:var(--muted)}
.topic .tc{display:flex;flex-wrap:wrap;gap:6px 8px;margin-top:8px;align-items:center}
.tchip{display:inline-flex;gap:6px;align-items:baseline;background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:3px 9px;font-size:13px}.tchip span{color:var(--muted)}
.basis{font-size:12.5px;color:var(--muted)}
.order{margin:0;padding-left:22px}.order li{margin:6px 0}.order strong{font-weight:500}
.flows{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}
.cflow{border:1px solid var(--line);border-radius:var(--radius);padding:16px 20px}.cflow .fh{margin-bottom:8px}
.cflow ol{margin:0;padding-left:22px}.cflow li{margin:6px 0;font-size:14px}.cflow .mt{font-weight:500}.cflow .ml{display:block;font-size:12.5px;color:var(--muted)}.cflow .mh{font-size:12px;color:var(--faint);margin-left:6px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:6px 0 22px}
.kpi{border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px}.kpi b{display:block;font-size:22px;font-weight:500}.kpi span{color:var(--muted);font-size:13px}
.catcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:36px 24px}
.catcard{text-decoration:none}
:target{outline:2px solid var(--accent);outline-offset:6px;border-radius:var(--radius)}
footer{color:var(--faint);font-size:13px;padding:30px 0 0;border-top:1px solid var(--line)}
@media (max-width:1100px){.frame{display:block}.side{display:none}.topbar{display:flex;position:sticky;top:0;z-index:20;background:var(--bg);border-bottom:1px solid var(--line);align-items:center;gap:14px;padding:12px 20px}.topbar .brand{font-weight:500;text-decoration:none;white-space:nowrap}.topbar .search{flex:1}.content{padding:0 20px 60px}.toolbar,.searchinfo{top:57px}}
@media (max-width:860px){.axcards,.grid2{grid-template-columns:1fr}.rows .row{grid-template-columns:1fr}}
@media (max-width:640px){h1{font-size:30px}.cards{grid-template-columns:1fr 1fr;gap:24px 14px}.how li{grid-template-columns:1fr;gap:2px}.claim{grid-template-columns:1fr}.claim .side2{flex-direction:row;align-items:center}.sechead{grid-template-columns:1fr}.sechead p{grid-column:1}}
/* viewer */
#viewer{position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;z-index:100;display:none;background:var(--v-bg);color:var(--v-text)}
#viewer.open{display:grid;grid-template-rows:auto 1fr auto;grid-template-columns:1fr auto}
#viewer header{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--v-line);flex-wrap:wrap}
#viewer header .t{margin-right:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#viewer header .t small{color:var(--v-muted);margin-left:8px}
#viewer button,#viewer header a{font:inherit;font-size:13px;color:var(--v-text);background:var(--v-btn);border:0;border-radius:999px;padding:6px 13px;cursor:pointer;text-decoration:none}
#viewer button:hover,#viewer header a:hover{background:var(--v-btn-hover)}#viewer .modes button.on{background:var(--v-accent);color:var(--on-accent)}#viewer button:disabled{opacity:.3;cursor:default}
#viewer .stage{position:relative;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:20px}
#viewer .stage.fit{align-items:center}#viewer .stage.fit img{max-width:100%;max-height:100%;object-fit:contain;cursor:zoom-in}
#viewer .stage.zoom img{max-width:none;max-height:none;cursor:zoom-out}
#viewer .stage.scroll{flex-direction:column;align-items:center}#viewer .stage.scroll img{display:block;width:min(100%,1280px);height:auto}
#viewer .nav{position:fixed;top:50%;transform:translateY(-50%);font-size:20px!important;width:44px;height:44px;padding:0!important;background:rgba(26,26,26,.9)!important}
#viewer .nav.prev{left:16px}#viewer .nav.next{right:calc(16px + var(--side,0px))}
#viewer .count{position:fixed;left:50%;transform:translateX(-50%);bottom:96px;font-size:12px;color:var(--v-soft);background:rgba(0,0,0,.6);padding:3px 10px;border-radius:999px}
#viewer .strip{grid-column:1;display:flex;gap:8px;overflow-x:auto;padding:10px 16px;border-top:1px solid var(--v-line)}
#viewer .strip img{height:64px;width:auto;border-radius:4px;opacity:.45;cursor:pointer;flex:none}#viewer .strip img.on{opacity:1;box-shadow:0 0 0 2px var(--v-accent)}
#viewer aside{grid-row:2/4;grid-column:2;width:min(400px,34vw);overflow:auto;border-left:1px solid var(--v-line);padding:18px 22px;background:var(--v-panel);font-size:14px;line-height:1.65}
#viewer aside[hidden]{display:none}#viewer aside h5{margin:0 0 8px;font-size:12px;font-weight:500;color:var(--v-muted)}
#viewer aside .facts{margin:0 0 16px;padding:0 0 14px;border-bottom:1px solid var(--v-line)}#viewer aside .facts div{margin:2px 0;color:var(--v-soft)}
#viewer aside .chip{background:var(--v-btn);color:var(--v-soft)}#viewer aside a{color:var(--v-text)}#viewer aside .prose{color:var(--v-soft)}#viewer aside .cite{background:var(--v-btn);color:var(--v-soft)}

/* ---- layout color (indigo theme): tinted page, dark sidebar, gradient hero, sections as cards ---- */
body{background:var(--page)}
.side{background:var(--side-bg);color:var(--side-text);border-right:0}
.side .brand{color:#fff}.side .brand span{color:var(--side-muted)}
.side .about{color:var(--side-muted)}.side .about strong{color:#fff}
.side nav a{color:var(--side-muted);padding:6px 10px;border-radius:8px;margin:0 -10px}.side nav a:hover{color:#fff;background:rgba(255,255,255,.07)}
.side .foot{color:var(--side-muted);border-top:1px solid var(--side-line);padding-top:14px}
.side .search input{background:rgba(255,255,255,.08);border-color:transparent;color:#fff}.side .search input::placeholder{color:var(--side-muted)}
.side .search input:focus{background:rgba(255,255,255,.12);border-color:#7d9bf7;box-shadow:0 0 0 3px rgba(125,155,247,.25)}
.side .search kbd{background:transparent;border-color:var(--side-line);color:var(--side-muted)}
.content{padding:28px 40px 80px}
.hero{max-width:none;margin:0 0 24px;padding:22px 32px 14px;border-radius:18px;color:var(--text);background:var(--panel);border:1px solid var(--line);box-shadow:0 1px 2px rgba(25,29,58,.04),0 8px 24px rgba(25,29,58,.04)}
.hero .eyebrow{color:var(--muted)}.hero h1{color:var(--text)}.hero .lead{color:var(--muted);max-width:880px}
.hero .stats{color:var(--muted);max-width:920px}.hero .stats b{color:var(--text)}
section{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:32px 36px 36px;margin:0 0 24px;box-shadow:0 1px 2px rgba(25,29,58,.04),0 8px 24px rgba(25,29,58,.04)}
.sechead .n{display:inline-grid;place-items:center;width:30px;height:24px;padding:0;border-radius:7px;background:var(--accent);color:var(--on-accent);font-size:12px;margin-top:2px}
section .panel{background:var(--inner);border-color:transparent}
.axcard,.cflow{background:var(--panel)}
.toolbar,.searchinfo{background:var(--panel)}
.searchinfo{border-radius:12px;padding:12px 16px;margin-bottom:16px;border:1px solid var(--line);color:var(--accent);font-weight:500}
.band{border-top:0;border-bottom:0;gap:10px;grid-template-columns:repeat(5,minmax(0,1fr))}
.band div{margin:0;border:0;border-radius:12px;padding:16px 18px}
.band div{background:var(--accent-soft)}
.band div b{color:var(--accent)}
.topics{border-top:0}.topics .thead{background:var(--inner);border-radius:8px;padding:8px 12px;border-bottom:0}
.thumb{background:var(--mat)}
footer{border-top:0;text-align:center}
@media (max-width:1100px){.topbar{background:var(--side-bg)!important;border-bottom:0!important}.topbar .brand{color:#fff}.topbar .search input{background:rgba(255,255,255,.1);border-color:transparent;color:#fff}.content{padding:18px 14px 60px}.hero{padding:28px 22px;border-radius:16px}section{padding:24px 18px;border-radius:14px}}
body.viewing{overflow:hidden}body.viewing .topbar{visibility:hidden}
@media (max-width:760px){#viewer.open{grid-template-columns:1fr}#viewer aside{grid-column:1;grid-row:auto;width:auto;max-height:38vh;border-left:0;border-top:1px solid var(--v-line)}#viewer .nav.next{right:16px}#viewer .count{bottom:auto;top:58px}}
/* ---- readability pass (docs/BOARD-REDESIGN.md, phase 1): goal block, stat tiles, 3-line claim cards, limited lists, copyable ids, scrollspy ---- */
.hero .goal{margin:16px 0 8px;padding:14px 18px;border-radius:12px;background:var(--inner);max-width:72ch}
.hero .goal .lbl{display:block;font-size:11.5px;font-weight:700;letter-spacing:.08em;color:var(--muted);margin-bottom:4px}
.hero .goal p{margin:0;font-size:16px;line-height:1.55;color:var(--text);font-weight:500}
.hero .goal .aud{margin-top:6px;font-size:14px;font-weight:400;color:var(--muted)}
.htop{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;padding-bottom:12px;border-bottom:1px solid var(--line)}.hero.answer h1{font-size:21px;font-weight:600;letter-spacing:-.01em;margin:4px 0 0}
.hmeta{margin:0;font-size:12.5px;color:var(--muted);white-space:nowrap}
.hgrid{display:grid;grid-template-columns:minmax(0,1fr) 216px;gap:0 28px}
.crow{display:grid;grid-template-columns:60px minmax(0,1fr);gap:14px;padding:11px 0;border-bottom:1px solid var(--line);font-size:15px;line-height:1.55}.crow:last-child{border-bottom:0}
.crow .cl{font-size:12.5px;font-weight:700;color:var(--muted);padding-top:.2em}
.crow.ans .cl{color:var(--accent)}.crow.ans>div{font-size:21px;line-height:1.4;font-weight:600;letter-spacing:-.01em}
.crow.warn .cl{color:var(--amber)}.cto{display:block;font-size:12.5px;font-weight:600;color:var(--amber)}.evn{display:inline-block;min-width:1.3em;margin-right:4px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}
.hlegend{margin:0;padding:10px 0 4px;border-top:1px solid var(--line);font-size:12.5px;line-height:1.6;color:var(--muted)}.hlegend b{font-weight:600;color:var(--text)}
.intents{margin:0;padding-left:20px}.intents li{margin:0 0 8px}.intents small{display:block;font-size:13px;line-height:1.5;color:var(--muted)}
.hside{border-left:1px solid var(--line);padding:12px 0 10px 24px;display:flex;flex-direction:column;gap:16px}
.hstat h4{margin:0 0 6px;font-size:12.5px;font-weight:700;color:var(--muted)}
.sbar{display:flex;gap:2px;height:7px;margin:0 0 7px;border-radius:2px;overflow:hidden;background:var(--gray-soft)}.sbar i{display:block}
.s-good{background:var(--green)}.s-warn{background:var(--amber)}.s-bad{background:var(--coral)}.s-none{background:var(--faint)}
.hstat ul{list-style:none;margin:0;padding:0;font-size:13px;line-height:1.7}.hstat li{display:flex;justify-content:space-between;gap:10px;color:var(--muted)}.hstat li b{font-weight:600;color:var(--text)}.hstat li.miss,.hstat li.miss b{color:var(--amber)}
.hstat .dot{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px}
.evrow{border-top:1px solid var(--line)}.evrow:first-of-type{border-top:0}
.evrow summary{display:flex;align-items:baseline;gap:10px;padding:9px 0;cursor:pointer;list-style:none;font-size:15px}.evrow summary::-webkit-details-marker{display:none}
.evrow summary::before{content:"▸";color:var(--accent);flex:none}.evrow[open] summary::before{content:"▾"}.evrow summary .t{flex:1;min-width:0}.evrow .conf{flex:none}
.evrow .evbody{padding:0 0 12px 22px;font-size:14px;color:var(--muted)}.evrow .evbody p{margin:0 0 8px}.evrow div.plain{padding:9px 0;font-size:15px}
.whycards{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
.whycard{display:grid;grid-template-columns:96px minmax(0,1fr);gap:14px;padding:16px;border-radius:var(--radius);background:var(--inner)}.whycard.noimg{grid-template-columns:minmax(0,1fr)}
.whycard .thumb{aspect-ratio:4/3;padding:0;align-self:start;overflow:hidden;border-radius:6px}.whycard .thumb img{width:100%;height:100%;object-fit:cover;object-position:top}
.whycard h4{display:flex;align-items:center;gap:8px;margin:0 0 6px;font-size:14.5px}.whycard p{margin:4px 0 0;font-size:14px;line-height:1.55}.whycard p b{color:var(--muted);font-weight:600;margin-right:6px}
.basis{display:inline-block;font-size:11.5px;font-weight:600;padding:1px 8px;border-radius:999px;white-space:nowrap}.basis-official{background:var(--green-soft);color:var(--green)}.basis-signal{background:var(--amber-soft);color:var(--amber)}.basis-guess{background:var(--gray-soft);color:var(--muted)}
.axwhy{margin:0 0 10px;font-size:13px;line-height:1.5;color:var(--muted)}.axwhy .basis{margin-right:6px}
.vwhy{margin:0 0 16px;padding:12px 14px;border-radius:8px;background:var(--v-btn);font-size:13px;line-height:1.55;color:var(--v-soft)}.vwhy h5{margin:0 0 6px}.vwhy p{margin:4px 0 0}.vwhy b{color:var(--v-muted);font-weight:600;margin-right:6px}
.proc summary{cursor:pointer;color:var(--accent);font-size:14px;font-weight:600;padding:4px 0}.proc[open] summary{margin-bottom:12px}
.procgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:14px;margin:0 0 16px;align-items:start}.procgrid h4{margin:0 0 8px;font-size:14px}.procgrid table{width:100%;font-size:13.5px}.procgrid th,.procgrid td{padding:8px 10px;vertical-align:baseline;font-size:13.5px;line-height:1.5}.procgrid th{font-size:12.5px;white-space:nowrap}.procgrid tbody th{width:1%;padding-left:0}.procgrid thead th:first-child,.procgrid tbody td:first-child{padding-left:0}.procgrid tbody td:first-child{white-space:nowrap;width:1%}.procgrid th.n,.procgrid td.n{width:1%;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.procgrid tbody tr:last-child th,.procgrid tbody tr:last-child td{border-bottom:0}
.seg{max-width:100%;flex-wrap:wrap}.procfresh{display:flex;flex-wrap:wrap;gap:8px}.proc .tiles{margin:0 0 16px}
.tiles{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:22px 0 0}
.tiles div{background:var(--inner);border-radius:12px;padding:14px 16px;min-width:0}
.tiles b{display:block;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-.02em;color:var(--text)}
.tiles span{display:block;margin-top:5px;font-size:12.5px;line-height:1.45;color:var(--muted)}
.tiles .mbar{display:flex;height:5px;border-radius:3px;overflow:hidden;margin-top:9px;background:var(--gray-soft)}
.tiles .mbar i{display:block;height:100%}.tiles .mbar .h{background:var(--green)}.tiles .mbar .m{background:var(--amber)}.tiles .mbar .l{background:var(--coral)}
.hero .lead,.sechead p{max-width:72ch}
.side nav a{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.side nav a small{font-size:11.5px;color:var(--faint);font-variant-numeric:tabular-nums}.side nav a.on{color:#fff;background:rgba(255,255,255,.1)}
/* claims: title / body / meta */
.claim{display:block;padding:18px 0;border-top:1px solid var(--line)}.claim:first-child{border-top:0;padding-top:0}
.claim .chead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.claim .ctitle{margin:0;font-size:16px;font-weight:600;line-height:1.4;letter-spacing:-.01em}
.claim .cbody{margin:6px 0 0;font-size:15px;line-height:1.6;max-width:72ch}
.claim .cbody.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.claim .more{font:inherit;font-size:12.5px;color:var(--accent);background:none;border:0;padding:0;margin-top:4px;cursor:pointer}
.cmeta{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;margin-top:8px;font-size:12.5px;color:var(--muted)}
.cmeta .sep{color:var(--faint)}.cmeta .run{cursor:help;border-bottom:1px dotted var(--faint)}
.claim .evidence{margin-top:10px}
.claim .prev{margin-top:10px;font-size:13px}.claim .prev summary{cursor:pointer;color:var(--muted);width:max-content}.claim .prev .old{margin-top:8px;padding:8px 14px;border-left:2px solid var(--line);color:var(--muted)}
.fix{display:inline-block;font-size:11.5px;font-weight:600;padding:1px 8px;border-radius:999px;background:var(--amber-soft);color:var(--amber);white-space:nowrap}
.idbtn{font:inherit;font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums;padding:2px 8px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--muted);cursor:copy;line-height:1.4;white-space:nowrap}.idbtn:hover{border-color:var(--accent);color:var(--accent)}
.idbtn.done{background:var(--green-soft);color:var(--green);border-color:transparent}
.empty-group{display:none!important}
/* lists with a limit ("더 보기") */
.over-limit,.filtered{display:none!important}
.morebtn{display:block;margin:18px auto 0;font:inherit;font-size:13.5px;font-weight:500;padding:9px 18px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--accent);cursor:pointer}.morebtn:hover{border-color:var(--accent)}.morebtn.small{margin:10px 0 0;padding:5px 12px;font-size:12.5px}
/* text-only references */
.docs td .tt{font-weight:500}.docs td .sum{display:block;color:var(--muted);font-size:13px;margin-top:2px;max-width:60ch}
.docs th.n,.docs td.n{width:1%;white-space:nowrap}
.docs details{margin-top:4px;font-size:13px}.docs details summary{cursor:pointer;color:var(--accent);width:max-content}.docs details .prose{margin-top:6px;color:var(--muted)}.docs details .prose p{margin:4px 0}
.stoolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px}.stoolbar .shown{font-size:13px;color:var(--faint);margin-left:auto}
.seg button.tog.on{background:var(--teal);color:var(--on-accent)}
/* home: goal line, claim-kind bar when there is no capture */
.catcard .goal2{display:block;margin-top:6px;font-size:14px;line-height:1.5;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.catcard .meta2{display:block;margin-top:6px;font-size:12.5px;color:var(--faint)}
.thumb.kinds{display:flex;flex-direction:column;justify-content:center;gap:10px;cursor:pointer;padding:28px}
.kbar{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--chip)}.kbar i{display:block;height:100%}
.klegend{font-size:12.5px;color:var(--muted);line-height:1.6}
/* floating */
.totop{position:fixed;right:22px;bottom:22px;z-index:30;width:42px;height:42px;border-radius:50%;border:1px solid var(--line);background:var(--panel);color:var(--accent);font-size:18px;cursor:pointer;box-shadow:0 6px 18px rgba(25,29,58,.12);opacity:0;pointer-events:none;transition:opacity .2s}.totop.show{opacity:1;pointer-events:auto}
.toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(10px);z-index:40;background:var(--side-bg);color:#fff;font-size:13.5px;padding:10px 16px;border-radius:999px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;max-width:90vw}.toast.show{opacity:1;transform:translateX(-50%)}
/* key takeaways + open questions */
.keygrid{display:grid;grid-template-columns:3fr 2fr;gap:16px}
.keylist{list-style:none;margin:0;padding:0;counter-reset:k}.keylist li{counter-increment:k;display:grid;grid-template-columns:34px 1fr;gap:10px;padding:12px 0;border-top:1px solid var(--line)}.keylist li:first-child{border-top:0;padding-top:0}.keylist li:last-child{padding-bottom:0}
.keylist li::before{content:counter(k);font-size:22px;font-weight:500;color:var(--accent);line-height:1.1;font-variant-numeric:tabular-nums}
.keylist .kt{display:block;font-weight:600;font-size:15.5px;line-height:1.45}.keylist .kt a{color:var(--text)}.keylist .kb{color:var(--muted);font-size:14px;margin-top:3px;max-width:60ch}.keylist .cmeta{margin-top:6px;font-size:12px}
.openq h4{margin:0 0 8px;font-size:14px;color:var(--muted);font-weight:600;letter-spacing:.02em}.openq ul{margin:0;padding-left:18px}.openq li{margin:6px 0;font-size:14.5px}
.pbtn{font:inherit;font-size:12px;font-weight:500;padding:2px 10px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--accent);cursor:copy;line-height:1.5}.pbtn:hover{border-color:var(--accent)}.pbtn.big{font-size:13.5px;padding:8px 14px;margin-top:14px;display:inline-block}
.star{display:inline-block;font-size:11.5px;font-weight:600;padding:1px 8px;border-radius:999px;background:var(--violet-soft);color:var(--violet);margin-right:6px;vertical-align:2px}
.pbtn::before{content:"⧉";margin-right:5px;font-size:.95em;opacity:.8}.pbtn.done::before{content:"✓"}.pbtn.done{background:var(--green-soft);color:var(--green);border-color:transparent}
.pact{display:inline-flex;flex-direction:column;align-items:flex-start;gap:6px;vertical-align:middle;max-width:100%}.asks .pact{flex-direction:row}.pprev{font-size:12.5px}.pprev summary{cursor:pointer;color:var(--muted);list-style:none}.pprev summary::before{content:"▸ "}.pprev[open] summary::before{content:"▾ "}
.pprev pre{margin:8px 0 4px;padding:10px 12px;border-radius:8px;background:var(--inner);border:1px solid var(--line);font:12.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word;color:var(--text);max-width:72ch;max-height:180px;overflow:auto}
.hero .pact:has(.pprev){flex-basis:100%}
.oqact{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:flex-start;margin:4px 0 6px 18px}.oqact > a{padding-top:4px}.oqact a{white-space:nowrap}
.seg.tabs button{display:inline-flex;align-items:center;gap:6px}.seg.tabs button small{font-size:11px;opacity:.75;font-variant-numeric:tabular-nums}.seg.tabs .kdot{width:8px;height:8px;margin:0}
#viewer aside .vtabs{display:flex;gap:6px;margin:0 0 10px}#viewer aside .vtabs button{padding:4px 11px;font-size:12.5px}#viewer aside .vtabs button.on{background:var(--v-accent);color:var(--on-accent)}
#viewer aside .vcl{list-style:none;margin:0;padding:0}#viewer aside .vcl li{padding:9px 0;border-top:1px solid var(--v-line);color:var(--v-soft);font-size:13.5px}#viewer aside .vcl li:first-child{border-top:0}#viewer aside .vcl a{color:#9db3f6;font-weight:600;margin-right:8px}#viewer aside .vcl .conf{font-size:11px;padding:1px 7px 1px 6px}
/* phase 3: folded summary, research chips, verdicts, run timeline, structured notes */
.sumtoc{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}.sumtoc a{font-size:12.5px;padding:3px 10px;border-radius:999px;background:var(--chip);color:var(--muted)}.sumtoc a:hover{color:var(--accent);text-decoration:none}
.sumsec{border-top:1px solid var(--line);padding:6px 0}.sumsec:first-child{border-top:0}.sumsec summary{cursor:pointer;font-size:15.5px;font-weight:600;padding:8px 0;list-style:none;display:flex;gap:8px;align-items:baseline}.sumsec summary::before{content:"▸";color:var(--accent);font-size:12px}.sumsec[open] summary::before{content:"▾"}.sumsec summary .cite{font-weight:600}
.sumbody{padding:0 0 10px 18px}.sumbody > :first-child{margin-top:0}
.schips{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.schip{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;padding:3px 9px 3px 4px;border-radius:999px;background:var(--chip);color:var(--text);text-decoration:none}.schip:hover{background:var(--accent-soft);text-decoration:none}
.schip b{font-size:11px;font-weight:700;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:var(--gray-soft);color:var(--muted)}.schip.g-A b{background:var(--green-soft);color:var(--green)}.schip.g-B b{background:var(--blue-soft);color:var(--blue)}.schip.g-C b{background:var(--amber-soft);color:var(--amber)}.schip.g-D b{background:var(--coral-soft);color:var(--coral)}
.verdict{margin:2px 0 10px;padding:8px 12px;border-left:1px solid var(--accent);background:var(--accent-soft);color:var(--text);font-size:14px;border-radius:0 8px 8px 0}.verdict.small{font-size:12.5px;margin:6px 0 0;padding:4px 10px}
.runs{list-style:none;margin:0;padding:0}.runs .run{display:grid;grid-template-columns:150px 1fr;gap:6px 18px;padding:14px 0;border-top:1px solid var(--line)}.runs .run:first-child{border-top:0;padding-top:0}
.runs .rh{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.runs .rd{font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums}.runs .rg{font-size:15px;line-height:1.5;max-width:72ch}.runs .rr{grid-column:2;color:var(--muted);font-size:14px;padding-left:14px;border-left:2px solid var(--line)}.runs .rc{grid-column:2}.runs .cur .rg{font-weight:500}
.nf{margin:8px 0;display:grid;grid-template-columns:72px 1fr;gap:6px 12px}.nf dt{font-size:11.5px;font-weight:600;color:var(--muted);letter-spacing:.03em;padding-top:2px}.nf dd{margin:0;font-size:14px}
.nl{display:block;font-size:11.5px;font-weight:600;color:var(--muted);letter-spacing:.03em;margin:8px 0 2px}
#viewer aside .nf dt,#viewer aside .nl{color:var(--v-muted)}#viewer aside .nf dd{color:var(--v-soft)}
/* home */
.hero .prompts{max-width:none;display:flex;flex-wrap:wrap;gap:10px 12px;align-items:center}.hero .prompts .lbl{width:100%;margin:0}.hero .prompts .pbtn.big{margin:0}.hero .prompts .asks{display:flex;flex-wrap:wrap;gap:6px}.hero .prompts .aud{width:100%;margin:2px 0 0;font-size:12.5px}
.catcard .concl{display:block;margin-top:8px;font-size:15px;font-weight:600;line-height:1.45;color:var(--text)}.catcard .concl .cite{margin-left:4px;vertical-align:2px}.catcard .concl.muted{font-weight:400}
.catcard .goal2{font-weight:400;color:var(--muted);font-size:13.5px}
.hero .goal.prompts{margin-top:18px}
#findings{display:none}.searching #findings{display:block}
.frows{display:flex;flex-direction:column}.frow{display:block;padding:12px 0;border-top:1px solid var(--line);color:var(--text)}.frow:first-child{border-top:0}.frow:hover{text-decoration:none;background:var(--inner)}
.frow .fh{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.frow .fh strong{font-size:15px;font-weight:600}.frow .fb{display:block;margin-top:4px;color:var(--muted);font-size:14px;max-width:72ch}.frow .fm{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}
.askbar{margin:0 0 14px}.askbar .pbtn.big{margin:0}
#recent .runs .run{grid-template-columns:150px 1fr}
.oqs{padding:6px 22px}.oq{border-top:1px solid var(--line);padding:8px 0}.oq:first-child{border-top:0}.oq summary{cursor:pointer;list-style:none;display:flex;gap:10px;align-items:baseline;padding:6px 0;font-weight:600;font-size:15px}.oq summary::before{content:"▸";color:var(--accent);font-size:12px}.oq[open] summary::before{content:"▾"}.oq summary a{color:var(--text)}
.oq ul{margin:4px 0 8px;padding-left:36px}.oq li{margin:5px 0;font-size:14.5px;max-width:72ch}
.catcard .cap .p a{color:var(--accent)}.pill.plan{background:var(--teal-soft);color:var(--teal)}.meta2 .warn{color:var(--amber);font-weight:600}.catcard .meta2 .pbtn{vertical-align:1px}
@media (max-width:1100px){.tiles{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:860px){.keygrid{grid-template-columns:1fr}.runs .run{grid-template-columns:1fr}.runs .rr,.runs .rc{grid-column:1}}
@media (max-width:860px){.hgrid{grid-template-columns:minmax(0,1fr)}.hside{border-left:0;border-top:1px solid var(--line);padding:12px 0;flex-direction:row;flex-wrap:wrap}.hstat{flex:1 1 150px}.htop{display:block}.hmeta{margin-top:6px;white-space:normal}}
@media (max-width:640px){.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.hero{padding:18px 18px 8px}.crow{grid-template-columns:minmax(0,1fr);gap:2px}.hero .goal p{font-size:15.5px}.claim .chead{flex-direction:column;gap:6px}}

/* ---- board G (docs/BOARD-DRAFTS.md): neon dark, glow on shapes only, never on text ---- */
::selection{background:#3d3a7a;color:#fff}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
section,.hero{background:linear-gradient(180deg,#131316,#0d0d10);border-color:var(--line);box-shadow:none;border-radius:20px}
.sechead .n{display:none}
.sechead{display:block!important;margin:0 0 16px}.sechead h2{margin:0 0 4px;font-size:18px;font-weight:650;letter-spacing:-.01em}.sechead p{margin:0;max-width:86ch}
.side .brand::before{background:transparent;border:3px solid var(--green);box-shadow:0 0 10px rgba(79,227,165,.7)}
.side nav a.on,.side nav a:hover{background:#18181d}
.ghead{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin:0 0 18px}
.ghead .crumb{margin:0 0 4px;font-size:13.5px;color:var(--faint)}.ghead .crumb a{color:var(--muted)}
.ghead h1{margin:0;font-size:30px;line-height:1.2;letter-spacing:-.02em;font-weight:700;color:var(--text)}
.ghead .sub{margin:6px 0 0;color:var(--muted);font-size:14.5px;max-width:76ch}
.ghead .gmeta{margin:6px 0 0;font-size:13px;color:var(--faint)}
.ghead .tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.btn.go,.pbtn.go{background:#0f2a20;border:1px solid #2c7a59;color:#bff5dc;box-shadow:0 0 18px rgba(79,227,165,.18)}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:0 0 18px}
.kpi{display:flex;flex-direction:column;min-height:150px;padding:16px 18px 0;border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,#131316,#0c0c0e);color:var(--text);text-decoration:none;overflow:hidden;transition:transform .15s ease-out,border-color .2s}
.kpi:hover{transform:translateY(-2px);border-color:var(--line2);text-decoration:none}
.kpi .k{font-size:13.5px;color:var(--muted);display:flex;align-items:center;gap:8px}.kpi .k i{width:8px;height:8px;border-radius:50%;background:var(--c);box-shadow:0 0 8px var(--c)}
.kpi .v{font:600 32px/1.15 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:-.02em;margin:8px 0 2px;display:flex;align-items:baseline;gap:8px}
.kpi .v small{font:600 12.5px -apple-system,BlinkMacSystemFont,"Pretendard","Apple SD Gothic Neo",sans-serif;color:var(--c)}
.kpi .h{font-size:12.5px;color:var(--faint)}
.kpi svg{display:block;width:calc(100% + 36px);margin:auto -18px 0;height:58px;overflow:visible}
.spark-line{fill:none;stroke-width:2;filter:drop-shadow(0 0 4px var(--c))}
.galley{display:grid;grid-template-columns:minmax(0,1fr) 300px;margin:14px -36px -36px;border-top:1px solid var(--line)}
.grows{min-width:0}
.grow{display:grid;grid-template-columns:84px minmax(0,1fr) 190px;gap:0 18px;padding:12px 24px 12px 36px;border-top:1px solid var(--line);align-items:start;transition:background .18s}
.grow:first-child{border-top:0}
.grow:hover,.grow:focus-within,.grow.sel{background:#141418}
.grow.sel{box-shadow:inset 3px 0 0 var(--accent)}
.grow>.lab{color:var(--faint);font-size:13.5px;padding-top:2px}
.grow>.mg{border-left:1px dashed var(--line2);padding-left:14px;font-size:13px;color:var(--muted);display:flex;flex-direction:column;gap:6px}
.grow.counter{background:rgba(255,96,72,.07)}.grow.counter>.lab{color:var(--coral);font-weight:600}
.grow .ans{font-size:20px;line-height:1.45;font-weight:700;margin:0}
.grow p{margin:0}
.mark{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;line-height:1.3}
.mark svg{flex:none;width:18px;height:18px}
.mark.strong{color:var(--green)}.mark.medium{color:var(--amber)}.mark.weak{color:var(--muted)}.mark.contested{color:var(--coral)}.mark.query{color:var(--amber)}.mark.new{color:var(--accent)}.mark.unread{color:var(--faint)}
.mark.contested svg{filter:drop-shadow(0 0 4px rgba(255,96,72,.7))}
.mark .why{font-weight:400;color:var(--muted)}
.cited{border-left:1px solid var(--line);padding:14px 16px}
.cited h3{margin:0 0 2px;font-size:13.5px}.cited p{margin:0 0 10px;font-size:12.5px;color:var(--faint);min-height:2.6em}
.cited .cg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cited button{padding:0;border:1px solid var(--line2);border-radius:10px;overflow:hidden;background:var(--inner);position:relative;cursor:pointer;transition:border-color .2s,box-shadow .2s,transform .2s;text-align:left}
.cited img{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;display:block;transition:opacity .2s}
.cited button span{display:block;font-size:12px;color:var(--muted);padding:3px 7px}
.cited.focus button img{opacity:.25}
.cited.focus button.lit{border-color:#ffd75e;box-shadow:0 0 18px rgba(255,215,94,.25);transform:translateY(-2px)}
.cited.focus button.lit img{opacity:1}
.dgwrap{overflow-x:auto;padding:4px 0 6px}
.dgwrap svg{display:block}
.dg text{font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif}
.dg .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.dg .box{fill:#131317;stroke:var(--line2);stroke-width:1;transition:stroke .2s,fill .2s}
.dg .dn[tabindex],.dg .dn.view{cursor:pointer}
.dg .dn[tabindex]:hover .box,.dg .dn.view:hover .box{stroke:var(--muted)}
.dg .dn.sel .box{stroke:var(--accent);stroke-width:1.5;fill:var(--sel-fill)}
.dg .dn.ext .box{fill:#101013;stroke:#3a3a42}
.dg .dn.more .box{fill:none;stroke:var(--line2);stroke-dasharray:4 3}
.dg .tag{fill:none;stroke-width:.8}
.dg .e{fill:none;stroke:var(--edge);stroke-width:1.5;transition:stroke .2s,opacity .2s}
.dg .e.lit{stroke:var(--accent)}
.dg .e.acc{stroke:var(--coral);stroke-dasharray:5 4;filter:drop-shadow(0 0 4px rgba(255,96,72,.75))}
.dg.dim .e:not(.lit):not(.acc){opacity:.35}
.dg .glow{filter:drop-shadow(0 0 8px var(--c))}
.dgdet{border-top:1px solid var(--line);margin-top:10px;padding-top:12px}
.dgdet h3{margin:0 0 6px;font-size:14px}
.gtip{position:absolute;pointer-events:none;background:#141418;border:1px solid var(--line2);border-radius:12px;padding:8px 10px;font-size:12.5px;min-width:170px;max-width:260px;z-index:5;transform:translate(-50%,calc(-100% - 12px));box-shadow:0 10px 30px rgba(0,0,0,.5)}
.gtip b{display:block;font-size:13px;margin-bottom:2px}
.plines .pl{fill:none;stroke-width:5;stroke-linecap:round;filter:drop-shadow(0 0 5px var(--c))}
.plines text{font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Apple SD Gothic Neo",sans-serif}
.plines .stop{cursor:pointer}
.glist{list-style:none;margin:0;padding:0}.glist.catcards{display:block}
.glist li{padding:12px 4px 10px;border-top:1px solid var(--line);transition:background .15s}
.glist li:first-child{border-top:0}
.glist li:hover,.glist li.hl{background:#141418}
.glist .t{display:flex;gap:10px;align-items:baseline;justify-content:space-between;flex-wrap:wrap}
.glist .t b{font-weight:600}.glist .t a{color:var(--text)}
.glist .m{display:block;font-size:13px;color:var(--faint);margin-top:2px}
.glist .a{display:block;font-size:13.5px;color:var(--muted);margin-top:2px}
.gbar{display:block;height:3px;border-radius:2px;margin-top:9px;background:linear-gradient(90deg,var(--c),transparent);box-shadow:0 0 8px color-mix(in srgb,var(--c) 60%,transparent)}
.gpill{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;border-radius:999px;padding:2px 9px;background:var(--chip);white-space:nowrap}
.gpill::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 6px currentColor}
.gpill.good{color:var(--green)}.gpill.mid{color:var(--amber)}.gpill.bad{color:var(--coral)}.gpill.none{color:var(--muted)}
.hexwrap{overflow-x:auto}.hexwrap svg{display:block;max-width:100%;height:auto}
.hexwrap polygon{stroke:#0b0b0d;stroke-width:2}.hexwrap .on{filter:drop-shadow(0 0 5px var(--c))}
.hexleg{display:flex;justify-content:flex-end;align-items:center;gap:6px;font-size:12.5px;color:var(--faint);margin:4px 0 8px}
.hexleg i{width:10px;height:10px;clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%);background:var(--c)}
.statl{list-style:none;margin:0;padding:0}.statl li{display:flex;justify-content:space-between;gap:8px;padding:10px 0;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}.statl b{color:var(--text);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600}
.hgrid2{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:24px;align-items:start}
.chip.against{background:var(--coral-soft);color:var(--coral)}.chip.unread{background:var(--chip);color:var(--faint)}
.card .thumb img.alt{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top;opacity:0;transition:opacity .35s}
.card .thumb img.alt.on{opacity:1}
@media (max-width:1280px){.galley{grid-template-columns:1fr}.cited{border-left:0;border-top:1px solid var(--line)}.cited .cg{grid-template-columns:repeat(5,minmax(0,1fr))}.hgrid2{grid-template-columns:1fr}}
@media (max-width:1100px){.kpis{grid-template-columns:1fr 1fr}.galley{margin:14px -20px -20px}.grow{padding-left:20px}}
@media (max-width:640px){.kpis{gap:10px}.kpi{min-height:130px;padding:12px 14px 0}.kpi .v{font-size:24px}.kpi svg{width:calc(100% + 28px);margin:auto -14px 0}.ghead h1{font-size:24px}.grow{grid-template-columns:1fr;padding:12px 14px}.grow>.lab{padding:0}.grow>.mg{border:0;padding:6px 0 0;flex-direction:row;flex-wrap:wrap;gap:6px 12px}.galley{margin:14px -14px -14px}.cited .cg{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

const JS = `
(()=>{
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const isHidden=el=>el.classList.contains('filtered')||el.classList.contains('hidden-by-search');
// segment buttons / selects write into a state object, then re-apply
const wire=(root,st,apply)=>{
  $$('.seg[data-k] button',root).forEach(b=>b.addEventListener('click',()=>{const seg=b.parentElement;if(b.classList.contains('tog')){b.classList.toggle('on');st[seg.dataset.k]=b.classList.contains('on');}else{seg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));st[seg.dataset.k]=b.dataset.v;}apply();}));
  $$('select[data-k]',root).forEach(s=>s.addEventListener('change',()=>{st[s.dataset.k]=s.value;apply();}));
};
// lists with a limit: [data-limit] holds the items (data-items selector), a .morebtn right after it reveals more; search shows everything
const limits=[];
$$('[data-limit]').forEach(box=>{
  const step=+box.dataset.limit||12;let shown=step;const sel=box.dataset.items||':scope > *';
  let host=box;while(host.parentElement&&host.parentElement.tagName!=='MAIN'&&!(host.nextElementSibling&&host.nextElementSibling.classList.contains('morebtn')))host=host.parentElement;
  const btn=host.nextElementSibling&&host.nextElementSibling.classList.contains('morebtn')?host.nextElementSibling:null;
  const refresh=()=>{const all=document.body.classList.contains('searching')&&!box.hasAttribute('data-limit-always');let n=0,rest=0;
    $$(sel,box).forEach(el=>{if(isHidden(el)){el.classList.remove('over-limit');return;}n++;const over=!all&&n>shown;el.classList.toggle('over-limit',over);if(over)rest++;});
    if(btn){btn.hidden=!rest;btn.textContent='더 보기 '+Math.min(rest,step)+'개 · 남은 '+rest+'개';}};
  if(btn)btn.addEventListener('click',()=>{shown+=step;refresh();});
  limits.push(refresh);refresh();
});
const refreshAll=()=>limits.forEach(f=>f());
const count=(root,sel,label)=>{const s=$('.shown',root);if(s)s.textContent=$$(sel,root).filter(el=>!isHidden(el)).length+label;};
// reference toolbar: role segment, pattern select, run select, sort, view
const gal=$('#gallery');
if(gal){
  const st={role:'',axis:'',run:'',sort:'default',view:'grid'};$$('.seg[data-k] button.on',gal).forEach(b=>{st[b.parentElement.dataset.k]=b.dataset.v||'';});
  const cards=$$('.card',gal);const orig=cards.slice();const box=$('.cards',gal);
  const match=el=>(!st.role||el.dataset.role===st.role)&&(!st.axis||(' '+el.dataset.axes+' ').includes(' '+st.axis+' '))&&(!st.run||(' '+(el.dataset.run||'')+' ').includes(' '+st.run+' '));
  const apply=()=>{
    cards.forEach(c=>c.classList.toggle('filtered',!match(c)));
    const sorted=st.sort==='name'?cards.slice().sort((a,b)=>a.dataset.name.localeCompare(b.dataset.name,'ko')):st.sort==='recent'?cards.slice().sort((a,b)=>(b.dataset.date||'').localeCompare(a.dataset.date||'')):orig;
    sorted.forEach(c=>box.appendChild(c));
    $('.gridview',gal).hidden=st.view!=='grid';$('.rowsview',gal).hidden=st.view!=='rows';$('.flows-view',gal).hidden=st.view!=='flow';
    $$('.rows .row, .flows-view .flow',gal).forEach(r=>r.classList.toggle('filtered',!match(r)));
    $$('.docs tbody tr').forEach(r=>r.classList.toggle('filtered',!match(r)));
    refreshAll();
    count(gal,'.card','개 표시');const ds=$('.docs');if(ds)count(ds,'tbody tr','개');
  };
  wire(gal,st,apply);window.refApply=apply;apply();
}
// library home: collection cards — domain chips, sort (recent / name / claims)
const hm=$('#cats .catcards');
if(hm){
  const st={topic:'',sort:'recent'};const root=$('#cats');const cards=$$('.catcard',hm);
  const apply=()=>{cards.forEach(c=>c.classList.toggle('filtered',!!(st.topic&&(st.topic==='__none'?c.dataset.topic!=='':c.dataset.topic!==st.topic))));
    const sorted=st.sort==='name'?cards.slice().sort((a,b)=>a.dataset.name.localeCompare(b.dataset.name,'ko')):st.sort==='claims'?cards.slice().sort((a,b)=>(+b.dataset.claims||0)-(+a.dataset.claims||0)):cards.slice().sort((a,b)=>(b.dataset.date||'').localeCompare(a.dataset.date||''));
    sorted.forEach(c=>hm.appendChild(c));refreshAll();count(root,'.catcard','개 조사');};
  wire(root,st,apply);apply();
}
// findings: run + confidence filters; empty kind groups fold away
const cl=$('#claims');
if(cl){
  const st={run:'',conf:'',kind:''};$$('.seg[data-k] button.on',cl).forEach(b=>{st[b.parentElement.dataset.k]=b.dataset.v||'';});
  const apply=()=>{$$('.claim',cl).forEach(c=>c.classList.toggle('filtered',!!(st.run&&c.dataset.run!==st.run)||!!(st.conf&&c.dataset.conf!==st.conf)||!!(st.kind&&c.dataset.kind!==st.kind)));
    $$('.kindgroup',cl).forEach(g=>g.classList.toggle('empty-group',!$$('.claim',g).some(c=>!isHidden(c))));
    count(cl,'.claim','개 표시');};
  wire(cl,st,apply);apply();
}
// sources: grade / type / cited-only
const so=$('#sources');
if(so){
  const st={grade:'',type:'',cited:true};
  const apply=()=>{$$('tbody tr',so).forEach(r=>r.classList.toggle('filtered',!!(st.grade&&r.dataset.grade!==st.grade)||!!(st.type&&r.dataset.type!==st.type)||(st.cited&&r.dataset.cited==='0')));refreshAll();count(so,'tbody tr','개');};
  wire(so,st,apply);apply();
}
// search: references, findings, patterns, topics
const qs=$$('input.q');
if(qs.length){
  const items=()=>$$('[data-search]');
  let q=qs[0];
  const vis=()=>qs.find(x=>x.offsetParent!==null)||qs[0];
  const run=()=>{qs.forEach(x=>{if(x!==q)x.value=q.value});const t=q.value.trim().toLowerCase();document.body.classList.toggle('searching',!!t);let n=0;
    items().forEach(el=>{const hit=!t||el.dataset.search.includes(t);el.classList.toggle('hidden-by-search',!hit);if(t&&hit)n++;});
    const info=$('.searchinfo');if(info)info.textContent=t?('"'+q.value+'" 검색 결과 '+n+'개 — Esc로 지우기'):'';
    const ask=$('#findings .askbtn');if(ask)ask.dataset.copy='reference-library에서 "'+q.value.trim()+'"에 대한 발견을 찾아 근거(S#)와 함께 정리해줘';
    // collapse groups that lost every match (no empty table shells), and say so per section
    const shown=el=>$$('[data-search]',el).some(x=>!x.classList.contains('hidden-by-search'));
    $$('.sgroup').forEach(g=>{const has=g.querySelector('[data-search]');g.classList.toggle('search-collapsed',!!t&&!!has&&!shown(g));});
    $$('main section').forEach(sec=>{const has=sec.querySelector('[data-search]');let m=sec.querySelector(':scope > .nomatch');const empty=!!t&&!!has&&!shown(sec);
      sec.classList.toggle('search-empty',empty);
      if(empty){if(!m){m=document.createElement('p');m.className='nomatch';sec.appendChild(m);}m.textContent='"'+q.value+'"와 일치하는 항목이 이 섹션에는 없습니다.';}else if(m)m.remove();});
    if(window.refApply)window.refApply();else refreshAll();};
  qs.forEach(x=>x.addEventListener('input',()=>{q=x;run();}));
  document.addEventListener('keydown',e=>{const act=qs.includes(document.activeElement);if(e.key==='/'&&!act&&!document.getElementById('viewer')?.classList.contains('open')){e.preventDefault();vis().focus();}else if(e.key==='Escape'&&act){q=document.activeElement;q.value='';run();q.blur();}});
}
// long finding text: 2 lines, then "더 보기"
document.addEventListener('click',e=>{const m=e.target.closest('.claim .more');if(!m)return;const b=m.previousElementSibling;const clamped=b.classList.toggle('clamp');m.textContent=clamped?'더 보기':'접기';});
// copy an id (S#/C#/R#) to hand it to Claude
const toast=document.createElement('div');toast.className='toast';document.body.appendChild(toast);let tt;
const say=msg=>{toast.textContent=msg;toast.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>toast.classList.remove('show'),2200);};
document.addEventListener('click',e=>{const b=e.target.closest('[data-copy]');if(!b)return;e.preventDefault();const v=b.dataset.copy;
  const isPrompt=b.classList.contains('pbtn');
  const done=()=>{say(isPrompt?'프롬프트 복사됨 — Claude Code 입력창에 붙여 넣으세요':v+' 복사됨 — Claude에게 "'+v+' 다시 확인해줘"처럼 붙여 쓸 수 있습니다');b.classList.add('done');
    if(isPrompt){if(!b.dataset.label)b.dataset.label=b.textContent;b.textContent='복사됨';}
    setTimeout(()=>{b.classList.remove('done');if(isPrompt&&b.dataset.label)b.textContent=b.dataset.label;},1600);};
  const fallback=()=>{const ta=document.createElement('textarea');ta.value=v;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(_){say('복사하지 못했습니다 — 직접 선택해 주세요');}ta.remove();};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(v).then(done,fallback);else fallback();});
// side nav follows the section in view; "맨 위로" after a screen of scrolling
const nav=$$('.side nav a[href^="#"]');
if(nav.length&&'IntersectionObserver' in window){
  const secs=nav.map(a=>document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  const io=new IntersectionObserver(es=>{es.forEach(en=>{if(en.isIntersecting)nav.forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+en.target.id));});},{rootMargin:'-18% 0px -72% 0px'});
  secs.forEach(s=>io.observe(s));
}

// board G: a conclusion row lights the captures it cites and switches the evidence-map detail; the map's nodes do the same
// narrow screens scroll diagrams inside their card: start at the centre, where the figure is
const centre=w=>{if(w&&w.scrollWidth>w.clientWidth)w.scrollLeft=(w.scrollWidth-w.clientWidth)/2;};
$$('#map .dgwrap, #axes .dgwrap').forEach(centre);
const grows=$('#key .grows');
if(grows){const cited=$('#cited'),note=$('#citednote');
  const light=row=>{const on=row&&row.dataset.cites?row.dataset.cites.split(' ').filter(Boolean):[];if(cited){cited.classList.toggle('focus',on.length>0);$$('[data-rail]',cited).forEach(b=>b.classList.toggle('lit',on.includes(b.dataset.rail)));}if(note)note.textContent=on.length?on.length+'개 · '+on.join(', '):'줄 선택 전';};
  const pick=k=>{const d=k==='question'?'answer':k;$$('#key .grow').forEach(r=>r.classList.toggle('sel',r.dataset.key===k));$$('.dgdet[data-for]').forEach(x=>{x.hidden=x.dataset.for!==d;if(!x.hidden)centre(x.querySelector('.dgwrap'));});$$('#ov .dn').forEach(g=>g.classList.toggle('sel',g.dataset.key===k));light($('#key .grow[data-key="'+k+'"]'));};
  grows.addEventListener('mouseover',e=>{const r=e.target.closest('.grow');if(r)light(r);});
  grows.addEventListener('mouseleave',()=>light($('#key .grow.sel')));
  grows.addEventListener('click',e=>{if(e.target.closest('a,button'))return;const r=e.target.closest('.grow');if(r)pick(r.dataset.key);});
  document.addEventListener('click',e=>{const g=e.target.closest('#ov .dn[data-key]');if(g&&$('.dgdet[data-for="'+(g.dataset.key==='question'?'answer':g.dataset.key)+'"]'))pick(g.dataset.key);});
  document.addEventListener('keydown',e=>{const t=e.target;if((e.key==='Enter'||e.key===' ')&&t.matches&&t.matches('#ov .dn[data-key], #key .grow')){e.preventDefault();pick(t.dataset.key);}});
  if($('#key .grow[data-key="answer"]'))pick('answer');
}
// captures step through their frames while hovered (never at rest, never under reduced motion)
if(!matchMedia('(prefers-reduced-motion: reduce)').matches)$$('.card .thumb').forEach(b=>{const alts=$$('img.alt',b);if(!alts.length)return;let t,k=-1;
  b.addEventListener('mouseenter',()=>{t=setInterval(()=>{alts.forEach(a=>a.classList.remove('on'));k=(k+1)%(alts.length+1);if(k<alts.length)alts[k].classList.add('on');},1100);});
  b.addEventListener('mouseleave',()=>{clearInterval(t);k=-1;alts.forEach(a=>a.classList.remove('on'));});});
// home: timeline crosshair with the runs of that week; collection rows light their edges in the shared-reference graph
const gt=$('#gtl');
if(gt){const wrap=gt.parentElement,tip=document.createElement('div');tip.className='gtip';tip.hidden=true;wrap.style.position='relative';wrap.appendChild(tip);
  const W=+gt.viewBox.baseVal.width,s=+gt.dataset.start,e=+gt.dataset.end,L0=+gt.dataset.l0,L1=+gt.dataset.l1,cross=gt.querySelector('.cross');const runs=JSON.parse(gt.dataset.runs||'[]');
  const x=d=>L0+(d-s)/(e-s)*(L1-L0);
  gt.addEventListener('mousemove',ev=>{const b=gt.getBoundingClientRect(),vx=(ev.clientX-b.left)/b.width*W;if(vx<L0){cross.setAttribute('visibility','hidden');tip.hidden=true;return;}
    const d=Math.round(s+(vx-L0)/(L1-L0)*(e-s)),hit=runs.filter(r=>r.d>=d-3&&r.d<=d+3);
    cross.setAttribute('x1',x(d));cross.setAttribute('x2',x(d));cross.setAttribute('visibility','visible');
    const iso=v=>new Date(v*864e5).toISOString().slice(5,10);
    tip.innerHTML='<b>'+iso(d-3)+' ~ '+iso(d+3)+'</b>'+(hit.length?hit.map(r=>r.t).join('<br>'):'회차 없음');
    tip.style.left=Math.min(Math.max(x(d)/W*b.width+wrap.scrollLeft,130),wrap.scrollWidth-130)+'px';tip.style.top='60px';tip.hidden=false;});
  gt.addEventListener('mouseleave',()=>{cross.setAttribute('visibility','hidden');tip.hidden=true;});
  if(wrap.scrollWidth>wrap.clientWidth+60)wrap.scrollLeft=wrap.scrollWidth; // phones: start at the recent end
}
const sh=$('#shg');
if(sh){const light=n=>{sh.classList.toggle('dim',!!n);$$('.e',sh).forEach(p=>p.classList.toggle('lit',p.dataset.from===n));$$('.dn',sh).forEach(g=>g.classList.toggle('sel',g.dataset.key===n));$$('#cats .catcard').forEach(li=>li.classList.toggle('hl',li.dataset.col===n));};
  document.addEventListener('mouseover',ev=>{const li=ev.target.closest('#cats .catcard,#shg .dn[data-col]');light(li?(li.dataset.col||null):null);});
  const w=sh.parentElement;if(w.scrollWidth>w.clientWidth)w.scrollLeft=(w.scrollWidth-w.clientWidth)/2;
}
const top=document.createElement('button');top.className='totop';top.textContent='↑';top.title='맨 위로';top.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));document.body.appendChild(top);
addEventListener('scroll',()=>top.classList.toggle('show',scrollY>700),{passive:true});
})();
`;

const VIEWER = `<div id="viewer" role="dialog" aria-modal="true" aria-label="캡처 보기">
<header><span class="t"></span><span class="modes"></span><a class="orig" target="_blank" rel="noopener">원본 사이트 ↗</a><button class="notesbtn" title="정보·노트 패널 (N)">정보</button><button class="pref" title="이전 레퍼런스 (Shift+←)">‹ 이전</button><button class="nref" title="다음 레퍼런스 (Shift+→)">다음 ›</button><button class="close" title="닫기 (Esc)">✕</button></header>
<div class="stage"></div><aside hidden><div class="facts"></div><div class="vtabs"><button data-t="notes" class="on">분석 노트</button><button data-t="claims">이 화면을 근거로 쓴 발견</button></div><div class="prose"></div><div class="vclaims" hidden></div></aside><div class="strip"></div></div>`;

const VIEWER_JS = `
(()=>{
const V=document.getElementById('viewer'),stage=V.querySelector('.stage'),strip=V.querySelector('.strip'),side=V.querySelector('aside');
const MODES={frames:'화면 단위',full:'전체 페이지',screens:'스크린샷'};
let cards=[],ci=0,data=null,mode='',idx=0,showNotes=true;
const has=c=>c&&c.dataset.viewer&&JSON.parse(c.dataset.viewer).preview;
const visible=()=>[...document.querySelectorAll('.card[data-viewer]')].filter(c=>!c.classList.contains('filtered')&&!c.classList.contains('hidden-by-search')&&has(c));
const list=()=>mode==='frames'?data.frames:mode==='screens'?data.screens:mode==='full'?data.full:[data.preview];
function sideWidth(){V.style.setProperty('--side',showNotes&&innerWidth>760?Math.min(400,innerWidth*.34)+'px':'0px');}
function open(card,m,i){cards=visible();if(!cards.includes(card))cards=[card];ci=Math.max(0,cards.indexOf(card));load(m,i);V.classList.add('open');document.body.classList.add('viewing');history.replaceState(null,'','#'+data.id);}
function load(m,i){
  const card=cards[ci];data=JSON.parse(card.dataset.viewer);
  const avail=Object.keys(MODES).filter(k=>data[k]&&data[k].length);
  mode=m&&avail.includes(m)?m:(avail[0]||'preview');idx=Math.max(0,Math.min(+(i||0),(list().length||1)-1));
  V.querySelector('.t').innerHTML=data.id+' · '+data.title.replace(/</g,'&lt;')+'<small>'+(data.date?'캡처 '+data.date:'')+'</small>';
  V.querySelector('.orig').href=data.url;
  V.querySelector('.modes').innerHTML=avail.length>1?avail.map(k=>'<button data-m="'+k+'"'+(k===mode?' class="on"':'')+'>'+MODES[k]+'</button>').join(' '):'';
  const facts=card.querySelector('template.facts-src'),notes=card.querySelector('template.notes-src'),cls=card.querySelector('template.claims-src');
  side.querySelector('.facts').innerHTML=facts?facts.innerHTML:'';
  side.querySelector('.prose').innerHTML=notes&&notes.innerHTML.trim()?notes.innerHTML:'<p style="color:var(--v-muted)">노트 없음</p>';
  side.querySelector('.vclaims').innerHTML=cls&&cls.innerHTML.trim()?cls.innerHTML:'<p style="color:var(--v-muted)">이 화면을 근거로 쓴 발견이 아직 없습니다</p>';
  const nc=+(card.dataset.claims||0);side.querySelector('[data-t=claims]').textContent='이 화면을 근거로 쓴 발견'+(nc?' '+nc:'');
  tab(side.dataset.tab||(notes&&notes.innerHTML.trim()?'notes':nc?'claims':'notes'));
  side.hidden=!showNotes;sideWidth();
  V.querySelector('.pref').disabled=ci===0;V.querySelector('.nref').disabled=ci===cards.length-1;
  render();
}
function render(){
  const L=list();
  if(mode==='full'){stage.className='stage scroll';stage.innerHTML=L.map(s=>'<img src="'+s+'" alt="">').join('');strip.innerHTML='';stage.scrollTop=0;return;}
  stage.className='stage fit';
  stage.innerHTML=(L.length>1?'<button class="nav prev" aria-label="이전 화면">‹</button>':'')+'<img src="'+L[idx]+'" alt="">'+(L.length>1?'<button class="nav next" aria-label="다음 화면">›</button><span class="count">'+(idx+1)+' / '+L.length+'</span>':'');
  strip.innerHTML=L.length>1?L.map((s,i)=>'<img loading="lazy" src="'+s+'" data-i="'+i+'"'+(i===idx?' class="on"':'')+'>').join(''):'';
  strip.querySelector('.on')?.scrollIntoView({block:'nearest',inline:'center'});
}
function toggleNotes(){showNotes=!showNotes;side.hidden=!showNotes;sideWidth();}
function tab(t){side.dataset.tab=t;side.querySelectorAll('.vtabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));side.querySelector('.prose').hidden=t!=='notes';side.querySelector('.vclaims').hidden=t!=='claims';}
function step(d){const L=list();if(mode==='full'||L.length<2)return;idx=(idx+d+L.length)%L.length;render();}
function ref(d){const n=ci+d;if(n<0||n>=cards.length)return;ci=n;load(mode);history.replaceState(null,'','#'+data.id);}
function close(){V.classList.remove('open');document.body.classList.remove('viewing');stage.innerHTML='';const id=data&&data.id;history.replaceState(null,'',location.pathname+location.search);if(id)document.getElementById(id)?.scrollIntoView({block:'center'});}
document.addEventListener('click',e=>{
  const pr=e.target.closest('[data-open-ref]');
  if(pr&&!V.contains(pr)){e.preventDefault();const c=document.getElementById(pr.dataset.openRef);if(has(c))open(c,pr.dataset.mode||'',pr.dataset.idx||0);else if(c)c.scrollIntoView({block:'center'});return;}
  const t=e.target.closest('[data-view]');
  if(t&&!V.contains(t)){e.preventDefault();open(t.closest('.card'),t.dataset.view||'');return;}
  if(!V.classList.contains('open'))return;
  if(e.target.closest('.close'))return close();
  if(e.target.closest('.pref'))return ref(-1);
  if(e.target.closest('.nref'))return ref(1);
  if(e.target.closest('.notesbtn'))return toggleNotes();
  const vt=e.target.closest('.vtabs button');if(vt)return tab(vt.dataset.t);
  const vc=e.target.closest('.vclaims a[href^="#"]');if(vc){e.preventDefault();const id=vc.getAttribute('href').slice(1);V.classList.remove('open');document.body.classList.remove('viewing');stage.innerHTML='';history.replaceState(null,'','#'+id);document.getElementById(id)?.scrollIntoView({block:'center'});return;}
  const mb=e.target.closest('.modes button');if(mb){mode=mb.dataset.m;idx=0;V.querySelectorAll('.modes button').forEach(b=>b.classList.toggle('on',b===mb));return render();}
  if(e.target.closest('.nav.prev'))return step(-1);
  if(e.target.closest('.nav.next'))return step(1);
  const si=e.target.closest('.strip img');if(si){idx=+si.dataset.i;return render();}
  if(e.target.tagName==='IMG'&&e.target.parentElement===stage&&mode!=='full'){stage.classList.toggle('zoom');stage.classList.toggle('fit');return;}
  if(e.target===stage)close();
});
document.addEventListener('keydown',e=>{
  if(!V.classList.contains('open'))return;
  if(e.key==='Escape')close();
  else if(e.key==='ArrowLeft')e.shiftKey?ref(-1):step(-1);
  else if(e.key==='ArrowRight')e.shiftKey?ref(1):step(1);
  else if(e.key==='n'||e.key==='N')toggleNotes();
  else return;e.preventDefault();
});
const h=location.hash.slice(1);const c=h&&document.getElementById(h);if(has(c)){document.documentElement.style.scrollBehavior='auto';c.scrollIntoView({block:'center'});open(c,'');document.documentElement.style.scrollBehavior='';}
})();
`;

function shell(title, side, topbar, body, viewer = true) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head>
<body><div class="frame"><aside class="side">${side}</aside><div><div class="topbar">${topbar}</div><main class="content"><div class="searchinfo"></div>${body}</main></div></div>${viewer ? VIEWER : ""}<script>${JS}${viewer ? VIEWER_JS : ""}</script></body></html>`;
}

const searchBox = (placeholder) => `<label class="search"><input class="q" type="search" placeholder="${esc(placeholder)}" autocomplete="off" aria-label="검색"><kbd>/</kbd></label>`;
const confBadge = (c) => `<span class="conf ${esc(c)}">근거 ${esc({ high: "강함", medium: "보통", low: "약함", hypothesis: "가설" }[c] ?? c)}</span>`;
const ROLE_KO = { direct: "직접 경쟁", indirect: "간접 경쟁", trend: "트렌드", analogous: "유사 분야" };
const KIND = { pattern: ["패턴", "여러 곳에서 반복되는 해법"], benchmark: ["기준치", "수치로 본 수준"], fact: ["사실", "확인된 정보"], gap: ["빈틈", "아무도(거의) 하지 않는 것"], failure: ["실패 사례", "불만·문제·피할 점"], opinion: ["의견", "평가·리뷰"], hypothesis: ["가설", "근거 없이 세운 추정"] };
const sectionHead = (n, title, desc, extra = "") => `<div class="sechead"><h2>${title}</h2>${extra}${desc ? `<p>${desc}</p>` : ""}</div>`;
const searchText = (...parts) => esc(parts.flat().filter(Boolean).join(" ").toLowerCase());
const DOMAIN_KO = { design: "디자인·기획", curriculum: "커리큘럼", dev: "개발", research: "연구", strategy: "전략·비즈니스", voice: "사용자 반응", travel: "여행·동선" };
const KIND_KO = { category: "카테고리 조사", service: "서비스 분석" };
const UNIT = { design: "제품", dev: "제품", curriculum: "강의", research: "출처", strategy: "출처", voice: "출처", travel: "출처" };
const TYPE_KO = { official: "공식", docs: "문서", store: "스토어", repo: "저장소", paper: "논문", report: "보고서", press: "언론", framework: "기준", survey: "설문", "job-posting": "채용 공고", community: "커뮤니티", blog: "블로그", listicle: "목록글", capture: "캡처", other: "기타" };
const short = (s, n) => ((s = String(s ?? "")), s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
/** copyable id chip — one click puts S#/C#/R# on the clipboard to hand to Claude */
const idText = (id) => ({ S: `자료 ${id}`, C: `발견 ${id}`, R: `${id.slice(1)}번째 조사` })[id[0]] ?? id;
const idBtn = (id, extra = "") => `<button class="idbtn" data-copy="${esc(id)}" title="클릭하면 ${esc(id)} 복사 — Claude에게 '${esc(id)} 다시 확인해줘'라고 말할 수 있습니다"${extra}>${esc(idText(id))}</button>`;
const CRED_KO = { A: "공식·1차 자료", B: "언론·조사 기관", C: "커뮤니티·블로그", D: "미확인" };
const credLabel = (g) => `${g} ${CRED_KO[g] ?? ""}`.trim();
const WHY_TITLE = { design: "기획 의도", dev: "설계 의도", curriculum: "교육 설계 의도", strategy: "전략적 의도", voice: "반응의 이유", travel: "구성 의도", research: "연구 배경" };
/** "text — 의도: why" → [text, why]: an open question or next step says what its answer changes */
const withIntent = (s) => {
  const m = String(s).match(/^(.*?)\s+[—-]\s*의도\s*[:：]\s*(.+)$/s);
  return m ? [m[1], m[2]] : [String(s), ""];
};
const intentList = (items, cite) => `<ul class="intents" data-limit="5" data-items="li">${items.map((q) => {
  const [t, why] = withIntent(q);
  return `<li>${inline(t, cite)}${why ? `<small>의도: ${inline(why, cite)}</small>` : ""}</li>`;
}).join("")}</ul>`;
/**
 * prompt action — a copy button (clipboard icon, "복사됨 ✓" feedback) and, with preview, a fold that shows the exact text
 * that will be pasted into Claude Code. Used for 이어서 하기 / 다시 확인 / 새 조사 시작 / 묻기.
 */
const promptAction = (label, text, { preview = false, big = false, hint = "" } = {}) =>
  `<span class="pact"><button class="pbtn${big ? " big" : ""}" type="button" data-copy="${esc(text)}" title="${esc(hint || "Claude Code에 붙여 넣을 프롬프트를 복사합니다")}">${esc(label)}</button>${
    preview ? `<details class="pprev"><summary>프롬프트 보기</summary><pre>${esc(text)}</pre><span class="muted small">복사한 뒤 Claude Code 입력창에 붙여 넣으세요. &lt;…&gt; 자리는 채웁니다.</span></details>` : ""
  }</span>`;
/** the most common source types among ids, "논문 3 · 공식 2" */
const typeMix = (ids, typeOf, k = 3) => {
  const cnt = {};
  for (const id of ids) {
    const t = typeOf(id);
    if (t) cnt[t] = (cnt[t] ?? 0) + 1;
  }
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, k).map(([t, n]) => `${TYPE_KO[t] ?? t} ${n}`).join(" · ");
};
/** finding → [title, body]: subject, else the clause before "—"/":", else a short cut of the text */
const splitTitle = (c) => {
  if (c.subject) return [c.subject, c.text];
  const t = String(c.text ?? "");
  const m = t.match(/^(.{4,48}?)\s*(?:—|–|:)\s+([\s\S]+)$/);
  if (m) return [m[1], m[2]];
  if (t.length <= 64) return [t, ""];
  const s = t.match(/^(.{10,90}?[다요음함됨임])\.\s+([\s\S]+)$/);
  if (s) return [s[1], s[2]];
  const cut = t.slice(0, 60);
  const i = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf(","));
  return [(i > 28 ? cut.slice(0, i) : cut).replace(/[,\s]+$/, "") + "…", t];
};
/**
 * SUMMARY.md section contract (docs/BOARD-REDESIGN.md E6): headings "## 목표 · 이번 실행에서 바뀐 것 · 핵심 발견 · 공통 vs 차별 · 추천 · 열린 질문"
 * + 왜 이렇게 만들었나 · 피할 것 · 조사 과정 (also "**제목**" / "**제목:** text" lines). Returns { goal, changed, key, why, common, avoid, recommend, open, process } → body markdown, unknown headings ignored.
 */
const SUMMARY_KEYS = [
  ["goal", /목표|목적|goal/i],
  ["changed", /바뀐|변경|changed/i],
  ["key", /핵심|주요 발견|key|takeaway/i],
  ["common", /공통|차별|common/i],
  ["recommend", /추천|다음 (할 일|단계)|권장|recommend|next/i],
  ["open", /열린|미해결|질문|open question/i],
  ["why", /왜 이렇게|^왜|의도|이유|배경|벤치마킹|rationale/i],
  ["avoid", /피할|avoid/i],
  ["process", /조사 과정|process/i],
];
export function splitSummary(src) {
  const out = {};
  let cur = null;
  for (const raw of String(src ?? "").replace(/\r/g, "").split("\n")) {
    const m = raw.match(/^#{1,4}\s+(.+?)\s*$/) ?? raw.match(/^\*\*([^*]{2,40})\*\*:?\s*(.*)$/);
    if (m) {
      const k = SUMMARY_KEYS.find(([, re]) => re.test(m[1]))?.[0] ?? null;
      cur = k;
      if (k && m[2]?.trim()) out[k] = [...(out[k] ?? []), m[2].trim()];
      continue;
    }
    if (cur) out[cur] = [...(out[cur] ?? []), raw];
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join("\n").trim()]));
}
/** every heading-delimited section of a summary, in order: [{ title|null, body }] (preamble first) */
const sectionsOf = (src) => {
  const out = [];
  let cur = { title: null, body: [] };
  const lines = String(src ?? "").replace(/\r/g, "").split("\n");
  const levels = lines.map((l) => l.match(/^(#{1,4})\s+\S/)?.[1].length).filter(Boolean);
  const count = (lv) => levels.filter((x) => x === lv).length;
  // the section level = the shallowest heading level that occurs ≥3 times (a lone "# 제목" is the document title), else the shallowest
  const top = levels.length ? ([1, 2, 3, 4].find((lv) => count(lv) >= 3) ?? Math.min(...levels)) : 0; // 0 → fall back to "**제목**" lines
  for (const raw of lines) {
    const m = top ? raw.match(new RegExp(`^#{${top}}\\s+(.+?)\\s*$`)) : raw.match(/^\*\*([^*]{2,40})\*\*:?\s*(.*)$/);
    if (m) {
      if (cur.title !== null || cur.body.join("").trim()) out.push(cur);
      cur = { title: m[1], body: m[2]?.trim() ? [m[2].trim()] : [] };
      continue;
    }
    cur.body.push(raw);
  }
  if (cur.title !== null || cur.body.join("").trim()) out.push(cur);
  return out.map((x) => ({ ...x, body: x.body.join("\n").trim() }));
};
const NOTE_FIELDS_KO = { feature: "기능", structure: "구조", copy: "카피/CTA", visual: "비주얼", ui: "UI 패턴", context: "맥락", why: "의도", alternatives: "대안", result: "결과", implication: "시사점", adopt: "차용할 점", avoid: "피할 점" };
export const WHY_BASIS_KO = { official: "공식", signal: "정황", guess: "추정" };
/** a note → html: structured fields as a definition list, else markdown with "**라벨**:" lines styled as labels */
const noteHtml = (x, cite) => {
  if (x.fields && Object.keys(x.fields).length) return `<dl class="nf">${Object.entries(x.fields).filter(([k]) => k !== "why_basis").map(([k, v]) => `<dt>${esc(NOTE_FIELDS_KO[k] ?? k)}</dt><dd>${k === "why" && WHY_BASIS_KO[x.fields.why_basis] ? `<b>${WHY_BASIS_KO[x.fields.why_basis]}</b> ` : ""}${inline(String(v), cite)}</dd>`).join("")}</dl>`;
  return md(x.text, cite).replace(/<strong>([^<]{1,20})<\/strong>\s*[:：]\s*/g, '<span class="nl">$1</span>');
};
export const WHY_RANK = { official: 0, signal: 1, guess: 2 };
const NOTE_PARTS = { 맥락: "context", 왜: "why", 대안: "alternatives", 결과: "result", 시사점: "implication" };
const BASIS_KEY = { 공식: "official", 정황: "signal", 추정: "guess" };
const basisChip = (b) => (WHY_BASIS_KO[b] ? `<span class="basis basis-${b}">${WHY_BASIS_KO[b]}</span>` : "");
/** a note's why-trace: from fields, or the **라벨**: lines of a markdown note */
export function rationaleOf(x) {
  const parts = { ...x.fields };
  if (!parts.why) for (const m of String(x.text ?? "").matchAll(/^\*\*(맥락|왜|대안|결과|시사점)\*\*\s*[:：]\s*(.+)$/gm)) parts[NOTE_PARTS[m[1]]] = m[2];
  if (!parts.why) return null;
  const lead = parts.why.match(/^(공식|정황|추정)\s*[—:-]\s*/);
  return { ...parts, why: lead ? parts.why.slice(lead[0].length) : parts.why, basis: parts.why_basis ?? BASIS_KEY[lead?.[1]] ?? null };
}
const CONCLUSION_LABELS = [["question", /질문/], ["answer", /^(답|결론)/], ["decision", /^(제안|추천|결정)/], ["counter", /반대/], ["evidence", /^근거/]];
/** labelled bullets of the summary's 핵심 결론 → { question, answer, decision, counter, evidence[] } */
function conclusionOf(block) {
  const out = { evidence: [] };
  for (const item of listItems(block)) {
    const m = item.replace(/\*\*/g, "").match(/^([^:：]{1,14})\s*[:：]\s*(.+)$/);
    const k = m && CONCLUSION_LABELS.find(([, re]) => re.test(m[1]))?.[0];
    if (k === "evidence") out.evidence.push(m[2]);
    else if (k) out[k] ??= m[2];
  }
  // "근거 2 — …": what the counter-evidence stands against
  const target = out.counter?.match(/^(답|제안|근거\s*\d+)\s*[—:-]\s*(.+)$/s);
  if (target) Object.assign(out, { counterOf: target[1].replace(/\s+/g, " "), counter: target[2] });
  return out;
}
/** What a board leads with, shared with the MCP server. Key claims: collection.highlights → claims marked key → summary list → strongest claims. */
export function conclusionData(col, claims, summary) {
  const active = claims.own.filter((c) => c.status === "active");
  const sum = splitSummary(summary);
  const claimById = new Map([...claims.own, ...claims.related].map((c) => [c.id, c]));
  const CONF_RANK = { high: 0, medium: 1, low: 2, hypothesis: 3 };
  const KIND_RANK = { pattern: 0, benchmark: 1, fact: 2, failure: 3, gap: 4, opinion: 5, hypothesis: 6 };
  let keyClaims = (col.highlights ?? []).map((id) => claimById.get(id)).filter((c) => c && c.status === "active");
  let keySource = keyClaims.length ? "highlights" : "";
  if (!keyClaims.length) {
    keyClaims = active.filter((c) => c.key);
    keySource = keyClaims.length ? "key" : "";
  }
  const keyLines = !keyClaims.length && sum.key ? listItems(sum.key).slice(0, 3) : [];
  if (!keyClaims.length && !keyLines.length) {
    keyClaims = active.slice().sort((a, b) => (CONF_RANK[a.confidence] ?? 9) - (CONF_RANK[b.confidence] ?? 9) || b.sources.length - a.sources.length || (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9)).slice(0, 3);
    keySource = keyClaims.length ? "auto" : "";
  }
  const openQ = col.openQuestions?.length ? col.openQuestions : sum.open ? listItems(sum.open) : [];
  const nextS = col.nextSteps?.length ? col.nextSteps : sum.recommend ? listItems(sum.recommend) : [];
  const concl = conclusionOf(sum.key);
  const answer = concl.answer ?? keyClaims[0]?.text ?? keyLines[0];
  const lineItem = (line) => ({ line, c: claimById.get(line.match(/\[(C\d+)/)?.[1]) });
  // an older summary has no labelled 답: its first key line becomes the answer, so it is not repeated as evidence
  const evItems = (concl.evidence.length ? concl.evidence.map(lineItem) : keyClaims.length ? keyClaims.map((c) => ({ c })) : keyLines.map(lineItem)).filter((x) => concl.answer || (x.line ?? x.c?.text) !== answer);
  return { sum, claimById, keyClaims, keySource, keyLines, openQ, nextS, concl, answer, evItems };
}
/** "- a" / "1. a" lines of a markdown block (one level), else non-empty lines */
const listItems = (block) => {
  const lines = String(block ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const li = lines.filter((l) => /^([-*]|\d+\.)\s+/.test(l)).map((l) => l.replace(/^([-*]|\d+\.)\s+/, ""));
  return li.length ? li : lines.filter((l) => !/^\|/.test(l));
};
/** first paragraph under "## 목표" / "**목표**" in the summary markdown */
const goalFromSummary = (s) => {
  const m = String(s ?? "").match(/(?:^|\n)(?:#{1,4}\s*목표\s*\n+|\*\*목표\*\*:?\s*)([^\n]+)/);
  return m ? m[1].replace(/\*\*/g, "").trim() : "";
};

// ---------- board G helpers ----------
const ICON = {
  strong: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10.5l4.2 4.2L17 4.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  medium: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10.5l4.2 4.2L12 9.4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15.5" cy="6.5" r="1.8" fill="currentColor"/></svg>',
  weak: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  contested: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 10h16M6 16l4-6 4 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  query: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.6 7.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6M10 14.6v.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  new: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5v15M2.5 10h15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  unread: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2.6"/></svg>',
};
/** a margin mark: shape + word, colour only reinforces */
const mark = (k, word, why = "") => `<span class="mark ${k}">${ICON[k]}<span>${esc(word)}${why ? ` <span class="why">${esc(why)}</span>` : ""}</span></span>`;
const STRENGTH_KO = { high: "강함", medium: "보통", low: "약함", hypothesis: "가설" };
const strengthMark = (c) => (!c ? "" : c.confidence === "high" ? mark("strong", "근거 강함") : c.confidence === "medium" ? mark("medium", "근거 보통") : c.confidence === "hypothesis" ? mark("query", "가설") : mark("weak", "근거 약함"));
const idsIn = (s) => [...String(s ?? "").matchAll(/\b([SC]\d+)\b/g)].map((m) => m[1]);
const kpiCard = (href, k, color, v, small, h, vals, gid) => `<a class="kpi" href="#${href}" style="--c:${color}"><span class="k"><i></i>${esc(k)}</span><span class="v">${v}<small>${esc(small)}</small></span><span class="h">${esc(h)}</span>${spark(vals.length > 1 ? vals : [vals[0] ?? 0, vals[0] ?? 0], color, gid)}</a>`;
const gpill = (cls, t) => `<span class="gpill ${cls}">${esc(t)}</span>`;
const LINE_COLORS = ["var(--accent)", "var(--green)", "var(--violet)", "var(--amber)", "var(--teal)"];

// ---------- collection board ----------

export function renderBoard(d) {
  const { col } = d;
  const memberIds = new Set(d.members.map((m) => m.r.id));
  const byRef = new Map(d.members.map((m) => [m.r.id, m]));
  const cite = (id) => `<a class="cite" href="${id.startsWith("C") ? `#${id}` : memberIds.has(id) ? `#${id}` : `#src-${id}`}" title="${esc(d.titleOf(id))}">${id}</a>`;
  const active = d.claims.own.filter((c) => c.status === "active");
  const shared = d.axes.rows.filter((r) => r.other.length).length;
  const axisLabel = (id) => d.axes.rows.find((r) => r.id === id)?.label ?? id;
  const lastRun = d.runs.at(-1);
  const BASIS = new Set(["framework", "survey", "job-posting", "report", "press", "blog"]);
  const isBasis = (p) => d.curriculum && p.members.every((m) => BASIS.has(m.r.type) && !m.r.course);
  const productCount = d.products.filter((p) => !isBasis(p)).length;
  const basisCount = d.products.length - productCount;
  const unit = d.curriculum ? "강의" : (UNIT[col.domain] ?? "제품");
  const srcById = new Map(d.sources.map((r) => [r.id, r]));
  const typeOf = (id) => (byRef.get(id)?.r ?? srcById.get(id))?.type;
  const captured = d.members.filter((m) => m.thumb).length;
  const conf = (c) => active.filter((x) => x.confidence === c).length;
  const citedBy = new Map();
  for (const c of [...d.claims.own, ...d.claims.related]) if (c.status === "active") for (const s of c.sources) citedBy.set(s, (citedBy.get(s) ?? 0) + 1);
  const runGoal = (id) => d.runs.find((r) => r.id === id)?.goal ?? "";
  // R# counts across the whole library; a reader wants "which run of this research"
  const runNo = new Map(d.runs.map((r, i) => [r.id, i + 1]));
  const runLabel = (id) => (runNo.has(id) ? `${runNo.get(id)}회차` : "다른 조사");
  // a claim's evidence: thumbnails of its sources
  const evidence = (ids) =>
    ids
      .map((id) => {
        const m = byRef.get(id);
        const label = esc(m ? `${m.r.product ?? ""}${m.r.page ? " · " + m.r.page : ""}` : d.titleOf(id));
        return m?.thumb ? `<button class="ev" data-open-ref="${id}" title="${label}"><img src="${esc(m.thumb)}" alt="">${id}</button>` : `<a class="ev noimg" href="${memberIds.has(id) ? `#${id}` : `#src-${id}`}" title="${label}">${id}</a>`;
      })
      .join("");
  // a finding reads top-down: title → text (2 lines, then 더 보기) → meta (strength · run · date · source mix · id) → evidence → earlier versions
  const otherCats = [...new Set(d.members.flatMap((m) => (m.r.categories ?? []).filter((c) => c !== col.name)))];
  const NUM = "\u0000num\u0000";
  const next = () => NUM;
  const reader = ["decision", "practitioner", "archive"].includes(col.reader) ? col.reader : "practitioner";

  const { sum, claimById, keyClaims, keySource, keyLines, openQ, nextS, concl, answer, evItems } = conclusionData(col, d.claims, d.summary);
  const plain = (md) => String(md).replace(/\*\*/g, "").replace(/\[([SC]\d+(?:\s*,\s*[SC]\d+)*)\]/g, "").replace(/\s+/g, " ").trim();
  const continuePrompt = `reference-research 스킬로 "${col.title ?? col.name}" 조사(컬렉션 ${col.name})를 이어서 해줘.${openQ.length ? ` 추가 질문 항목: ${openQ.map((q, i) => `${i + 1}) ${plain(q)}`).join(" ")}` : ""}${nextS.length ? ` 다음 할 일: ${nextS.map((q, i) => `${i + 1}) ${plain(q)}`).join(" ")}` : ""}`;
  const evShown = evItems.slice(0, 3);
  const openSection =
    openQ.length || nextS.length
      ? `<section id="open">${sectionHead(next(), "미해결 질문 · 다음 단계", "답에 따라 결론이나 제안이 달라질 수 있는 질문과 이어서 할 일입니다. 항목 아래 의도는 왜 확인해야 하는지를 적은 것입니다. 버튼을 누르면 이어서 조사할 프롬프트가 복사됩니다.")}<div class="panel openq">${openQ.length ? `<h4>추가 질문 항목</h4>${intentList(openQ, cite)}${openQ.length > 5 ? `<button class="morebtn small" type="button" hidden></button>` : ""}` : ""}${nextS.length ? `<h4${openQ.length ? ' style="margin-top:14px"' : ""}>다음 할 일 · 추천</h4>${intentList(nextS, cite)}${nextS.length > 5 ? `<button class="morebtn small" type="button" hidden></button>` : ""}` : ""}${
          !openQ.length && !nextS.length ? `<p class="muted small">요약에 <code>## 추가 질문 항목</code> · <code>## 추천</code> 절을 쓰거나 <code>ref report</code>에 <code>open_questions</code> · <code>next_steps</code>를 넘기면 여기에 표시됩니다.</p>` : ""
        }${promptAction("이 조사 이어서 하기", continuePrompt, { preview: true, big: true, hint: "추가 질문 항목과 다음 할 일을 담은 프롬프트를 복사합니다" })}</div></section>`
      : "";
  const avoidSection = sum.avoid ? `<section id="avoid">${sectionHead(next(), "회피 조합", "맥락과 함께 적은, 따라 하면 안 되는 조합.")}<div class="panel prose">${md(sum.avoid, cite)}</div></section>` : "";

  const whyTitle = col.whyTitle || (WHY_TITLE[col.domain] ?? WHY_TITLE.design);
  // why-traces: one per reference, the best-evidenced first; they also feed the viewer and the pattern cards
  const traces = d.members
    .map((m) => ({ m, w: (m.r.notes ?? []).filter((x) => !x.collection || x.collection === col.name).map(rationaleOf).find(Boolean) }))
    .filter((x) => x.w)
    .sort((a, b) => (WHY_RANK[a.w.basis] ?? 3) - (WHY_RANK[b.w.basis] ?? 3) || (citedBy.get(b.m.r.id) ?? 0) - (citedBy.get(a.m.r.id) ?? 0));
  const traceById = new Map(traces.map((x) => [x.m.r.id, x.w]));
  const axisWhy = new Map();
  for (const { m, w } of traces) for (const a of m.axes) if (!axisWhy.has(a)) axisWhy.set(a, w);
  const whyCard = ({ m, w }) => `<article class="whycard${m.thumb ? "" : " noimg"}">${m.thumb ? `<button class="thumb" data-open-ref="${m.r.id}" title="${esc(m.r.label ?? m.r.id)} 크게 보기"><img loading="lazy" src="${esc(m.thumb)}" alt=""></button>` : ""}<div><h4>${esc(m.r.product ?? m.r.label ?? m.r.id)}${basisChip(w.basis)}</h4><p>${inline(w.why, cite)}</p>${w.result ? `<p><b>결과</b>${inline(w.result, cite)}</p>` : ""}${w.implication ? `<p><b>시사점</b>${inline(w.implication, cite)}</p>` : ""}</div></article>`;
  const whySection =
    traces.length || sum.why
      ? `<section id="why">${sectionHead(next(), whyTitle, "왜 이렇게 만들었는지 근거로 따라간 기록입니다. 공식은 회사가 직접 밝힌 것, 정황은 여러 단서로 본 것, 추정은 가설입니다.")}${traces.length ? `<div class="whycards">${traces.slice(0, 5).map(whyCard).join("")}</div>` : `<div class="panel prose">${md(sum.why, cite)}</div>`}</section>`
      : "";

  const topbar = `<a class="brand" href="../index.html">References</a>${searchBox("검색")}`;

  // why this research exists — collection goal, else the last run's goal, else the summary's 목표 line
  const goal = col.goal ?? col.question ?? lastRun?.goal ?? goalFromSummary(d.summary);
  const goalBlock = goal
    ? `<div class="goal"><span class="lbl">목적</span><p>${inline(goal, cite)}</p>${col.audience ? `<p class="aud">대상: ${esc(col.audience)}</p>` : ""}${otherCats.length ? `<p class="aud">같은 레퍼런스를 쓰는 다른 조사: ${otherCats.map((c) => `<a href="../${esc(c)}/index.html" style="color:#fff;text-decoration:underline">${esc(d.catTitle(c))}</a>`).join(", ")}</p>` : ""}</div>`
    : "";
  const unitSub = SOURCE_LED.includes(col.domain) ? `${unit} · ${typeMix(d.members.map((m) => m.r.id), typeOf, 2)}` : `${unit}${basisCount ? ` · 근거 자료 ${basisCount}` : ""}`;
  const tiles = `<div class="tiles">
<div><b>${productCount}</b><span>${esc(unitSub)}</span></div>
<div><b>${d.members.length}</b><span>레퍼런스 · 캡처 ${captured} · 글 자료 ${d.members.length - captured}</span></div>
<div><b>${active.length}</b><span>발견 · 강함 ${conf("high")} · 보통 ${conf("medium")} · 약함 ${conf("low")}</span><em class="mbar"><i class="h" style="flex:${conf("high")}"></i><i class="m" style="flex:${conf("medium")}"></i><i class="l" style="flex:${conf("low")}"></i></em></div>
<div><b>${d.axes.rows.length}</b><span>패턴${shared ? ` · 다른 조사와 공유 ${shared}` : ""}</span></div>
<div><b>${d.runs.length}</b><span>조사 회차${lastRun ? ` · 마지막 ${esc(lastRun.startedAt.slice(0, 10))}` : ""}</span></div>
</div>`;
  const question = concl.question ?? col.question ?? goal;
  const decision = concl.decision ?? null;
  const meta = `${productCount}개 ${esc(unit)} · 레퍼런스 ${d.members.length}개 · 발견 ${active.length}개 · ${d.runs.length}회차`;
  // ---- board G head: crumb, title, goal, format; KPI cards; conclusion galley with margin marks; evidence map ----
  const R = d.refById ?? new Map([...d.sources, ...d.members.map((m) => m.r)].map((r) => [r.id, r]));
  const claimsIn = (t) => idsIn(t).filter((x) => x.startsWith("C")).map((x) => claimById.get(x)).filter(Boolean);
  const refsFor = (cs, extra = []) => [...new Set([...extra, ...cs.flatMap((c) => c.sources)])];
  const readMark = (c) => (!c ? "" : readState(c, R) === "unknown" ? mark("unread", "열람 미기록") : readState(c, R) === "snippet" ? mark("unread", "요약만 읽음") : "");
  const evC = evShown.map((x) => x.c ?? claimsIn(x.line)[0] ?? null);
  const ansClaims = claimsIn(answer).length ? claimsIn(answer) : keyClaims.slice(0, 2);
  // counter-evidence: a claim's `against` sources (v3) first, else the summary's labelled 반대 근거 line
  const v3i = evC.findIndex((c) => c?.against?.length);
  const counter = v3i >= 0
    ? { of: v3i, text: `반대 출처 ${evC[v3i].against.map((id) => R.get(id)?.product ?? R.get(id)?.label ?? id).join(", ")}`, ids: evC[v3i].against, claims: [], refs: evC[v3i].against, v3: true }
    : concl.counter
      ? { of: Number(concl.counterOf?.match(/근거\s*(\d+)/)?.[1] ?? 0) - 1, text: plain(concl.counter), ids: idsIn(concl.counter), claims: claimsIn(concl.counter) }
      : null;
  const counterCount = active.filter((c) => c.against?.length).length + (counter && !counter.v3 ? 1 : 0);
  const rowsG = [];
  const grow = (key, lab, body, mg, cites, cls = "") => rowsG.push(`<div class="grow ${cls}" data-key="${key}" data-cites="${esc(cites.join(" "))}" tabindex="0"><div class="lab">${lab}</div><div>${body}</div><div class="mg">${mg}</div></div>`);
  if (answer) {
    if (question) grow("question", "질문", `<p>${inline(question, cite)}</p>`, lastRun ? mark("new", `${runLabel(lastRun.id)}`, lastRun.startedAt.slice(0, 10)) : "", []);
    grow("answer", "답", `<p class="ans">${inline(answer, cite)}</p>`, [counter && counter.of >= 0 ? mark("contested", "반대 근거", `근거 ${counter.of + 1}`) : "", ansClaims[0] ? strengthMark(ansClaims[0]) : "", readMark(ansClaims[0])].join(""), refsFor(ansClaims));
    if (decision) grow("decision", "제안", `<p>${inline(decision, cite)}</p>`, strengthMark(claimsIn(decision)[0]), refsFor(claimsIn(decision)));
    evShown.forEach((x, i) => grow(`e${i}`, i ? "" : "근거", `<p>${i + 1}. ${x.line ? inline(x.line, cite) : esc(splitTitle(x.c)[0])}</p>`, [strengthMark(evC[i]), counter?.of === i ? mark("contested", "반대 근거") : "", readMark(evC[i])].join(""), refsFor(evC[i] ? [evC[i]] : [], idsIn(x.line).filter((y) => y.startsWith("S")))));
    if (counter) grow("counter", "반대 근거", `<p>${counter.of >= 0 ? `<b>근거 ${counter.of + 1}</b> · ` : ""}${counter.v3 ? `${esc(counter.text)} ${counter.ids.map(cite).join("")}` : inline(concl.counter, cite)}</p>`, mark("contested", counter.of >= 0 ? `근거 ${counter.of + 1} 반박` : "반박"), refsFor(counter.claims ?? [], counter.ids.filter((y) => y.startsWith("S"))), "counter");
  }
  const citedIds = [...new Set(rowsG.flatMap((h) => (h.match(/data-cites="([^"]*)"/)?.[1] ?? "").split(" ").filter(Boolean)))].filter((id) => byRef.get(id)?.thumb).slice(0, 10);
  const citedPanel = citedIds.length ? `<aside class="cited" id="cited"><h3>인용 캡처</h3><p id="citednote">줄 선택 전</p><div class="cg">${citedIds.map((id) => `<button type="button" data-open-ref="${id}" data-rail="${id}"><img loading="lazy" src="${esc(byRef.get(id).thumb)}" alt=""><span>${id} ${esc(short(byRef.get(id).r.product ?? byRef.get(id).r.label ?? "", 14))}</span></button>`).join("")}</div></aside>` : "";
  const refOf = (id) => {
    const m = byRef.get(id), r = m?.r ?? R.get(id);
    return { tag: m?.role ? ({ direct: "직접", indirect: "간접", trend: "트렌드", analogous: "유사" }[m.role] ?? "자료") : (TYPE_KO[r?.type] ?? "자료"), name: r?.product ?? r?.label ?? id, frames: m?.frames.length ?? 0, view: !!m?.thumb };
  };
  const dc = (c) => ({ id: c.id, subject: c.subject ?? splitTitle(c)[0], kindKo: KIND[c.kind]?.[0] ?? c.kind, strength: STRENGTH_KO[c.confidence] ?? "기록", sources: c.sources ?? [] });
  const nodesFor = { answer: ["답", plain(answer ?? ""), ansClaims], decision: ["제안", plain(decision ?? ""), claimsIn(decision)], ...Object.fromEntries(evShown.map((x, i) => [`e${i}`, [`근거 ${i + 1}`, plain(x.line ?? x.c?.text ?? ""), evC[i] ? [evC[i]] : []]])), ...(counter ? { counter: ["반대 근거", counter.text, counter.claims, counter.refs ?? []] } : {}) };
  const mapSection = answer && evShown.length
    ? `<section id="map">${sectionHead(next(), "근거 노선", "개요의 노드나 위 핵심 결론의 줄을 고르면 아래 상세가 그 노드의 발견과 자료로 바뀜. 빨간 점선 하나가 반대 근거. 자료 노드를 누르면 캡처가 열림.")}
<div class="dgwrap">${dgOverview("ov", { question, answer: { text: plain(answer), ids: ansClaims.map((c) => c.id) }, evidence: evShown.map((x, i) => ({ strength: STRENGTH_KO[evC[i]?.confidence] ?? "기록", ids: evC[i] ? [evC[i].id, ...evC[i].sources.slice(0, 2)] : idsIn(x.line) })), counter: counter && counter.of >= 0 ? { of: counter.of, text: counter.text, ids: counter.ids.slice(0, 3) } : null, selected: "answer" })}</div>
${Object.entries(nodesFor).map(([k, [label, text, cs, rs = []]]) => `<div class="dgdet" data-for="${k}"${k === "answer" ? "" : " hidden"}><h3>${esc(label)} 상세</h3>${cs.length || rs.length ? `<div class="dgwrap">${dgDetail(`dt-${k}`, { label, text, claims: cs.map(dc), refs: rs, refOf })}</div>` : `<p class="muted small">이 줄에 연결된 발견 번호(C#)가 없음 — 요약의 줄 끝에 [C#]를 달면 여기에 그려짐.</p>`}</div>`).join("")}</section>`
    : "";
  const unread = active.filter((c) => readState(c, R) === "unknown").length;
  const ghead = `<div class="ghead"><div><p class="crumb"><a href="../index.html">라이브러리</a> / <b>${esc(col.title ?? col.name)}</b></p><h1>${esc(col.title ?? col.name)}</h1>${goal ? `<p class="sub">${inline(goal, cite)}</p>` : ""}<p class="gmeta">조사 형식 ${esc(DOMAIN_KO[col.domain] ?? col.domain)} · ${esc(KIND_KO[col.kind] ?? col.kind ?? "조사")} · ${meta}${lastRun ? ` · 마지막 조사 ${esc(lastRun.startedAt.slice(0, 10))}` : ""}${otherCats.length ? ` · 공유 조사 ${otherCats.length}` : ""}</p></div><div class="tools">${promptAction("이어서 조사", continuePrompt, { hint: "추가 질문 항목과 다음 할 일을 담은 프롬프트를 복사합니다" }).replace('class="pbtn', 'class="pbtn go')}</div></div>`;
  const kpis = `<div class="kpis">${kpiCard("refs", "레퍼런스", "var(--green)", d.members.length, `캡처 ${captured} · 글 ${d.members.length - captured}`, "레퍼런스별 인용 발견", d.members.map((m) => citedBy.get(m.r.id) ?? 0).sort((a, b) => b - a), "gk1")}${kpiCard("claims", "강한 근거", "var(--accent)", conf("high"), `/ ${active.length}`, unread ? `열람 미기록 ${unread}` : "발견별 근거 세기", active.map((c) => ({ high: 2, medium: 1 })[c.confidence] ?? 0), "gk2")}${kpiCard("key", "반대 근거", "var(--coral)", counterCount, counter?.of >= 0 ? `근거 ${counter.of + 1}` : "없음", "근거별 반대 근거", evShown.map((_, i) => (counter?.of === i ? 1 : 0)), "gk3")}${kpiCard(openQ.length ? "open" : "changes", "미해결 질문", "#ffd75e", openQ.length, openQ.length ? "답 없음" : "없음", "회차별 신규 발견", d.runs.map((r) => r.counts.created), "gk4")}</div>`;
  const hero = answer
    ? `${ghead}${kpis}<section id="key">${sectionHead(next(), "핵심 결론", "줄을 고르면 인용 캡처가 오른쪽에서, 연결 구조가 아래 근거 노선에서 함께 바뀜. 여백 표시는 근거 세기·반대 근거·열람 기록.")}<div class="galley"><div class="grows">${rowsG.join("")}</div>${citedPanel}</div></section>${mapSection}`
    : `${ghead}${kpis}${goalBlock ? `<section id="key">${sectionHead(next(), "조사 목적", "")}${goalBlock}</section>` : ""}`;

  // long summaries fold: every heading becomes a section, the first two stay open, a mini TOC jumps and opens
  const secs = sectionsOf(d.summary);
  const titled = secs.filter((x) => x.title !== null);
  const summaryBody = !d.summary
    ? `<p class="muted">요약이 아직 없습니다 — <code>ref report</code>에 <code>summary_file</code>을 넘기면 여기에 표시됩니다.</p>`
    : titled.length < 3 || d.summary.length < 2500
      ? `<div class="panel prose">${md(d.summary, cite)}</div>`
      : `<div class="sumtoc">${titled.map((x, i) => `<a href="#sum-${i}">${esc(x.title)}</a>`).join("")}</div>
<div class="panel prose sumsecs">${secs
          .map((x, i) => {
            if (x.title === null) return md(x.body, cite);
            const n = titled.indexOf(x);
            return `<details class="sumsec" id="sum-${n}"${reader === "archive" || (reader === "practitioner" && n < 2) ? " open" : ""}><summary>${inline(x.title, cite)}<span class="muted small">${x.body.length > 0 ? ` · ${Math.max(1, Math.round(x.body.length / 350))}분` : ""}</span></summary><div class="sumbody">${md(x.body, cite)}</div></details>`;
          })
          .join("")}</div>`;
  const summary = `<section id="summary">${sectionHead(next(), "요약 전문", `조사 결과 전문. 문장 끝의 번호(C·S)를 누르면 해당 발견이나 레퍼런스로 이동합니다.${titled.length >= 3 && d.summary.length >= 2500 ? " 긴 요약은 절마다 접혀 있고, 제목을 누르면 펼쳐집니다." : ""}`)}${summaryBody}${d.citeWarn ? `<div class="note">${esc(d.citeWarn)}</div>` : ""}</section>`;

  const curriculum = d.curriculum ? renderCurriculum(d.curriculum, cite, next()) : "";

  // patterns
  const n = d.axes.products.length;
  const common = (r) => r.products.length >= Math.max(2, Math.ceil(n * 0.3));
  const compact = SOURCE_LED.includes(col.domain); // research boards: sources as grade chips, not thumbnail rows
  const axCard = (r) => `<article class="axcard" id="axis-${esc(r.id)}" data-search="${searchText(r.label, r.question, r.verdict, r.products, Object.values(r.how))}">
  <header><strong>${esc(r.label)}</strong><span class="count"><b>${r.products.length}</b> / ${n} ${esc(unit)}</span></header>
  ${r.question ? `<p class="q">${esc(r.question)}</p>` : ""}
  ${r.verdict ? `<p class="verdict">${inline(r.verdict, cite)}</p>` : ""}
  ${axisWhy.has(r.id) ? `<p class="axwhy">${basisChip(axisWhy.get(r.id).basis)}의도: ${inline(short(axisWhy.get(r.id).why, 90), cite)}</p>` : ""}
  ${
    compact
      ? `<div class="schips">${r.products.map((p) => { const m = byRef.get(r.refBy[p]); const g = m?.r.credibility ?? ""; return `<a class="schip g-${esc(g)}" href="#${esc(r.refBy[p])}" title="${esc(p)} — ${esc(r.how[p].join(" · "))} · 출처 등급 ${esc(credLabel(g))}"><b>${esc(g)}</b>${esc(short(p, 18))}</a>`; }).join("")}</div>`
      : `<ul class="how" data-limit="6" data-items="li">${r.products.map((p) => { const th = byRef.get(r.refBy[p])?.thumb; return `<li><button class="prod" data-open-ref="${esc(r.refBy[p])}" title="${esc(p)} 캡처 보기">${th ? `<span class="mini"><img loading="lazy" src="${esc(th)}" alt=""></span>` : `<span class="mini"></span>`}<span class="pn">${esc(p)}</span></button><span>${r.how[p].map(esc).join(" · ")}</span></li>`; }).join("")}</ul>${r.products.length > 6 ? `<button class="morebtn small" type="button" hidden></button>` : ""}`
  }
  ${r.other.length ? `<p class="also">${r.other.map((o) => `<a href="../${esc(o.name)}/index.html#axis-${esc(r.id)}">${esc(o.title)}</a> 조사에서도 같은 패턴 — ${o.products.map(esc).join(", ")}`).join("<br>")}</p>` : ""}
</article>`;
  const groups = [
    ["공통 패턴", "여러 제품이 갖춘 것 — 따라가야 할 기본기", d.axes.rows.filter(common), "g-common"],
    ["일부 제품의 패턴", "두 곳 이상이 쓰지만 보편적이지 않음 — 선택지", d.axes.rows.filter((r) => !common(r) && r.products.length > 1), "g-partial"],
    ["한 제품만의 패턴", "한 곳만 하는 것 — 차별점 후보이거나 아직 검증되지 않은 시도", d.axes.rows.filter((r) => r.products.length === 1), "g-unique"],
  ].filter(([, , rows]) => rows.length);
  // pattern lines: one line per question (top 5 axes), a stop per product (≤8), filled where it uses that solution
  const plP = d.axes.products.slice(0, 8), plR = d.axes.rows.slice(0, 5);
  const plines = plP.length >= 2 && plR.length
    ? (() => {
        const W = 1000, rowH = 84, top = 34, H = top + plR.length * rowH, x = (i) => 130 + i * ((W - 190) / Math.max(plP.length - 1, 1));
        let g = `<div class="dgwrap plines"><svg viewBox="0 0 ${W} ${H}" width="${W}" style="min-width:${Math.min(W, 760)}px;max-width:100%;height:auto" role="img" aria-label="패턴 노선: 질문마다 제품 ${plP.length}곳 중 그 해법을 쓰는 곳">`;
        plP.forEach((p, i) => { g += `<text x="${x(i)}" y="16" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text)">${esc(short(p, 10))}</text>`; });
        plR.forEach((r, k) => {
          const y = top + k * rowH + 32, c = LINE_COLORS[k % LINE_COLORS.length];
          g += `<text x="0" y="${y - 20}" font-size="13.5" font-weight="700" fill="var(--text)">${esc(short(r.question ?? r.label, 34))}</text><line class="pl" style="--c:${c}" x1="${x(0)}" x2="${x(plP.length - 1)}" y1="${y}" y2="${y}" stroke="${c}" stroke-opacity=".55"/>`;
          plP.forEach((p, i) => { const on = r.products.includes(p); g += `<circle class="stop"${on ? ` data-open-ref="${esc(r.refBy[p])}"` : ""} cx="${x(i)}" cy="${y}" r="${on ? 11 : 8}" fill="${on ? c : "var(--paper)"}" stroke="${on ? c : "var(--line2)"}" stroke-width="4"${on ? ` style="filter:drop-shadow(0 0 6px ${c})"` : ""}><title>${esc(p)} · ${esc(r.label)}: ${esc(on ? r.how[p].join(" · ") : "미사용")}</title></circle>`; });
          g += `<text x="${W}" y="${y + 5}" text-anchor="end" font-size="13" fill="var(--muted)">${r.products.length}/${n}</text>`;
        });
        return g + "</svg></div>";
      })()
    : "";
  const axes = d.axes.rows.length
    ? `<section id="axes">${sectionHead(
        next(),
        "패턴 비교",
        "여러 제품이 <strong>같은 문제</strong>를 각자 어떻게 풀었는지 묶어 봅니다. 제품 이름을 누르면 그 화면이 열립니다. <span style='color:var(--accent);font-weight:600'>파란 상자</span>는 다른 조사에서도 같은 패턴이 나왔다는 뜻이고, 카드 위 선 색은 <span style='color:var(--green);font-weight:600'>공통</span> · <span style='color:var(--accent);font-weight:600'>일부</span> · <span style='color:var(--amber);font-weight:600'>한 제품만</span>을 나타냅니다.",
      )}${plines}${groups.map(([t, sub, rows, g]) => `<div class="sgroup ${g}"><div class="groupcap"><i class="gdot"></i><h3>${t}</h3><span>${sub} · ${rows.length}개</span></div><div class="axcards">${rows.map(axCard).join("")}</div></div>`).join("")}${
        d.axes.facets.length ? `<div class="groupcap"><h3>시장 · 플랫폼 · 포지셔닝</h3><span>패턴이 아니라 제품의 속성</span></div><div class="panel"><ul style="margin:0;padding-left:20px">${d.axes.facets.map((f) => `<li><strong>${esc(f.label)}</strong> — ${f.products.map(esc).join(", ")}</li>`).join("")}</ul></div>` : ""
      }${d.axes.unmapped ? `<div class="note">아직 패턴으로 묶이지 않은 태그 ${d.axes.unmapped}개 — <code>ref axes suggest ${esc(col.name)}</code></div>` : ""}</section>`
    : "";

  // references
  const card = (m) => {
    const r = m.r;
    const other = (r.categories ?? []).filter((c) => c !== col.name);
    const notes = (r.notes ?? []).filter((x) => x.text?.trim());
    const snap = r.snapshots?.at(-1);
    const pics = m.frames.length || m.screens.length;
    const viewer = { id: r.id, title: `${r.product ?? ""}${r.page ? " — " + r.page : ""}` || r.label || r.id, url: r.url, preview: m.thumb, frames: m.frames, full: m.fullParts, screens: m.screens, date: snap?.at?.slice(0, 10) ?? "" };
    const facts = `<div><strong>${esc(r.product ?? "")}</strong>${r.page ? ` · ${esc(r.page)}` : ""}</div>
<div>${m.role ? `${ROLE_KO[m.role] ?? m.role} · ` : ""}출처 등급 ${esc(credLabel(r.credibility))} · ${esc(TYPE_KO[r.type] ?? r.type)}${r.publisher ? ` · ${esc(r.publisher)}` : ""}</div>
${snap ? `<div>캡처 ${r.snapshots.length}회 · 최신 ${esc(snap.at.slice(0, 10))}${r.changes?.length ? ` · 변화 기록 ${r.changes.length}` : ""}</div>` : ""}
${other.length ? `<div>다른 조사에도 포함: ${other.map((c) => `<a href="../${esc(c)}/index.html#${r.id}">${esc(d.catTitle(c))}</a>`).join(", ")}</div>` : ""}
<div style="margin-top:8px">${[...(r.screens ?? []), ...m.axes.map(axisLabel)].map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
${r.changes?.length ? `<div style="margin-top:8px">${r.changes.map((c) => `${esc(c.at.slice(0, 10))}: ${esc(c.lines.join(" · ") || "변화 없음")}`).join("<br>")}</div>` : ""}${traceById.has(r.id) ? `<div class="vwhy"><h5>${esc(whyTitle)}</h5>${basisChip(traceById.get(r.id).basis)}<p>${inline(traceById.get(r.id).why, cite)}</p>${traceById.get(r.id).result ? `<p><b>결과</b>${inline(traceById.get(r.id).result, cite)}</p>` : ""}${traceById.get(r.id).implication ? `<p><b>시사점</b>${inline(traceById.get(r.id).implication, cite)}</p>` : ""}</div>` : ""}`;
    const notesHtml = notes.map((x) => `${x.collection && x.collection !== col.name ? `<p style="color:var(--amber);font-size:12px;margin:12px 0 0">‹${esc(d.catTitle(x.collection))}› 조사에서 쓴 노트</p>` : ""}${noteHtml(x, cite)}`).join("<hr>");
    return `<article class="card" id="${r.id}" data-role="${esc(m.role ?? "")}" data-axes="${esc(m.axes.join(" "))}" data-run="${esc(m.run ?? "")}" data-name="${esc(r.product ?? r.label ?? r.id)}" data-date="${esc(snap?.at ?? "")}" data-claims="${citedBy.get(r.id) ?? 0}" data-viewer="${esc(JSON.stringify(viewer))}" data-search="${searchText(r.id, r.product, r.page, r.label, r.title, r.tags, m.axes.map(axisLabel), notes.map((x) => x.text))}">
  <button class="thumb" data-view="" title="크게 보기"><img loading="lazy" src="${esc(m.thumb)}" alt="${esc(r.label ?? r.id)}">${m.frames.slice(0, 3).map((f) => `<img class="alt" loading="lazy" src="${esc(f)}" alt="">`).join("")}${pics ? `<span class="count">${m.frames.length ? `${m.frames.length}화면` : `${m.screens.length}장`}</span>` : ""}<span class="go" aria-hidden="true">↗</span></button>
  <div class="cap"><div class="t"><div class="p">${esc(r.product ?? r.label ?? r.id)}</div><div class="s">${esc(r.page ?? r.title ?? "")}</div></div><div class="r">${m.role ? `<span class="role r-${esc(m.role)}">${ROLE_KO[m.role] ?? esc(m.role)}</span><br>` : ""}${other.length ? `다른 조사 ${other.length} · ` : ""}${idBtn(r.id)}</div></div>
  <template class="facts-src">${facts}</template><template class="notes-src">${notesHtml}</template><template class="claims-src">${citing(r.id)}</template>
</article>`;
  };
  // claims that cite a reference — the viewer's 발견 tab
  const citing = (id) => {
    const list = [...d.claims.own, ...d.claims.related].filter((c) => c.status === "active" && c.sources.includes(id));
    return list.length ? `<ul class="vcl">${list.map((c) => `<li><a href="#${c.id}">${c.id}</a>${confBadge(c.confidence)}<div>${esc(splitTitle(c)[0])}</div></li>`).join("")}</ul>` : "";
  };
  // captured pages go in the gallery; text-only references (articles, papers, docs) go in a table below it — no empty tiles
  const ordered = d.products.flatMap((p) => p.members);
  const shots = ordered.filter((m) => m.thumb);
  const docs = ordered.filter((m) => !m.thumb);
  const docRow = (m) => {
    const r = m.r;
    const notes = (r.notes ?? []).filter((x) => x.text?.trim());
    const n = citedBy.get(r.id) ?? 0;
    return `<tr id="${r.id}" data-role="${esc(m.role ?? "")}" data-axes="${esc(m.axes.join(" "))}" data-run="${esc(m.run ?? "")}" data-search="${searchText(r.id, r.product, r.page, r.label, r.title, r.publisher, r.tags, m.axes.map(axisLabel), notes.map((x) => x.text))}">
<td class="n">${idBtn(r.id)}</td>
<td><a class="tt" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label ?? r.title ?? r.url)}</a>${r.summary || r.description ? `<span class="sum">${esc(short(r.summary ?? r.description, 160))}</span>` : ""}${notes.length ? `<details><summary>노트 ${notes.length}</summary><div class="prose">${notes.map((x) => noteHtml(x, cite)).join("<hr>")}</div></details>` : ""}</td>
<td>${esc(r.publisher ?? r.product ?? "")}</td>
<td class="n" title="자료 종류: ${esc(TYPE_KO[r.type] ?? r.type)}">${esc(credLabel(r.credibility))}</td>
<td class="n">${refDate(r) ? `<span class="small">${esc(refDate(r).slice(0, 10))}</span> ` : ""}<span class="role fr-${freshness(r)}">${FRESH_KO[freshness(r)]}</span></td>
<td class="n">${m.role ? `<span class="role r-${esc(m.role)}">${ROLE_KO[m.role] ?? esc(m.role)}</span>` : ""}</td>
<td class="n num">${n ? `<a href="#claims" title="이 자료를 인용한 발견">${n}</a>` : `<span class="muted">0</span>`}</td>
</tr>`;
  };
  const rows = d.products
    .filter((p) => p.members.some((m) => m.thumb))
    .map(
      (p) => `<div class="row" data-role="${esc(p.role ?? "")}" data-axes="${esc([...new Set(p.members.flatMap((m) => m.axes))].join(" "))}" data-run="${esc([...new Set(p.members.map((m) => m.run).filter(Boolean))].join(" "))}" data-search="${searchText(p.name, p.members.map((m) => [m.r.page, m.r.label]))}">
  <div><h4>${esc(p.name)}</h4>${p.role ? `<span class="badge b-${esc(p.role)}">${ROLE_KO[p.role] ?? esc(p.role)}</span>` : ""}<div class="muted small" style="margin-top:6px">${p.members.filter((m) => m.thumb).length}개 페이지</div></div>
  <div class="strip">${p.members
    .filter((m) => m.thumb)
    .map((m) => `<div><button class="thumb" data-open-ref="${m.r.id}"><img loading="lazy" src="${esc(m.thumb)}" alt=""></button><div class="label">${esc(m.r.page ?? m.r.label ?? m.r.id)}</div></div>`)
    .join("")}</div></div>`,
    )
    .join("");
  const seqs = shots
    .filter((m) => m.frames.length > 1 || m.screens.length > 1)
    .map((m) => {
      const mode = m.frames.length > 1 ? "frames" : "screens";
      const list = mode === "frames" ? m.frames : m.screens;
      return `<div class="flow" data-role="${esc(m.role ?? "")}" data-axes="${esc(m.axes.join(" "))}" data-run="${esc(m.run ?? "")}" data-search="${searchText(m.r.product, m.r.page, m.r.label)}">
  <div class="fh"><div><span class="p">${esc(m.r.product ?? m.r.label ?? m.r.id)}</span> <span class="s">${esc(m.r.page ?? "")}</span></div><span class="s">${list.length}${mode === "frames" ? "개 화면 · 스크롤 순서" : "장 · 스토어 순서"}</span></div>
  <div class="seq">${list.map((src, i) => `${i ? `<span class="arrow" aria-hidden="true">→</span>` : ""}<div class="step"><button class="thumb${mode === "frames" ? " wide" : ""}" data-open-ref="${m.r.id}" data-mode="${mode}" data-idx="${i}"><img loading="lazy" src="${esc(src)}" alt=""></button><div class="n">${i + 1}</div></div>`).join("")}</div>
</div>`;
    })
    .join("");
  const roleSeg = ["", "direct", "indirect", "trend", "analogous"].filter((r) => !r || d.members.some((m) => m.role === r));
  const usedAxes = d.axes.rows.filter((r) => r.products.length > 1);
  const runSelect = d.runs.length > 1 ? `<select data-k="run" aria-label="조사 회차로 거르기"><option value="">모든 회차</option>${d.runs.map((r) => `<option value="${esc(r.id)}">${esc(runLabel(r.id))} · ${esc(short(r.goal ?? r.startedAt.slice(0, 10), 28))}</option>`).join("")}</select>` : "";
  const more = `<button class="morebtn" type="button" hidden></button>`;
  const shotProducts = d.products.filter((p) => p.members.some((m) => m.thumb)).length;
  const view0 = ["grid", "rows", "flow"].includes(col.view) ? col.view : !SOURCE_LED.includes(col.domain) && shotProducts >= 10 && rows ? "rows" : "grid";
  const refs = `<section id="refs">${sectionHead(next(), "레퍼런스", `<b>자료 S1234</b>는 라이브러리 전체에서 이 레퍼런스를 가리키는 고유 번호입니다. 누르면 복사되어 Claude에게 'S1234 다시 확인해줘'처럼 말할 수 있습니다. 캡처한 화면은 <b>격자</b>(한 장씩) · <b>제품별</b>(제품 하나에 여러 페이지) · <b>흐름</b>(한 페이지의 화면을 순서대로)으로 봅니다. 이미지를 누르면 뷰어가 열립니다: <kbd>←</kbd><kbd>→</kbd> 화면 · <kbd>Shift</kbd>+<kbd>←</kbd><kbd>→</kbd> 다른 레퍼런스 · <kbd>N</kbd> 정보 · <kbd>Esc</kbd> 닫기. 글로 읽은 자료(논문·기사·문서)는 아래 <b>자료 목록</b>에 있습니다.`)}
<div id="gallery">
<div class="toolbar">
  ${roleSeg.length > 2 ? `<div class="seg" data-k="role">${roleSeg.map((r) => `<button data-v="${r}"${r ? "" : ' class="on"'}>${r ? ROLE_KO[r] : "전체"}</button>`).join("")}</div>` : ""}
  ${usedAxes.length ? `<select data-k="axis" aria-label="패턴으로 거르기"><option value="">모든 패턴</option>${usedAxes.map((r) => `<option value="${esc(r.id)}">${esc(r.label)}</option>`).join("")}</select>` : ""}
  ${runSelect}
  <select data-k="sort" aria-label="정렬"><option value="default">기본 순서</option><option value="name">${esc(unit)} 이름순</option><option value="recent">최근 캡처순</option></select>
  <span class="spacer"></span><span class="shown"></span>
  <div class="seg" data-k="view">${[["grid", "격자"], ["rows", `${esc(unit)}별`], ["flow", "흐름"]].map(([v, t]) => `<button data-v="${v}"${v === view0 ? ' class="on"' : ""}>${t}</button>`).join("")}</div>
</div>
<div class="gridview"${view0 !== "grid" ? " hidden" : ""}>${shots.length ? `<div class="cards" data-limit="12" data-items=".card">${shots.map(card).join("")}</div>${more}` : `<p class="muted">캡처한 화면이 없습니다${docs.length ? " — 이 조사의 레퍼런스는 모두 글 자료입니다(아래 목록)" : ""}.</p>`}</div>
<div class="rowsview"${view0 !== "rows" ? " hidden" : ""}>${rows ? `<div class="rows" data-limit="10" data-items=".row">${rows}</div>${more}` : `<p class="muted">캡처한 화면이 없습니다.</p>`}</div>
<div class="flows-view"${view0 !== "flow" ? " hidden" : ""}>${seqs ? `<div class="flowlist" data-limit="8" data-items=".flow">${seqs}</div>${more}` : `<p class="muted">여러 화면으로 된 레퍼런스가 없습니다.</p>`}</div>
</div>
${
  docs.length
    ? `<div class="sgroup docs"><div class="groupcap"><h3>자료 목록</h3><span>캡처 없이 글로 읽은 자료 · <span class="shown">${docs.length}개</span> · 노트가 있으면 펼쳐 볼 수 있습니다</span></div>
<div class="panel tablewrap" style="padding:0"><table><thead><tr><th class="n">번호</th><th>자료</th><th>발행처</th><th class="n">출처 등급</th><th class="n">날짜</th><th class="n">역할</th><th class="n">인용</th></tr></thead><tbody data-limit="20" data-items="tr">${[...docs].sort((a, b) => String(refDate(b.r) ?? "").localeCompare(String(refDate(a.r) ?? ""))).map(docRow).join("")}</tbody></table></div>${more}</div>`
    : ""
}
${d.coverageWarn ? `<div class="note">${esc(d.coverageWarn)}</div>` : ""}</section>`;

  // claims, grouped by kind, each with its evidence
  const prevOf = new Map();
  for (const o of d.claims.own) if (o.status !== "active" && o.replacedBy) prevOf.set(o.replacedBy, [...(prevOf.get(o.replacedBy) ?? []), o]);
  const claimRow = (c, { inline: inl = false } = {}) => {
    const [title, body] = splitTitle(c);
    const date = (c.createdAt ?? "").slice(0, 10);
    const mix = typeMix(c.sources, typeOf);
    const olds = inl ? [] : (prevOf.get(c.id) ?? []);
    const fixed = c.status !== "active" ? `<span class="fix">${c.status === "refuted" ? "틀린 것으로 확인" : "수정됨"}${c.replacedBy ? ` → <a href="#${esc(c.replacedBy)}">${esc(c.replacedBy)}</a>` : ""}</span>` : "";
    const recheck = `reference-research 스킬로 ${col.name}의 발견 ${c.id}을(를) 다시 확인해줘: "${plain(title)}"${c.sources.length ? ` (출처 ${c.sources.join(", ")})` : ""}`;
    return `<article class="claim" id="${c.id}" data-kind="${esc(c.kind ?? "")}" data-run="${esc(c.run ?? "")}" data-conf="${esc(c.confidence ?? "")}" data-search="${searchText(c.id, c.subject, c.text, c.run)}">
  <div class="chead"><h4 class="ctitle">${c.key ? `<span class="star">핵심</span>` : ""}${esc(title)}</h4>${confBadge(c.confidence)}</div>
  ${body ? `<p class="cbody${body.length > 150 ? " clamp" : ""}">${esc(body)}</p>${body.length > 150 ? `<button class="more" type="button">더 보기</button>` : ""}` : ""}
  <div class="cmeta">${idBtn(c.id)}${d.staleKey.has(c.id) ? `<span class="sep">·</span><span class="role fr-stale" title="이 핵심 결론은 12개월이 지났거나 날짜를 모르는 자료만 인용합니다">지난 자료만 인용</span>` : ""}${c.run ? `<span class="sep">·</span><span class="run" title="${esc(runGoal(c.run) || c.run)}">${esc(runLabel(c.run))}</span>` : ""}${date ? `<span class="sep">·</span><span>${esc(date)}</span>` : ""}<span class="sep">·</span><span>출처 ${c.sources.length}${mix ? ` (${esc(mix)})` : ""}</span>${c.asOf ? `<span class="sep">·</span><span title="이 수치가 맞았던 날짜">기준 ${esc(c.asOf)}</span>` : ""}${c.scope ? `<span class="sep">·</span><span>${esc(c.scope)}</span>` : ""}${c.against?.length ? `<span class="sep">·</span><span class="chip against" title="이 발견에 반대되는 자료">반대 출처 ${c.against.map((id) => esc(id)).join(", ")}</span>` : ""}${((rs) => (rs === "unknown" ? `<span class="sep">·</span><span class="chip unread" title="인용한 자료를 원문으로 읽었다는 기록이 없음">열람 미기록</span>` : rs === "snippet" ? `<span class="sep">·</span><span class="chip unread" title="인용한 자료를 요약으로만 읽음 — 근거 세기 최대 보통">요약만 읽음</span>` : ""))(readState(c, R))}${fixed ? `<span class="sep">·</span>${fixed}` : ""}<span class="sep">·</span>${promptAction("다시 확인", recheck, { hint: "이 발견을 다시 확인하라는 프롬프트를 복사합니다 (컬렉션 · 번호 · 출처 포함)" })}</div>
  ${c.sources.length ? `<div class="evidence">${evidence(c.sources)}</div>` : ""}
  ${olds.length ? `<details class="prev"><summary>이전 버전 ${olds.length}개 — ${olds[0].status === "refuted" ? "틀린 것으로 확인됨" : "수정됨"}</summary>${olds.map((o) => `<div class="old" id="${o.id}">${idBtn(o.id)} ${esc(o.text)} <span class="small">(${esc((o.createdAt ?? "").slice(0, 10))})</span></div>`).join("")}</details>` : ""}
</article>`;
  };
  const kinds = Object.keys(KIND).filter((k) => active.some((c) => c.kind === k));
  const attached = new Set([...prevOf.values()].flat().map((o) => o.id));
  const corrected = d.claims.own.filter((c) => c.status !== "active" && !attached.has(c.id));
  const claimRuns = [...new Set(active.map((c) => c.run).filter(Boolean))].sort();
  const runFilter =
    claimRuns.length > 4
      ? `<select data-k="run" aria-label="조사 회차로 거르기"><option value="">모든 회차</option>${claimRuns.map((r) => `<option value="${esc(r)}">${esc(runLabel(r))} · ${esc(short(runGoal(r), 28))}</option>`).join("")}</select>`
      : claimRuns.length > 1
        ? `<div class="seg" data-k="run"><button data-v="" class="on">모든 회차</button>${claimRuns.map((r) => `<button data-v="${esc(r)}" title="${esc(runGoal(r))}">${esc(runLabel(r))}</button>`).join("")}</div>`
        : "";
  const confSeg = `<div class="seg" data-k="conf"><button data-v="" class="on">모든 근거</button><button data-v="high">강함</button><button data-v="medium">보통</button><button data-v="low">약함</button></div>`;
  // one kind at a time (the biggest first); 전체 shows every group
  const kindCounts = kinds.map((k) => [k, active.filter((c) => c.kind === k).length]).sort((a, b) => b[1] - a[1]);
  const firstKind = active.length > 12 && kindCounts.length > 1 ? kindCounts[0][0] : "";
  const kindTabs = kindCounts.length > 1 ? `<div class="seg tabs" data-k="kind">${kindCounts.map(([k, n]) => `<button data-v="${k}"${k === firstKind ? ' class="on"' : ""}><i class="kdot k-${k}"></i>${KIND[k][0]} <small>${n}</small></button>`).join("")}<button data-v=""${firstKind ? "" : ' class="on"'}>전체 <small>${active.length}</small></button></div>` : "";
  const claims = `<section id="claims">${sectionHead(next(), "발견", "조사에서 나온 주장과 그 근거. <b>발견 C1234</b>는 주장의 고유 번호, <b>N회차</b>는 이 조사의 몇 번째 진행에서 나왔는지입니다. 제목 → 내용 → 근거 세기·조사 회차·날짜·출처 구성 순으로 읽습니다. 근거 세기는 출처의 수와 등급으로 자동 계산되고, 썸네일을 누르면 근거 화면이 열립니다. 번호를 누르면 복사됩니다.")}${
    active.length || d.claims.related.length
      ? `${kindTabs ? `<div class="stoolbar">${kindTabs}</div>` : ""}<div class="stoolbar">${runFilter}${confSeg}<span class="shown"></span></div>` +
        kinds.map((k) => `<div class="kindgroup sgroup"><h3><i class="kdot k-${k}"></i>${KIND[k][0]} <span>${KIND[k][1]} · ${active.filter((c) => c.kind === k).length}개</span></h3><div class="panel">${active.filter((c) => c.kind === k).map((c) => claimRow(c)).join("")}</div></div>`).join("") +
        (d.claims.related.length ? `<div class="kindgroup sgroup"><h3>다른 조사의 발견 <span>같은 레퍼런스를 근거로 쓴 것 · ${d.claims.related.length}개</span></h3><div class="panel">${d.claims.related.map((c) => claimRow(c)).join("")}</div></div>` : "") +
        (corrected.length ? `<details class="corrections sgroup"><summary>이후 조사에서 정정된 발견 ${corrected.length}개</summary><div class="panel" style="margin-top:10px">${corrected.map((c) => claimRow(c, { inline: true })).join("")}</div></details>` : "")
      : `<p class="muted">아직 기록된 발견이 없습니다.</p>`
  }</section>`;

  // research log
  const cur = d.current;
  const li = (tag, c, extra = "") => `<li><strong>${tag}</strong> ${c.subject ? `${esc(c.subject)} — ` : ""}${esc(c.text)} ${c.sources.map(cite).join("")}${extra}</li>`;
  const p = d.process;
  const procBody = `<div class="procgrid">${p.brief.length ? `<div class="panel"><h4>개요</h4><table><tbody>${p.brief.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(k === "범위" ? v.replace(/\b(direct|indirect|trend)\b/g, (x) => ROLE_KO[x]) : v)}</td></tr>`).join("")}</tbody></table></div>` : ""}
${p.rounds.length ? `<div class="panel"><h4>바퀴 기록</h4><table><thead><tr><th>바퀴</th><th class="n">질의</th><th class="n">후보</th><th>새 패턴</th></tr></thead><tbody>${p.rounds.map((r) => `<tr><td>${r.n}바퀴</td><td class="n">${r.queries.length}</td><td class="n">${r.candidates.length}</td><td>${esc(r.newAxes.join(", ") || "없음")}${r.stopped ? ` <span class="muted small">(멈춤: ${esc(r.stopped)})</span>` : ""}</td></tr>`).join("")}</tbody></table></div>` : ""}
<div class="panel"><h4>채널</h4><table><thead><tr><th>채널</th><th class="n">레퍼런스</th><th class="n">국내</th></tr></thead><tbody>${p.channels.rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="n">${r.count}</td><td class="n">${r.korean}</td></tr>`).join("")}</tbody></table>${p.channels.missing.length ? `<p class="small" style="color:var(--amber);margin:8px 0 0">없는 채널: ${esc(p.channels.missing.join(", "))}</p>` : ""}</div>
<div class="panel"><h4>신선도</h4><div class="procfresh">${Object.entries(p.fresh).map(([k, n]) => `<span class="role fr-${k}">${FRESH_KO[k]} ${n}</span>`).join("")}</div></div></div>${tiles}`;
  const changes = `<section id="changes">${sectionHead(next(), "조사 과정", "개요, 바퀴 기록, 채널, 신선도와 회차별 기록. 결론을 어떻게 얻었는지 확인할 때 펼칩니다.")}<details class="proc"${reader === "archive" ? " open" : ""}><summary>조사 과정 펼치기</summary>${procBody}
${
    d.runs.length
      ? `<ol class="runs">${d.runs
          .slice()
          .reverse()
          .map(
            (r) => `<li class="run${r.id === col.currentRun ? " cur" : ""}" data-search="${searchText(r.id, r.goal, r.result)}"><div class="rh"><strong>${esc(runLabel(r.id))}</strong><span class="rd">${esc(r.startedAt.slice(0, 10))}${r.endedAt && r.endedAt.slice(0, 10) !== r.startedAt.slice(0, 10) ? ` → ${esc(r.endedAt.slice(0, 10))}` : ""}</span>${r.id === col.currentRun ? `<span class="pill">현재</span>` : ""}</div>
<div class="rg">${esc(r.goal ?? "")}</div>${r.result ? `<div class="rr">→ ${inline(r.result, cite)}</div>` : ""}
<div class="rc">${[["새 발견", r.counts.created], ["정정", r.counts.revised + r.counts.refuted], ["다시 확인", r.counts.confirmed]].filter(([, v]) => v).map(([k, v]) => `<span class="chip">${k} ${v}</span>`).join("") || `<span class="muted small">발견 변화 없음</span>`}</div></li>`,
          )
          .join("")}</ol>`
      : `<p class="muted">아직 조사 회차가 없습니다.</p>`
  }
${cur && cur.refuted.length + cur.revised.length + cur.confirmed.length ? `<h3>최근 조사(${esc(runLabel(cur.run))})에서 바뀐 것</h3><div class="panel prose"><ul>${[
    ...cur.refuted.map((c) => li("틀린 것으로 확인", c, ` <span class="muted">(${c.refutes} 대체)</span>`)),
    ...cur.revised.map((c) => li("수정", c, ` <span class="muted">(${c.revises} 대체)</span>`)),
    ...cur.confirmed.map((c) => li("다시 확인", c)),
  ].join("")}</ul></div>` : ""}
<h3>현행화</h3>${
    d.changes.length
      ? `<div class="panel prose"><ul>${d.changes.map(({ r, c }) => `<li><a href="#${r.id}">${r.id} ${esc(r.label ?? "")}</a> — ${esc(c.at.slice(0, 10))} (이전 ${esc(c.from.slice(0, 10))}): ${esc(c.lines.join(" · ") || "변화 없음")}</li>`).join("")}</ul></div>`
      : `<p class="muted small">다시 캡처해서 확인된 변화는 아직 없습니다. 30일이 지난 레퍼런스는 다음 캡처 때 자동으로 다시 찍어 이전과 비교합니다.</p>`
  }${d.stale.length ? `<div class="note">90일 넘게 다시 확인하지 않은 레퍼런스: ${d.stale.map((r) => r.id).join(", ")}</div>` : ""}</details></section>`;

  // sources: the citation index — cited-only by default, filter by grade / type, 20 rows at a time
  const grades = [...new Set(d.sources.map((r) => r.credibility))].sort();
  const types = [...new Set(d.sources.map((r) => r.type).filter(Boolean))].sort();
  const sources = `<section id="sources">${sectionHead(next(), "출처", "발견이 인용한 자료의 색인. 출처 등급은 자료 종류로 매긴 신뢰도입니다: A 공식·1차 자료 · B 언론·조사 기관 · C 커뮤니티·블로그 · D 미확인. 등급은 발견의 근거 세기를 계산할 때 쓰입니다. 기본은 인용된 자료만 보이고, 끄면 이 조사의 모든 레퍼런스가 나옵니다.")}
<div class="stoolbar">${grades.length > 1 ? `<div class="seg" data-k="grade"><button data-v="" class="on">모든 등급</button>${grades.map((g) => `<button data-v="${esc(g)}">${esc(credLabel(g))}</button>`).join("")}</div>` : ""}${types.length > 1 ? `<select data-k="type" aria-label="종류로 거르기"><option value="">모든 종류</option>${types.map((t) => `<option value="${esc(t)}">${esc(TYPE_KO[t] ?? t)}</option>`).join("")}</select>` : ""}<div class="seg" data-k="cited"><button class="tog on" type="button">인용된 것만</button></div><span class="shown"></span></div>
<div class="panel tablewrap" style="padding:0"><table><thead><tr><th class="n">번호</th><th>제목</th><th class="n">출처 등급</th><th>발행처</th><th class="n">인용</th><th>포함된 조사</th></tr></thead><tbody data-limit="20" data-items="tr">${d.sources
    .map((r) => {
      const n = citedBy.get(r.id) ?? 0;
      return `<tr id="${memberIds.has(r.id) ? `src-row-${r.id}` : `src-${r.id}`}" data-grade="${esc(r.credibility)}" data-type="${esc(r.type ?? "")}" data-cited="${n}" data-search="${searchText(r.id, r.label, r.title, r.publisher)}"><td class="n">${idBtn(r.id)}${memberIds.has(r.id) ? ` <a href="#${r.id}" title="이 조사의 레퍼런스로 이동">↑</a>` : ""}</td><td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label ?? r.title ?? r.url)}</a></td><td class="n" title="자료 종류: ${esc(TYPE_KO[r.type] ?? r.type)}">${esc(credLabel(r.credibility))}</td><td>${esc(r.publisher ?? "")}</td><td class="n num">${n || `<span class="muted">0</span>`}</td><td>${(r.categories ?? []).map((c) => (c === col.name ? esc(d.catTitle(c)) : `<a href="../${esc(c)}/index.html">${esc(d.catTitle(c))}</a>`)).join(", ")}</td></tr>`;
    })
    .join("")}</tbody></table></div><button class="morebtn" type="button" hidden></button></section>`;

  const foot = `<footer>${esc(col.name)} · 생성 ${esc(new Date().toLocaleString("ko-KR"))} · <code>ref report</code>로 다시 만들 수 있습니다</footer>`;
  const blocks = { why: whySection, curriculum, axes, avoid: avoidSection, open: openSection, refs, claims, summary, changes, sources };
  const ORDER = {
    decision: ["why", "avoid", "open", "axes", "curriculum", "summary", "claims", "refs", "changes", "sources"],
    practitioner: ["why", "axes", "curriculum", "avoid", "open", "refs", "claims", "summary", "changes", "sources"],
    archive: ["summary", "why", "axes", "curriculum", "avoid", "open", "claims", "refs", "changes", "sources"],
  };
  const NAV = { key: ["핵심 결론", evShown.length], map: ["근거 노선", ""], why: [whyTitle, traces.slice(0, 5).length], curriculum: ["커리큘럼 비교", d.curriculum?.n], axes: ["패턴 비교", d.axes.rows.length], avoid: ["회피 조합", ""], open: ["미해결 질문", openQ.length], refs: ["레퍼런스", d.members.length], claims: ["발견", active.length], summary: ["요약 전문", ""], changes: ["조사 과정", d.runs.length], sources: ["출처", d.sources.filter((r) => citedBy.has(r.id)).length] };
  const order = ORDER[reader].filter((k) => blocks[k]);
  const navOrder = [...(answer ? ["key"] : []), ...(answer && evShown.length ? ["map"] : []), ...order];
  const side = `<a class="brand" href="../index.html">References <span>/ 라이브러리</span></a>
<div class="about"><strong>${esc(col.title ?? col.name)}</strong><br>${esc(col.description ?? "")}</div>
${searchBox("레퍼런스·발견·패턴 검색")}
<nav>${navOrder.map((k) => `<a href="#${k}">${NAV[k][0]}${NAV[k][1] ? `<small>${NAV[k][1]}</small>` : ""}</a>`).join("")}</nav>
<div class="foot">${productCount}개 ${unit} · ${d.members.length}개 레퍼런스 · ${active.length}개 발견<br>${lastRun ? `마지막 조사 ${esc(lastRun.startedAt.slice(0, 10))}` : ""}</div>`;
  let sec = 0;
  const body = (hero + order.map((k) => blocks[k]).join("") + foot).replaceAll(NUM, () => String(++sec).padStart(2, "0"));
  return shell(`${col.title ?? col.name} — 레퍼런스 보드`, side, topbar, body);
}

// ---------- curriculum section ----------

const LEVEL_KO = { intro: "입문", beginner: "초급", intermediate: "중급", advanced: "고급" };
const FORMAT_KO = { "self-paced": "자율 학습(VOD)", "live-online": "실시간 온라인", cohort: "기수제", offline: "오프라인", hybrid: "혼합" };
const money = (v, cur) => (v == null ? "-" : v === 0 ? "무료" : cur === "USD" ? `$${v.toLocaleString("en-US")}` : `${v.toLocaleString("ko-KR")}원`);
const pct = (x) => (x == null ? "-" : `${Math.round(x * 100)}%`);
const whereKo = (p) => (p == null ? "-" : p < 0.34 ? "초반" : p < 0.67 ? "중반" : "후반");

function renderCurriculum(c, cite, num) {
  const byId = new Map(c.courses.map((x) => [x.id, x]));
  const courseBtn = (id) => `<button class="prod" data-open-ref="${esc(id)}" title="캡처 보기">${esc(byId.get(id)?.product ?? id)}</button>`;
  const head = sectionHead(num, "커리큘럼 비교", "강의마다 <strong>무엇을, 어떤 순서로, 몇 시간</strong> 가르치는지 비교하고, 근거 자료(역량 기준·조사·채용 공고)와 대조해 빈틈을 찾습니다. 강의 이름을 누르면 캡처가 열립니다.");
  if (!c.courses.length) return `<section id="curriculum">${head}<p class="muted">아직 강의 구조가 기록되지 않았습니다 — 강의계획서를 읽고 <code>ref course set</code>으로 모듈·주제·시간을 기록하면 채워집니다.</p></section>`;
  const maxH = Math.max(...c.courses.map((x) => x.hours ?? 0), 1);
  const bar = (v, max, label) => `<span class="bar"><span class="fill" style="width:${Math.max(2, Math.round((v / max) * 100))}%"></span></span><span class="barv">${label}</span>`;
  // stat band (C46, C58): big numerals, no boxes
  const band = `<div class="band">${[
    [c.n, "비교한 강의"],
    [c.stats.hours != null ? `${+c.stats.hours.toFixed(1)}<small>시간</small>` : "–", `총 시간 중앙값 · 범위 ${c.stats.hoursRange.length ? `${+Math.min(...c.stats.hoursRange).toFixed(1)}–${+Math.max(...c.stats.hoursRange).toFixed(1)}시간` : "–"}`],
    [pct(c.stats.handsOn), "실습 비중 중앙값"],
    [c.stats.price != null ? `${Math.round(c.stats.price / 10000)}<small>만원</small>` : "–", `원화 가격 중앙값 · ${c.stats.priceRange.length}개 강의${c.stats.otherPrices?.length ? ` · 그 외 ${c.stats.otherPrices.join(", ")}` : ""}`],
    [c.basis.length, "근거 자료"],
  ]
    .map(([v, l]) => `<div><b>${v}</b><span>${esc(l).replace(/&lt;small&gt;|&lt;\/small&gt;/g, "")}</span></div>`)
    .join("")}</div>`;
  // overview with inline bars
  const overview = `<div class="sgroup"><h3>강의 개요</h3><div class="tablewrap"><table class="viz"><thead><tr><th>강의</th><th>수준</th><th style="width:22%">총 시간</th><th style="width:16%">실습 비중</th><th>형식</th><th>가격</th><th>평가·수료</th></tr></thead><tbody>${c.courses
    .slice()
    .sort((a, b) => (a.hours ?? 0) - (b.hours ?? 0))
    .map(
      (x) => `<tr data-search="${searchText(x.product, x.title, x.audience)}"><td>${courseBtn(x.id)}<div class="muted small">${esc(x.provider ?? "")}${x.audience ? ` · ${esc(x.audience)}` : ""}</div></td><td>${x.level ? `<span class="pill">${esc(LEVEL_KO[x.level])}</span>` : "–"}</td><td>${x.hours != null ? bar(x.hours, maxH, `${+x.hours.toFixed(1)}h${x.weeks ? ` · ${x.weeks}주` : ""}`) : "–"}</td><td>${x.handsOn != null ? bar(x.handsOn, 1, pct(x.handsOn)).replace('class="bar"', 'class="bar hands"') : "–"}</td><td class="small nowrap">${esc(FORMAT_KO[x.format] ?? "–")}</td><td class="small nowrap">${esc(money(x.price, x.currency))}</td><td class="small muted">${esc(((xs) => xs.filter((a) => !xs.some((b) => b !== a && b.includes(a))))([...new Set([...x.assessment, x.credential].filter(Boolean))]).join(" · ") || "–")}</td></tr>`,
    )
    .join("")}</tbody></table></div><p class="muted small">총 시간 순. 막대는 가장 긴 강의(${+maxH.toFixed(1)}시간) 대비. 실습 비중은 실습 모듈의 시간 비율(시간이 없으면 모듈 수 비율).</p></div>`;
  // topic coverage: coverage bar + position track (where in the curriculum each course teaches it)
  const topicRow = (t) => {
    // merge coincident positions into one dot; size and number show how many courses sit there
    const buckets = new Map();
    for (const [id, v] of Object.entries(t.courses)) {
      const p = Math.min(...v.pos);
      const k = Math.round(p * 40) / 40;
      const e = buckets.get(k) ?? { p: 0, names: [] };
      e.p = k;
      e.names.push(`${byId.get(id)?.product ?? id} · ${v.modules.join("·")}번째 모듈`);
      buckets.set(k, e);
    }
    const dots = [...buckets.values()].map((e) => {
      const n = e.names.length;
      const sz = Math.min(20, 8 + (n - 1) * 3);
      return `<span class="dot${n > 1 ? " many" : ""}" style="left:${(e.p * 100).toFixed(1)}%;width:${sz}px;height:${sz}px;margin:-${sz / 2}px 0 0 -${sz / 2}px" title="${esc(e.names.join("\n"))}">${n > 1 ? n : ""}</span>`;
    });
    return `<div class="trow" data-search="${searchText(t.label, Object.keys(t.courses).map((id) => byId.get(id)?.product))}">
  <div class="tl"><strong>${esc(t.label)}</strong>${t.basis.length ? `<span class="basis">근거 ${t.basis.map((b) => cite(b)).join("")}</span>` : ""}<details class="tdetail"><summary>강의별 보기</summary><div class="tchips">${Object.entries(t.courses)
      .map(([id, v]) => `<span class="tchip">${courseBtn(id)}<span>${v.modules.map((m) => `${m}번째`).join("·")} 모듈${v.hours ? ` · ${v.hours.toFixed(1)}h` : ""}</span></span>`)
      .join("")}</div></details></div>
  <div class="tc">${bar(t.coverage, c.n, `${t.coverage}/${c.n}`)}</div>
  <div class="track" aria-label="커리큘럼 안 위치">${dots.join("")}</div>
  <div class="th small muted">${t.medianHours ? `약 ${t.medianHours.toFixed(1)}시간` : ""}</div>
</div>`;
  };
  const topics = `<div class="sgroup"><h3>주제별 커버리지</h3><p class="muted small" style="margin-top:-6px">막대 = 그 주제를 다루는 강의 수. 오른쪽 선 = 커리큘럼의 처음부터 끝까지, 점 = 강의가 그 주제를 처음 다루는 위치(숫자는 같은 위치의 강의 수, 점에 마우스를 올리면 강의 이름).</p>
<div class="topics"><div class="trow thead"><div>주제</div><div>다루는 강의</div><div class="trackhead"><span>처음</span><span>중간</span><span>끝</span></div><div>평균 시간</div></div>${c.rows.map(topicRow).join("")}</div></div>`;
  // average order as numbered steps
  const order = c.order.length
    ? `<ol class="steps">${c.order.map((t) => `<li data-search="${searchText(t.label)}"><span class="sn"></span><div><strong>${esc(t.label)}</strong><span class="muted small">${t.coverage}/${c.n} 강의 · 보통 ${whereKo(t.avgPos)}${t.medianHours ? ` · 약 ${t.medianHours.toFixed(1)}시간` : ""}</span></div></li>`).join("")}</ol>`
    : `<p class="muted">두 개 이상 강의가 다루는 주제가 아직 없습니다.</p>`;
  const gaps = `${
    c.gaps.length
      ? `<ul class="plain">${c.gaps.map((t) => `<li data-search="${searchText(t.label)}"><strong>${esc(t.label)}</strong><span class="muted small">${t.coverage}/${c.n} 강의만 다룸 · 근거 ${t.basis.map((b) => cite(b)).join("")}</span></li>`).join("")}</ul>`
      : `<p class="muted small">${c.basis.length ? "근거 자료에 나온 주제는 모두 30% 이상의 강의가 다룹니다." : "근거 자료가 아직 없습니다."}</p>`
  }${c.unique.length ? `<h4>한 강의만 다루는 주제</h4><ul class="plain">${c.unique.map((t) => `<li data-search="${searchText(t.label)}"><strong>${esc(t.label)}</strong><span class="muted small">${Object.keys(t.courses).map((id) => byId.get(id)?.product ?? id).map(esc).join(", ")}</span></li>`).join("")}</ul>` : ""}`;
  // course flows: module timeline bar (width = hours) + list
  const flows = c.courses
    .map((x) => {
      const total = x.modules.reduce((s2, m) => s2 + (m.hours ?? 0), 0);
      const seg = x.modules.map((m, i) => `<span class="seg${m.hands_on ? " on" : ""}" style="flex:${total ? Math.max(m.hours ?? 0, total * 0.01) : 1}" title="${i + 1}. ${esc(m.title)}${m.hours ? ` · ${m.hours}h` : ""}${m.hands_on ? " · 실습" : ""}"></span>`).join("");
      return `<div class="cflow" data-search="${searchText(x.product, x.title, x.modules.map((m) => m.title))}"><div class="fh">${courseBtn(x.id)}<span class="muted small">${x.hours != null ? `${+x.hours.toFixed(1)}시간` : ""} · 모듈 ${x.modules.length}개</span></div>
<div class="timeline">${seg}</div><ol>${x.modules
        .map((m) => `<li><span class="mt">${esc(m.title)}</span><span class="mh">${[m.hours ? `${m.hours}h` : "", m.hands_on ? "실습" : ""].filter(Boolean).join(" · ")}</span>${m.labels.length ? `<span class="ml">${m.labels.map(esc).join(" · ")}</span>` : ""}</li>`)
        .join("")}</ol></div>`;
    })
    .join("");
  return `<section id="curriculum">${head}${band}${overview}${topics}
<div class="grid2"><div class="sgroup"><h3>강의들의 평균 순서</h3><p class="muted small" style="margin-top:-6px">두 개 이상 강의가 다루는 주제를 평균 위치 순으로 — 학습 순서 설계의 출발점</p>${order}</div>
<div class="sgroup"><h3>빈틈</h3><p class="muted small" style="margin-top:-6px">근거 자료에는 있는데 강의들이 잘 다루지 않는 주제</p>${gaps}</div></div>
<div class="sgroup"><h3>강의별 흐름</h3><p class="muted small" style="margin-top:-6px">막대 길이 = 모듈 시간, <span style="color:var(--accent);font-weight:600">진한 칸</span> = 실습 모듈</p><div class="flows">${flows}</div></div>
${c.missing.length ? `<div class="note">강의 구조가 기록되지 않은 강의 페이지: ${c.missing.join(", ")} — <code>ref course set</code></div>` : ""}
</section>`;
}

// ---------- library home ----------

/**
 * h: { cats:[{name, title, description, goal, lastRun, lastRunAt, conclusion:{id,subject,text,confidence,sources,key}|null, openQ, inProgress, kind, domain, refs, products, claims, kinds:{kind:n}, run, thumbs:[], topAxes:[labels]}],
 *      axes:[{id, label, question, verdict, description, facet, cats:{name:n}}], totals:{refs, claims, runs, lastRun, sharedRefs} }
 * Home (docs/HOME-REDESIGN.md phase 1): stat tiles + prompts → recent-first collection cards with a conclusion line → shared-pattern cards.
 */
export function renderHome(h) {
  const titleOf = new Map(h.cats.map((c) => [c.name, c.title ?? c.name]));
  const hcite = (id) => `<span class="cite" title="${esc(id)}">${esc(id)}</span>`; // ids on the home have no single board to link to
  const patternAxes = h.axes.filter((a) => a.facet === "pattern");
  const shared = patternAxes.filter((a) => Object.keys(a.cats).length > 1).sort((a, b) => Object.keys(b.cats).length - Object.keys(a.cats).length || Object.values(b.cats).reduce((x, y) => x + y, 0) - Object.values(a.cats).reduce((x, y) => x + y, 0) || a.label.localeCompare(b.label));
  const otherFacets = h.axes.filter((a) => a.facet !== "pattern" && Object.keys(a.cats).length > 1);
  const FACET_KO = { topic: "커리큘럼 주제", market: "시장", platform: "플랫폼", positioning: "포지셔닝" };

  const side = `<a class="brand" href="index.html">References <span>/ 라이브러리</span></a>
<div class="about">조사할 때마다 모은 레퍼런스와 발견. 같은 레퍼런스는 한 번만 저장하고, 여러 조사에 걸쳐 다시 씁니다.</div>
${searchBox("조사·패턴 검색")}
<nav><a href="#timeline">조사 타임라인</a><a href="#cats">조사 목록<small>${h.cats.length}</small></a><a href="#activity">활동</a>${h.sharedRefs?.length ? `<a href="#sharedrefs">공유 레퍼런스<small>${h.sharedRefs.length}</small></a>` : ""}<a href="#shared">교차 패턴<small>${shared.length}</small></a>${h.recent?.length ? `<a href="#recent">최근 활동<small>${h.recent.length}</small></a>` : ""}${h.cats.some((c) => c.openQuestions?.length) ? `<a href="#openq">미해결 질문<small>${h.cats.reduce((n, c) => n + (c.openQuestions?.length ?? 0), 0)}</small></a>` : ""}${h.findings?.length ? `<a href="#findings">발견 검색<small>${h.findings.length}</small></a>` : ""}</nav>
<div class="foot">${h.cats.length}개 조사 · ${h.totals.refs}개 레퍼런스 · ${h.totals.claims}개 발견<br>${esc(new Date().toLocaleDateString("ko-KR"))} 기준</div>`;
  const topbar = `<a class="brand" href="index.html">References</a>${searchBox("검색")}`;

  // ---- board G home: head, KPI sparklines, timeline (Gantt), collection list by topic, activity hexes, shared references ----
  const startPrompt = `reference-research 스킬로 "<주제>" 레퍼런스 조사를 시작해줘. 목적: <어떤 결정을 위해>, 대상: <누구를 위해>`;
  const asks = [
    ["지난 조사 찾기", `reference-library에서 "<패턴이나 제품>"을 다룬 발견을 찾아줘`],
    ["근거 다시 보기", `reference-library에서 C<번호>의 근거 화면을 보여줘`],
    ["패턴 비교", `reference-library에서 "<패턴 이름>"을 쓴 제품을 조사별로 비교해줘`],
  ];
  const plain = (md) => String(md).replace(/\*\*/g, "").replace(/\[([SC]\d+(?:\s*,\s*[SC]\d+)*)\]/g, "").replace(/\s+/g, " ").trim();
  const continuePrompt = (c) => `reference-research 스킬로 "${c.title ?? c.name}" 조사(컬렉션 ${c.name})를 이어서 해줘.${c.openQuestions?.length ? ` 추가 질문 항목: ${c.openQuestions.map((q, i) => `${i + 1}) ${plain(q)}`).join(" ")}` : ""}`;
  const sorted = h.cats.slice().sort((a, b) => String(b.lastRunAt ?? "").localeCompare(String(a.lastRunAt ?? "")));
  const day = (iso) => Math.round(Date.parse(String(iso).slice(0, 10) + "T00:00:00Z") / 864e5);
  const today = h.today ?? new Date().toISOString().slice(0, 10);
  const end = day(today);
  const weekly = (weeks, f) => { const out = Array(weeks).fill(0); for (const c of h.cats) (c.runsAt ?? []).forEach((d, i) => { const w = weeks - 1 - Math.floor((end - day(d)) / 7); if (w >= 0 && w < weeks) out[w] += f(c, i); }); return out; };
  const runsW = weekly(8, () => 1), newW = weekly(8, (c, i) => c.newByRun?.[i] ?? 0);
  const allQ = h.cats.reduce((n, c) => n + (c.openQuestions?.length ?? 0), 0);
  const colorOf = new Map(sorted.map((c, i) => [c.name, LINE_COLORS[i % LINE_COLORS.length]]));
  const topicLabel = new Map((h.topics ?? []).map((t) => [t.id, t.label]));
  const ghead = `<div class="ghead"><div><p class="crumb">라이브러리 / <b>전체</b></p><h1>레퍼런스 라이브러리</h1><p class="sub">조사 ${h.cats.length} · 레퍼런스 ${h.totals.refs} · 발견 ${h.totals.claims} · 조사 회차 ${h.totals.runs ?? 0}${h.totals.lastRun ? ` · 마지막 조사 ${esc(h.totals.lastRun)}` : ""}</p></div><div class="tools">${promptAction("새 조사", startPrompt, { hint: "새 조사를 시작하는 프롬프트를 복사합니다" }).replace('class="pbtn', 'class="pbtn go')}${asks.map(([t, q]) => promptAction(t, q, { hint: q })).join("")}</div></div>`;
  const kpis = `<div class="kpis">${kpiCard("timeline", "조사 회차", "var(--accent)", runsW.reduce((a, b) => a + b, 0), "최근 8주", "주별 조사 회차", runsW, "hk1")}${kpiCard("activity", "신규 발견", "var(--green)", newW.reduce((a, b) => a + b, 0), "최근 8주", "주별 신규 발견", newW, "hk2")}${kpiCard("sharedrefs", "레퍼런스", "var(--amber)", h.totals.refs, `공유 ${h.totals.sharedRefs ?? 0}`, "조사별 레퍼런스", sorted.map((c) => c.refs), "hk3")}${kpiCard(allQ ? "openq" : "cats", "미해결 질문", "var(--violet)", allQ, allQ ? "답 없음" : "없음", "조사별 미해결 질문", sorted.map((c) => c.openQuestions?.length ?? 0), "hk4")}</div>`;
  const staleCats = h.cats.filter((c) => c.stale);
  const staleNote = staleCats.length ? `<p class="gmeta" style="color:var(--amber)">90일 넘게 다시 캡처하지 않은 레퍼런스가 있는 조사 ${staleCats.length}개: ${staleCats.map((c) => `<a href="${esc(c.name)}/index.html">${esc(c.title ?? c.name)}</a> ${c.stale}`).join(", ")} — 다음 캡처 때 자동으로 다시 찍음.</p>` : "";
  // timeline: up to 12 most recent collections over 12 weeks; crosshair data per run
  const tlRows = sorted.slice(0, 12).map((c, i) => ({ title: c.title ?? c.name, runs: c.runsAt ?? [], color: colorOf.get(c.name), focal: i === 0 }));
  const tlRuns = sorted.flatMap((c) => (c.runsAt ?? []).map((d, i) => ({ d: day(d), t: `${c.title ?? c.name} ${i + 1}회차 · 신규 발견 ${c.newByRun?.[i] ?? 0}` })));
  const timeline = tlRows.length ? `<section id="timeline">${sectionHead("", "조사 타임라인", "세로선이 마우스를 따라가며 그 주의 회차를 보여 줌. 막대는 첫 회차부터 마지막 회차까지.")}<div class="dgwrap">${gantt("gtl", { rows: tlRows, end: today, weeks: 12 }).replace('<svg class="dg gt" id="gtl"', `<svg class="dg gt" id="gtl" data-runs="${esc(JSON.stringify(tlRuns))}"`)}</div></section>` : "";
  // collection list (ponytail-style rows): topic chips (domain stays out of the chips), sort, glowing bar = references
  const maxRefs = Math.max(1, ...h.cats.map((c) => c.refs));
  const topicsUsed = [...new Set(h.cats.map((c) => c.topic).filter((t) => topicLabel.has(t)))];
  const catRow = (c) => `<li class="catcard" data-col="${esc(c.name)}" data-topic="${esc(c.topic ?? "")}" data-name="${esc(c.title ?? c.name)}" data-date="${esc(c.lastRunAt ?? "")}" data-claims="${c.claims}" data-search="${searchText(c.title, c.description, c.goal, c.topAxes, c.conclusion?.subject, c.conclusion?.text, c.plans, topicLabel.get(c.topic))}" style="--c:${colorOf.get(c.name)}">
<span class="t"><b><a href="${esc(c.name)}/index.html">${esc(c.title ?? c.name)}</a></b>${c.openQ ? gpill("mid", `미해결 ${c.openQ}`) : gpill("good", "미해결 0")}</span>
<span class="m">${[topicLabel.get(c.topic) ?? "주제 없음", c.lastRun ? `마지막 ${c.lastRun}` : "", `회차 ${(c.runsAt ?? []).length}`, `레퍼런스 ${c.refs}`, `발견 ${c.claims}`, c.stale ? `다시 캡처 필요 ${c.stale}` : ""].filter(Boolean).map(esc).join(" · ")}${c.plans?.length ? ` · ${c.plans.map((n) => `<span class="pill plan">${esc(n)}</span>`).join(" ")}` : ""}</span>
${c.conclusion ? `<span class="a">${c.conclusion.key ? "핵심 · " : ""}${esc(splitTitle(c.conclusion)[0])} <span class="cite">${esc(c.conclusion.id)}</span></span>` : `<span class="a">아직 발견 없음</span>`}
${c.inProgress ? `<span class="m">${gpill("good", "진행 중")} ${promptAction("이어서 조사", continuePrompt(c), { hint: "열린 질문을 담은 프롬프트를 복사합니다" })}</span>` : ""}
<span class="gbar" style="width:${Math.max(4, Math.round((c.refs / maxRefs) * 100))}%"></span></li>`;
  const catsSection = `<section id="cats">${sectionHead("", "조사 목록", "최근 조사순. 줄에 마우스를 올리면 공유 레퍼런스 그래프에서 그 조사의 선이 밝아짐.")}
<div class="stoolbar">${topicsUsed.length ? `<div class="seg" data-k="topic"><button data-v="" class="on">전체 <small>${h.cats.length}</small></button>${topicsUsed.map((t) => `<button data-v="${esc(t)}">${esc(topicLabel.get(t))} <small>${h.cats.filter((c) => c.topic === t).length}</small></button>`).join("")}<button data-v="__none">주제 없음 <small>${h.cats.filter((c) => !topicLabel.has(c.topic)).length}</small></button></div>` : ""}<select data-k="sort" aria-label="정렬"><option value="recent">최근 조사순</option><option value="name">이름순</option><option value="claims">발견 많은 순</option></select><span class="shown"></span></div>
<ul class="glist catcards" data-limit="12" data-items=".catcard">${sorted.map(catRow).join("")}</ul><button class="morebtn" type="button" hidden></button></section>`;
  // activity: one hex per day for 12 weeks, one green ramp by findings recorded that day
  const byDay = new Map();
  for (const c of h.cats) (c.runsAt ?? []).forEach((d, i) => { const k = day(d), o = byDay.get(k) ?? { n: 0, lines: [] }; o.n += c.newByRun?.[i] ?? 0; o.lines.push(`${c.title ?? c.name} ${i + 1}회차 · 신규 ${c.newByRun?.[i] ?? 0}`); byDay.set(k, o); });
  for (const o of byDay.values()) o.label = o.lines.join(" / ");
  const runDays = [...byDay.keys()].filter((k) => k > end - 84).length;
  const allRuns = h.cats.reduce((n, c) => n + (c.runsAt ?? []).length, 0);
  const activity = `<section id="activity">${sectionHead("", "활동", "최근 12주. 칸 하나가 하루, 신규 발견이 많은 날일수록 밝은 녹색.")}<div class="hexwrap">${hexes({ byDay, end: today, weeks: 12 })}</div><div class="hexleg">적음 <i style="--c:var(--hex-0)"></i><i style="--c:var(--hex-1)"></i><i style="--c:var(--hex-2)"></i><i style="--c:var(--hex-3)"></i> 많음</div><ul class="statl"><li>조사 일수 (12주)<b>${runDays}</b></li><li>마지막 조사<b>${esc(h.totals.lastRun ?? "-")}</b></li><li>회차당 발견<b>${allRuns ? (h.totals.claims / allRuns).toFixed(1) : "0"}</b></li></ul></section>`;

  // shared patterns as cards: label · question · verdict · one chip per collection
  const axCard = (a) => {
    const cs = Object.entries(a.cats).sort((x, y) => y[1] - x[1]);
    return `<article class="axcard" id="axis-${esc(a.id)}" data-search="${searchText(a.label, a.question, a.verdict, cs.map(([n]) => titleOf.get(n)))}">
  <header><strong>${esc(a.label)}</strong><span class="count"><b>${cs.length}</b> 조사</span></header>
  ${a.question ? `<p class="q">${esc(a.question)}</p>` : ""}
  ${a.verdict ? `<p class="verdict">${inline(a.verdict, hcite)}</p>` : ""}
  <div class="schips">${cs.map(([n, k]) => `<a class="schip" href="${esc(n)}/index.html#axis-${esc(a.id)}" title="${esc(titleOf.get(n) ?? n)} — ${k}개 ${esc(UNIT[h.cats.find((c) => c.name === n)?.domain] ?? "제품")}"><b>${k}</b>${esc(short(titleOf.get(n) ?? n, 26))}</a>`).join("")}</div>
</article>`;
  };
  const sharedSection = `<section id="shared">${sectionHead("", "교차 패턴", "두 조사 이상에서 나온 해법. 한 분야의 답을 다른 분야에서 참고할 수 있는 지점입니다. 칩의 숫자는 그 조사에서 이 패턴을 가진 제품 수이고, 누르면 그 보드의 패턴 카드로 갑니다. 결론 줄은 <code>ref axes set</code>의 <code>verdict</code>입니다.")}${
    shared.length ? `<div class="axcards" data-limit="12" data-items=".axcard">${shared.map(axCard).join("")}</div><button class="morebtn" type="button" hidden></button>` : `<p class="muted">아직 두 조사 이상에 걸친 패턴이 없습니다.</p>`
  }${
    otherFacets.length
      ? `<details class="sgroup" style="margin-top:18px"><summary class="muted" style="cursor:pointer">패턴이 아닌 공통 속성 ${otherFacets.length}개 (${[...new Set(otherFacets.map((a) => FACET_KO[a.facet] ?? a.facet))].join(" · ")})</summary><div class="axcards" style="margin-top:10px">${otherFacets.map(axCard).join("")}</div></details>`
      : ""
  }<p class="muted small" style="margin-top:14px">한 조사에만 있는 패턴 ${patternAxes.length - shared.length}개는 각 보드의 '패턴 비교'에 있습니다.</p></section>`;

  // recent activity: last five runs across the library
  const recentSection = h.recent?.length
    ? `<section id="recent">${sectionHead("", "최근 활동", "마지막 조사 회차 5개. 목표 → 결과(<code>ref report</code>의 <code>result</code>) → 새 발견 수.")}<ol class="runs">${h.recent
        .map(
          (r) => `<li class="run" data-search="${searchText(r.id, r.title, r.goal, r.result)}"><div class="rh">${idBtn(r.id)}<span class="rd">${esc(r.startedAt.slice(0, 10))}${r.endedAt && r.endedAt.slice(0, 10) !== r.startedAt.slice(0, 10) ? ` → ${esc(r.endedAt.slice(0, 10))}` : ""}</span></div>
<div class="rg"><a href="${esc(r.collection)}/index.html">${esc(r.title)}</a> — ${esc(r.goal ?? "")}</div>${r.result ? `<div class="rr">→ ${esc(r.result)}</div>` : ""}
<div class="rc">${r.created ? `<span class="chip">새 발견 ${r.created}</span>` : `<span class="muted small">새 발견 없음</span>`}${!r.endedAt && r.startedAt >= "2026-10-19" ? ` <span class="pill">진행 중</span>` : ""}</div></li>`,
        )
        .join("")}</ol></section>`
    : "";
  // open questions across the library: the three most recent collections open, the rest folded per collection
  const withQ = sorted.filter((c) => c.openQuestions?.length);
  const totalQ = withQ.reduce((n, c) => n + c.openQuestions.length, 0);
  const oqGroup = (c, open) => `<details class="oq sgroup"${open ? " open" : ""}><summary><a href="${esc(c.name)}/index.html">${esc(c.title ?? c.name)}</a><span class="muted small">${c.openQuestions.length}개${c.lastRun ? ` · ${esc(c.lastRun)}` : ""}</span>${c.inProgress ? `<span class="pill">진행 중</span>` : ""}</summary><ul>${c.openQuestions.map((q) => `<li data-search="${searchText(q, c.title)}">${inline(withIntent(q)[0], hcite)}${withIntent(q)[1] ? `<small class="muted" style="display:block">의도: ${inline(withIntent(q)[1], hcite)}</small>` : ""}</li>`).join("")}</ul><div class="oqact">${promptAction("이 질문들로 이어서 하기", continuePrompt(c), { preview: true, hint: "이 조사의 열린 질문을 담은 프롬프트를 복사합니다" })}<a class="muted small" href="${esc(c.name)}/index.html#key">보드의 핵심 결론 보기 →</a></div></details>`;
  const openSection = withQ.length
    ? `<section id="openq">${sectionHead("", "미해결 질문", `아직 답하지 못한 질문 ${totalQ}개 (${withQ.length}개 조사). 최근 조사 ${Math.min(3, withQ.length)}개는 펼쳐져 있고 나머지는 제목을 누르면 열립니다.`)}<div class="panel oqs">${withQ.map((c, i) => oqGroup(c, i < 3)).join("")}</div></section>`
    : "";
  // references reused across collections — folded, ten at a time
  const srRow = (r) => `<tr data-search="${searchText(r.id, r.product, r.page, r.label, r.categories.map(([, t]) => t))}"><td class="n">${idBtn(r.id)}</td><td>${r.thumb ? `<span class="mini"><img loading="lazy" src="${esc(r.thumb)}" alt=""></span>` : ""}<strong>${esc(r.product ?? r.label ?? r.id)}</strong>${r.page ? ` <span class="muted">· ${esc(r.page)}</span>` : ""}</td><td class="n">${esc(r.credibility ?? "")} <span class="muted small">${esc(TYPE_KO[r.type] ?? r.type ?? "")}</span></td><td class="n num">${r.cited || `<span class="muted">0</span>`}</td><td>${r.categories.map(([n, t]) => `<a class="chip" href="${esc(n)}/index.html#${esc(r.id)}">${esc(short(t, 22))}</a>`).join("")}</td></tr>`;
  const graphRefs = [];
  const graphCols = new Set();
  for (const r of h.sharedRefs ?? []) {
    const names = r.categories.map(([n]) => n);
    if (graphRefs.length >= 3) break;
    if (new Set([...graphCols, ...names]).size > 6) continue;
    names.forEach((n) => graphCols.add(n));
    graphRefs.push(r);
  }
  const catByName = new Map(h.cats.map((c) => [c.name, c]));
  const shGraph = graphRefs.length
    ? `<div class="dgwrap">${sharedGraph("shg", { cols: [...graphCols].map((n) => ({ name: n, title: catByName.get(n)?.title ?? n, refs: catByName.get(n)?.refs ?? 0, tag: topicLabel.get(catByName.get(n)?.topic) ? short(topicLabel.get(catByName.get(n)?.topic), 6) : "조사" })), refs: graphRefs.map((r) => ({ id: r.id, name: r.product ?? r.label ?? r.id, sub: r.page ?? TYPE_KO[r.type] ?? "", in: r.categories.map(([n]) => n), view: false })) })}</div>${(h.sharedRefs?.length ?? 0) > graphRefs.length ? `<p class="muted small">그래프는 가장 많이 쓰인 레퍼런스 ${graphRefs.length}개(조사 6개 이하)만 그림. 전체는 아래 목록.</p>` : ""}`
    : "";
  const sharedRefsSection = h.sharedRefs?.length
    ? `<section id="sharedrefs">${sectionHead("", "공유 레퍼런스", `한 번 모은 레퍼런스를 다른 조사가 다시 쓴 것 ${h.sharedRefs.length}개. 많이 쓰인 순.`)}${shGraph}<details class="sgroup"><summary class="muted" style="cursor:pointer">목록 보기</summary><div class="panel tablewrap" style="padding:0;margin-top:10px"><table class="docs"><thead><tr><th class="n">번호</th><th>레퍼런스</th><th class="n">출처 등급</th><th class="n">인용</th><th>쓴 조사</th></tr></thead><tbody data-limit="10" data-items="tr" data-limit-always>${h.sharedRefs.map(srRow).join("")}</tbody></table></div><button class="morebtn" type="button" hidden></button></details></section>`
    : "";
  // findings search: every active finding is in the page but only shows while a search is typed
  const frow = (f) => {
    const [t, b] = splitTitle(f);
    const first = f.collections[0];
    return `<a class="frow" href="${esc(first?.[0] ?? "")}/index.html#${esc(f.id)}" data-search="${searchText(f.id, f.subject, f.text, f.collections.map(([, x]) => x))}"><span class="fh">${idBtn(f.id)}<i class="kdot k-${esc(f.kind)}" title="${esc(KIND[f.kind]?.[0] ?? f.kind)}"></i><strong>${f.key ? `<span class="star">핵심</span>` : ""}${esc(t)}</strong>${confBadge(f.confidence)}</span>${b ? `<span class="fb">${esc(short(b, 160))}</span>` : ""}<span class="fm">${f.collections.map(([, x]) => `<span class="chip">${esc(short(x, 22))}</span>`).join("")}<span class="muted small">출처 ${f.sources}</span></span></a>`;
  };
  const findingsSection = h.findings?.length
    ? `<section id="findings">${sectionHead("", "발견 검색", `라이브러리의 발견 ${h.findings.length}개 전부. 위 검색창에 입력하면 여기에 맞는 발견이 나옵니다 — 누르면 그 보드의 발견으로 갑니다.`)}<div class="askbar"><span class="pact"><button class="pbtn big askbtn" type="button" data-copy="" title="검색어로 Claude에게 묻는 프롬프트를 복사합니다">이 검색어로 Claude에게 묻기</button></span></div><div class="frows" data-limit="10" data-items=".frow" data-limit-always>${h.findings.map(frow).join("")}</div><button class="morebtn" type="button" hidden></button></section>`
    : "";
  return shell("레퍼런스 라이브러리", side, topbar, `${ghead}${staleNote}${kpis}${timeline}${catsSection}${activity}${sharedRefsSection}${sharedSection}${recentSection}${openSection}${findingsSection}<footer>~/references · <code>ref report</code>를 실행할 때마다 다시 만들어집니다</footer>`, false);
}
