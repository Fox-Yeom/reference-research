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
const { cleanText, connectorList, connectorNames, connectorStatus, excerpt, fetchCandidates, hnUrl, parseAppPage, parseDeckList, parseDeckPage, parseGithub, parseHn } = await import("../scripts/connectors.mjs");
const { RefError, channelOf } = await import("../scripts/store.mjs");

const page = (name) => readFileSync(new URL(`fixtures/connectors/${name}`, import.meta.url), "utf8");
const fixture = (name) => JSON.parse(page(`${name}.json`));
const respond = (body, status = 200, headers = {}) => async () => ({ status, ok: status < 400, headers: new Headers(headers), json: async () => body });
const announced = () => readFileSync(path.join(process.env.REF_HOME, "announce.log"), "utf8");
const rejects = (promise, pattern, message) => assert.rejects(promise, (e) => e instanceof RefError && pattern.test(e.message), message);

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

// App Store: the distribution comes first, the shown reviews are labelled, and nothing about the reviewer survives
const appHtml = page("appstore-page.html");
const appData = () => JSON.parse(/id="serialized-server-data">([\s\S]*?)<\/script>/.exec(appHtml)[1]);
const asHtml = (data) => `<script id="serialized-server-data" type="application/json">${JSON.stringify(data)}</script>`;
const edited = (change) => {
  const data = appData();
  change(data.data[0].data.shelfMapping, data.data[0]);
  return asHtml(data);
};
const parsedApp = parseAppPage(appHtml);
assert.deepEqual(parsedApp, {
  name: "Fixture App",
  storefront: "kr",
  average: 3.6,
  total: 1000,
  stars: [560, 70, 40, 20, 310],
  reviews: [
    { date: "2026-04-06", rating: 5, title: "Shown first", summary: "An older review that Apple put on top." },
    { date: "2026-10-28", rating: 5, title: "The newest one", summary: "Five stars so this gets read." },
  ],
});
const appFetch = (body, opened = []) => async (url) => {
  opened.push(url);
  return typeof body === "function" ? body(url) : { status: 200, ok: true, headers: new Headers(), text: async () => body };
};
const opened = [];
const app = await fetchCandidates("appstore", { app_id: 1000000001 }, { get: appFetch(appHtml, opened) });
assert.deepEqual(opened, ["https://apps.apple.com/kr/app/id1000000001?see-all=reviews"]);
assert.ok(!JSON.stringify(app).includes("fixture-author"), "reviewer names are dropped");
assert.equal(app.candidates.length, 1, "one source: reviews have no address of their own");
assert.deepEqual({ ...app.candidates[0], meta: null }, {
  url: "https://apps.apple.com/kr/app/id1000000001?see-all=reviews",
  title: "Fixture App — App Store 리뷰",
  published: "2026-10-28",
  summary: "평균 3.6 · 1,000건 · 5점 56% · 4점 7% · 3점 4% · 2점 2% · 1점 31%",
  via: "appstore",
  type: "community",
  channel: "reaction",
  meta: null,
});
assert.deepEqual(app.candidates[0].meta.stars, { 5: 560, 4: 70, 3: 40, 2: 20, 1: 310 });
const appLines = app.text.split("\n");
assert.equal(appLines[0], "appstore · Fixture App · kr · 앱 id 1000000001");
assert.equal(appLines[2], "  평균 3.6 · 1,000건 · 5점 56% · 4점 7% · 3점 4% · 2점 2% · 1점 31%", "the distribution comes before the reviews");
assert.equal(appLines[3], "  노출 리뷰 2건: Apple이 고른 순서, 최신순 아님, 분포를 대표하지 않음");
assert.equal(appLines[4], "  2026-04-06 · 5점 · Shown first · An older review that Apple put on top.", "Apple's order is kept");
assert.match(app.text, /고른 것: ref source add \(type community, channel reaction\)/);
assert.match(announced(), /커넥터 appstore: 평가 1,000건 · 노출 리뷰 2건 \(최신 2026-10-28\)/);

// an unknown country is served another storefront with HTTP 200: the answer has to say which one it is
const elsewhere = await fetchCandidates("appstore", { app_id: 1000000001, country: "uk" }, { get: appFetch(edited((_, page) => { page.intent.storefront = "us"; })) });
assert.equal(elsewhere.candidates[0].url, "https://apps.apple.com/us/app/id1000000001?see-all=reviews");
assert.match(elsewhere.text, /^appstore · Fixture App · us ·/);
assert.match(elsewhere.text, /country "uk"는 없는 코드라 Apple이 us 스토어를 보여 줌/);

// no ratings: a real 0, and a Mac app read without platform looks the same
const noCounts = (shelves) => { shelves.productRatings.items[0].ratingCounts = [0, 0, 0, 0, 0]; shelves.productRatings.items[0].ratingAverage = 0; };
const empty = await fetchCandidates("appstore", { app_id: 1 }, { get: appFetch(edited((shelves) => { noCounts(shelves); delete shelves.allProductReviews; })) });
assert.deepEqual(empty.candidates, []);
assert.match(empty.text, /평가와 리뷰가 없음/);
assert.match(empty.text, /0건은 없다는 증거가 아님/);
const macMisread = await fetchCandidates("appstore", { app_id: 1 }, { get: appFetch(edited(noCounts)) });
assert.equal(macMisread.candidates[0].summary, null, "no invented average");
assert.equal(macMisread.candidates[0].meta.average, null);
assert.match(macMisread.text, /platform "mac"으로 다시 질의/);
const macOpened = [];
const mac = await fetchCandidates("appstore", { app_id: 1, platform: "mac" }, { get: appFetch(appHtml, macOpened) });
assert.deepEqual(macOpened, ["https://apps.apple.com/kr/app/id1?see-all=reviews&platform=mac"]);
assert.equal(mac.candidates[0].title, "Fixture App — Mac App Store 리뷰");
const ratingsOnly = await fetchCandidates("appstore", { app_id: 1 }, { get: appFetch(edited((shelves) => { delete shelves.allProductReviews; })) });
assert.equal(ratingsOnly.candidates[0].published, null, "no date is invented");
assert.match(ratingsOnly.text, /미상 · Fixture App/);
assert.match(ratingsOnly.text, /노출 리뷰 없음/);

