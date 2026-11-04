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
const version = (() => {
  try {
    return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  } catch {
    return null;
  }
})();
const UA = `reference-research${version ? `/${version}` : ""} (+https://github.com/Fox-Yeom/reference-research)`;

const httpGet = (url) => fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });

/** One line per failure; connectors never retry (docs/CONNECTORS.md §3). */
async function getJson(name, url, get) {
  let res;
  try {
    res = await get(url);
  } catch (e) {
    bad(`${name}: 연결 실패 (${e.cause?.code ?? e.name})`);
  }
  if (res.status === 429) bad(`${name}: 호출 한도 초과 (HTTP 429)`);
  if (!res.ok) bad(`${name}: HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    bad(`${name}: 응답 구조가 바뀜 (JSON 아님)`);
  }
}

const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decodeEntity = (whole, body) => {
  const code = /^#x/i.test(body) ? parseInt(body.slice(2), 16) : body[0] === "#" ? Number(body.slice(1)) : null;
  if (code === null) return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
};

/** HTML to plain text, cut to a summary. Tags go before entities so an escaped "<" survives as text. */
export function cleanText(html, max = SUMMARY_CHARS) {
  const text = oneLine(String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, decodeEntity));
  if (!text) return null;
  const chars = [...text];
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : text;
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
  if (!Array.isArray(data?.hits)) bad("hn: 응답 구조가 바뀜 (hits 없음)");
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
  if (data.hits.length && !candidates.length) bad("hn: 응답 구조가 바뀜 (objectID · created_at 없음)");
  return { total: data.nbHits ?? candidates.length, candidates };
}

function hnHint(o) {
  if (/[가-힣]/.test(o.q)) return "HN은 영어권 글이라 한국어 질의는 거의 잡히지 않음. 영어로 다시 질의";
  if (o.match === "loose") return null;
  return `구문 그대로 찾음. 단어를 줄이거나 match "${o.match === "title" ? "text" : "loose"}"로 다시 질의`;
}

async function hnRun(o, json) {
  const { total, candidates } = parseHn(await json(hnUrl(o)));
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

// ---------- registry ----------

const CONNECTORS = {
  hn: { channel: "reaction", type: "community", key: null, about: "Hacker News 최신순 검색. 영어 질의. {q, match, since_days, min_points, tags, limit}", input: hnInput, run: hnRun, line: hnLine },
};

export const connectorNames = Object.keys(CONNECTORS);

export const connectorList = () => Object.entries(CONNECTORS).map(([name, c]) => `${name} · ${CHANNEL_KO[c.channel]} · ${c.key ?? "키 없음"} · ${c.about}`).join("\n");

/** `get` is replaceable so tests run without a network. A failure is reported, and the research goes on without it. */
export async function fetchCandidates(name, params = {}, { get = httpGet } = {}) {
  const c = CONNECTORS[name] ?? bad(`unknown connector "${name}" (ref fetch list)`);
  const options = c.input(params);
  let result;
  try {
    result = await c.run(options, (url) => getJson(name, url, get));
  } catch (e) {
    if (!(e instanceof RefError)) throw e;
    await announce(`커넥터 ${name} 실패: ${e.message}`);
    bad(`${e.message}. 없다는 증거가 아님, WebSearch로 대체`);
  }
  const { head, candidates, hint } = result;
  const newest = candidates.find((x) => x.published)?.published;
  await announce(`커넥터 ${name}: ${candidates.length}건${newest ? ` (최신 ${newest})` : ""}`);
  const next = candidates.length ? `고른 것: ref source add (type ${c.type}, 채널 ${CHANNEL_KO[c.channel]}) · ref run round의 후보와 질의에 via "${name}"` : "0건은 없다는 증거가 아님";
  return { candidates, text: [head, ...candidates.flatMap(c.line), next, ...(hint ? [hint] : [])].join("\n") };
}
