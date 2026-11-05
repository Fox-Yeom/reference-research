#!/usr/bin/env node
// Connector parsing and failure reporting, offline: fixtures are hand-written, `get` is replaced, nothing reaches the network.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

const scratch = mkdtempSync(path.join(tmpdir(), "ref-connectors-"));
process.env.REF_HOME = path.join(scratch, "home"); // announce() writes here, set before store.mjs loads
process.env.REF_LIBRARY = path.join(scratch, "lib");
delete process.env.GITHUB_TOKEN;
delete process.env.GH_TOKEN;
const { cleanText, connectorList, connectorNames, connectorStatus, excerpt, fetchCandidates, hnUrl, parseDeckList, parseDeckPage, parseGithub, parseHn } = await import("../scripts/connectors.mjs");
const { RefError } = await import("../scripts/store.mjs");

const page = (name) => readFileSync(new URL(`fixtures/connectors/${name}`, import.meta.url), "utf8");
const fixture = (name) => JSON.parse(page(`${name}.json`));
const respond = (body, status = 200, headers = {}) => async () => ({ status, ok: status < 400, headers: new Headers(headers), json: async () => body });
const announced = () => readFileSync(path.join(process.env.REF_HOME, "announce.log"), "utf8");
const rejects = (promise, pattern) => assert.rejects(promise, (e) => e instanceof RefError && pattern.test(e.message));

// text
assert.equal(cleanText("<p>a &amp; b</p>\n<i>c</i>"), "a & b c");
assert.equal(cleanText("&lt;Select&gt;"), "<Select>", "an escaped tag stays as text");
assert.equal(cleanText("&#x2F;&#39;&bogus;&#x110000;"), "/'&bogus;&#x110000;");
assert.equal(cleanText("가".repeat(201)), `${"가".repeat(200)}…`);
assert.equal(cleanText(""), null);
assert.equal(excerpt("  a\n b ", null), "a b");
assert.equal(excerpt(`${"x".repeat(100)} needle`, "NEEDLE"), `…${"x".repeat(39)} needle`, "starts near the match");
assert.equal(excerpt(null, "q"), null);

// stories
const stories = parseHn(fixture("hn-story"));
assert.equal(stories.total, 134);
assert.deepEqual(stories.candidates[0], {
  url: "https://news.ycombinator.com/item?id=1001",
  title: "A fixture story about tokens",
  published: "2026-11-02",
  summary: null,
  via: "hn",
  type: "community",
  channel: "reaction",
  meta: { points: 42, comments: 18, link: "https://example.com/tokens" },
});
assert.equal(stories.candidates[1].summary, "Why are tokens & themes separate?");
assert.equal(stories.candidates[1].published, "2026-10-30", "the date is kept as the source wrote it");

// comments
const [comment] = parseHn(fixture("hn-comment")).candidates;
assert.equal(comment.url, "https://news.ycombinator.com/item?id=2001");
assert.equal(comment.title, "A fixture story");
assert.equal(comment.summary, "We moved off it because of <Select> bugs. See https://example.com/a 'here'.");
assert.deepEqual(comment.meta, { story: "https://news.ycombinator.com/item?id=1001", link: "https://example.com/tokens" });
assert.ok(!JSON.stringify([stories, comment]).includes("fixture-author"), "author names are dropped");

// query: a phrase in the title by default, because the default search forgives typos
const now = Date.UTC(2026, 10, 4);
const since = now / 1000 - 365 * 86400;
const params = (o) => new URL(hnUrl({ q: "design system", tags: "story", match: "title", limit: 20, sinceDays: 365, minPoints: 5, ...o }, now)).searchParams;
assert.equal(params({}).get("query"), '"design system"');
assert.equal(params({}).get("restrictSearchableAttributes"), "title");
assert.equal(params({}).get("numericFilters"), `created_at_i>${since},points>=5`);
assert.equal(params({ match: "text" }).get("query"), '"design system"');
assert.equal(params({ match: "text" }).get("restrictSearchableAttributes"), null);
assert.equal(params({ match: "loose" }).get("query"), "design system");
assert.equal(params({ tags: "comment", match: "text" }).get("numericFilters"), `created_at_i>${since}`, "comments have no points");

