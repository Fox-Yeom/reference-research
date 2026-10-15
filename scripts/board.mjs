/**
 * board — the HTML template for every collection board and the library home (self-contained, light/dark).
 *
 * Board: 한눈에 보기 · (커리큘럼 비교) · 패턴 비교 · 레퍼런스 · 발견과 근거 · 조사 기록 · 출처
 * Design follows the reference-library research (reference-library-ui-category): search-first [C42], one filter row
 * [C43], image-first cards + product rows [C44], insights traced to evidence [C45], library size as one sentence
 * [C46], editorial tone [C49], no popups/ads [C48].
 */

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
:root{--bg:#fbfbfd;--mat:#eef1f8;--panel:#fff;--panel2:#f4f6fb;--text:#14161c;--muted:#5d6475;--faint:#9aa1b2;--line:#e4e7ef;--chip:#eef1f7;--chip-on:#2f5bea;--chip-on-text:#fff;
--accent:#2f5bea;--accent-soft:#e6ecfd;--accent-2:#9db3f6;
--blue:#2f5bea;--blue-soft:#e6ecfd;--violet:#7c5ce6;--violet-soft:#efeafd;--teal:#0e9488;--teal-soft:#dff4f1;--amber:#d4870f;--amber-soft:#fcf0dc;--coral:#e0533d;--coral-soft:#fde7e3;--green:#1f9d55;--green-soft:#dff3e7;--gray-soft:#eef0f4;
--good:var(--green);--warn:var(--amber);--bad:var(--coral);--radius:10px}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0e1016;--mat:#1a1e29;--panel:#141821;--panel2:#181c26;--text:#e9ecf3;--muted:#98a0b3;--faint:#5d6578;--line:#252a36;--chip:#1d2230;--chip-on:#6f8ff5;--chip-on-text:#0e1016;--accent:#7d9bf7;--accent-soft:#1c2747;--accent-2:#3c5299;--blue:#7d9bf7;--blue-soft:#1c2747;--violet:#a68ff2;--violet-soft:#2a2246;--teal:#3cc3b4;--teal-soft:#123532;--amber:#f0b04e;--amber-soft:#3a2c14;--coral:#f2846f;--coral-soft:#3d1f1a;--green:#4fcb83;--green-soft:#163423;--gray-soft:#1d2230}}
:root[data-theme=dark]{--bg:#0e1016;--mat:#1a1e29;--panel:#141821;--panel2:#181c26;--text:#e9ecf3;--muted:#98a0b3;--faint:#5d6578;--line:#252a36;--chip:#1d2230;--chip-on:#6f8ff5;--chip-on-text:#0e1016;--accent:#7d9bf7;--accent-soft:#1c2747;--accent-2:#3c5299;--blue:#7d9bf7;--blue-soft:#1c2747;--violet:#a68ff2;--violet-soft:#2a2246;--teal:#3cc3b4;--teal-soft:#123532;--amber:#f0b04e;--amber-soft:#3a2c14;--coral:#f2846f;--coral-soft:#3d1f1a;--green:#4fcb83;--green-soft:#163423;--gray-soft:#1d2230}
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
th,td{border-bottom:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top}th{color:var(--muted);font-weight:500;font-size:12.5px;white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
.cites{white-space:nowrap}.cite{display:inline-block;font-size:11px;font-weight:600;line-height:1;padding:3px 6px;margin:0 2px;border-radius:999px;background:var(--accent-soft);color:var(--accent);text-decoration:none;vertical-align:1px}.cite:hover{text-decoration:none;background:var(--accent);color:#fff}
.chip{display:inline-block;font-size:12px;line-height:1.5;padding:2px 9px;margin:2px 4px 2px 0;border-radius:999px;background:var(--chip);color:var(--muted)}
.badge{font-size:12px;color:var(--muted);white-space:nowrap}
.conf{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:2px 9px 2px 8px;border-radius:999px;white-space:nowrap;background:var(--gray-soft);color:var(--muted)}.conf::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.conf.high{background:var(--green-soft);color:var(--green)}.conf.medium{background:var(--amber-soft);color:var(--amber)}.conf.low{background:var(--coral-soft);color:var(--coral)}
.note{background:var(--amber-soft);color:var(--amber);border-radius:8px;padding:10px 14px;font-size:14px;margin:12px 0}
.role{display:inline-block;font-size:11.5px;font-weight:600;padding:1px 8px;border-radius:999px;white-space:nowrap}.r-direct{background:var(--blue-soft);color:var(--blue)}.r-indirect{background:var(--amber-soft);color:var(--amber)}.r-analogous{background:var(--teal-soft);color:var(--teal)}
.kdot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:2px;vertical-align:0}.k-pattern{background:var(--blue)}.k-benchmark{background:var(--violet)}.k-fact{background:var(--teal)}.k-gap{background:var(--amber)}.k-failure{background:var(--coral)}.k-opinion,.k-hypothesis{background:var(--faint)}
.muted{color:var(--muted)}.small{font-size:13px}
.prod{font:inherit;font-size:13.5px;font-weight:500;background:none;border:0;padding:0;color:var(--accent);cursor:zoom-in;text-align:left}.prod:hover{text-decoration:underline;text-underline-offset:3px}
/* pattern cards */
.groupcap{display:flex;align-items:baseline;gap:10px;margin:28px 0 12px}.groupcap h3{margin:0}.groupcap span{color:var(--muted);font-size:13px}
.axcards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.axcard{border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px;display:flex;flex-direction:column;background:var(--panel);border-top:3px solid var(--accent-2)}
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
.toolbar select{font:inherit;font-size:13px;padding:5px 28px 5px 12px;border:0;border-radius:999px;background:var(--chip);color:var(--text);appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);background-position:calc(100% - 15px) 52%,calc(100% - 10px) 52%;background-size:5px 5px;background-repeat:no-repeat}
.toolbar .spacer{flex:1}.toolbar .shown{font-size:13px;color:var(--faint)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:36px 24px}
.card{display:flex;flex-direction:column;gap:10px;min-width:0}
.thumb{display:block;position:relative;width:100%;border:0;cursor:zoom-in;aspect-ratio:4/3;background:var(--mat);border-radius:8px;padding:16px;overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:cover;object-position:top;display:block;border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,.06)}
.thumb .count{position:absolute;left:12px;bottom:2px;font-size:10.5px;line-height:14px;color:var(--accent);font-weight:600}
.thumb .go{position:absolute;right:10px;bottom:10px;width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font-size:13px;opacity:0;transition:opacity .15s;box-shadow:0 0 0 1px var(--line)}
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
.band{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-top:3px solid var(--accent);border-bottom:1px solid var(--line);margin:4px 0 30px}
.band div{padding:16px 18px 18px 0;border-right:1px solid var(--line);margin-right:18px}.band div:last-child{border-right:0}
.band b{display:block;font-size:40px;line-height:1.1;font-weight:300;letter-spacing:-.03em}.band b small{font-size:16px;font-weight:400;margin-left:2px;color:var(--muted);letter-spacing:0}
.band span{display:block;margin-top:6px;font-size:12.5px;color:var(--muted)}
.bar{display:inline-block;vertical-align:middle;width:calc(100% - 78px);max-width:220px;height:6px;border-radius:3px;background:var(--chip);overflow:hidden;margin-right:8px}
.bar{background:var(--accent-soft)}.bar .fill{display:block;height:100%;background:var(--accent);border-radius:3px}td .bar.hands .fill,.bar.hands .fill{background:var(--teal)}td .bar.hands{background:var(--teal-soft)}
.barv{font-size:12.5px;color:var(--muted);white-space:nowrap}
.pill{display:inline-block;font-size:12px;font-weight:600;padding:1px 9px;border-radius:999px;white-space:nowrap;background:var(--violet-soft);color:var(--violet)}
table.viz td{vertical-align:middle}
.topics{border-top:3px solid var(--accent)}
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
#viewer{position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;z-index:100;display:none;background:#0b0b0b;color:#ececec}
#viewer.open{display:grid;grid-template-rows:auto 1fr auto;grid-template-columns:1fr auto}
#viewer header{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #222;flex-wrap:wrap}
#viewer header .t{margin-right:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#viewer header .t small{color:#8f8f8f;margin-left:8px}
#viewer button,#viewer header a{font:inherit;font-size:13px;color:#ececec;background:#1a1a1a;border:0;border-radius:999px;padding:6px 13px;cursor:pointer;text-decoration:none}
#viewer button:hover,#viewer header a:hover{background:#262626}#viewer .modes button.on{background:#5b7ff0;color:#fff}#viewer button:disabled{opacity:.3;cursor:default}
#viewer .stage{position:relative;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:20px}
#viewer .stage.fit{align-items:center}#viewer .stage.fit img{max-width:100%;max-height:100%;object-fit:contain;cursor:zoom-in}
#viewer .stage.zoom img{max-width:none;max-height:none;cursor:zoom-out}
#viewer .stage.scroll{flex-direction:column;align-items:center}#viewer .stage.scroll img{display:block;width:min(100%,1280px);height:auto}
#viewer .nav{position:fixed;top:50%;transform:translateY(-50%);font-size:20px!important;width:44px;height:44px;padding:0!important;background:rgba(26,26,26,.9)!important}
#viewer .nav.prev{left:16px}#viewer .nav.next{right:calc(16px + var(--side,0px))}
#viewer .count{position:fixed;left:50%;transform:translateX(-50%);bottom:96px;font-size:12px;color:#bdbdbd;background:rgba(0,0,0,.6);padding:3px 10px;border-radius:999px}
#viewer .strip{grid-column:1;display:flex;gap:8px;overflow-x:auto;padding:10px 16px;border-top:1px solid #222}
#viewer .strip img{height:64px;width:auto;border-radius:4px;opacity:.45;cursor:pointer;flex:none}#viewer .strip img.on{opacity:1;box-shadow:0 0 0 2px #5b7ff0}
#viewer aside{grid-row:2/4;grid-column:2;width:min(400px,34vw);overflow:auto;border-left:1px solid #222;padding:18px 22px;background:#111;font-size:14px;line-height:1.65}
#viewer aside[hidden]{display:none}#viewer aside h5{margin:0 0 8px;font-size:12px;font-weight:500;color:#8f8f8f}
#viewer aside .facts{margin:0 0 16px;padding:0 0 14px;border-bottom:1px solid #222}#viewer aside .facts div{margin:2px 0;color:#c4c4c4}
#viewer aside .chip{background:#1f1f1f;color:#c4c4c4}#viewer aside a{color:#ececec}#viewer aside .prose{color:#d6d6d6}#viewer aside .cite{background:#1f1f1f;color:#bdbdbd}

