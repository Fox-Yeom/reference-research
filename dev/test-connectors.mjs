#!/usr/bin/env node
// Connector parsing and failure reporting, offline: fixtures are hand-written, `get` is replaced, nothing reaches the network.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

const scratch = mkdtempSync(path.join(tmpdir(), "ref-connectors-"));
process.env.REF_HOME = path.join(scratch, "home"); // announce() writes here, set before store.mjs loads
process.env.REF_LIBRARY = path.join(scratch, "lib");
const { cleanText, connectorList, connectorNames, fetchCandidates, hnUrl, parseHn } = await import("../scripts/connectors.mjs");
const { RefError } = await import("../scripts/store.mjs");

const fixture = (name) => JSON.parse(readFileSync(new URL(`fixtures/connectors/${name}.json`, import.meta.url), "utf8"));
const respond = (body, status = 200) => async () => ({ status, ok: status < 400, json: async () => body });
const announced = () => readFileSync(path.join(process.env.REF_HOME, "announce.log"), "utf8");
const rejects = (promise, pattern) => assert.rejects(promise, (e) => e instanceof RefError && pattern.test(e.message));

// text
assert.equal(cleanText("<p>a &amp; b</p>\n<i>c</i>"), "a & b c");
assert.equal(cleanText("&lt;Select&gt;"), "<Select>", "an escaped tag stays as text");
assert.equal(cleanText("&#x2F;&#39;&bogus;&#x110000;"), "/'&bogus;&#x110000;");
assert.equal(cleanText("가".repeat(201)), `${"가".repeat(200)}…`);
assert.equal(cleanText(""), null);

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
assert.match(lines.at(-1), /type community, 채널 반응/);
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
assert.match(announced(), /커넥터 hn 실패: hn: 호출 한도 초과/);

// input
await rejects(fetchCandidates("hn", {}), /needs q/);
await rejects(fetchCandidates("hn", { q: "x", tags: "job" }), /tags/);
await rejects(fetchCandidates("hn", { q: "x", limit: 0 }), /limit/);
await rejects(fetchCandidates("hn", { q: "x", match: "exact" }), /match/);
await rejects(fetchCandidates("hn", { q: "x", tags: "comment", match: "title" }), /comments have no title/);
await rejects(fetchCandidates("nope", {}), /unknown connector/);
assert.ok(connectorNames.includes("hn"));
assert.match(connectorList(), /^hn · 반응 · 키 없음/);

console.log("connectors ok");