// '0 results' and 'broken' stay apart
assert.throws(() => parseHn({}), /구조/);
assert.throws(() => parseHn({ hits: [{ title: "no id" }] }), /구조/);
assert.deepEqual(parseHn({ nbHits: 0, hits: [] }), { total: 0, candidates: [] });

// output
const ok = await fetchCandidates("hn", { q: "design system" }, { get: respond(fixture("hn-story")) });
const lines = ok.text.split("\n");
assert.equal(lines[0], 'hn · "design system" · 최근 365일 · 제목 일치 · 5점 이상 134건 중 2건 (최신순)');
assert.equal(lines[1], "2026-11-02 · 42점 · 댓글 18 · A fixture story about tokens · https://news.ycombinator.com/item?id=1001");
assert.match(lines.at(-1), /type community, channel reaction/);
assert.match(announced(), /커넥터 hn: 2건 \(최신 2026-11-02\)/);
const none = await fetchCandidates("hn", { q: "토스" }, { get: respond({ nbHits: 0, hits: [] }) });
assert.match(none.text, /0건은 없다는 증거가 아님/);
assert.match(none.text, /영어로 다시 질의/);
const phrase = await fetchCandidates("hn", { q: '"figma pricing"' }, { get: respond({ nbHits: 0, hits: [] }) });
assert.match(phrase.text, /^hn · "figma pricing" ·/, "quotes in q are not doubled");
assert.match(phrase.text, /match "text"로 다시 질의/);
const comments = await fetchCandidates("hn", { q: "figma", tags: "comment" }, { get: respond(fixture("hn-comment")) });
assert.match(comments.text, /본문 일치 · 댓글 1건/, "comments default to text");

// failures are one line, say the research goes on, and reach the user
await rejects(fetchCandidates("hn", { q: "x" }, { get: respond({}, 429) }), /호출 한도 초과.*WebSearch로 대체/);
await rejects(fetchCandidates("hn", { q: "x" }, { get: respond({}, 500) }), /HTTP 500/);
await rejects(fetchCandidates("hn", { q: "x" }, { get: respond({}) }), /구조/);
await rejects(fetchCandidates("hn", { q: "x" }, { get: async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } }); } }), /연결 실패 \(ENOTFOUND\)/);
assert.match(announced(), /커넥터 hn 건너뜀: 호출 한도 초과\. 조사는 계속됨/);

// input
await rejects(fetchCandidates("hn", {}), /needs q/);
await rejects(fetchCandidates("hn", { q: "x", tags: "job" }), /tags/);
await rejects(fetchCandidates("hn", { q: "x", limit: 0 }), /limit/);
await rejects(fetchCandidates("hn", { q: "x", match: "exact" }), /match/);
await rejects(fetchCandidates("hn", { q: "x", tags: "comment", match: "title" }), /comments have no title/);
await rejects(fetchCandidates("nope", {}), /unknown connector/);
assert.ok(connectorNames.includes("hn"));
assert.match(connectorList(), /^hn · 반응 · 키 없음/);

// GitHub: stable releases only, sorted by publish date
const github = { repo: "acme/widgets", q: null, includePrerelease: false, limit: 10 };
const releases = fixture("github-releases");
const stable = parseGithub(releases, github);
assert.deepEqual(stable.candidates.map((c) => c.meta.tag), ["v2.9.9", "v3.1.0"], "no prerelease or draft, a late backport sorts by date");
assert.deepEqual([stable.scanned, stable.wanted, stable.total], [4, 2, 2]);
assert.deepEqual(stable.candidates[1], {
  url: "https://github.com/acme/widgets/releases/tag/v3.1.0",
  title: "acme/widgets Widgets 3.1",
  published: "2026-10-01",
  summary: "## Changes We dropped <Select> caching because it broke themes.",
  via: "github",
  type: "official",
  channel: "rationale",
  meta: { tag: "v3.1.0", prerelease: false },
});
assert.equal(stable.candidates[0].title, "acme/widgets v2.9.9", "falls back on the tag");
assert.equal(stable.candidates[0].summary, null);
assert.ok(!JSON.stringify(stable).includes("fixture-author"), "author names are dropped");
assert.equal(parseGithub(releases, { ...github, includePrerelease: true }).candidates[0].meta.tag, "v4.0.0-canary.2");
const searched = parseGithub(releases, { ...github, q: "CACHING" });
assert.deepEqual(searched.candidates.map((c) => c.meta.tag), ["v3.1.0"], "q ignores case and reads the body");
assert.throws(() => parseGithub({ message: "x" }, github), /구조/);
assert.throws(() => parseGithub([{ tag_name: "v1" }], github), /구조/);