/* ---- layout color (indigo theme): tinted page, dark sidebar, gradient hero, sections as cards ---- */
:root{--bg:#eef1fa;--page:#eef1fa;--side-bg:#191d3a;--side-text:#e8eaf6;--side-muted:#9aa0c3;--side-line:#2b3058;--hero-a:#3348d6;--hero-b:#7a4fe0;--inner:#f5f7fd}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0b0d16;--page:#0b0d16;--side-bg:#121530;--side-text:#e3e6f6;--side-muted:#8a90b5;--side-line:#23284a;--hero-a:#2a3aa8;--hero-b:#5b3bb0;--inner:#171b27}}
:root[data-theme=dark]{--bg:#0b0d16;--page:#0b0d16;--side-bg:#121530;--side-text:#e3e6f6;--side-muted:#8a90b5;--side-line:#23284a;--hero-a:#2a3aa8;--hero-b:#5b3bb0;--inner:#171b27}
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
.hero{max-width:none;margin:0 0 24px;padding:40px 44px 36px;border-radius:20px;color:#fff;background:radial-gradient(1200px 400px at 100% 0%,rgba(255,255,255,.14),transparent 60%),linear-gradient(120deg,var(--hero-a),var(--hero-b))}
.hero .eyebrow{color:rgba(255,255,255,.75)}.hero h1{color:#fff}.hero .lead{color:rgba(255,255,255,.85);max-width:880px}
.hero .stats{color:rgba(255,255,255,.85);max-width:920px}.hero .stats b{color:#fff;background:linear-gradient(transparent 62%,rgba(255,255,255,.22) 62%)}
.hero .collage .thumb{background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
section{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:32px 36px 36px;margin:0 0 24px;box-shadow:0 1px 2px rgba(25,29,58,.04),0 8px 24px rgba(25,29,58,.04)}
.sechead .n{display:inline-grid;place-items:center;width:30px;height:24px;padding:0;border-radius:7px;background:var(--accent);color:#fff;font-size:12px;margin-top:2px}
section .panel{background:var(--inner);border-color:transparent}
.axcard,.cflow{background:var(--panel)}
.toolbar,.searchinfo{background:var(--panel)}
.searchinfo{border-radius:12px;padding:12px 16px;margin-bottom:16px;border:1px solid var(--line);color:var(--accent);font-weight:500}
.band{border-top:0;border-bottom:0;gap:10px;grid-template-columns:repeat(5,minmax(0,1fr))}
.band div{margin:0;border:0;border-radius:12px;padding:16px 18px}
.band div:nth-child(1){background:var(--blue-soft)}.band div:nth-child(2){background:var(--violet-soft)}.band div:nth-child(3){background:var(--teal-soft)}.band div:nth-child(4){background:var(--amber-soft)}.band div:nth-child(5){background:var(--green-soft)}
.band div:nth-child(1) b{color:var(--blue)}.band div:nth-child(2) b{color:var(--violet)}.band div:nth-child(3) b{color:var(--teal)}.band div:nth-child(4) b{color:var(--amber)}.band div:nth-child(5) b{color:var(--green)}
.topics{border-top:0}.topics .thead{background:var(--inner);border-radius:8px;padding:8px 12px;border-bottom:0}
.thumb{background:var(--mat)}
footer{border-top:0;text-align:center}
@media (max-width:1100px){.topbar{background:var(--side-bg)!important;border-bottom:0!important}.topbar .brand{color:#fff}.topbar .search input{background:rgba(255,255,255,.1);border-color:transparent;color:#fff}.content{padding:18px 14px 60px}.hero{padding:28px 22px;border-radius:16px}section{padding:24px 18px;border-radius:14px}}
body.viewing{overflow:hidden}body.viewing .topbar{visibility:hidden}
@media (max-width:760px){#viewer.open{grid-template-columns:1fr}#viewer aside{grid-column:1;grid-row:auto;width:auto;max-height:38vh;border-left:0;border-top:1px solid #222}#viewer .nav.next{right:16px}#viewer .count{bottom:auto;top:58px}}
/* ---- readability pass (docs/BOARD-REDESIGN.md, phase 1): goal block, stat tiles, 3-line claim cards, limited lists, copyable ids, scrollspy ---- */
.hero .goal{margin:18px 0 0;padding:16px 20px;border-radius:14px;background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);max-width:72ch}
.hero .goal .lbl{display:block;font-size:11.5px;font-weight:700;letter-spacing:.08em;color:rgba(255,255,255,.75);margin-bottom:4px}
.hero .goal p{margin:0;font-size:17px;line-height:1.55;color:#fff;font-weight:500}.hero .goal p .cite{background:rgba(255,255,255,.2);color:#fff}
.hero .goal .aud{margin-top:6px;font-size:14px;font-weight:400;color:rgba(255,255,255,.82)}
.tiles{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:22px 0 0}
.tiles div{background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16);border-radius:12px;padding:14px 16px;min-width:0}
.tiles b{display:block;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-.02em;color:#fff}
.tiles span{display:block;margin-top:5px;font-size:12.5px;line-height:1.45;color:rgba(255,255,255,.78)}
.tiles .mbar{display:flex;height:5px;border-radius:3px;overflow:hidden;margin-top:9px;background:rgba(255,255,255,.18)}
.tiles .mbar i{display:block;height:100%}.tiles .mbar .h{background:#6fe3a5}.tiles .mbar .m{background:#ffd27a}.tiles .mbar .l{background:#ff9d8a}
.hero .lead,.sechead p{max-width:72ch}
.side nav a{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.side nav a small{font-size:11.5px;opacity:.7;font-variant-numeric:tabular-nums}.side nav a.on{color:#fff;background:rgba(255,255,255,.1)}
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
.seg button.tog.on{background:var(--teal);color:#fff}
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
.seg.tabs button{display:inline-flex;align-items:center;gap:6px}.seg.tabs button small{font-size:11px;opacity:.75;font-variant-numeric:tabular-nums}.seg.tabs .kdot{width:8px;height:8px;margin:0}
#viewer aside .vtabs{display:flex;gap:6px;margin:0 0 10px}#viewer aside .vtabs button{padding:4px 11px;font-size:12.5px}#viewer aside .vtabs button.on{background:#5b7ff0;color:#fff}
#viewer aside .vcl{list-style:none;margin:0;padding:0}#viewer aside .vcl li{padding:9px 0;border-top:1px solid #222;color:#d6d6d6;font-size:13.5px}#viewer aside .vcl li:first-child{border-top:0}#viewer aside .vcl a{color:#9db3f6;font-weight:600;margin-right:8px}#viewer aside .vcl .conf{font-size:11px;padding:1px 7px 1px 6px}
@media (max-width:1100px){.tiles{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:860px){.keygrid{grid-template-columns:1fr}}
@media (max-width:640px){.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.hero .goal p{font-size:15.5px}.claim .chead{flex-direction:column;gap:6px}}
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
  const refresh=()=>{const all=document.body.classList.contains('searching');let n=0,rest=0;
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
  const st={role:'',axis:'',run:'',sort:'default',view:'grid'};
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
  const done=()=>{say(v+' 복사됨 — Claude에게 "'+v+' 다시 확인해줘"처럼 붙여 쓸 수 있습니다');b.classList.add('done');setTimeout(()=>b.classList.remove('done'),1200);};
  const fallback=()=>{const ta=document.createElement('textarea');ta.value=v;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(_){say('복사하지 못했습니다 — 직접 선택해 주세요');}ta.remove();};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(v).then(done,fallback);else fallback();});
// side nav follows the section in view; "맨 위로" after a screen of scrolling
const nav=$$('.side nav a[href^="#"]');
if(nav.length&&'IntersectionObserver' in window){
  const secs=nav.map(a=>document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  const io=new IntersectionObserver(es=>{es.forEach(en=>{if(en.isIntersecting)nav.forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+en.target.id));});},{rootMargin:'-18% 0px -72% 0px'});
  secs.forEach(s=>io.observe(s));
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
  side.querySelector('.prose').innerHTML=notes&&notes.innerHTML.trim()?notes.innerHTML:'<p style="color:#a3a097">노트 없음</p>';
  side.querySelector('.vclaims').innerHTML=cls&&cls.innerHTML.trim()?cls.innerHTML:'<p style="color:#a3a097">이 화면을 근거로 쓴 발견이 아직 없습니다</p>';
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
const ROLE_KO = { direct: "직접 경쟁", indirect: "간접 경쟁", analogous: "유사 분야" };
const KIND = { pattern: ["패턴", "여러 곳에서 반복되는 해법"], benchmark: ["기준치", "수치로 본 수준"], fact: ["사실", "확인된 정보"], gap: ["빈틈", "아무도(거의) 하지 않는 것"], failure: ["실패 사례", "불만·문제·피할 점"], opinion: ["의견", "평가·리뷰"], hypothesis: ["가설", "근거 없이 세운 추정"] };
const sectionHead = (n, title, desc, extra = "") => `<div class="sechead"><span class="n">${n}</span><h2>${title}</h2>${extra}${desc ? `<p>${desc}</p>` : ""}</div>`;
const searchText = (...parts) => esc(parts.flat().filter(Boolean).join(" ").toLowerCase());
const DOMAIN_KO = { design: "디자인·기획", curriculum: "커리큘럼", dev: "개발", research: "연구" };
const KIND_KO = { category: "카테고리 조사", service: "서비스 분석" };
const UNIT = { design: "제품", dev: "제품", curriculum: "강의", research: "출처" };
const TYPE_KO = { official: "공식", docs: "문서", store: "스토어", repo: "저장소", paper: "논문", report: "보고서", press: "언론", framework: "기준", survey: "설문", "job-posting": "채용 공고", community: "커뮤니티", blog: "블로그", listicle: "목록글", capture: "캡처", other: "기타" };
const short = (s, n) => ((s = String(s ?? "")), s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
/** copyable id chip — one click puts S#/C#/R# on the clipboard to hand to Claude */
const idBtn = (id, extra = "") => `<button class="idbtn" data-copy="${esc(id)}" title="클릭하면 ${esc(id)} 복사 — Claude에게 '${esc(id)} 다시 확인해줘'라고 말할 수 있습니다"${extra}>${esc(id)}</button>`;
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
 * (also "**제목**" / "**제목:** text" lines). Returns { goal, changed, key, common, recommend, open } → body markdown, unknown headings ignored.
 */
const SUMMARY_KEYS = [
  ["goal", /목표|목적|goal/i],
  ["changed", /바뀐|변경|changed/i],
  ["key", /핵심|주요 발견|key|takeaway/i],
  ["common", /공통|차별|common/i],
  ["recommend", /추천|다음 (할 일|단계)|권장|recommend|next/i],
  ["open", /열린|미해결|질문|open question/i],
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
  const otherCats = [...new Set(d.members.flatMap((m) => (m.r.categories ?? []).filter((c) => c !== col.name)))];
  let sec = 0;
  const next = () => String(++sec).padStart(2, "0");

  // key takeaways: collection.highlights → claims marked key → summary "핵심 발견" list → strongest claims
  const sum = splitSummary(d.summary);
  const claimById = new Map([...d.claims.own, ...d.claims.related].map((c) => [c.id, c]));
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
  const plain = (md) => String(md).replace(/\*\*/g, "").replace(/\[([SC]\d+(?:\s*,\s*[SC]\d+)*)\]/g, "").replace(/\s+/g, " ").trim();
  const continuePrompt = `reference-research 스킬로 "${col.title ?? col.name}" 조사(컬렉션 ${col.name})를 이어서 해줘.${openQ.length ? ` 열린 질문: ${openQ.map((q, i) => `${i + 1}) ${plain(q)}`).join(" ")}` : ""}${nextS.length ? ` 다음 할 일: ${nextS.map((q, i) => `${i + 1}) ${plain(q)}`).join(" ")}` : ""}`;
  const keyItem = (c) => {
    const [t, b] = splitTitle(c);
    return `<li><div><span class="kt"><a href="#${c.id}">${esc(t)}</a></span>${b ? `<div class="kb">${esc(short(b, 140))}</div>` : ""}<div class="cmeta">${confBadge(c.confidence)}${idBtn(c.id)}${c.asOf ? `<span class="sep">·</span><span>기준 ${esc(c.asOf)}</span>` : ""}<span class="sep">·</span><span>출처 ${c.sources.length}</span></div></div></li>`;
  };
  const keySection =
    keyClaims.length || keyLines.length || openQ.length || nextS.length
      ? `<section id="key">${sectionHead(next(), "핵심 결론", `이 조사에서 가장 중요한 것 ${keyClaims.length || keyLines.length}가지와 아직 답하지 못한 것. ${{ highlights: "결론은 <code>ref report</code>의 <code>highlights</code>로 고른 것", key: "결론은 <code>key</code>로 표시한 발견", auto: "결론은 근거가 강하고 출처가 많은 발견을 자동으로 고른 것 — <code>highlights</code>나 <code>key</code>로 바꿀 수 있습니다", "": "" }[keySource]}${keyLines.length ? "결론은 요약의 '핵심 발견' 항목" : ""}.`)}
<div class="keygrid"><div class="panel">${
          keyClaims.length ? `<ol class="keylist">${keyClaims.map(keyItem).join("")}</ol>` : keyLines.length ? `<ol class="keylist">${keyLines.map((l) => `<li><div><span class="kt">${inline(l, cite)}</span></div></li>`).join("")}</ol>` : `<p class="muted">아직 발견이 없습니다.</p>`
        }</div>
<div class="panel openq">${openQ.length ? `<h4>열린 질문</h4><ul data-limit="5" data-items="li">${openQ.map((q) => `<li>${inline(q, cite)}</li>`).join("")}</ul>${openQ.length > 5 ? `<button class="morebtn small" type="button" hidden></button>` : ""}` : ""}${nextS.length ? `<h4${openQ.length ? ' style="margin-top:14px"' : ""}>다음 할 일 · 추천</h4><ul data-limit="5" data-items="li">${nextS.map((q) => `<li>${inline(q, cite)}</li>`).join("")}</ul>${nextS.length > 5 ? `<button class="morebtn small" type="button" hidden></button>` : ""}` : ""}${
          !openQ.length && !nextS.length ? `<p class="muted small">요약에 <code>## 열린 질문</code> · <code>## 추천</code> 절을 쓰거나 <code>ref report</code>에 <code>open_questions</code> · <code>next_steps</code>를 넘기면 여기에 표시됩니다.</p>` : ""
        }<button class="pbtn big" type="button" data-copy="${esc(continuePrompt)}" title="Claude에게 붙여 넣을 프롬프트를 복사합니다">이 조사 이어서 하기 — 프롬프트 복사</button></div></div></section>`
      : "";

  const navItems = [
    ...(keySection ? [["key", "핵심 결론", keyClaims.length || keyLines.length]] : []),
    ["summary", "한눈에 보기", ""],
    ...(d.curriculum ? [["curriculum", "커리큘럼 비교", d.curriculum.n]] : []),
    ...(d.axes.rows.length ? [["axes", "패턴 비교", d.axes.rows.length]] : []),
    ["refs", "레퍼런스", d.members.length],
    ["claims", "발견과 근거", active.length],
    ["changes", "조사 기록", d.runs.length],
    ["sources", "출처", d.sources.filter((r) => citedBy.has(r.id)).length],
  ];
  const side = `<a class="brand" href="../index.html">References <span>/ 라이브러리</span></a>
<div class="about"><strong>${esc(col.title ?? col.name)}</strong><br>${esc(col.description ?? "")}</div>
${searchBox("레퍼런스·발견·패턴 검색")}
<nav>${navItems.map(([h, t, n]) => `<a href="#${h}">${t}${n ? `<small>${n}</small>` : ""}</a>`).join("")}</nav>
<div class="foot">${productCount}개 ${unit} · ${d.members.length}개 레퍼런스 · ${active.length}개 발견<br>${lastRun ? `마지막 조사 ${esc(lastRun.startedAt.slice(0, 10))}` : ""}</div>`;
  const topbar = `<a class="brand" href="../index.html">References</a>${searchBox("검색")}`;

  // why this research exists — collection goal, else the last run's goal, else the summary's 목표 line
  const goal = col.goal ?? col.question ?? lastRun?.goal ?? goalFromSummary(d.summary);
  const goalBlock = goal
    ? `<div class="goal"><span class="lbl">목적</span><p>${inline(goal, cite)}</p>${col.audience ? `<p class="aud">대상: ${esc(col.audience)}</p>` : ""}${otherCats.length ? `<p class="aud">같은 레퍼런스를 쓰는 다른 조사: ${otherCats.map((c) => `<a href="../${esc(c)}/index.html" style="color:#fff;text-decoration:underline">${esc(d.catTitle(c))}</a>`).join(", ")}</p>` : ""}</div>`
    : "";
  const unitSub = col.domain === "research" ? `${unit} · ${typeMix(d.members.map((m) => m.r.id), typeOf, 2)}` : `${unit}${basisCount ? ` · 근거 자료 ${basisCount}` : ""}`;
  const tiles = `<div class="tiles">
<div><b>${productCount}</b><span>${esc(unitSub)}</span></div>
<div><b>${d.members.length}</b><span>레퍼런스 · 캡처 ${captured} · 글 자료 ${d.members.length - captured}</span></div>
<div><b>${active.length}</b><span>발견 · 강함 ${conf("high")} · 보통 ${conf("medium")} · 약함 ${conf("low")}</span><em class="mbar"><i class="h" style="flex:${conf("high")}"></i><i class="m" style="flex:${conf("medium")}"></i><i class="l" style="flex:${conf("low")}"></i></em></div>
<div><b>${d.axes.rows.length}</b><span>패턴${shared ? ` · 다른 조사와 공유 ${shared}` : ""}</span></div>
<div><b>${d.runs.length}</b><span>조사 회차${lastRun ? ` · 마지막 ${esc(lastRun.startedAt.slice(0, 10))}` : ""}</span></div>
</div>`;
  const hero = `<header class="hero">
<div class="eyebrow">${esc(KIND_KO[col.kind] ?? col.kind ?? "")} · ${esc(DOMAIN_KO[col.domain] ?? col.domain)}${lastRun ? ` · 마지막 조사 ${esc(lastRun.startedAt.slice(0, 10))}` : ""}</div>
<h1>${esc(col.title ?? col.name)}</h1>
${col.description ? `<p class="lead">${esc(col.description)}</p>` : ""}
${goalBlock}${tiles}
</header>`;

  const picks = [];
  for (const p of d.products) {
    const m = p.members.find((x) => x.thumb);
    if (m && picks.length < 8) picks.push(m);
  }
  const collage = picks.length >= 3 ? `<div class="collage">${picks.map((m) => `<button class="thumb" data-open-ref="${m.r.id}" title="${esc(m.r.product ?? m.r.id)}"><img loading="lazy" src="${esc(m.thumb)}" alt=""></button>`).join("")}</div>` : "";
  const summary = `<section id="summary">${sectionHead(next(), "한눈에 보기", "조사 결과 요약. 문장 끝의 번호(C·S)를 누르면 해당 발견이나 레퍼런스로 이동합니다.")}${
    d.summary ? `<div class="panel prose">${md(d.summary, cite)}</div>` : `<p class="muted">요약이 아직 없습니다 — <code>ref report</code>에 <code>summary_file</code>을 넘기면 여기에 표시됩니다.</p>`
  }${d.citeWarn ? `<div class="note">${esc(d.citeWarn)}</div>` : ""}</section>`;

  const curriculum = d.curriculum ? renderCurriculum(d.curriculum, cite, next()) : "";

  // patterns
  const n = d.axes.products.length;
  const common = (r) => r.products.length >= Math.max(2, Math.ceil(n * 0.3));
  const axCard = (r) => `<article class="axcard" id="axis-${esc(r.id)}" data-search="${searchText(r.label, r.question, r.products, Object.values(r.how))}">
  <header><strong>${esc(r.label)}</strong><span class="count"><b>${r.products.length}</b> / ${n} ${esc(unit)}</span></header>
  ${r.question ? `<p class="q">${esc(r.question)}</p>` : ""}
  <ul class="how" data-limit="6" data-items="li">${r.products.map((p) => { const th = byRef.get(r.refBy[p])?.thumb; return `<li><button class="prod" data-open-ref="${esc(r.refBy[p])}" title="${esc(p)} 캡처 보기">${th ? `<span class="mini"><img loading="lazy" src="${esc(th)}" alt=""></span>` : `<span class="mini"></span>`}<span class="pn">${esc(p)}</span></button><span>${r.how[p].map(esc).join(" · ")}</span></li>`; }).join("")}</ul>${r.products.length > 6 ? `<button class="morebtn small" type="button" hidden></button>` : ""}
  ${r.other.length ? `<p class="also">${r.other.map((o) => `<a href="../${esc(o.name)}/index.html#axis-${esc(r.id)}">${esc(o.title)}</a> 조사에서도 같은 패턴 — ${o.products.map(esc).join(", ")}`).join("<br>")}</p>` : ""}
</article>`;
  const groups = [
    ["공통 패턴", "여러 제품이 갖춘 것 — 따라가야 할 기본기", d.axes.rows.filter(common), "g-common"],
    ["일부 제품의 패턴", "두 곳 이상이 쓰지만 보편적이지 않음 — 선택지", d.axes.rows.filter((r) => !common(r) && r.products.length > 1), "g-partial"],
    ["한 제품만의 패턴", "한 곳만 하는 것 — 차별점 후보이거나 아직 검증되지 않은 시도", d.axes.rows.filter((r) => r.products.length === 1), "g-unique"],
  ].filter(([, , rows]) => rows.length);
  const axes = d.axes.rows.length
    ? `<section id="axes">${sectionHead(
        next(),
        "패턴 비교",
        "여러 제품이 <strong>같은 문제</strong>를 각자 어떻게 풀었는지 묶어 봅니다. 제품 이름을 누르면 그 화면이 열립니다. <span style='color:var(--violet);font-weight:600'>보라색 상자</span>는 다른 조사에서도 같은 패턴이 나왔다는 뜻이고, 카드 위 선 색은 <span style='color:var(--green);font-weight:600'>공통</span> · <span style='color:var(--accent);font-weight:600'>일부</span> · <span style='color:var(--amber);font-weight:600'>한 제품만</span>을 나타냅니다.",
      )}${groups.map(([t, sub, rows, g]) => `<div class="sgroup ${g}"><div class="groupcap"><i class="gdot"></i><h3>${t}</h3><span>${sub} · ${rows.length}개</span></div><div class="axcards">${rows.map(axCard).join("")}</div></div>`).join("")}${
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
<div>${m.role ? `${ROLE_KO[m.role] ?? m.role} · ` : ""}출처 등급 ${esc(r.credibility)} (${esc(r.type)})${r.publisher ? ` · ${esc(r.publisher)}` : ""}</div>
${snap ? `<div>캡처 ${r.snapshots.length}회 · 최신 ${esc(snap.at.slice(0, 10))}${r.changes?.length ? ` · 변화 기록 ${r.changes.length}` : ""}</div>` : ""}
${other.length ? `<div>다른 조사에도 포함: ${other.map((c) => `<a href="../${esc(c)}/index.html#${r.id}">${esc(d.catTitle(c))}</a>`).join(", ")}</div>` : ""}
<div style="margin-top:8px">${[...(r.screens ?? []), ...m.axes.map(axisLabel)].map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
${r.changes?.length ? `<div style="margin-top:8px">${r.changes.map((c) => `${esc(c.at.slice(0, 10))}: ${esc(c.lines.join(" · ") || "변화 없음")}`).join("<br>")}</div>` : ""}`;
    const notesHtml = notes.map((x) => `${x.collection && x.collection !== col.name ? `<p style="color:#f0ad4e;font-size:12px;margin:12px 0 0">‹${esc(d.catTitle(x.collection))}› 조사에서 쓴 노트</p>` : ""}${md(x.text, cite)}`).join("<hr>");
    return `<article class="card" id="${r.id}" data-role="${esc(m.role ?? "")}" data-axes="${esc(m.axes.join(" "))}" data-run="${esc(m.run ?? "")}" data-name="${esc(r.product ?? r.label ?? r.id)}" data-date="${esc(snap?.at ?? "")}" data-claims="${citedBy.get(r.id) ?? 0}" data-viewer="${esc(JSON.stringify(viewer))}" data-search="${searchText(r.id, r.product, r.page, r.label, r.title, r.tags, m.axes.map(axisLabel), notes.map((x) => x.text))}">
  <button class="thumb" data-view="" title="크게 보기"><img loading="lazy" src="${esc(m.thumb)}" alt="${esc(r.label ?? r.id)}">${pics ? `<span class="count">${m.frames.length ? `${m.frames.length}화면` : `${m.screens.length}장`}</span>` : ""}<span class="go" aria-hidden="true">↗</span></button>
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
<td><a class="tt" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label ?? r.title ?? r.url)}</a>${r.description ? `<span class="sum">${esc(short(r.description, 140))}</span>` : ""}${notes.length ? `<details><summary>노트 ${notes.length}</summary><div class="prose">${notes.map((x) => md(x.text, cite)).join("<hr>")}</div></details>` : ""}</td>
<td>${esc(r.publisher ?? r.product ?? "")}</td>
<td class="n">${esc(r.credibility)} <span class="muted small">${esc(TYPE_KO[r.type] ?? r.type)}</span></td>
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
  const roleSeg = ["", "direct", "indirect", "analogous"].filter((r) => !r || d.members.some((m) => m.role === r));
  const usedAxes = d.axes.rows.filter((r) => r.products.length > 1);
  const runSelect = d.runs.length > 1 ? `<select data-k="run" aria-label="조사 회차로 거르기"><option value="">모든 회차</option>${d.runs.map((r) => `<option value="${esc(r.id)}">${esc(r.id)} · ${esc(short(r.goal ?? r.startedAt.slice(0, 10), 28))}</option>`).join("")}</select>` : "";
  const more = `<button class="morebtn" type="button" hidden></button>`;
  const refs = `<section id="refs">${sectionHead(next(), "레퍼런스", `캡처한 화면은 <b>격자</b>(한 장씩) · <b>제품별</b>(제품 하나에 여러 페이지) · <b>흐름</b>(한 페이지의 화면을 순서대로)으로 봅니다. 이미지를 누르면 뷰어가 열립니다: <kbd>←</kbd><kbd>→</kbd> 화면 · <kbd>Shift</kbd>+<kbd>←</kbd><kbd>→</kbd> 다른 레퍼런스 · <kbd>N</kbd> 정보 · <kbd>Esc</kbd> 닫기. 글로 읽은 자료(논문·기사·문서)는 아래 <b>자료 목록</b>에 있습니다.`)}
<div id="gallery">
<div class="toolbar">
  ${roleSeg.length > 2 ? `<div class="seg" data-k="role">${roleSeg.map((r) => `<button data-v="${r}"${r ? "" : ' class="on"'}>${r ? ROLE_KO[r] : "전체"}</button>`).join("")}</div>` : ""}
  ${usedAxes.length ? `<select data-k="axis" aria-label="패턴으로 거르기"><option value="">모든 패턴</option>${usedAxes.map((r) => `<option value="${esc(r.id)}">${esc(r.label)}</option>`).join("")}</select>` : ""}
  ${runSelect}
  <select data-k="sort" aria-label="정렬"><option value="default">기본 순서</option><option value="name">${esc(unit)} 이름순</option><option value="recent">최근 캡처순</option></select>
  <span class="spacer"></span><span class="shown"></span>
  <div class="seg" data-k="view"><button data-v="grid" class="on">격자</button><button data-v="rows">${esc(unit)}별</button><button data-v="flow">흐름</button></div>
</div>
<div class="gridview">${shots.length ? `<div class="cards" data-limit="12" data-items=".card">${shots.map(card).join("")}</div>${more}` : `<p class="muted">캡처한 화면이 없습니다${docs.length ? " — 이 조사의 레퍼런스는 모두 글 자료입니다(아래 목록)" : ""}.</p>`}</div>
<div class="rowsview" hidden>${rows ? `<div class="rows" data-limit="10" data-items=".row">${rows}</div>${more}` : `<p class="muted">캡처한 화면이 없습니다.</p>`}</div>
<div class="flows-view" hidden>${seqs ? `<div class="flowlist" data-limit="8" data-items=".flow">${seqs}</div>${more}` : `<p class="muted">여러 화면으로 된 레퍼런스가 없습니다.</p>`}</div>
</div>
${
  docs.length
    ? `<div class="sgroup docs"><div class="groupcap"><h3>자료 목록</h3><span>캡처 없이 글로 읽은 자료 · <span class="shown">${docs.length}개</span> · 노트가 있으면 펼쳐 볼 수 있습니다</span></div>
<div class="panel tablewrap" style="padding:0"><table><thead><tr><th class="n">번호</th><th>자료</th><th>발행처</th><th class="n">등급</th><th class="n">역할</th><th class="n">인용</th></tr></thead><tbody data-limit="20" data-items="tr">${docs.map(docRow).join("")}</tbody></table></div>${more}</div>`
    : ""
}
${d.coverageWarn ? `<div class="note">${esc(d.coverageWarn)}</div>` : ""}</section>`;

  // claims, grouped by kind, each with its evidence
  const evidence = (ids) =>
    ids
      .map((id) => {
        const m = byRef.get(id);
        const label = esc(m ? `${m.r.product ?? ""}${m.r.page ? " · " + m.r.page : ""}` : d.titleOf(id));
        return m?.thumb ? `<button class="ev" data-open-ref="${id}" title="${label}"><img src="${esc(m.thumb)}" alt="">${id}</button>` : `<a class="ev noimg" href="${memberIds.has(id) ? `#${id}` : `#src-${id}`}" title="${label}">${id}</a>`;
      })
      .join("");
  // a finding reads top-down: title → text (2 lines, then 더 보기) → meta (strength · run · date · source mix · id) → evidence → earlier versions
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
  <div class="cmeta">${idBtn(c.id)}${c.run ? `<span class="sep">·</span><span class="run" title="${esc(runGoal(c.run) || c.run)}">${esc(c.run)}</span>` : ""}${date ? `<span class="sep">·</span><span>${esc(date)}</span>` : ""}<span class="sep">·</span><span>출처 ${c.sources.length}${mix ? ` (${esc(mix)})` : ""}</span>${c.asOf ? `<span class="sep">·</span><span title="이 수치가 맞았던 날짜">기준 ${esc(c.asOf)}</span>` : ""}${c.scope ? `<span class="sep">·</span><span>${esc(c.scope)}</span>` : ""}${fixed ? `<span class="sep">·</span>${fixed}` : ""}<span class="sep">·</span><button class="pbtn" type="button" data-copy="${esc(recheck)}" title="Claude에게 붙여 넣을 '다시 확인' 프롬프트를 복사합니다">다시 확인</button></div>
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
      ? `<select data-k="run" aria-label="조사 회차로 거르기"><option value="">모든 회차</option>${claimRuns.map((r) => `<option value="${esc(r)}">${esc(r)} · ${esc(short(runGoal(r), 28))}</option>`).join("")}</select>`
      : claimRuns.length > 1
        ? `<div class="seg" data-k="run"><button data-v="" class="on">모든 회차</button>${claimRuns.map((r) => `<button data-v="${esc(r)}" title="${esc(runGoal(r))}">${esc(r)}</button>`).join("")}</div>`
        : "";
  const confSeg = `<div class="seg" data-k="conf"><button data-v="" class="on">모든 근거</button><button data-v="high">강함</button><button data-v="medium">보통</button><button data-v="low">약함</button></div>`;
  // one kind at a time (the biggest first); 전체 shows every group
  const kindCounts = kinds.map((k) => [k, active.filter((c) => c.kind === k).length]).sort((a, b) => b[1] - a[1]);
  const firstKind = active.length > 12 && kindCounts.length > 1 ? kindCounts[0][0] : "";
  const kindTabs = kindCounts.length > 1 ? `<div class="seg tabs" data-k="kind">${kindCounts.map(([k, n]) => `<button data-v="${k}"${k === firstKind ? ' class="on"' : ""}><i class="kdot k-${k}"></i>${KIND[k][0]} <small>${n}</small></button>`).join("")}<button data-v=""${firstKind ? "" : ' class="on"'}>전체 <small>${active.length}</small></button></div>` : "";
  const claims = `<section id="claims">${sectionHead(next(), "발견과 근거", "조사에서 나온 주장과 그 근거. 제목 → 내용 → 근거 세기·조사 회차·날짜·출처 구성 순으로 읽습니다. 근거 세기는 출처의 수와 등급으로 자동 계산되고, 썸네일을 누르면 근거 화면이 열립니다. 번호를 누르면 복사됩니다.")}${
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
  const changes = `<section id="changes">${sectionHead(next(), "조사 기록", "언제 무엇을 조사했고, 그때 무엇이 새로 나오거나 바뀌었는지.")}
<div class="panel tablewrap" style="padding:0"><table><thead><tr><th>회차</th><th>목표</th><th>날짜</th><th>새 발견</th><th>정정</th><th>재확인</th></tr></thead><tbody>${d.runs
    .map((r) => `<tr><td class="num">${r.id}</td><td>${esc(r.goal ?? "")}</td><td>${esc(r.startedAt.slice(0, 10))}</td><td>${r.counts.created}</td><td>${r.counts.revised + r.counts.refuted}</td><td>${r.counts.confirmed}</td></tr>`)
    .join("")}</tbody></table></div>
${cur && cur.refuted.length + cur.revised.length + cur.confirmed.length ? `<h3>최근 조사(${esc(cur.run)})에서 바뀐 것</h3><div class="panel prose"><ul>${[
    ...cur.refuted.map((c) => li("틀린 것으로 확인", c, ` <span class="muted">(${c.refutes} 대체)</span>`)),
    ...cur.revised.map((c) => li("수정", c, ` <span class="muted">(${c.revises} 대체)</span>`)),
    ...cur.confirmed.map((c) => li("다시 확인", c)),
  ].join("")}</ul></div>` : ""}
<h3>현행화</h3>${
    d.changes.length
      ? `<div class="panel prose"><ul>${d.changes.map(({ r, c }) => `<li><a href="#${r.id}">${r.id} ${esc(r.label ?? "")}</a> — ${esc(c.at.slice(0, 10))} (이전 ${esc(c.from.slice(0, 10))}): ${esc(c.lines.join(" · ") || "변화 없음")}</li>`).join("")}</ul></div>`
      : `<p class="muted small">다시 캡처해서 확인된 변화는 아직 없습니다. 30일이 지난 레퍼런스는 다음 캡처 때 자동으로 다시 찍어 이전과 비교합니다.</p>`
  }${d.stale.length ? `<div class="note">90일 넘게 다시 확인하지 않은 레퍼런스: ${d.stale.map((r) => r.id).join(", ")}</div>` : ""}</section>`;

  // sources: the citation index — cited-only by default, filter by grade / type, 20 rows at a time
  const grades = [...new Set(d.sources.map((r) => r.credibility))].sort();
  const types = [...new Set(d.sources.map((r) => r.type).filter(Boolean))].sort();
  const sources = `<section id="sources">${sectionHead(next(), "출처", "발견이 인용한 자료의 색인. 등급 A 공식·1차 자료 · B 언론·조사 기관 · C 커뮤니티·블로그 · D 미확인. 기본은 인용된 자료만 보이고, 끄면 이 조사의 모든 레퍼런스가 나옵니다.")}
<div class="stoolbar">${grades.length > 1 ? `<div class="seg" data-k="grade"><button data-v="" class="on">모든 등급</button>${grades.map((g) => `<button data-v="${esc(g)}">${esc(g)}</button>`).join("")}</div>` : ""}${types.length > 1 ? `<select data-k="type" aria-label="종류로 거르기"><option value="">모든 종류</option>${types.map((t) => `<option value="${esc(t)}">${esc(TYPE_KO[t] ?? t)}</option>`).join("")}</select>` : ""}<div class="seg" data-k="cited"><button class="tog on" type="button">인용된 것만</button></div><span class="shown"></span></div>
<div class="panel tablewrap" style="padding:0"><table><thead><tr><th class="n">번호</th><th>제목</th><th class="n">등급</th><th>발행처</th><th class="n">인용</th><th>포함된 조사</th></tr></thead><tbody data-limit="20" data-items="tr">${d.sources
    .map((r) => {
      const n = citedBy.get(r.id) ?? 0;
      return `<tr id="${memberIds.has(r.id) ? `src-row-${r.id}` : `src-${r.id}`}" data-grade="${esc(r.credibility)}" data-type="${esc(r.type ?? "")}" data-cited="${n}" data-search="${searchText(r.id, r.label, r.title, r.publisher)}"><td class="n">${idBtn(r.id)}${memberIds.has(r.id) ? ` <a href="#${r.id}" title="이 조사의 레퍼런스로 이동">↑</a>` : ""}</td><td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label ?? r.title ?? r.url)}</a></td><td class="n">${esc(r.credibility)} <span class="muted small">${esc(TYPE_KO[r.type] ?? r.type)}</span></td><td>${esc(r.publisher ?? "")}</td><td class="n num">${n || `<span class="muted">0</span>`}</td><td>${(r.categories ?? []).map((c) => (c === col.name ? esc(d.catTitle(c)) : `<a href="../${esc(c)}/index.html">${esc(d.catTitle(c))}</a>`)).join(", ")}</td></tr>`;
    })
    .join("")}</tbody></table></div><button class="morebtn" type="button" hidden></button></section>`;

  const foot = `<footer>${esc(col.name)} · 생성 ${esc(new Date().toLocaleString("ko-KR"))} · <code>ref report</code>로 다시 만들 수 있습니다</footer>`;
  return shell(`${col.title ?? col.name} — 레퍼런스 보드`, side, topbar, hero.replace("</header>", collage + "</header>") + keySection + summary + curriculum + axes + refs + claims + changes + sources + foot);
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
<div class="sgroup"><h3>강의별 흐름</h3><p class="muted small" style="margin-top:-6px">막대 길이 = 모듈 시간, <span style="color:var(--teal);font-weight:600">청록 칸</span> = 실습 모듈</p><div class="flows">${flows}</div></div>
${c.missing.length ? `<div class="note">강의 구조가 기록되지 않은 강의 페이지: ${c.missing.join(", ")} — <code>ref course set</code></div>` : ""}
</section>`;
}

// ---------- library home ----------

/** h: { cats:[{name, title, description, goal, lastRun, kind, domain, refs, products, claims, kinds:{kind:n}, run, thumbs:[], topAxes:[labels]}], axes:[{id, label, question, facet, cats:{name:n}}], totals } */
export function renderHome(h) {
  const side = `<a class="brand" href="index.html">References <span>/ 라이브러리</span></a>
<div class="about">조사할 때마다 모은 레퍼런스와 발견. 같은 레퍼런스는 한 번만 저장하고, 여러 조사에 걸쳐 다시 씁니다.</div>
${searchBox("조사·패턴 검색")}
<nav><a href="#cats">조사<small>${h.cats.length}</small></a><a href="#shared">조사 사이에 겹치는 패턴</a></nav>
<div class="foot">${h.cats.length}개 조사 · ${h.totals.refs}개 레퍼런스 · ${h.totals.claims}개 발견<br>${esc(new Date().toLocaleDateString("ko-KR"))} 기준</div>`;
  const topbar = `<a class="brand" href="index.html">References</a>${searchBox("검색")}`;
  // no capture → show what kinds of findings the research produced instead of an empty tile
  const kindBar = (c) => {
    const ks = Object.entries(c.kinds ?? {}).sort((a, b) => b[1] - a[1]);
    if (!ks.length) return `<span class="thumb empty">아직 발견이 없습니다</span>`;
    return `<span class="thumb kinds"><span class="kbar">${ks.map(([k, n]) => `<i class="k-${esc(k)}" style="flex:${n}" title="${esc(KIND[k]?.[0] ?? k)} ${n}"></i>`).join("")}</span><span class="klegend">${ks.slice(0, 4).map(([k, n]) => `<i class="kdot k-${esc(k)}"></i> ${esc(KIND[k]?.[0] ?? k)} ${n}`).join(" · ")}</span></span>`;
  };
  const catCard = (c) => `<a class="card catcard" href="${esc(c.name)}/index.html" data-search="${searchText(c.title, c.description, c.goal, c.topAxes)}">
  ${c.thumbs.length ? `<span class="thumb" style="cursor:pointer"><img loading="lazy" src="${esc(c.thumbs[0])}" alt=""><span class="go" aria-hidden="true">↗</span></span>` : kindBar(c)}
  <span class="cap"><span class="t"><div class="p">${esc(c.title ?? c.name)}</div><div class="s">${esc(KIND_KO[c.kind] ?? c.kind ?? "")} · ${esc(DOMAIN_KO[c.domain] ?? c.domain)}</div></span><span class="r">${c.products}개 ${esc(UNIT[c.domain] ?? "제품")}<br>${c.claims}개 발견</span></span>
  <span class="goal2">${esc(c.goal ?? c.description ?? "")}</span>
  <span class="meta2">${[c.lastRun ? `마지막 조사 ${esc(c.lastRun)}` : "", `레퍼런스 ${c.refs}`].filter(Boolean).join(" · ")}</span></a>`;
  const byDomain = ["design", "research", "dev", "curriculum"].map((dm) => [dm, h.cats.filter((c) => (c.domain ?? "design") === dm)]).filter(([, cs]) => cs.length);
  const rest = h.cats.filter((c) => !["design", "research", "dev", "curriculum"].includes(c.domain ?? "design"));
  if (rest.length) byDomain.push(["other", rest]);
  const cats =
    byDomain.length > 1
      ? byDomain.map(([dm, cs]) => `<div class="sgroup"><div class="groupcap"><h3>${esc(DOMAIN_KO[dm] ?? "기타")}</h3><span>${cs.length}개 조사</span></div><div class="catcards">${cs.map(catCard).join("")}</div></div>`).join("")
      : `<div class="catcards">${h.cats.map(catCard).join("")}</div>`;
  const total = (a) => Object.values(a.cats).reduce((x, y) => x + y, 0);
  h.axes.sort((a, b) => (a.facet === "pattern" ? 0 : 1) - (b.facet === "pattern" ? 0 : 1) || Object.keys(b.cats).length - Object.keys(a.cats).length || total(b) - total(a) || a.label.localeCompare(b.label));
  const sharedAxes = h.axes.filter((a) => Object.keys(a.cats).length > 1);
  const axisRow = (a) => `<tr data-search="${searchText(a.label, a.question)}"><td><strong>${esc(a.label)}</strong><div class="muted small">${esc(a.facet !== "pattern" ? { topic: "커리큘럼 주제", market: "시장", platform: "플랫폼", positioning: "포지셔닝" }[a.facet] ?? a.facet : a.question ?? "")}</div></td>${h.cats.map((c) => `<td class="num">${a.cats[c.name] ? `<a href="${esc(c.name)}/index.html#axis-${esc(a.id)}">${a.cats[c.name]}</a>` : `<span class="muted">—</span>`}</td>`).join("")}</tr>`;
  const table = (rows) => `<div class="panel tablewrap" style="padding:0"><table><thead><tr><th>패턴</th>${h.cats.map((c) => `<th>${esc(c.title ?? c.name)}</th>`).join("")}</tr></thead><tbody>${rows.map(axisRow).join("")}</tbody></table></div>`;
  return shell(
    "레퍼런스 라이브러리",
    side,
    topbar,
    `<header class="hero"><div class="eyebrow">레퍼런스 라이브러리</div><h1>조사해 둔 레퍼런스</h1>
<p class="stats"><b>${h.cats.length}개 조사</b>에서 <b>${h.totals.refs}개 레퍼런스</b>와 <b>${h.totals.claims}개 발견</b>을 모았습니다. 제품들이 같은 문제를 푼 방식은 <b>${h.axes.length}개 패턴·주제</b>로 묶여 있고, 그중 여러 조사에 걸친 것은 아래 표에 있습니다.</p></header>
<section id="cats">${sectionHead("01", "조사", "카테고리별 레퍼런스 보드. 카드의 한 줄은 그 조사의 목적입니다.")}${cats}</section>
<section id="shared">${sectionHead("02", "조사 사이에 겹치는 패턴", "숫자는 각 조사에서 그 패턴을 가진 제품 수입니다. 한 분야의 해법을 다른 분야에서 참고할 수 있는 지점이며, 숫자를 누르면 해당 보드의 패턴 카드로 갑니다.")}${
      sharedAxes.length ? table(sharedAxes) : `<p class="muted">아직 두 조사 이상에 걸친 패턴이 없습니다.</p>`
    }<details style="margin-top:14px"><summary class="muted" style="cursor:pointer">한 조사에만 있는 패턴 ${h.axes.length - sharedAxes.length}개 보기</summary><div style="margin-top:10px">${table(h.axes.filter((a) => !sharedAxes.includes(a)))}</div></details></section>
<footer>~/references · <code>ref report</code>를 실행할 때마다 다시 만들어집니다</footer>`,
    false,
  );
}
