// Judgment drafts (#28): the board without an answer line. A person reads observations and captures,
// compares options and records the decision; the agent's reading stays folded as a memo.
// Variant from <html data-variant>: a = observations first, b = option cards, c = screens first.
// Shared by all three: evidence side panel, intent comparison table, search with scope and a results panel.
(() => {
  const { B, esc, ref, claim, copy, openViewer } = Draft;
  Object.assign(Draft.L, { notes: "분석 노트", citing: "인용 발견", pick: "담기" });
  const V = document.documentElement.dataset.variant || "a";

  // --- content, all restated from data.js (dev/demo.sh captures); nothing new is claimed
  const OBS = ["C1", "C2", "C3", "C4", "C5"]; // observation order
  const COUNTER = { C2: ["C6"] }; // an observation and what speaks against it
  const BASE = ["C1", "C3"]; // shared by every option
  const OPTIONS = [
    { id: "o1", name: "기능 단계형", text: "무료 1단과 개인 유료 1단을 나란히 두는 구성", pro: ["C2", "C5"], con: ["C6"], check: B.open[1].text },
    { id: "o2", name: "부가 서비스형", text: "앱은 무료로 두고 동기화·게시만 판매하는 구성", pro: ["C4"], con: [], conNote: "5곳 중 1곳(Obsidian)만의 구성, 근거 세기 보통", check: B.open[0].text },
    { id: "o3", name: "유료 단계형", text: "요금표 첫 화면에 ₩0 단계 없이 유료 단계만 두는 구성", pro: ["C6"], con: ["C2"], check: "무료 단계를 표에서 빼도 무료로 시작하려는 사람이 경계를 찾을 수 있나" },
  ];
  // what each captured pricing page shows (from the notes in data.js)
  const SCREENS = {
    S1: ["Free ₩0", "Plus ₩14,000", "연간 토글 · 최대 20% 절약", "Business ₩30,000 · Enterprise"],
    S2: ["비기너 $0", "프로 $5", "연간 토글 · 20% 할인", "비지니스 $8"],
    S3: [null, "Starter · Advanced", "월간/연간 토글", "Flexible · Enterprise(영업 문의)"],
    S4: ["앱 무료(가입 없이)", "Sync $4 · Publish $8(부가 서비스)", "월간/연간 토글", "Commercial 라이선스"],
    S5: ["Starter ₩0", "Plus ₩9,667", "월간/연간 토글", "Team $5/멤버(최소 3명) · Enterprise 상담"],
  };
  const COLS = ["무료 단계", "개인 유료 첫 단계", "결제 주기", "팀 단계"];

  // --- small parts
  const st = (s) => `<span class="st ${s === "강함" ? "strong" : "mid"}">근거 ${esc(s)}</span>`;
  const sid = (id) => (id.startsWith("S") ? `<button type="button" class="sid" data-open="${id}" title="${esc(ref(id).product)} 화면">${id}</button>` : `<button type="button" class="sid c" data-panel="claim:${id}" title="${esc(claim(id).subject ?? "")}">${id}</button>`);
  const refsOf = (ids) => [...new Set(ids.flatMap((c) => claim(c).sources))];
  const thumbs = (rids, max = 5) => `<div class="thumbs">${rids.slice(0, max).map((r) => `<button type="button" data-open="${r}"><img loading="lazy" src="${ref(r).images[0]}" alt="${esc(ref(r).product)} 요금제 캡처"><span>${esc(ref(r).product)}</span></button>`).join("")}</div>`;
  const decideBtn = (o) => `<button type="button" class="decide" data-decide="${o.id}">결정 기록</button>`;
  const searchOf = (...xs) => esc(xs.flat().filter(Boolean).join(" "));
  const card = (id, title, lead, body, group) => `<section class="card" id="${id}" data-sg="${group ?? title}"><h2>${title}</h2>${lead ? `<p class="lead">${lead}</p>` : ""}${body}</section>`;

  const obRow = (cid, cls = "") => {
    const c = claim(cid);
    return `<li class="ob ${cls}" id="ob-${cid}" data-panel="claim:${cid}" tabindex="0" data-s="${searchOf(c.id, c.subject, c.text)}" data-sl="${esc(c.text)}" data-sg="관찰">
<span class="lab">${cls ? "반대 관찰" : esc(c.kind)}</span>
<div><p>${esc(c.text)} ${sid(c.id)}</p>${thumbs(c.sources)}</div>
<div class="side2">${cls ? `<span class="st counter">반대</span>` : st(c.strength)}<button type="button" class="more" data-panel="claim:${cid}">근거</button></div></li>`;
  };
  const obsList = (compact) => `<ul class="obs${compact ? " compact" : ""}">${OBS.map((c) => obRow(c) + (COUNTER[c] ?? []).map((x) => obRow(x, "counter")).join("")).join("")}</ul>`;
  const qRow = () => `<div class="q" data-s="${searchOf(B.question)}" data-sl="${esc(B.question)}" data-sg="판단 자료" id="question"><span class="lab">질문</span><p>${esc(B.question)}</p></div>`;
  const memo = () => `<details class="memo" id="memo" data-s="${searchOf(B.answer.text, B.proposal.text)}" data-sl="에이전트 메모" data-sg="판단 자료"><summary>에이전트 메모 · 결정 아님</summary><p>해석: ${esc(B.answer.text)} ${B.answer.claims.map(sid).join("")}</p><p>다음 단계 후보: ${esc(B.proposal.text)} ${B.proposal.claims.map(sid).join("")}</p></details>`;
  const optItems = (ids) => (ids.length ? `<ul>${ids.map((c) => `<li>${esc(claim(c).text)} ${sid(c)}</li>`).join("")}</ul>` : "");

  // A: observations, then an options table
  const optTable = () => `<table class="otbl"><thead><tr><th scope="col"><span class="lab">선택지</span></th>${OPTIONS.map((o) => `<th scope="col" id="opt-${o.id}" data-s="${searchOf(o.name, o.text)}" data-sl="${esc(o.name)}" data-sg="선택지">${esc(o.name)}<small>${esc(o.text)}</small></th>`).join("")}</tr></thead><tbody>
<tr><th scope="row">받치는 관찰</th>${OPTIONS.map((o) => `<td data-o="${esc(o.name)}">${optItems(o.pro)}</td>`).join("")}</tr>
<tr><th scope="row">반대 관찰</th>${OPTIONS.map((o) => `<td data-o="${esc(o.name)}">${optItems(o.con)}${o.conNote ? `<span class="none">${esc(o.conNote)}</span>` : ""}</td>`).join("")}</tr>
<tr><th scope="row">레퍼런스</th>${OPTIONS.map((o) => `<td data-o="${esc(o.name)}">${thumbs(refsOf(o.pro), 3)}</td>`).join("")}</tr>
<tr><th scope="row">확인할 것</th>${OPTIONS.map((o) => `<td data-o="${esc(o.name)}">${esc(o.check)}</td>`).join("")}</tr>
<tr><th scope="row">결정</th>${OPTIONS.map((o) => `<td data-o="${esc(o.name)}"><button type="button" class="more" data-panel="opt:${o.id}">근거</button> ${decideBtn(o)}</td>`).join("")}</tr></tbody></table>`;

  // B: option cards side by side
  const optCards = () => `<div class="ocards">${OPTIONS.map((o) => `<article class="ocard" id="opt-${o.id}" data-s="${searchOf(o.name, o.text, o.check)}" data-sl="${esc(o.name)}" data-sg="선택지">
<h3>${esc(o.name)}</h3><p>${esc(o.text)}</p>${thumbs(refsOf(o.pro), 3)}
<h4>받치는 관찰</h4>${optItems(o.pro)}
<h4 class="c" style="color:var(--coral)">반대 관찰</h4>${optItems(o.con) || `<p class="lab" style="margin:0">${esc(o.conNote ?? "없음")}</p>`}
<h4>확인할 것</h4><p style="margin:0;font-size:14px">${esc(o.check)}</p>
<div class="acts"><button type="button" class="more" data-panel="opt:${o.id}">근거</button>${decideBtn(o)}</div></article>`).join("")}</div>`;
  const baseList = () => `<div class="base">${BASE.map((c) => `<div data-s="${searchOf(claim(c).text)}" data-sl="${esc(claim(c).text)}" data-sg="공통 기본기" id="base-${c}">${esc(claim(c).text)} ${sid(c)}</div>`).join("")}</div>`;

  // C: screens first
  const screens = () => `<table class="cmp"><thead><tr><th scope="col">화면</th>${COLS.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${B.refs.map((r) => `<tr id="scr-${r.id}" data-s="${searchOf(r.product, SCREENS[r.id])}" data-sl="${esc(r.product)} 화면" data-sg="화면 비교">
<td class="prod">${thumbs([r.id], 1)}<b>${esc(r.product)} ${sid(r.id)}</b></td>${SCREENS[r.id].map((v, i) => `<td data-h="${COLS[i]}">${v == null ? `<span class="no">첫 화면에 ₩0 단계 없음</span> ${sid("C6")}` : esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const optCompact = () => `<ul class="obs compact">${OPTIONS.map((o) => `<li class="ob" id="opt-${o.id}" data-panel="opt:${o.id}" tabindex="0" data-s="${searchOf(o.name, o.text, o.check)}" data-sl="${esc(o.name)}" data-sg="선택지"><span class="lab">선택지</span><div><p><b>${esc(o.name)}</b> · ${esc(o.text)}</p></div><div class="side2">${decideBtn(o)}</div></li>`).join("")}</ul>`;

  // shared: intent comparison table (notes: 기능 · 의도 · 결과 · 시사점)
  const note = (r, k) => r.note.find(([key]) => key === k)?.[1];
  const intent = () => `<table class="itbl"><thead><tr><th scope="col">출처</th><th scope="col">의도</th><th scope="col">결과</th><th scope="col">시사점</th></tr></thead><tbody>${B.refs.map((r) => {
    const imp = note(r, "시사점") ?? "";
    const [verb, rest] = imp.includes(" — ") ? imp.split(" — ") : ["", imp];
    const cell = (k, h) => { const v = note(r, k); return `<td data-h="${h}">${v ? esc(v.replace(/\s*\[S\d+\]/g, "")) : `<span class="nil">기록 없음</span>`}</td>`; };
    return `<tr id="int-${r.id}" data-s="${searchOf(r.product, r.note.map(([, v]) => v))}" data-sl="${esc(r.product)} 설계 의도" data-sg="설계 의도"><td><b>${esc(r.product)} ${sid(r.id)}</b>${r.basis ? `<span class="tag" style="margin-top:4px">${esc(r.basis)}</span>` : ""}<small>${esc((note(r, "기능") ?? "").replace(/\s*\[S\d+\]/g, ""))}</small></td>${cell("의도", "의도")}${cell("결과", "결과")}<td data-h="시사점" class="imp">${verb ? `<em>${esc(verb)}</em>` : ""}${esc(rest)}</td></tr>`;
  }).join("")}</tbody></table>`;
  const refsGrid = () => `<div class="rgrid">${B.refs.map((r) => `<article class="rcard" id="${r.id}" data-s="${searchOf(r.id, r.product, r.page, r.url)}" data-sl="${esc(r.product)} — ${esc(r.page)}" data-sg="레퍼런스"><button type="button" class="img" data-open="${r.id}"><img loading="lazy" src="${r.images[0]}" alt="${esc(r.product)} ${esc(r.page)} 캡처"></button><div><b>${esc(r.product)}</b><span>${r.id} · ${esc(r.role)} · 화면 ${r.images.length}</span></div></article>`).join("")}</div>`;
  const openQs = () => `<ol class="openq">${B.open.map((q, i) => `<li id="oq-${i}" data-s="${searchOf(q.text, q.why)}" data-sl="${esc(q.text)}" data-sg="미해결 질문">${esc(q.text)} ${q.claims.map(sid).join("")}<span>${esc(q.why)}</span></li>`).join("")}</ol>`;

  const judge = {
    a: () => card("judge", "판단 자료", "관찰과 캡처를 보고 선택지를 비교합니다. 결정은 사람이 기록합니다.", qRow() + `<h3 class="lab" style="margin:16px 0 0">관찰</h3>` + obsList(false) + `<h3 class="lab" style="margin:22px 0 8px">선택지 비교</h3>` + optTable() + `<div style="margin-top:14px">${memo()}</div>`, "판단 자료"),
    b: () => card("judge", "판단 자료", "선택지마다 받치는 관찰과 반대 관찰, 캡처를 나란히 둡니다. 결정은 사람이 기록합니다.", qRow() + `<h3 class="lab" style="margin:16px 0 8px">선택지</h3>` + optCards() + `<h3 class="lab" style="margin:22px 0 8px">공통 기본기</h3>` + baseList() + `<h3 class="lab" style="margin:22px 0 0">관찰</h3>` + obsList(true), "판단 자료"),
    c: () => card("judge", "판단 자료", "먼저 화면을 직접 비교합니다. 관찰과 선택지는 그 아래에 둡니다.", qRow() + `<h3 class="lab" style="margin:16px 0 8px">화면 비교</h3>` + screens() + `<h3 class="lab" style="margin:22px 0 0">관찰</h3>` + obsList(true) + `<h3 class="lab" style="margin:22px 0 0">선택지</h3>` + optCompact() + `<div style="margin-top:14px">${memo()}</div>`, "판단 자료"),
  };
  const NAMES = { a: ["h-observe.html", "A 관찰 중심"], b: ["i-options.html", "B 선택지 중심"], c: ["j-refs-first.html", "C 화면 먼저"] };

  document.getElementById("app").innerHTML = `<header class="head"><div><p class="crumb">라이브러리 / <b>${esc(B.title)}</b></p><h1>${esc(B.title)}</h1><p class="sub">${esc(B.goal)}</p>
<p class="meta">대상 ${esc(B.audience)} · 조사 형식 ${esc(B.domain)} · 레퍼런스 ${B.refs.length} · 발견 ${B.claims.length}</p></div>
<nav class="vswitch" aria-label="시안">${Object.entries(NAMES).map(([k, [f, n]]) => `<a href="${f}"${k === V ? ' aria-current="page"' : ""}>${n}</a>`).join("")}</nav></header>
${judge[V]()}
${card("intent", "설계 의도", "레퍼런스 노트의 의도·결과·시사점. 근거 수준: 공식은 회사가 밝힌 것, 정황은 여러 단서로 본 것.", intent())}
${card("refs", "레퍼런스", "", refsGrid())}
${card("open", "미해결 질문", "", openQs())}`;
  document.getElementById("secs").innerHTML = [["judge", "판단 자료"], ["intent", "설계 의도"], ["refs", "레퍼런스"], ["open", "미해결 질문"]].map(([id, t]) => `<a href="#${id}"><i style="--c:var(--n-blue)"></i><span>${t}</span></a>`).join("");

  // --- evidence side panel (non-modal; Esc or × closes, focus returns to the opener)
  const P = document.getElementById("panel");
  let opener = null;
  const pcClaim = (cid) => { const c = claim(cid); return `<div class="pc"><div>${sid(c.id)} <span class="tag">${esc(c.kind)}</span> ${st(c.strength)}</div><p>${esc(c.text)}</p>${c.sources.map((r) => { const R = ref(r); return `<div class="pr"><button type="button" data-open="${r}" aria-label="${esc(R.product)} 화면 보기"><img loading="lazy" src="${R.images[0]}" alt=""></button><div><b>${esc(R.product)} — ${esc(R.page)} ${sid(r)}</b><span>${esc((note(R, "기능") ?? "").replace(/\s*\[S\d+\]/g, ""))}</span></div></div>`; }).join("")}</div>`; };
  function openPanel(key, from) {
    const [kind, id] = key.split(":");
    let head, body;
    if (kind === "claim") {
      const c = claim(id), counters = COUNTER[id] ?? [], countered = Object.entries(COUNTER).find(([, v]) => v.includes(id))?.[0];
      head = `<small>관찰 ${id}</small>${esc(c.subject ?? c.text)}`;
      body = `<h3>근거</h3>${pcClaim(id)}${counters.length ? `<h3 class="c">반대 관찰</h3>${counters.map(pcClaim).join("")}` : ""}${countered ? `<h3>이 관찰이 반대하는 것</h3>${pcClaim(countered)}` : ""}`;
    } else {
      const o = OPTIONS.find((x) => x.id === id);
      head = `<small>선택지</small>${esc(o.name)}`;
      body = `<p style="margin:12px 0 0;color:var(--muted)">${esc(o.text)}</p><h3>받치는 관찰</h3>${o.pro.map(pcClaim).join("")}<h3 class="c">반대 관찰</h3>${o.con.length ? o.con.map(pcClaim).join("") : `<p class="lab">${esc(o.conNote ?? "없음")}</p>`}<h3>확인할 것</h3><div class="pcheck">${esc(o.check)}</div><p style="margin-top:14px">${decideBtn(o)}</p>`;
    }
    P.querySelector("h2").innerHTML = head;
    P.querySelector(".body").innerHTML = body;
    P.hidden = false; requestAnimationFrame(() => P.classList.add("is-open"));
    document.body.classList.add("panel-open");
    document.querySelectorAll(".ob.is-sel").forEach((x) => x.classList.remove("is-sel"));
    document.getElementById(kind === "claim" ? `ob-${id}` : `opt-${id}`)?.classList.add("is-sel");
    opener = from ?? null;
    P.querySelector(".x").focus({ preventScroll: true });
  }
  function closePanel() {
    P.classList.remove("is-open"); document.body.classList.remove("panel-open");
    document.querySelectorAll(".ob.is-sel").forEach((x) => x.classList.remove("is-sel"));
    setTimeout(() => { if (!P.classList.contains("is-open")) P.hidden = true; }, 240);
    opener?.focus?.({ preventScroll: true });
  }

  // --- decision record: a prompt the person hands to Claude, never written by the agent on its own
  const decidePrompt = (o) => `reference-research 스킬로 "${B.title}" 조사(컬렉션 ${B.id})에 사람의 결정을 기록해줘: 선택지 "${o.name}" — ${o.text}. 판단에 쓴 근거: ${[...o.pro, ...refsOf(o.pro)].join(", ")}.`;

  document.addEventListener("click", (e) => {
    const d = e.target.closest("[data-decide]");
    if (d) { e.stopPropagation(); const o = OPTIONS.find((x) => x.id === d.dataset.decide); copy(decidePrompt(o), d); return; }
    if (e.target.closest("[data-open]")) return; // common.js opens the viewer in place
    if (e.target.closest(".panel .x")) return closePanel();
    const t = e.target.closest("[data-panel]");
    if (t) { e.preventDefault(); openPanel(t.dataset.panel, t.closest("button") ?? t); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("viewer")?.open) { if (!S.hidden) return clearSearch(); if (!P.hidden) closePanel(); }
    if (e.key === "Enter" && e.target.matches(".ob[data-panel]")) openPanel(e.target.dataset.panel, e.target);
  });

  // --- search: scope shown under the box, results gathered in one panel by kind
  const q = document.getElementById("q"), S = document.getElementById("sres");
  const items = () => [...document.querySelectorAll("[data-s]")];
  const hl = (text, t) => { const i = text.toLowerCase().indexOf(t); return i < 0 ? esc(text) : esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + t.length)) + "</mark>" + esc(text.slice(i + t.length)); };
  // a label without the term gets the words around the match, so the reader sees why it was found
  const snip = (text, t) => { const i = text.toLowerCase().indexOf(t), a = Math.max(0, i - 24); return (a ? "…" : "") + hl(text.slice(a, i + t.length + 32), t) + (i + t.length + 32 < text.length ? "…" : ""); };
  function clearSearch() { q.value = ""; S.hidden = true; }
  function runSearch() {
    const t = q.value.trim().toLowerCase();
    if (!t) { S.hidden = true; return; }
    const groups = new Map();
    for (const el of items()) if (el.dataset.s.toLowerCase().includes(t)) (groups.get(el.dataset.sg) ?? groups.set(el.dataset.sg, []).get(el.dataset.sg)).push(el);
    const n = [...groups.values()].reduce((a, g) => a + g.length, 0);
    S.innerHTML = `<header><b>"${esc(q.value.trim())}" ${n}건</b><span>범위: 이 조사 · Esc 닫기</span></header>${n ? [...groups].map(([g, els]) => `<h3>${esc(g)} <i>${els.length}</i></h3>${els.map((el) => `<button type="button" class="hit" data-goto="${el.id}">${hl(el.dataset.sl || el.dataset.s, t)}${(el.dataset.sl || "").toLowerCase().includes(t) ? "" : `<small>${snip(el.dataset.s, t)}</small>`}</button>`).join("")}`).join("") : `<p class="none">이 조사에는 맞는 항목이 없습니다.</p>`}<p class="none"><a href="g-neon-mix.html#home">라이브러리 전체에서 찾기</a></p>`;
    S.hidden = false;
  }
  q.addEventListener("input", runSearch);
  S.addEventListener("click", (e) => {
    const h = e.target.closest("[data-goto]"); if (!h) return;
    const el = document.getElementById(h.dataset.goto); S.hidden = true;
    el.closest("details")?.setAttribute("open", "");
    el.scrollIntoView({ block: "center" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  });
  document.addEventListener("keydown", (e) => { if (e.key === "/" && document.activeElement !== q && !document.getElementById("viewer")?.open) { e.preventDefault(); q.focus(); } });
})();