// GitHub: request, quota and messages
const seen = [];
const recording = (body, status, headers) => async (url, sent) => {
  seen.push({ url, sent });
  return respond(body, status, headers)();
};
const quota = { "x-ratelimit-limit": "60", "x-ratelimit-remaining": "57" };
const out = await fetchCandidates("github", { repo: "https://github.com/acme/widgets.git" }, { get: recording(releases, 200, quota) });
assert.equal(seen[0].url, "https://api.github.com/repos/acme/widgets/releases?per_page=100");
assert.equal(seen[0].sent.authorization, undefined);
assert.equal(out.text.split("\n")[0], "github · acme/widgets · 최근 릴리스 4개 · 안정판 2건 (최신순) · 남은 호출 57/60");
assert.match(out.text, /type official, channel rationale/);
const narrowed = await fetchCandidates("github", { repo: "acme/widgets", q: "caching", limit: 1 }, { get: respond(releases) });
assert.match(narrowed.text, /안정판 2건 · "caching" 포함 1건/);
assert.match((await fetchCandidates("github", { repo: "acme/empty" }, { get: respond([]) })).text, /릴리스 없음/);
assert.match((await fetchCandidates("github", { repo: "acme/canary" }, { get: respond([releases[0]]) })).text, /모두 사전 릴리스/);
assert.match((await fetchCandidates("github", { repo: "acme/widgets", q: "nothing" }, { get: respond(releases) })).text, /단어를 바꿔/);
assert.match((await fetchCandidates("github", { repo: "acme/widgets" }, { get: respond(releases, 200, { "x-ratelimit-limit": "60", "x-ratelimit-remaining": "3" }) })).text, /호출 3회 남음/);
await rejects(fetchCandidates("github", { repo: "acme/none" }, { get: respond({}, 404) }), /저장소를 찾지 못함/);
await rejects(fetchCandidates("github", { repo: "acme/widgets" }, { get: respond({}, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1793780138" }) }), /한도 소진, \d\d:\d\d 이후 다시 가능\. GITHUB_TOKEN/);
await rejects(fetchCandidates("github", { repo: "acme/widgets" }, { get: respond({}, 403, { "x-ratelimit-remaining": "12" }) }), /HTTP 403/);
for (const repo of ["", "acme", "../x", "acme/..", "acme/."]) await rejects(fetchCandidates("github", { repo }), /owner\/name/);
assert.deepEqual((await fetchCandidates("github", { repo: "acme/.github" }, { get: respond([]) })).candidates, []);

// GitHub: the token is sent and shown nowhere
const fakeToken = `fake-${process.pid}`;
assert.match(connectorStatus(), /토큰 없음/);
process.env.GITHUB_TOKEN = fakeToken;
const shown = [];
await fetchCandidates("github", { repo: "acme/widgets" }, { get: recording(releases, 200, quota) }).then((r) => shown.push(r.text));
assert.equal(seen.at(-1).sent.authorization, `Bearer ${fakeToken}`);
for (const status of [401, 403, 500]) await fetchCandidates("github", { repo: "acme/widgets" }, { get: respond({}, status) }).catch((e) => shown.push(e.message));
await fetchCandidates("github", { repo: "acme/widgets" }, { get: async () => { throw new TypeError("fetch failed"); } }).catch((e) => shown.push(e.message));
assert.equal(shown.length, 5);
assert.match(connectorStatus(), /토큰 있음/);
for (const text of [...shown, connectorStatus(), connectorList(), announced()]) assert.ok(!text.includes(fakeToken), "token leaked");
assert.ok(!announced().includes("GITHUB_TOKEN"), "token advice goes to the agent, not to the user");
assert.match(announced(), /커넥터 github 건너뜀: 시간당 호출 한도 소진, \d\d:\d\d 이후 다시 가능\. 조사는 계속됨/);
delete process.env.GITHUB_TOKEN;

// Speaker Deck: the account page lists, the deck page dates
const listing = page("speakerdeck-account.html");
const deckOn = (date) => page("speakerdeck-deck.html").replace("2026-08-25", date);
assert.deepEqual(parseDeckList(listing), [
  { url: "https://speakerdeck.com/acme/first-deck", title: "First & deck", slides: 26 },
  { url: "https://speakerdeck.com/acme/second-deck", title: "Second deck", slides: 12 },
  { url: "https://speakerdeck.com/acme/old-deck", title: "Old deck", slides: 40 },
]);
assert.deepEqual(parseDeckPage(deckOn("2026-08-25")), { published: "2026-08-25", summary: "Why we moved the design tokens. https://example.com/a", language: "en" });
assert.deepEqual(parseDeckPage("<html></html>"), { published: null, summary: null, language: null });
assert.deepEqual(parseDeckList('<script type="application/ld+json">{"@type":"ProfilePage"}</script>'), [], "a profile with no decks is a real 0");
assert.throws(() => parseDeckList("<html>something else</html>"), /구조/, "a changed layout is not 0");

const days = (n) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
const site = (decks) => {
  const opened = [];
  const get = async (url) => {
    opened.push(url);
    const key = url.split("/").pop();
    if (key === "acme") return { status: 200, ok: true, headers: new Headers(), text: async () => listing };
    if (decks[key] === undefined) return { status: 500, ok: false, headers: new Headers() };
    return { status: 200, ok: true, headers: new Headers(), text: async () => decks[key] };
  };
  return { get, opened };
};
let pauses = 0;
const pause = async () => void pauses++;
const open = site({ "first-deck": deckOn(days(10)), "second-deck": deckOn(days(100)), "old-deck": deckOn(days(800)) });
const decks = await fetchCandidates("speakerdeck", { url: "https://speakerdeck.com/acme/first-deck?slide=3" }, { get: open.get, pause });
assert.deepEqual(open.opened, ["https://speakerdeck.com/acme", "https://speakerdeck.com/acme/first-deck", "https://speakerdeck.com/acme/second-deck", "https://speakerdeck.com/acme/old-deck"], "stops at the first old deck");
assert.equal(pauses, 3, "waits before each deck page");
assert.ok(open.opened.every((u) => !u.includes(".atom") && !u.includes("/search")), "paths robots.txt disallows stay unused");
assert.deepEqual(decks.candidates.map((c) => c.published), [days(10), days(100)]);
assert.deepEqual(decks.candidates[0].meta, { slides: 26, language: "en" });
assert.equal(decks.candidates[0].via, "speakerdeck");
assert.equal(decks.text.split("\n")[0], "speakerdeck · acme · 최근 365일 · 2건 (최신순)");
assert.equal(decks.text.split("\n")[1], `${days(10)} · 26쪽 · First & deck · https://speakerdeck.com/acme/first-deck`);
assert.match(decks.text, /고른 것: ref capture · ref run round의 후보와 질의에 via "speakerdeck"/);
const capped = await fetchCandidates("speakerdeck", { account: "acme", limit: 1 }, { get: site({ "first-deck": deckOn(days(1)) }).get, pause });
assert.match(capped.text, /최신순, 최근 1건까지 확인/);
assert.match((await fetchCandidates("speakerdeck", { account: "acme" }, { get: site({ "first-deck": deckOn(days(900)) }).get, pause })).text, /가장 최근 덱도 365일보다 오래됨/);
assert.match((await fetchCandidates("speakerdeck", { account: "acme" }, { get: site({ "first-deck": deckOn(days(1)) }).get, pause })).text, /덱 1건 확인 뒤 중단: 서버 응답 오류/, "keeps what it has when a deck page fails");
assert.match((await fetchCandidates("speakerdeck", { account: "acme", limit: 1 }, { get: site({ "first-deck": "<html></html>" }).get, pause })).text, /날짜를 못 읽음/);
await rejects(fetchCandidates("speakerdeck", { account: "none" }, { get: respond({}, 404), pause }), /계정을 찾지 못함/);
for (const bad of [{}, { account: "toss.atom" }, { account: "search" }, { account: "c" }, { url: "https://speakerdeck.com/p/all.atom" }, { url: "https://example.com/acme/x" }]) await rejects(fetchCandidates("speakerdeck", bad), /needs account/);
await rejects(fetchCandidates("speakerdeck", { account: "acme", limit: 19 }), /limit/);

console.log("connectors ok");
