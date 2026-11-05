/**
 * connectors — read-only candidate lists for `ref fetch` (docs/CONNECTORS.md).
 *
 * Nothing here writes to the library: what the user picks goes through `source add` or `capture`.
 * Documented APIs follow their docs; undocumented paths follow robots.txt `User-agent: *` (DECISIONS 2026-11-04).
 * Text from these sources is third-party data: it is cleaned and cut here, and author names are dropped.
 * parse functions are pure so dev/test-connectors.mjs can feed them fixtures.
 */
import { readFileSync } from "node:fs";
import { CHANNEL_KO, RefError, announce, bad } from "./store.mjs";

const SUMMARY_CHARS = 200;
const TIMEOUT_MS = 30_000;
const PAUSE_MS = 1_000;
const version = (() => {
  try {
    return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  } catch {
    return null;
  }
})();
const UA = `reference-research${version ? `/${version}` : ""} (+https://github.com/Fox-Yeom/reference-research)`;

const httpGet = (url, headers = {}) => fetch(url, { headers: { "user-agent": UA, ...headers }, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });

/** Ends a call. `reason` reaches the user through announce, in plain words; `detail` only reaches the agent, so tokens and paths stay out of the user's view. */
function giveUp(name, reason, detail = "") {
  throw Object.assign(new RefError(`${name}: ${reason}${detail}`), { reason });
}

/** One line per failure; connectors never retry (docs/CONNECTORS.md §3). Messages never carry request headers: a token lives there. */
async function request(name, url, get, { headers, explain } = {}) {
  let res;
  try {
    res = await get(url, headers);
  } catch (e) {
    giveUp(name, "연결 실패", ` (${e.cause?.code ?? e.name})`);
  }
  if (!res.ok) {
    const known = explain?.(res) ?? (res.status === 429 ? { reason: "호출 한도 초과", detail: " (HTTP 429)" } : { reason: "서버 응답 오류", detail: ` (HTTP ${res.status})` });
    giveUp(name, known.reason, known.detail);
  }
  return res;
}

async function getJson(name, url, get, options) {
  const res = await request(name, url, get, options);
  try {
    return { data: await res.json(), headers: res.headers };
  } catch {
    giveUp(name, "응답 구조가 바뀜", " (JSON 아님)");
  }
}

async function getText(name, url, get, options) {
  const res = await request(name, url, get, options);
  try {
    return { data: await res.text(), headers: res.headers };
  } catch {
    giveUp(name, "연결 실패", " (본문을 읽지 못함)");
  }
}

const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decodeEntity = (whole, body) => {
  const code = /^#x/i.test(body) ? parseInt(body.slice(2), 16) : body[0] === "#" ? Number(body.slice(1)) : null;
  if (code === null) return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
};

const cut = (text, max = SUMMARY_CHARS) => {
  const chars = [...text];
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : text;
};

/** HTML to plain text, cut to a summary. Tags go before entities so an escaped "<" survives as text. */
export function cleanText(html, max = SUMMARY_CHARS) {
  return cut(oneLine(String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, decodeEntity)), max) || null;
}

/** Plain text cut to a summary; with a query it starts near the first match, the passage the source was picked for. */
export function excerpt(text, q, max = SUMMARY_CHARS) {
  const flat = oneLine(text);
  const at = q ? flat.toLowerCase().indexOf(q.toLowerCase()) : -1;
  return cut(at > 40 ? `…${flat.slice(at - 40)}` : flat, max) || null;
}

