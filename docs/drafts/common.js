// Shared behaviour for the three board drafts: data lookups, routing, search, copy, ID tray, in-page viewer.
// Each draft owns its markup and look; this file only wires behaviour (class names prefixed so drafts can style them).
(() => {
  const D = window.DEMO;
  const B = D.board, H = D.home;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const ref = (id) => B.refs.find((r) => r.id === id);
  const claim = (id) => B.claims.find((c) => c.id === id);
  const col = (id) => H.collections.find((c) => c.id === id);
  const ctitle = (id) => { const c = col(id); return esc(c.title) + (c.synthetic ? " (가상)" : ""); };
  const claimsCiting = (refId) => B.claims.filter((c) => c.sources.includes(refId));

  const continuePrompt = () =>
    `reference-research 스킬로 "${B.title}" 조사(컬렉션 ${B.id})를 이어서 해줘. 추가 질문 항목: ${B.open.map((q, i) => `${i + 1}) ${q.text}`).join(" ")}`;
  const newPrompt = () => `reference-research 스킬로 새 조사를 시작해줘. 주제: <무엇을 조사할지>. 목적: <이 조사로 정할 것>.`;
  const askPrompt = () => `reference-library MCP로 라이브러리에서 찾아줘: <궁금한 것>. 근거가 된 레퍼런스(S#)와 발견(C#)을 함께 알려줘.`;
  const trayPrompt = (ids) => `reference-research 스킬로 "${B.title}" 조사(컬렉션 ${B.id})에서 다음 항목을 바탕으로 이어서 조사해줘: ${ids.join(", ")}.`;

  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select(); document.execCommand("copy"); t.remove();
    }
    if (btn) { const old = btn.textContent; btn.textContent = "복사됨"; btn.classList.add("is-done"); setTimeout(() => { btn.textContent = old; btn.classList.remove("is-done"); }, 1400); }
  }

  // --- ID tray: pick S#/C# items, copy them as one prompt for the next run
  const picked = new Set();
  function renderTray() {
    const tray = document.getElementById("tray");
    if (!tray) return;
    tray.hidden = picked.size === 0;
    tray.querySelector(".tray-ids").innerHTML = [...picked].map((id) => `<span class="tray-id">${esc(id)}<button type="button" data-unpick="${esc(id)}" aria-label="${esc(id)} 빼기">×</button></span>`).join("");
    tray.querySelector(".tray-n").textContent = `${picked.size}개 담음`;
    document.querySelectorAll("[data-pick]").forEach((b) => { const on = picked.has(b.dataset.pick); b.setAttribute("aria-pressed", on); b.classList.toggle("is-on", on); });
  }
  const trayHtml = () => `<div id="tray" class="tray" hidden role="region" aria-label="Claude에 넘길 항목"><span class="tray-n"></span><span class="tray-ids"></span><button type="button" class="tray-copy">프롬프트 복사</button><button type="button" class="tray-clear">비우기</button></div>`;

  // --- in-page viewer (native dialog): frames of one reference, step references, notes and citing claims
  let vRef = null, vIdx = 0;
  function viewerHtml() {
    return `<dialog id="viewer" class="vw" aria-label="캡처 보기"><div class="vw-top"><strong class="vw-title"></strong><span class="vw-count"></span>
<button type="button" class="vw-pref">이전 레퍼런스</button><button type="button" class="vw-nref">다음 레퍼런스</button><a class="vw-orig" target="_blank" rel="noopener">원본 사이트</a><button type="button" class="vw-close" aria-label="닫기">닫기</button></div>
<div class="vw-body"><div class="vw-stage"><button type="button" class="vw-prev" aria-label="이전 화면">‹</button><img alt=""><button type="button" class="vw-next" aria-label="다음 화면">›</button></div><aside class="vw-side"></aside></div><div class="vw-strip"></div></dialog>`;
  }
  function openViewer(id, i = 0) {
    vRef = ref(id); if (!vRef) return; vIdx = i;
    const v = document.getElementById("viewer");
    drawViewer(); if (!v.open) v.showModal();
  }
  function drawViewer() {
    const v = document.getElementById("viewer"), r = vRef;
    v.querySelector(".vw-title").textContent = `${r.id} ${r.product} — ${r.page}`;
    v.querySelector(".vw-count").textContent = `화면 ${vIdx + 1}/${r.images.length}`;
    v.querySelector(".vw-orig").href = r.url;
    const img = v.querySelector(".vw-stage img"); img.src = r.images[vIdx]; img.alt = `${r.product} ${r.page} 캡처 ${vIdx + 1}`;
    v.querySelector(".vw-strip").innerHTML = r.images.map((s, k) => `<button type="button" data-k="${k}" class="${k === vIdx ? "is-on" : ""}" aria-label="화면 ${k + 1}"><img src="${s}" alt=""></button>`).join("");
    const cites = claimsCiting(r.id);
    v.querySelector(".vw-side").innerHTML = `<p class="vw-meta">${esc(r.role)} · ${esc(r.type)} 출처 · 등급 ${esc(r.cred)}</p>
<div class="vw-tags">${r.tags.map((t) => `<span>${esc(t.label)}</span>`).join("")}</div>
<h3>분석 노트</h3><dl>${r.note.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join("")}</dl>
<h3>이 화면을 근거로 쓴 발견 ${cites.length}개</h3><ul>${cites.map((c) => `<li><b>${c.id}</b> ${esc(c.text)}</li>`).join("")}</ul>
<button type="button" data-pick="${r.id}" aria-pressed="false" class="pick">${r.id} 담기</button>`;
    renderTray();
    const idx = B.refs.indexOf(r);
    v.querySelector(".vw-pref").disabled = idx === 0;
    v.querySelector(".vw-nref").disabled = idx === B.refs.length - 1;
  }
  const step = (d) => { if (!vRef) return; vIdx = (vIdx + d + vRef.images.length) % vRef.images.length; drawViewer(); };
  const stepRef = (d) => { const i = B.refs.indexOf(vRef) + d; if (B.refs[i]) { vRef = B.refs[i]; vIdx = 0; drawViewer(); } };

  // --- search: items carry data-search; groups ([data-group]) without a match collapse to one line, never an empty table
  function bindSearch(input) {
    const run = () => {
      const q = input.value.trim().toLowerCase();
      document.body.classList.toggle("is-searching", !!q);
      let total = 0;
      document.querySelectorAll("[data-group]").forEach((g) => {
        let n = 0;
        g.querySelectorAll("[data-search]").forEach((el) => { const hit = !q || el.dataset.search.toLowerCase().includes(q); el.hidden = !hit; if (hit) n++; });
        g.classList.toggle("is-empty", !!q && n === 0);
        let msg = g.querySelector(":scope > .nomatch");
        if (!msg) { msg = document.createElement("p"); msg.className = "nomatch"; g.append(msg); }
        msg.hidden = !(q && n === 0);
        msg.textContent = `"${input.value.trim()}"와 맞는 항목이 이 구역에는 없습니다.`;
        total += n;
      });
      const info = document.getElementById("searchinfo");
      if (info) { info.hidden = !q; info.textContent = q ? `"${input.value.trim()}" 검색 결과 ${total}개` : ""; }
    };
    input.addEventListener("input", run);
    document.addEventListener("keydown", (e) => { if (e.key === "/" && document.activeElement !== input && !document.getElementById("viewer")?.open) { e.preventDefault(); input.focus(); } });
  }

  // --- routing: #home shows the library home, anything else the board
  function route(drawBoard, drawHome) {
    const go = () => {
      const home = location.hash === "#home" || location.hash.startsWith("#home-");
      document.documentElement.dataset.view = home ? "home" : "board";
      (home ? drawHome : drawBoard)();
      document.querySelectorAll("[data-view-link]").forEach((a) => a.setAttribute("aria-current", a.dataset.viewLink === (home ? "home" : "board") ? "page" : "false"));
      renderTray();
    };
    addEventListener("hashchange", (e) => { const was = new URL(e.oldURL).hash, now = location.hash; if ((was === "#home") !== (now === "#home")) go(); });
    go();
  }

  // --- one delegated click handler for every draft
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, a"); if (!t) return;
    // in-page anchors scroll without touching the hash, so the board/home view never flips
    const href = t.getAttribute("href");
    if (href && href.length > 1 && href.startsWith("#") && href !== "#home" && !t.dataset.viewLink) {
      const el = document.getElementById(href.slice(1));
      if (el) { e.preventDefault(); el.scrollIntoView({ block: "start" }); el.closest("[tabindex]") || el.focus?.({ preventScroll: true }); }
      return;
    }
    if (t.dataset.open) { e.preventDefault(); openViewer(t.dataset.open, +(t.dataset.frame || 0)); }
    else if (t.dataset.copy) copy(t.dataset.copy === "continue" ? continuePrompt() : t.dataset.copy === "new" ? newPrompt() : t.dataset.copy === "ask" ? askPrompt() : t.dataset.copy, t);
    else if (t.dataset.pick) { picked.has(t.dataset.pick) ? picked.delete(t.dataset.pick) : picked.add(t.dataset.pick); renderTray(); }
    else if (t.dataset.unpick) { picked.delete(t.dataset.unpick); renderTray(); }
    else if (t.classList.contains("tray-copy")) copy(trayPrompt([...picked]), t);
    else if (t.classList.contains("tray-clear")) { picked.clear(); renderTray(); }
    else if (t.classList.contains("vw-close")) document.getElementById("viewer").close();
    else if (t.classList.contains("vw-prev")) step(-1);
    else if (t.classList.contains("vw-next")) step(1);
    else if (t.classList.contains("vw-pref")) stepRef(-1);
    else if (t.classList.contains("vw-nref")) stepRef(1);
    else if (t.closest(".vw-strip") && t.dataset.k) { vIdx = +t.dataset.k; drawViewer(); }
  });
  document.addEventListener("keydown", (e) => {
    const v = document.getElementById("viewer"); if (!v?.open) return;
    if (e.key === "ArrowRight") e.shiftKey ? stepRef(1) : step(1);
    if (e.key === "ArrowLeft") e.shiftKey ? stepRef(-1) : step(-1);
  });

  // --- theme: html[data-theme] light/dark, remembered per viewer when storage works
  function theme(btn, fallback = "light") {
    let t = fallback;
    const key = "draft-theme:" + location.pathname.split("/").pop();
    try { t = localStorage.getItem(key) || fallback; } catch {}
    const set = (v) => { document.documentElement.dataset.theme = v; btn?.setAttribute("aria-pressed", v === "dark"); if (btn) btn.textContent = v === "dark" ? "밝게" : "어둡게"; };
    set(t);
    btn?.addEventListener("click", () => { t = t === "dark" ? "light" : "dark"; set(t); try { localStorage.setItem(key, t); } catch {} });
  }
  // --- FLIP: reorder or filter children, then animate each from where it was (skipped under reduced motion)
  function flip(box, mutate) {
    const kids = [...box.children], before = new Map(kids.map((k) => [k, k.getBoundingClientRect()]));
    mutate();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    kids.forEach((k) => { const a = before.get(k), b = k.getBoundingClientRect(); if (!b.height) return; const dy = a.top - b.top, dx = a.left - b.left; if (dx || dy) k.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }); });
  }
  // --- days between two ISO dates, and a smooth path through values (for sparklines and timelines)
  const day = (iso) => Math.round(Date.parse(iso + "T00:00:00Z") / 864e5);
  function spark(values, w, h, pad = 2) {
    const max = Math.max(...values, 1), step = (w - pad * 2) / Math.max(values.length - 1, 1);
    const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    return { line, area: `${line} L${pts.at(-1)[0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`, pts };
  }
  // weekly new findings across the home collections, oldest first (8 weeks ending at the board date)
  function weekly(end = "2026-11-13", weeks = 8) {
    const e = day(end), out = Array(weeks).fill(0);
    H.collections.forEach((c) => (c.runsAt || []).forEach((d, i) => { const w = weeks - 1 - Math.floor((e - day(d)) / 7); if (w >= 0 && w < weeks) out[w] += c.newByRun[i]; }));
    return out;
  }

  window.Draft = { theme, flip, day, spark, weekly, D, B, H, esc, ref, claim, col, ctitle, claimsCiting, copy, openViewer, bindSearch, route, viewerHtml, trayHtml, renderTray, continuePrompt };
})();