// a changed page is an error, never an empty answer
for (const [what, html] of Object.entries({
  "no data": "<html></html>",
  "not json": '<script id="serialized-server-data">{</script>',
  "no ratings shelf": edited((shelves) => { delete shelves.productRatings; }),
  "short counts": edited((shelves) => { shelves.productRatings.items[0].ratingCounts = [1, 2]; }),
  "reversed counts": edited((shelves) => { shelves.productRatings.items[0].ratingCounts.reverse(); }),
  "no average": edited((shelves) => { delete shelves.productRatings.items[0].ratingAverage; }),
  "no storefront": edited((_, page) => { delete page.intent; }),
  "renamed reviews": edited((shelves) => { for (const item of shelves.allProductReviews.items) delete item.review; }),
})) {
  await rejects(fetchCandidates("appstore", { app_id: 1 }, { get: appFetch(html) }), /응답 구조가 바뀜/, what);
}
await rejects(fetchCandidates("appstore", { app_id: 1 }, { get: appFetch(async () => ({ status: 404, ok: false, headers: new Headers() })) }), /이 스토어에서 앱을 찾지 못함/);
assert.match(announced(), /커넥터 appstore 건너뜀: 이 스토어에서 앱을 찾지 못함\. 조사는 계속됨/);

// a name goes through the documented search API, and the other matches stay in view
const itunes = (results) => {
  const seen = [];
  const get = async (url) => {
    seen.push(url);
    return url.includes("itunes.apple.com") ? { status: 200, ok: true, headers: new Headers(), json: async () => ({ resultCount: results.length, results }) } : { status: 200, ok: true, headers: new Headers(), text: async () => appHtml };
  };
  return { get, seen };
};
const byName = itunes([{ trackId: 111, trackName: "Second  one" }, { trackId: 222, trackName: "네이버지도 - 장소" }]);
const named = await fetchCandidates("appstore", { app: "네이버 지도" }, { get: byName.get });
assert.deepEqual(Object.fromEntries(new URL(byName.seen[0]).searchParams), { term: "네이버 지도", entity: "software", country: "kr", limit: "6" });
assert.equal(byName.seen[1], "https://apps.apple.com/kr/app/id222?see-all=reviews", "the name decides, not the search rank");
assert.match(named.text, /다른 앱이면 app_id로 다시 질의: Second one \(111\)/);
const byMac = itunes([{ trackId: 111, trackName: "Slack phone", kind: "software" }, { trackId: 333, trackName: "SLACK for Desktop", kind: "mac-software" }]);
await fetchCandidates("appstore", { app: "Slack", platform: "mac" }, { get: byMac.get });
assert.equal(new URL(byMac.seen[0]).searchParams.get("entity"), "macSoftware");
assert.equal(byMac.seen[1], "https://apps.apple.com/kr/app/id333?see-all=reviews&platform=mac", "a Mac search can return phone apps");
const nothing = await fetchCandidates("appstore", { app: "없는 앱" }, { get: itunes([]).get });
assert.deepEqual(nothing.candidates, []);
assert.match(nothing.text, /이름이 맞는 앱 0건/);
assert.match(nothing.text, /앱 이름을 바꾸거나 app_id로 다시 질의/);
const wrongApp = itunes([{ trackId: 444, trackName: "KakaoTalk", kind: "mac-software" }, { trackId: 555, trackName: "DevCleaner for Xcode", kind: "mac-software" }]);
const refused = await fetchCandidates("appstore", { app: "Xcode", platform: "mac" }, { get: wrongApp.get });
assert.deepEqual(refused.candidates, [], "another app's ratings are never returned under this name");
assert.equal(wrongApp.seen.length, 1, "no page is read");
assert.match(refused.text, /이 중에 있으면 app_id로 다시 질의: KakaoTalk \(444\) · DevCleaner for Xcode \(555\)/);
await rejects(fetchCandidates("appstore", { app: "x" }, { get: respond({ error: "x" }) }), /응답 구조가 바뀜/);
for (const [input, message] of [[{}, /needs app/], [{ app_id: "id123" }, /must be a number/], [{ app: "x", country: "korea" }, /two-letter/], [{ app: "x", platform: "android" }, /platform/]]) await rejects(fetchCandidates("appstore", input), message);

// the store page is the product's own, so it counts as primary; written reviews are reactions
assert.equal(channelOf({ type: "store" }), "primary");
assert.equal(channelOf({ type: "community" }), "reaction");
assert.equal(channelOf({ type: "store", channel: "reaction" }), "reaction", "an old source keeps what was set on it");

console.log("connectors ok");