/** The date as the source wrote it: no timezone conversion, and nothing invented when it is missing. */
const isoDate = (v) => {
  const d = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

const intParam = (params, key, fallback, min, max) => {
  const v = params[key] ?? fallback;
  if (!Number.isInteger(v) || v < min || v > max) bad(`${key} must be an integer from ${min} to ${max}`);
  return v;
};

// ---------- Hacker News (Algolia) ----------

const HN_API = "https://hn.algolia.com/api/v1/search_by_date";
const HN_ITEM = "https://news.ycombinator.com/item?id=";

const HN_MATCH_KO = { title: "제목 일치", text: "본문 일치", loose: "느슨한 일치" };

/** The default search forgives typos and finds words apart ("notion" returns "nation"), so a phrase in the title is the default. */
function hnInput(params) {
  const q = oneLine(params.q).replaceAll('"', "");
  if (!q) bad("hn needs q");
  const tags = params.tags ?? "story";
  if (!["story", "comment"].includes(tags)) bad('tags must be "story" or "comment"');
  const match = params.match ?? (tags === "story" ? "title" : "text");
  if (!(match in HN_MATCH_KO)) bad('match must be "title", "text" or "loose"');
  if (match === "title" && tags === "comment") bad('match "title" needs tags "story": comments have no title');
  return { q, tags, match, limit: intParam(params, "limit", 20, 1, 50), sinceDays: intParam(params, "since_days", 365, 1, 3650), minPoints: intParam(params, "min_points", 5, 0, 100000) };
}

/** Comments carry no points, so min_points only filters stories. */
export function hnUrl(o, now = Date.now()) {
  const since = Math.floor(now / 1000) - o.sinceDays * 86400;
  const filters = [`created_at_i>${since}`, ...(o.tags === "story" ? [`points>=${o.minPoints}`] : [])];
  const query = o.match === "loose" ? o.q : `"${o.q}"`;
  return `${HN_API}?${new URLSearchParams({ query, tags: o.tags, hitsPerPage: String(o.limit), numericFilters: filters.join(","), ...(o.match === "title" ? { restrictSearchableAttributes: "title" } : {}) })}`;
}

/** The candidate is the discussion, not the linked article: the discussion is the evidence of a reaction. */
export function parseHn(data) {
  if (!Array.isArray(data?.hits)) giveUp("hn", "응답 구조가 바뀜", " (hits 없음)");
  const candidates = data.hits
    .filter((h) => h.objectID && h.created_at)
    .map((h) => ({
      url: `${HN_ITEM}${h.objectID}`,
      title: oneLine(h.title ?? h.story_title) || null,
      published: isoDate(h.created_at),
      summary: cleanText(h.comment_text ?? h.story_text),
      via: "hn",
      type: "community",
      channel: "reaction",
      meta: h.story_id && h.comment_text ? { story: `${HN_ITEM}${h.story_id}`, link: h.story_url ?? null } : { points: h.points ?? 0, comments: h.num_comments ?? 0, link: h.url ?? null },
    }));
  if (data.hits.length && !candidates.length) giveUp("hn", "응답 구조가 바뀜", " (objectID · created_at 없음)");
  return { total: data.nbHits ?? candidates.length, candidates };
}

function hnHint(o) {
  if (/[가-힣]/.test(o.q)) return "HN은 영어권 글이라 한국어 질의는 거의 잡히지 않음. 영어로 다시 질의";
  if (o.match === "loose") return null;
  return `구문 그대로 찾음. 단어를 줄이거나 match "${o.match === "title" ? "text" : "loose"}"로 다시 질의`;
}

async function hnRun(o, http) {
  const { total, candidates } = parseHn((await http.json(hnUrl(o))).data);
  const scope = o.tags === "comment" ? "댓글" : `${o.minPoints}점 이상`;
  return {
    head: `hn · "${o.q}" · 최근 ${o.sinceDays}일 · ${HN_MATCH_KO[o.match]} · ${scope} ${total}건${candidates.length < total ? ` 중 ${candidates.length}건` : ""} (최신순)`,
    candidates,
    hint: total ? null : hnHint(o),
  };
}

const hnLine = (c) => [
  `${c.published ?? "미상"} · ${c.meta.story ? "댓글" : `${c.meta.points}점 · 댓글 ${c.meta.comments}`} · ${c.title ?? "(제목 없음)"} · ${c.url}`,
  ...(c.summary ? [`  ${c.summary}`] : []),
];

// ---------- GitHub Releases ----------

const GITHUB_API = "https://api.github.com/repos";
const githubToken = () => process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
const githubHeaders = () => ({ accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", ...(githubToken() ? { authorization: `Bearer ${githubToken()}` } : {}) });

function githubInput(params) {
  const repo = String(params.repo ?? "").replace(/^https?:\/\/(www\.)?github\.com\//i, "").split("/").slice(0, 2).join("/").replace(/\.git$/, "");
  if (!/^[\w-][\w.-]*\/(?!\.\.?$)[\w.-]+$/.test(repo)) bad('github needs repo as "owner/name"');
  return { repo, q: oneLine(params.q) || null, includePrerelease: params.include_prerelease === true, limit: intParam(params, "limit", 10, 1, 100) };
}

function githubError(res) {
  if (res.status === 404) return { reason: "저장소를 찾지 못함", detail: " (owner/name 확인, 비공개 저장소는 토큰 필요)" };
  if (res.status === 401) return { reason: "토큰이 거절됨", detail: " (GITHUB_TOKEN · GH_TOKEN 확인)" };
  if (![403, 429].includes(res.status) || res.headers.get("x-ratelimit-remaining") !== "0") return null;
  const reset = new Date(Number(res.headers.get("x-ratelimit-reset")) * 1000);
  const when = Number.isNaN(reset.getTime()) ? "한 시간 안에" : `${reset.toTimeString().slice(0, 5)} 이후`;
  return { reason: `시간당 호출 한도 소진, ${when} 다시 가능`, detail: githubToken() ? "" : ". GITHUB_TOKEN을 넣으면 시간당 5,000회" };
}

/** The API has no filters: drafts, prereleases and q are applied here. It lists by creation, so a late backport is re-sorted by publish date. */
export function parseGithub(data, o) {
  if (!Array.isArray(data)) giveUp("github", "응답 구조가 바뀜", " (배열 아님)");
  if (data.length && !data.some((r) => r.html_url)) giveUp("github", "응답 구조가 바뀜", " (html_url 없음)");
  const wanted = data.filter((r) => r.html_url && !r.draft && (o.includePrerelease || !r.prerelease));
  const needle = o.q?.toLowerCase();
  const matched = needle ? wanted.filter((r) => [r.name, r.tag_name, r.body].some((t) => String(t ?? "").toLowerCase().includes(needle))) : wanted;
  const candidates = [...matched]
    .sort((a, b) => String(b.published_at ?? "").localeCompare(String(a.published_at ?? "")))
    .slice(0, o.limit)
    .map((r) => ({
      url: r.html_url,
      title: `${o.repo} ${oneLine(r.name) || r.tag_name}`,
      published: isoDate(r.published_at),
      summary: excerpt(r.body, o.q),
      via: "github",
      type: "official",
      channel: "rationale",
      meta: { tag: r.tag_name ?? null, prerelease: Boolean(r.prerelease) },
    }));
  return { scanned: data.length, wanted: wanted.length, total: matched.length, candidates };
}

function githubHint(o, { scanned, wanted }, remaining) {
  if (!scanned) return "릴리스 없음. 태그만 쓰는 저장소일 수 있음. 체인지로그 파일이나 WebSearch로 대체";
  if (!wanted) return `최근 ${scanned}개가 모두 사전 릴리스. include_prerelease: true로 다시 질의`;
  if (o.q) return `최근 ${scanned}개 안에서만 찾음. 단어를 바꿔 다시 질의`;
  return remaining;
}

async function githubRun(o, http) {
  const { data, headers } = await http.json(`${GITHUB_API}/${o.repo}/releases?per_page=100`, { headers: githubHeaders(), explain: githubError });
  const parsed = parseGithub(data, o);
  const { scanned, wanted, total, candidates } = parsed;
  const shown = (n) => `${n}건${candidates.length < n ? ` 중 ${candidates.length}건` : ""}`;
  const kind = o.includePrerelease ? "릴리스" : "안정판";
  const left = headers?.get("x-ratelimit-remaining");
  const quota = left ? ` · 남은 호출 ${left}/${headers.get("x-ratelimit-limit")}` : "";
  const low = left && Number(left) <= 10 && !githubToken() ? `호출 ${left}회 남음. GITHUB_TOKEN을 넣으면 시간당 5,000회` : null;
  return {
    head: `github · ${o.repo} · 최근 릴리스 ${scanned}개 · ${o.q ? `${kind} ${wanted}건 · "${o.q}" 포함 ${shown(total)}` : `${kind} ${shown(wanted)}`} (최신순)${quota}`,
    candidates,
    hint: candidates.length ? low : githubHint(o, parsed, low),
  };
}

const githubLine = (c) => [`${c.published ?? "미상"} · ${c.title}${c.meta.prerelease ? " (사전 릴리스)" : ""} · ${c.url}`, ...(c.summary ? [`  ${c.summary}`] : [])];

// ---------- Speaker Deck ----------

const DECK_HOST = "https://speakerdeck.com";
const DECK_PAGE_SIZE = 18;
const NOT_ACCOUNTS = new Set(["c", "p", "search"]);

/**
 * robots.txt disallows account feeds and search for `User-agent: *`, so this reads the account page, which lists decks
 * newest first without dates, and takes each date from the deck page. No dots in an account: "<name>.atom" is the disallowed feed.
 */
function speakerdeckInput(params) {
  const account = oneLine(params.account) || /^https?:\/\/(?:www\.)?speakerdeck\.com\/([^/?#]+)/i.exec(params.url ?? "")?.[1];
  if (!account || !/^[\w-]+$/.test(account) || NOT_ACCOUNTS.has(account)) bad("speakerdeck needs account, or url of a deck");
  return { account, sinceDays: intParam(params, "since_days", 365, 1, 3650), limit: intParam(params, "limit", 10, 1, DECK_PAGE_SIZE) };
}

const speakerdeckError = (res) => (res.status === 404 ? { reason: "계정을 찾지 못함", detail: " (계정 이름 확인)" } : null);

function jsonLd(html) {
  return [...String(html).matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap(([, body]) => {
    try {
      return [JSON.parse(body)];
    } catch {
      return [];
    }
  });
}

/** A profile with no decks is a real 0; a page that is neither is a changed layout. */
export function parseDeckList(html) {
  const decks = [...String(html).matchAll(/data-slide-count="(\d+)"[\s\S]*?class="deck-preview-link" href="(\/[^"]+)" title="([^"]*)"/g)].map(([, slides, href, title]) => ({ url: `${DECK_HOST}${href}`, title: cleanText(title), slides: Number(slides) }));
  if (!decks.length && !jsonLd(html).some((d) => d["@type"] === "ProfilePage")) giveUp("speakerdeck", "응답 구조가 바뀜", " (덱 카드 · ProfilePage 없음)");
  return decks;
}

export function parseDeckPage(html) {
  const doc = jsonLd(html).find((d) => d.datePublished);
  return { published: isoDate(doc?.datePublished), summary: excerpt(doc?.description), language: doc?.inLanguage ?? null };
}

async function speakerdeckRun(o, http) {
  const decks = parseDeckList((await http.text(`${DECK_HOST}/${o.account}`, { explain: speakerdeckError })).data);
  const oldest = Date.now() - o.sinceDays * 86400_000;
  const candidates = [];
  let halted = null;
  let aged = false;
  for (const deck of decks.slice(0, o.limit)) {
    await http.pause();
    let page;
    try {
      page = parseDeckPage((await http.text(deck.url)).data);
    } catch (e) {
      if (!(e instanceof RefError)) throw e;
      halted = e.reason ?? e.message;
      break;
    }
    if (page.published && Date.parse(page.published) < oldest) {
      aged = true; // the list runs newest first, so everything after this is older too
      break;
    }
    candidates.push({ url: deck.url, title: deck.title, published: page.published, summary: page.summary, via: "speakerdeck", type: "capture", channel: "primary", meta: { slides: deck.slides, language: page.language } });
  }
  const undated = candidates.filter((c) => !c.published).length;
  const hints = [
    halted && `덱 ${candidates.length}건 확인 뒤 중단: ${halted}`,
    candidates.length && undated === candidates.length && "덱 페이지에서 날짜를 못 읽음. 구조가 바뀌었을 수 있음",
    !decks.length && "공개 덱이 없는 계정",
    aged && !candidates.length && `가장 최근 덱도 ${o.sinceDays}일보다 오래됨. since_days를 늘려 다시 질의`,
  ].filter(Boolean);
  return {
    head: `speakerdeck · ${o.account} · 최근 ${o.sinceDays}일 · ${candidates.length}건 (최신순${!aged && !halted && decks.length > o.limit ? `, 최근 ${o.limit}건까지 확인` : ""})`,
    candidates,
    hint: hints.join("\n") || null,
  };
}

const speakerdeckLine = (c) => [`${c.published ?? "미상"} · ${c.meta.slides}쪽 · ${c.title ?? "(제목 없음)"} · ${c.url}`, ...(c.summary ? [`  ${c.summary}`] : [])];

// ---------- registry ----------

const CONNECTORS = {
  hn: { channel: "reaction", type: "community", key: null, about: "Hacker News 최신순 검색. 영어 질의. {q, match, since_days, min_points, tags, limit}", input: hnInput, run: hnRun, line: hnLine },
  github: { channel: "rationale", type: "official", key: "토큰 선택 (GITHUB_TOKEN · GH_TOKEN)", about: "GitHub 릴리스 노트. '왜'의 공식 근거, 사실 근거로 쓰면 channel primary. {repo, q, limit, include_prerelease}", input: githubInput, run: githubRun, line: githubLine },
  speakerdeck: { channel: "primary", type: "capture", key: null, next: "ref capture", about: "회사·발표자 계정의 최신 덱. 좋은 덱을 찾은 뒤 가지치기용. 요청 1 + N회. {account | url, since_days, limit}", input: speakerdeckInput, run: speakerdeckRun, line: speakerdeckLine },
};

export const connectorNames = Object.keys(CONNECTORS);

export const connectorStatus = () => `커넥터: ${connectorNames.join(", ")} (선택 사용, 자세히: ref fetch list) · GitHub 토큰 ${githubToken() ? "있음" : "없음 (없어도 됨, 시간당 60회)"}`;

export const connectorList = () => Object.entries(CONNECTORS).map(([name, c]) => `${name} · ${CHANNEL_KO[c.channel]} · ${c.key ?? "키 없음"} · ${c.about}`).join("\n");

/** `get` and `pause` are replaceable so tests run without a network or waits. A failure is reported, and the research goes on without it. */
export async function fetchCandidates(name, params = {}, { get = httpGet, pause = () => new Promise((done) => setTimeout(done, PAUSE_MS)) } = {}) {
  const c = CONNECTORS[name] ?? bad(`unknown connector "${name}" (ref fetch list)`);
  const options = c.input(params);
  let result;
  try {
    result = await c.run(options, { json: (url, opts) => getJson(name, url, get, opts), text: (url, opts) => getText(name, url, get, opts), pause });
  } catch (e) {
    if (!(e instanceof RefError)) throw e;
    await announce(`커넥터 ${name} 건너뜀: ${e.reason ?? e.message}. 조사는 계속됨`);
    bad(`${e.message}. 없다는 증거가 아님, WebSearch로 대체`);
  }
  const { head, candidates, hint } = result;
  const newest = candidates.find((x) => x.published)?.published;
  await announce(`커넥터 ${name}: ${candidates.length}건${newest ? ` (최신 ${newest})` : ""}`);
  const add = c.next ?? `ref source add (type ${c.type}, channel ${c.channel})`;
  const next = candidates.length ? `고른 것: ${add} · ref run round의 후보와 질의에 via "${name}"` : "0건은 없다는 증거가 아님";
  return { candidates, text: [head, ...candidates.flatMap(c.line), next, ...(hint ? [hint] : [])].join("\n") };
}
