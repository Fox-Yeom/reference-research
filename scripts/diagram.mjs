/**
 * diagram — static SVG figures for the board and home (board draft G, docs/BOARD-DRAFTS.md).
 * Node-link figures follow the diagram-design skill's grammar: ranked rows, rounded right-angle connectors (r=8),
 * fanned attach points, a hop where a horizontal crosses another edge's vertical, ≤9 nodes and ≤2 accents,
 * a legend strip at the bottom, and role="img" with prefixed <title>/<desc>. Colours are CSS variables of the page.
 * Every builder returns a string; nothing here touches the library.
 */
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/** text width budget: wide (CJK/Hangul) characters 1em, others 0.6em */
export const textW = (s, px) => [...String(s)].reduce((w, ch) => w + (/[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? 1 : 0.6), 0) * px;
const r4 = (n) => Math.ceil(n / 4) * 4;
const cut = (s, n) => ((s = String(s ?? "")), s.length > n ? s.slice(0, n - 1) + "…" : s);

/** one node box: opaque mask, box, rectangular type tag, optional count badge, name (sans), sublabel (mono) */
export function node(n) {
  const { x, y, w, h, tag, name, sub, badge, key, cls = "", tagColor = "var(--muted)", attrs = "" } = n;
  const cx = x + w / 2;
  const tw = r4(textW(tag, 8) + 10);
  const bw = badge ? r4(textW(badge, 9) + 10) : 0;
  return `<g class="dn ${cls}" data-key="${esc(key)}"${attrs}>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="var(--paper)"/><rect class="box" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>
<rect class="tag" x="${x + 8}" y="${y + 6}" width="${tw}" height="14" rx="2" stroke="${tagColor}"/><text x="${x + 8 + tw / 2}" y="${y + 17}" fill="${tagColor}" font-size="9.5" text-anchor="middle">${esc(tag)}</text>
${badge ? `<rect x="${x + w - bw - 6}" y="${y + 6}" width="${bw}" height="14" rx="2" fill="var(--chip)"/><text class="mono" x="${x + w - bw / 2 - 6}" y="${y + 17}" fill="var(--muted)" font-size="9" text-anchor="middle">${esc(badge)}</text>` : ""}
<text x="${cx}" y="${y + 38}" fill="var(--text)" font-size="13" font-weight="600" text-anchor="middle">${esc(name)}</text>
${sub ? `<text class="mono" x="${cx}" y="${y + 52}" fill="var(--muted)" font-size="10" text-anchor="middle">${esc(sub)}</text>` : ""}</g>`;
}

/** edges [{from,to,cls?,label?}] between nodes of adjacent rows (from above to below) → [{e, d}] path data */
export function edges(nodes, list, gap = 12) {
  const N = Object.fromEntries(nodes.map((n) => [n.key, n]));
  const es = list.filter((e) => N[e.from] && N[e.to]).map((e) => ({ ...e }));
  const outs = {}, ins = {};
  es.forEach((e) => { (outs[e.from] ??= []).push(e); (ins[e.to] ??= []).push(e); });
  // fan attach points, ordered by the other end's x so strokes never cross at the box
  for (const [k, l] of Object.entries(outs)) { l.sort((a, b) => N[a.to].x - N[b.to].x); l.forEach((e, i) => { const n = N[k]; e.x1 = n.x + (n.w * (i + 1)) / (l.length + 1); e.y1 = n.y + n.h; }); }
  for (const [k, l] of Object.entries(ins)) { l.sort((a, b) => N[a.from].x - N[b.from].x); l.forEach((e, i) => { const n = N[k]; e.x2 = n.x + (n.w * (i + 1)) / (l.length + 1); e.y2 = n.y; }); }
  // one horizontal level per bent edge in each gap, 12px apart; the widest turns first
  const gaps = {};
  for (const e of es) if (Math.abs(e.x1 - e.x2) > 1) (gaps[`${e.y1}:${e.y2}`] ??= []).push(e);
  for (const l of Object.values(gaps)) {
    l.sort((a, b) => Math.abs(b.x2 - b.x1) - Math.abs(a.x2 - a.x1));
    const mid = (l[0].y1 + l[0].y2) / 2;
    l.forEach((e, i) => { e.my = mid - ((l.length - 1) * gap) / 2 + i * gap; });
  }
  const r = 8;
  return es.map((e) => {
    if (Math.abs(e.x1 - e.x2) <= 1) return { e, d: `M${e.x1} ${e.y1} V${e.y2 - 2}` };
    const dir = e.x2 > e.x1 ? 1 : -1;
    const hops = es
      .filter((f) => f !== e)
      .flatMap((f) => (Math.abs(f.x1 - f.x2) <= 1 ? [[f.x1, f.y1, f.y2]] : [[f.x1, f.y1, f.my], [f.x2, f.my, f.y2]]).filter(([vx, a, b]) => vx > Math.min(e.x1, e.x2) + r + 6 && vx < Math.max(e.x1, e.x2) - r - 6 && e.my > Math.min(a, b) + 1 && e.my < Math.max(a, b) - 1).map(([vx]) => vx))
      .sort((a, b) => (a - b) * dir);
    const h = hops.map((hx) => ` H${hx - dir * 5} A5 5 0 0 ${dir > 0 ? 1 : 0} ${hx + dir * 5} ${e.my}`).join("");
    return { e, d: `M${e.x1} ${e.y1} V${e.my - r} A${r} ${r} 0 0 ${dir > 0 ? 0 : 1} ${e.x1 + dir * r} ${e.my}${h} H${e.x2 - dir * r} A${r} ${r} 0 0 ${dir > 0 ? 1 : 0} ${e.x2} ${e.my + r} V${e.y2 - 2}` };
  });
}

export const LEGEND = {
  dep: { svg: `<path d="M0 8 H24" stroke="var(--edge)" stroke-width="1.5" fill="none"/><polygon points="24 5, 30 8, 24 11" fill="var(--edge)"/>`, t: "기댐" },
  uses: { svg: `<path d="M0 8 H24" stroke="var(--edge)" stroke-width="1.5" fill="none"/><polygon points="24 5, 30 8, 24 11" fill="var(--edge)"/>`, t: "사용" },
  counter: { svg: `<path d="M0 8 H24" stroke="var(--coral)" stroke-width="1.5" stroke-dasharray="5 4" fill="none"/><polygon points="24 5, 30 8, 24 11" fill="var(--coral)"/>`, t: "반박" },
  sel: { svg: `<rect x="2" y="1" width="26" height="14" rx="4" fill="var(--sel-fill)" stroke="var(--accent)" stroke-width="1.5"/>`, t: "선택" },
  hop: { svg: `<path d="M0 8 H9 A5 5 0 0 1 19 8 H28" stroke="var(--edge)" stroke-width="1.5" fill="none"/>`, t: "교차" },
  more: { svg: `<rect x="2" y="1" width="26" height="14" rx="4" fill="none" stroke="var(--line2)" stroke-dasharray="3 2"/>`, t: "접힌 항목" },
};

/** a ranked node-link figure: nodes, edges, an optional accent overlay, a bottom legend strip */
export function figure(slug, W, H, title, desc, nodes, list, legend, extra = "") {
  const paths = edges(nodes, list);
  const crosses = paths.some(({ d }) => d.includes("A5 5"));
  const leg = crosses && !legend.includes(LEGEND.hop) ? [...legend, LEGEND.hop] : legend;
  const mk = (n, c) => `<marker id="${slug}-${n}" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="${c}"/></marker>`;
  const LY = H - 40;
  return `<svg class="dg" id="${slug}" viewBox="0 0 ${W} ${H}" width="${W}" style="min-width:${W}px;max-width:100%;height:auto" role="img" aria-labelledby="${slug}-title ${slug}-desc"><title id="${slug}-title">${esc(title)}</title><desc id="${slug}-desc">${esc(desc)}</desc>
<defs>${mk("a", "var(--edge)")}${mk("acc", "var(--coral)")}</defs>
${paths.map(({ e, d }) => `<path class="e ${e.cls ?? ""}" data-from="${esc(e.from)}" data-to="${esc(e.to)}" d="${d}" marker-end="url(#${slug}-a)"/>`).join("")}
${nodes.map(node).join("")}${extra}
<line x1="16" y1="${LY - 8}" x2="${W - 16}" y2="${LY - 8}" stroke="var(--line2)" stroke-width=".8"/>
<text x="16" y="${LY + 12}" fill="var(--faint)" font-size="10" letter-spacing=".1em">범례</text>
${leg.map((l, i) => `<g transform="translate(${64 + i * 150} ${LY})">${l.svg}<text x="34" y="12" fill="var(--muted)" font-size="11">${esc(l.t)}</text></g>`).join("")}</svg>`;
}

/** collections (top row) → references several of them share (bottom row); ≤6 collections and ≤3 references */
export function sharedGraph(slug, { cols, refs }) {
  const W = 820, w = 128, gap = 12;
  const x0 = (W - (cols.length * w + (cols.length - 1) * gap)) / 2;
  const nodes = cols.map((c, i) => ({ key: c.name, x: x0 + i * (w + gap), y: 24, w, h: 56, tag: c.tag, tagColor: "var(--green)", name: cut(c.title, 8), sub: `레퍼런스 ${c.refs}`, attrs: ` data-col="${esc(c.name)}"` }));
  const rw = 168, rx0 = (W - (refs.length * rw + (refs.length - 1) * 40)) / 2;
  refs.forEach((r, i) => nodes.push({ key: r.id, x: rx0 + i * (rw + 40), y: 24 + 56 + 112, w: rw, h: 56, tag: "공유", name: cut(`${r.id} ${r.name}`, 13), sub: r.sub, badge: `${r.in.length}곳`, cls: "ext", attrs: r.view ? ` data-open-ref="${esc(r.id)}"` : "" }));
  const list = refs.flatMap((r) => r.in.filter((n) => cols.some((c) => c.name === n)).map((n) => ({ from: n, to: r.id })));
  return figure(slug, W, 24 + 56 + 112 + 56 + 24 + 56, "공유 레퍼런스", `조사 ${cols.length}개가 레퍼런스 ${refs.length}개를 함께 씀.`, nodes, list, [LEGEND.uses]);
}

/** collections on a date axis: a bar from first to last run, a dot per run; the newest real collection glows */
export function gantt(slug, { rows, end, weeks }) {
  const day = (iso) => Math.round(Date.parse(String(iso).slice(0, 10) + "T00:00:00Z") / 864e5);
  const e = day(end), s = e - weeks * 7, W = 820, L0 = 172, L1 = 784, rowH = 40, top = 64, H = top + rows.length * rowH + 24 + 56;
  const x = (d) => L0 + ((d - s) / (e - s)) * (L1 - L0);
  let out = `<svg class="dg gt" id="${slug}" viewBox="0 0 ${W} ${H}" width="${W}" style="min-width:${W}px;max-width:100%;height:auto" role="img" aria-labelledby="${slug}-title ${slug}-desc" data-start="${s}" data-end="${e}" data-l0="${L0}" data-l1="${L1}"><title id="${slug}-title">조사 타임라인</title><desc id="${slug}-desc">조사마다 첫 회차부터 마지막 회차까지의 기간과 회차 날짜, 최근 ${weeks}주.</desc>`;
  for (let w = 0; w <= weeks; w += weeks > 8 ? 2 : 1) {
    const d = s + w * 7, xx = x(d);
    out += `<line x1="${xx}" x2="${xx}" y1="${top - 4}" y2="${top + rows.length * rowH}" stroke="var(--line)" stroke-width="1"/><text class="mono" x="${xx}" y="${top - 12}" text-anchor="middle" font-size="10" fill="var(--faint)">${new Date(d * 864e5).toISOString().slice(5, 10).replace("-", ".")}</text>`;
  }
  out += `<line x1="20" x2="${L1}" y1="${top}" y2="${top}" stroke="var(--line2)" stroke-width=".8"/>`;
  rows.forEach((r, i) => {
    const y = top + i * rowH, ds = r.runs.map(day).filter((d) => d >= s && d <= e);
    out += `<text x="20" y="${y + 25}" font-size="12" font-weight="600" fill="var(--text)">${esc(cut(r.title, 12))}</text>`;
    if (!ds.length) { out += `<text x="${L0 + 8}" y="${y + 25}" font-size="11" fill="var(--faint)">기간 밖</text>`; return; }
    const a = x(Math.min(...ds)), b = Math.max(x(Math.max(...ds)), a + 12);
    out += `<rect x="${a - 6}" y="${y + 8}" width="${b - a + 12}" height="24" rx="4" fill="${r.color}" fill-opacity=".14" stroke="${r.color}" stroke-width="1"${r.focal ? ` class="glow" style="--c:${r.color}"` : ""}/>`;
    ds.forEach((d) => { out += `<circle cx="${x(d)}" cy="${y + 20}" r="5" fill="var(--paper)" stroke="${r.color}" stroke-width="2"/>`; });
  });
  const LY = H - 40;
  out += `<line class="cross" x1="0" x2="0" y1="${top - 4}" y2="${top + rows.length * rowH}" stroke="var(--text)" stroke-opacity=".45" visibility="hidden"/>
<line x1="16" y1="${LY - 8}" x2="${W - 16}" y2="${LY - 8}" stroke="var(--line2)" stroke-width=".8"/><text x="16" y="${LY + 12}" fill="var(--faint)" font-size="10" letter-spacing=".1em">범례</text>
<g transform="translate(64 ${LY})"><rect x="0" y="2" width="30" height="12" rx="3" fill="var(--accent)" fill-opacity=".14" stroke="var(--accent)"/><text x="38" y="12" fill="var(--muted)" font-size="11">첫 회차 ~ 마지막 회차</text></g>
<g transform="translate(260 ${LY})"><circle cx="8" cy="8" r="5" fill="var(--paper)" stroke="var(--accent)" stroke-width="2"/><text x="20" y="12" fill="var(--muted)" font-size="11">회차</text></g>
<g transform="translate(340 ${LY})"><rect x="0" y="2" width="30" height="12" rx="3" fill="var(--green)" fill-opacity=".14" stroke="var(--green)" class="glow" style="--c:var(--green)"/><text x="38" y="12" fill="var(--muted)" font-size="11">가장 최근 조사</text></g></svg>`;
  return out;
}

/** 12-week hex activity map: one hex per day, one green ramp by findings recorded that day */
export function hexes({ byDay, end, weeks = 12 }) {
  const day = (iso) => Math.round(Date.parse(String(iso).slice(0, 10) + "T00:00:00Z") / 864e5);
  const e = day(end), days = weeks * 7, s = e - days + 1, R = 11, dx = R * 1.75, dy = R * 1.52, pad = 40, first = new Date(s * 864e5).getUTCDay();
  const VW = pad + (weeks + 1) * dx + 10, VH = 7 * dy + 22;
  let out = `<svg viewBox="0 0 ${VW} ${VH}" width="${Math.round(VW * 1.15)}" role="img" aria-label="${weeks}주 활동: 조사 회차가 있던 날과 그날 기록한 발견 수">`;
  ["일", "", "화", "", "목", "", "토"].forEach((t, i) => { if (t) out += `<text x="0" y="${16 + i * dy + 4}" font-size="11" fill="var(--faint)">${t}</text>`; });
  for (let i = 0; i < days; i++) {
    const d = s + i, slot = i + first, wk = Math.floor(slot / 7), wd = slot % 7, cx = pad + wk * dx + (wd % 2 ? dx / 2 : 0), cy = 16 + wd * dy;
    const info = byDay.get(d), n = info?.n ?? 0;
    const c = !info ? "var(--hex-0)" : n >= 7 ? "var(--hex-3)" : n >= 3 ? "var(--hex-2)" : "var(--hex-1)";
    const pts = [0, 60, 120, 180, 240, 300].map((a) => `${(cx + R * Math.cos(((a + 30) * Math.PI) / 180)).toFixed(1)},${(cy + R * Math.sin(((a + 30) * Math.PI) / 180)).toFixed(1)}`).join(" ");
    out += `<polygon points="${pts}" fill="${c}"${info ? ` class="on" style="--c:${c}"` : ""}><title>${new Date(d * 864e5).toISOString().slice(5, 10)} ${info ? esc(info.label) : "회차 없음"}</title></polygon>`;
  }
  return out + "</svg>";
}

/** neon sparkline: glowing stroke over a fading fill */
export function spark(values, color, gid) {
  const w = 300, h = 58, pad = 4, max = Math.max(...values, 1), step = (w - pad * 2) / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `${line} L${pts.at(-1)[0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" style="--c:${color}"><defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#${gid})"/><path class="spark-line" d="${line}" stroke="${color}"/></svg>`;
}
