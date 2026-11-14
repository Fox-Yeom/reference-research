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

/**
 * Evidence map overview: question → answer → evidence 1..n (≤4 shown), and one counter-evidence node
 * drawn as the single accent back-edge into the evidence it contests.
 */
export function overview(slug, { question, answer, evidence, counter, selected }) {
  const ev = evidence.slice(0, 4);
  const w = 160, h = 56, gap = 40;
  const W = Math.max(760, ev.length * w + (ev.length - 1) * gap + 80);
  const cx = W / 2 - w / 2;
  const x0 = (W - (ev.length * w + (ev.length - 1) * gap)) / 2;
  const y = [24, 144, 264, 384];
  const nodes = [
    ...(question ? [{ key: "question", x: cx, y: y[0], w, h, tag: "질문", name: cut(question, 10), sub: "", attrs: ' tabindex="0" role="button"' }] : []),
    { key: "answer", x: cx, y: y[1], w, h, tag: "답", name: cut(answer.text, 10), sub: answer.ids.join(" · "), badge: `근거 ${evidence.length}`, attrs: ' tabindex="0" role="button"' },
    ...ev.map((e, i) => ({ key: `e${i}`, x: x0 + i * (w + gap), y: y[2], w, h, tag: e.strength, tagColor: e.strength === "강함" ? "var(--green)" : e.strength === "보통" ? "var(--amber)" : "var(--muted)", name: `근거 ${i + 1}`, sub: e.ids.slice(0, 3).join(" "), attrs: ' tabindex="0" role="button"' })),
  ];
  const list = [...(question ? [{ from: "question", to: "answer" }] : []), ...ev.map((_, i) => ({ from: "answer", to: `e${i}` }))];
  let extra = "";
  let H = 24 + 3 * 120 + 24 + 56;
  if (counter && ev[counter.of]) {
    const target = nodes.find((n) => n.key === `e${counter.of}`);
    const cn = { key: "counter", x: target.x, y: y[3], w, h, tag: "반대", tagColor: "var(--coral)", name: cut(counter.text, 10), sub: counter.ids.join(" · "), cls: "ext", attrs: ' tabindex="0" role="button"' };
    nodes.push(cn);
    const bx = target.x + w / 2, ly = (cn.y + target.y + h) / 2;
    extra = `<path class="e acc" d="M${bx} ${cn.y} V${target.y + h + 2}" marker-end="url(#${slug}-acc)"/><rect x="${bx + 10}" y="${ly - 7}" width="36" height="14" rx="2" fill="var(--paper)"/><text x="${bx + 28}" y="${ly + 4}" fill="var(--coral)" font-size="9.5" text-anchor="middle">반박</text>`;
    H = 24 + 3 * 120 + 56 + 24 + 56;
  } else H = 24 + 2 * 120 + 56 + 24 + 56;
  for (const n of nodes) if (n.key === selected) n.cls = `${n.cls ?? ""} sel`;
  return figure(slug, W, H, "근거 노선 개요", `질문에 대한 답이 근거 ${evidence.length}개에 기대는 구조${counter ? ", 반대 근거 하나가 근거 하나를 반박" : ""}.`, nodes, list, counter ? [LEGEND.dep, LEGEND.counter, LEGEND.sel] : [LEGEND.dep, LEGEND.sel], extra);
}

/**
 * Evidence detail for one node: node → its claims (≤3) → the captures/sources they cite (≤5);
 * the rest collapse into one dashed "+N" node so the figure stays within 9 nodes.
 */
export function detail(slug, { label, text, claims, refOf }) {
  const cl = claims.slice(0, 3);
  const extraClaims = claims.length - cl.length;
  const allRefs = [...new Set(cl.flatMap((c) => c.sources))];
  const refs = allRefs.slice(0, 5);
  const moreRefs = allRefs.length - refs.length;
  const W = 820, rw = 136, rg = 16, cw = 176, cg = 40;
  const refNodes = [...refs, ...(moreRefs ? ["+refs"] : [])];
  const clNodes = [...cl.map((c) => c.id), ...(extraClaims ? ["+claims"] : [])];
  const nEdges = cl.reduce((n, c) => n + c.sources.filter((s) => refs.includes(s)).length + (c.sources.some((s) => !refs.includes(s)) ? 1 : 0), 0);
  const g2 = Math.max(64, nEdges * 12 + 28);
  const y0 = 24, y1 = y0 + 56 + 64, y2 = y1 + 56 + g2;
  const cx0 = (W - (clNodes.length * cw + (clNodes.length - 1) * cg)) / 2;
  const rx0 = (W - (refNodes.length * rw + (refNodes.length - 1) * rg)) / 2;
  const nodes = [
    { key: "root", x: (W - 200) / 2, y: y0, w: 200, h: 56, tag: label, name: cut(text, 14), sub: cl.map((c) => c.id).join(" · "), cls: "sel" },
    ...clNodes.map((id, i) => {
      if (id === "+claims") return { key: id, x: cx0 + i * (cw + cg), y: y1, w: cw, h: 56, tag: "더", name: `발견 +${extraClaims}`, sub: "발견 구역에서", cls: "more" };
      const c = cl.find((x) => x.id === id);
      return { key: id, x: cx0 + i * (cw + cg), y: y1, w: cw, h: 56, tag: c.kindKo, tagColor: c.strength === "강함" ? "var(--green)" : c.strength === "보통" ? "var(--amber)" : "var(--muted)", name: cut(`${c.id} ${c.subject ?? ""}`, 12), sub: `근거 ${c.strength} · 출처 ${c.sources.length}` };
    }),
    ...refNodes.map((id, i) => {
      if (id === "+refs") return { key: id, x: rx0 + i * (rw + rg), y: y2, w: rw, h: 56, tag: "더", name: `자료 +${moreRefs}`, sub: "출처 구역에서", cls: "more" };
      const r = refOf(id);
      return { key: id, x: rx0 + i * (rw + rg), y: y2, w: rw, h: 56, tag: r.tag, name: cut(r.name, 9), sub: `${id}${r.frames ? ` · 화면 ${r.frames}` : ""}`, cls: `ext${r.view ? " view" : ""}`, attrs: r.view ? ` data-open-ref="${esc(id)}" tabindex="0" role="button"` : "" };
    }),
  ];
  const list = [
    ...clNodes.map((id) => ({ from: "root", to: id })),
    ...cl.flatMap((c) => [...c.sources.filter((s) => refs.includes(s)).map((s) => ({ from: c.id, to: s })), ...(c.sources.some((s) => !refs.includes(s)) ? [{ from: c.id, to: "+refs" }] : [])]),
  ];
  return figure(slug, W, y2 + 56 + 24 + 56, `${label} 상세`, `${label}이 기대는 발견 ${claims.length}개와 그 발견이 인용한 자료 ${allRefs.length}개.`, nodes, list, extraClaims || moreRefs ? [LEGEND.dep, LEGEND.sel, LEGEND.more] : [LEGEND.dep, LEGEND.sel]);
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
