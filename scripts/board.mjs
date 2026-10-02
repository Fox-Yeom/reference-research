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
`;

const JS = `
(()=>{
// reference toolbar: role segment, pattern select, sort, view
const gal=document.getElementById('gallery');
if(gal){
  const st={role:'',axis:'',sort:'default',view:'grid'};
  const cards=[...gal.querySelectorAll('.card')];const orig=cards.slice();
  const apply=()=>{
    let n=0;
    cards.forEach(c=>{const ok=(!st.role||c.dataset.role===st.role)&&(!st.axis||(' '+c.dataset.axes+' ').includes(' '+st.axis+' '));c.classList.toggle('filtered',!ok);c.style.display=ok&&!c.classList.contains('hidden-by-search')?'':'none';if(ok)n++;});
    const box=gal.querySelector('.cards');
    const sorted=st.sort==='name'?cards.slice().sort((a,b)=>a.dataset.name.localeCompare(b.dataset.name,'ko')):st.sort==='recent'?cards.slice().sort((a,b)=>(b.dataset.date||'').localeCompare(a.dataset.date||'')):orig;
    sorted.forEach(c=>box.appendChild(c));
    gal.querySelector('.cards').hidden=st.view!=='grid';gal.querySelector('.rows').hidden=st.view!=='rows';gal.querySelector('.flows-view').hidden=st.view!=='flow';
    gal.querySelectorAll('.rows .row, .flows-view .flow').forEach(r=>{r.style.display=(!st.role||r.dataset.role===st.role)&&(!st.axis||(' '+r.dataset.axes+' ').includes(' '+st.axis+' '))?'':'none'});
    const s=gal.querySelector('.shown');if(s)s.textContent=n+'개 표시';
  };
  gal.querySelectorAll('.seg[data-k] button').forEach(b=>b.addEventListener('click',()=>{const seg=b.parentElement;seg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));st[seg.dataset.k]=b.dataset.v;apply();}));
  gal.querySelectorAll('select[data-k]').forEach(s=>s.addEventListener('change',()=>{st[s.dataset.k]=s.value;apply();}));
  apply();
}
// search: references, findings, patterns, topics
const qs=[...document.querySelectorAll('input.q')];
if(qs.length){
  const items=()=>document.querySelectorAll('[data-search]');
  let q=qs[0];
  const vis=()=>qs.find(x=>x.offsetParent!==null)||qs[0];
  const run=()=>{qs.forEach(x=>{if(x!==q)x.value=q.value});const t=q.value.trim().toLowerCase();document.body.classList.toggle('searching',!!t);let n=0;
    items().forEach(el=>{const hit=!t||el.dataset.search.includes(t);el.classList.toggle('hidden-by-search',!hit);if(t&&hit)n++;});
    const info=document.querySelector('.searchinfo');if(info)info.textContent=t?('"'+q.value+'" 검색 결과 '+n+'개 — Esc로 지우기'):'';
    document.querySelectorAll('.card').forEach(c=>{if(!c.classList.contains('filtered'))c.style.display=c.classList.contains('hidden-by-search')?'none':''});
    // collapse groups that lost every match (no empty table shells), and say so per section
    const shown=el=>[...el.querySelectorAll('[data-search]')].some(x=>!x.classList.contains('hidden-by-search'));
    document.querySelectorAll('.sgroup').forEach(g=>{const has=g.querySelector('[data-search]');g.classList.toggle('search-collapsed',!!t&&!!has&&!shown(g));});
    document.querySelectorAll('main section').forEach(sec=>{const has=sec.querySelector('[data-search]');let m=sec.querySelector(':scope > .nomatch');const empty=!!t&&!!has&&!shown(sec);
      sec.classList.toggle('search-empty',empty);
      if(empty){if(!m){m=document.createElement('p');m.className='nomatch';sec.appendChild(m);}m.textContent='"'+q.value+'"와 일치하는 항목이 이 섹션에는 없습니다.';}else if(m)m.remove();});};
  qs.forEach(x=>x.addEventListener('input',()=>{q=x;run();}));
  document.addEventListener('keydown',e=>{const act=qs.includes(document.activeElement);if(e.key==='/'&&!act&&!document.getElementById('viewer')?.classList.contains('open')){e.preventDefault();vis().focus();}else if(e.key==='Escape'&&act){q=document.activeElement;q.value='';run();q.blur();}});
}
})();
`;

const VIEWER = `<div id="viewer" role="dialog" aria-modal="true" aria-label="캡처 보기">
<header><span class="t"></span><span class="modes"></span><a class="orig" target="_blank" rel="noopener">원본 사이트 ↗</a><button class="notesbtn" title="정보·노트 패널 (N)">정보</button><button class="pref" title="이전 레퍼런스 (Shift+←)">‹ 이전</button><button class="nref" title="다음 레퍼런스 (Shift+→)">다음 ›</button><button class="close" title="닫기 (Esc)">✕</button></header>
<div class="stage"></div><aside hidden><div class="facts"></div><h5>분석 노트</h5><div class="prose"></div></aside><div class="strip"></div></div>`;

const VIEWER_JS = `
(()=>{
const V=document.getElementById('viewer'),stage=V.querySelector('.stage'),strip=V.querySelector('.strip'),side=V.querySelector('aside');
const MODES={frames:'화면 단위',full:'전체 페이지',screens:'스크린샷'};
let cards=[],ci=0,data=null,mode='',idx=0,showNotes=true;
const has=c=>c&&c.dataset.viewer&&JSON.parse(c.dataset.viewer).preview;
const visible=()=>[...document.querySelectorAll('.card[data-viewer]')].filter(c=>c.style.display!=='none'&&has(c));
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
  const facts=card.querySelector('template.facts-src'),notes=card.querySelector('template.notes-src');
  side.querySelector('.facts').innerHTML=facts?facts.innerHTML:'';
  side.querySelector('.prose').innerHTML=notes?notes.innerHTML:'<p style="color:#a3a097">노트 없음</p>';
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
  let sec = 0;
  const next = () => String(++sec).padStart(2, "0");

  const navItems = [
    ["summary", "한눈에 보기"],
    ...(d.curriculum ? [["curriculum", "커리큘럼 비교"]] : []),
    ...(d.axes.rows.length ? [["axes", "패턴 비교"]] : []),
    ["refs", "레퍼런스"],
    ["claims", "발견과 근거"],
    ["changes", "조사 기록"],
    ["sources", "출처"],
  ];
  const side = `<a class="brand" href="../index.html">References <span>/ 라이브러리</span></a>
<div class="about"><strong>${esc(col.title ?? col.name)}</strong><br>${esc(col.description ?? "")}</div>
${searchBox("레퍼런스·발견·패턴 검색")}
<nav>${navItems.map(([h, t]) => `<a href="#${h}">${t}</a>`).join("")}</nav>
<div class="foot">${productCount}개 ${d.curriculum ? "강의" : "제품"} · ${d.members.length}개 레퍼런스 · ${active.length}개 발견<br>${lastRun ? `마지막 조사 ${esc(lastRun.startedAt.slice(0, 10))}` : ""}</div>`;
  const topbar = `<a class="brand" href="../index.html">References</a>${searchBox("검색")}`;

  const hero = `<header class="hero">
<div class="eyebrow">${esc({ category: "카테고리 조사", service: "서비스 분석" }[col.kind] ?? col.kind ?? "")} · ${esc({ design: "디자인·기획", curriculum: "커리큘럼", dev: "개발", research: "연구" }[col.domain] ?? col.domain)}${lastRun ? ` · 마지막 조사 ${esc(lastRun.startedAt.slice(0, 10))}` : ""}</div>
<h1>${esc(col.title ?? col.name)}</h1>
${col.description ? `<p class="lead">${esc(col.description)}</p>` : ""}
<p class="stats"><b>${productCount}개 ${d.curriculum ? "강의" : "제품"}</b>${basisCount ? `와 <b>${basisCount}개 근거 자료</b>` : ""}에서 <b>${d.members.length}개 레퍼런스</b>를 모아 <b>${active.length}개 발견</b>을 정리했습니다${d.axes.rows.length ? ` — 제품들이 같은 문제를 푼 방식은 <b>${d.axes.rows.length}개 패턴</b>으로 묶었고${shared ? `, 그중 ${shared}개는 다른 조사에서도 나왔습니다` : ""}` : ""}. 근거가 강한 발견 ${active.filter((c) => c.confidence === "high").length}개, 보통 ${active.filter((c) => c.confidence === "medium").length}개, 약한 발견 ${active.filter((c) => c.confidence === "low").length}개${d.runs.length ? ` · 조사 ${d.runs.length}회` : ""}.</p>
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
  <header><strong>${esc(r.label)}</strong><span class="count"><b>${r.products.length}</b> / ${n} 제품</span></header>
  ${r.question ? `<p class="q">${esc(r.question)}</p>` : ""}
  <ul class="how">${r.products.map((p) => { const th = byRef.get(r.refBy[p])?.thumb; return `<li><button class="prod" data-open-ref="${esc(r.refBy[p])}" title="${esc(p)} 캡처 보기">${th ? `<span class="mini"><img loading="lazy" src="${esc(th)}" alt=""></span>` : `<span class="mini"></span>`}<span class="pn">${esc(p)}</span></button><span>${r.how[p].map(esc).join(" · ")}</span></li>`; }).join("")}</ul>
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
    return `<article class="card" id="${r.id}" data-role="${esc(m.role ?? "")}" data-axes="${esc(m.axes.join(" "))}" data-name="${esc(r.product ?? r.label ?? r.id)}" data-date="${esc(snap?.at ?? "")}" data-viewer="${esc(JSON.stringify(viewer))}" data-search="${searchText(r.id, r.product, r.page, r.label, r.title, r.tags, m.axes.map(axisLabel), notes.map((x) => x.text))}">
  ${m.thumb ? `<button class="thumb" data-view="" title="크게 보기"><img loading="lazy" src="${esc(m.thumb)}" alt="${esc(r.label ?? r.id)}">${pics ? `<span class="count">${m.frames.length ? `${m.frames.length}화면` : `${m.screens.length}장`}</span>` : ""}<span class="go" aria-hidden="true">↗</span></button>` : `<a class="thumb empty" href="${esc(r.url)}" target="_blank" rel="noopener">글 출처 ↗</a>`}
  <div class="cap"><div class="t"><div class="p">${esc(r.product ?? r.label ?? r.id)}</div><div class="s">${esc(r.page ?? r.title ?? "")}</div></div><div class="r">${m.role ? `<span class="role r-${esc(m.role)}">${ROLE_KO[m.role] ?? esc(m.role)}</span><br>` : ""}${other.length ? `다른 조사 ${other.length} · ` : ""}${r.id}</div></div>
  <template class="facts-src">${facts}</template><template class="notes-src">${notesHtml}</template>
</article>`;
  };
  const ordered = d.products.flatMap((p) => p.members);
  const rows = d.products
    .map(
      (p) => `<div class="row" data-role="${esc(p.role ?? "")}" data-axes="${esc([...new Set(p.members.flatMap((m) => m.axes))].join(" "))}" data-search="${searchText(p.name, p.members.map((m) => [m.r.page, m.r.label]))}">
  <div><h4>${esc(p.name)}</h4>${p.role ? `<span class="badge b-${esc(p.role)}">${ROLE_KO[p.role] ?? esc(p.role)}</span>` : ""}<div class="muted small" style="margin-top:6px">${p.members.length}개 페이지</div></div>
  <div class="strip">${p.members
    .map((m) => `<div>${m.thumb ? `<button class="thumb" data-open-ref="${m.r.id}"><img loading="lazy" src="${esc(m.thumb)}" alt=""></button>` : `<div class="thumb empty">이미지 없음</div>`}<div class="label">${esc(m.r.page ?? m.r.label ?? m.r.id)}</div></div>`)
    .join("")}</div></div>`,
    )
    .join("");
  const seqs = ordered
    .filter((m) => m.frames.length > 1 || m.screens.length > 1)
    .map((m) => {
      const mode = m.frames.length > 1 ? "frames" : "screens";
      const list = mode === "frames" ? m.frames : m.screens;
      return `<div class="flow" data-role="${esc(m.role ?? "")}" data-axes="${esc(m.axes.join(" "))}" data-search="${searchText(m.r.product, m.r.page, m.r.label)}">
  <div class="fh"><div><span class="p">${esc(m.r.product ?? m.r.label ?? m.r.id)}</span> <span class="s">${esc(m.r.page ?? "")}</span></div><span class="s">${list.length}${mode === "frames" ? "개 화면 · 스크롤 순서" : "장 · 스토어 순서"}</span></div>
  <div class="seq">${list.map((src, i) => `${i ? `<span class="arrow" aria-hidden="true">→</span>` : ""}<div class="step"><button class="thumb${mode === "frames" ? " wide" : ""}" data-open-ref="${m.r.id}" data-mode="${mode}" data-idx="${i}"><img loading="lazy" src="${esc(src)}" alt=""></button><div class="n">${i + 1}</div></div>`).join("")}</div>
</div>`;
    })
    .join("");
  const roleSeg = ["", "direct", "indirect", "analogous"].filter((r) => !r || d.members.some((m) => m.role === r));
  const usedAxes = d.axes.rows.filter((r) => r.products.length > 1);
  const refs = `<section id="refs">${sectionHead(next(), "레퍼런스", `보기는 세 가지 — <b>격자</b>(한 장씩), <b>제품별</b>(제품 하나에 여러 페이지), <b>흐름</b>(한 페이지의 화면을 순서대로). 이미지를 누르면 뷰어가 열립니다: <kbd>←</kbd><kbd>→</kbd> 화면 · <kbd>Shift</kbd>+<kbd>←</kbd><kbd>→</kbd> 다른 레퍼런스 · <kbd>N</kbd> 정보 · <kbd>Esc</kbd> 닫기`)}
<div id="gallery">
<div class="toolbar">
  ${roleSeg.length > 2 ? `<div class="seg" data-k="role">${roleSeg.map((r) => `<button data-v="${r}"${r ? "" : ' class="on"'}>${r ? ROLE_KO[r] : "전체"}</button>`).join("")}</div>` : ""}
  ${usedAxes.length ? `<select data-k="axis" aria-label="패턴으로 거르기"><option value="">모든 패턴</option>${usedAxes.map((r) => `<option value="${esc(r.id)}">${esc(r.label)}</option>`).join("")}</select>` : ""}
  <select data-k="sort" aria-label="정렬"><option value="default">기본 순서</option><option value="name">제품 이름순</option><option value="recent">최근 캡처순</option></select>
  <span class="spacer"></span><span class="shown"></span>
  <div class="seg" data-k="view"><button data-v="grid" class="on">격자</button><button data-v="rows">제품별</button><button data-v="flow">흐름</button></div>
</div>
<div class="cards">${ordered.map(card).join("")}</div>
<div class="rows" hidden>${rows}</div>
<div class="flows-view" hidden>${seqs || `<p class="muted">여러 화면으로 된 레퍼런스가 없습니다.</p>`}</div>
</div>
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
  const claimRow = (c) => `<div class="claim" id="${c.id}" data-search="${searchText(c.id, c.subject, c.text)}">
  <div class="text">${c.subject ? `<span class="subj">${esc(c.subject)}</span> — ` : ""}${esc(c.text)}${c.status !== "active" ? ` <em class="muted">(${c.status === "refuted" ? "틀린 것으로 확인" : "수정됨"} → <a href="#${c.replacedBy}">${c.replacedBy}</a>)</em>` : ""}</div>
  <div class="side2">${confBadge(c.confidence)}<span class="cid">${c.id}</span></div>
  <div class="evidence">${evidence(c.sources)}</div>
</div>`;
  const kinds = Object.keys(KIND).filter((k) => active.some((c) => c.kind === k));
  const corrected = d.claims.own.filter((c) => c.status !== "active");
  const claims = `<section id="claims">${sectionHead(next(), "발견과 근거", "조사에서 나온 주장과 그 근거. 근거 세기는 출처의 수와 등급으로 자동 계산됩니다. 썸네일을 누르면 근거 화면이 열립니다.")}${
    active.length || d.claims.related.length
      ? kinds.map((k) => `<div class="kindgroup sgroup"><h3><i class="kdot k-${k}"></i>${KIND[k][0]} <span>${KIND[k][1]} · ${active.filter((c) => c.kind === k).length}개</span></h3><div class="panel">${active.filter((c) => c.kind === k).map(claimRow).join("")}</div></div>`).join("") +
        (d.claims.related.length ? `<div class="kindgroup sgroup"><h3>다른 조사의 발견 <span>같은 레퍼런스를 근거로 쓴 것 · ${d.claims.related.length}개</span></h3><div class="panel">${d.claims.related.map(claimRow).join("")}</div></div>` : "") +
        (corrected.length ? `<details class="corrections sgroup"><summary>이후 조사에서 정정된 발견 ${corrected.length}개</summary><div class="panel" style="margin-top:10px">${corrected.map(claimRow).join("")}</div></details>` : "")
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

  const sources = `<section id="sources">${sectionHead(next(), "출처", "등급 A 공식·1차 자료 · B 언론·조사 기관 · C 커뮤니티·블로그 · D 미확인")}<div class="panel tablewrap" style="padding:0"><table><thead><tr><th>번호</th><th>제목</th><th>등급</th><th>발행처</th><th>포함된 조사</th></tr></thead><tbody>${d.sources
    .map(
      (r) =>
        `<tr id="${memberIds.has(r.id) ? `src-row-${r.id}` : `src-${r.id}`}" data-search="${searchText(r.id, r.label, r.title, r.publisher)}"><td class="num">${memberIds.has(r.id) ? `<a href="#${r.id}">${r.id}</a>` : r.id}</td><td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label ?? r.title ?? r.url)}</a></td><td>${esc(r.credibility)} <span class="muted small">${esc(r.type)}</span></td><td>${esc(r.publisher ?? "")}</td><td>${(r.categories ?? []).map((c) => `<span class="chip">${esc(d.catTitle(c))}</span>`).join("")}</td></tr>`,
    )
    .join("")}</tbody></table></div></section>`;

  const foot = `<footer>${esc(col.name)} · 생성 ${esc(new Date().toLocaleString("ko-KR"))} · <code>ref report</code>로 다시 만들 수 있습니다</footer>`;
  return shell(`${col.title ?? col.name} — 레퍼런스 보드`, side, topbar, hero.replace("</header>", collage + "</header>") + summary + curriculum + axes + refs + claims + changes + sources + foot);
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

/** h: { cats:[{name, title, description, kind, domain, refs, products, claims, run, thumbs:[], topAxes:[labels]}], axes:[{id, label, question, facet, cats:{name:n}}], totals } */
export function renderHome(h) {
  const side = `<a class="brand" href="index.html">References <span>/ 라이브러리</span></a>
<div class="about">조사할 때마다 모은 레퍼런스와 발견. 같은 레퍼런스는 한 번만 저장하고, 여러 조사에 걸쳐 다시 씁니다.</div>
${searchBox("조사·패턴 검색")}
<nav><a href="#cats">조사</a><a href="#shared">조사 사이에 겹치는 패턴</a></nav>
<div class="foot">${h.cats.length}개 조사 · ${h.totals.refs}개 레퍼런스 · ${h.totals.claims}개 발견<br>${esc(new Date().toLocaleDateString("ko-KR"))} 기준</div>`;
  const topbar = `<a class="brand" href="index.html">References</a>${searchBox("검색")}`;
  const cats = h.cats
    .map(
      (c) => `<a class="card catcard" href="${esc(c.name)}/index.html" data-search="${searchText(c.title, c.description, c.topAxes)}">
  ${c.thumbs.length ? `<span class="thumb" style="cursor:pointer"><img loading="lazy" src="${esc(c.thumbs[0])}" alt=""><span class="go" aria-hidden="true">↗</span></span>` : `<span class="thumb empty">이미지 없음</span>`}
  <span class="cap"><span class="t"><div class="p">${esc(c.title ?? c.name)}</div><div class="s">${esc({ category: "카테고리 조사", service: "서비스 분석" }[c.kind] ?? c.kind ?? "")} · ${esc({ design: "디자인·기획", curriculum: "커리큘럼", dev: "개발", research: "연구" }[c.domain] ?? c.domain)}</div></span><span class="r">${c.products}개 제품<br>${c.claims}개 발견</span></span>
  <span class="muted small" style="display:block">${esc(c.description ?? "")}</span></a>`,
    )
    .join("");
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
<section id="cats">${sectionHead("01", "조사", "카테고리별 레퍼런스 보드.")}<div class="catcards">${cats}</div></section>
<section id="shared">${sectionHead("02", "조사 사이에 겹치는 패턴", "숫자는 각 조사에서 그 패턴을 가진 제품 수입니다. 한 분야의 해법을 다른 분야에서 참고할 수 있는 지점이며, 숫자를 누르면 해당 보드의 패턴 카드로 갑니다.")}${
      sharedAxes.length ? table(sharedAxes) : `<p class="muted">아직 두 조사 이상에 걸친 패턴이 없습니다.</p>`
    }<details style="margin-top:14px"><summary class="muted" style="cursor:pointer">한 조사에만 있는 패턴 ${h.axes.length - sharedAxes.length}개 보기</summary><div style="margin-top:10px">${table(h.axes.filter((a) => !sharedAxes.includes(a)))}</div></details></section>
<footer>~/references · <code>ref report</code>를 실행할 때마다 다시 만들어집니다</footer>`,
    false,
  );
}
