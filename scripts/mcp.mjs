#!/usr/bin/env node
/**
 * mcp — read-only MCP server over the reference library, so AI agents (Claude Code, pi, …) can search it directly.
 * Mobbin, Refero and Savee expose their libraries to agents over MCP [C50]; this does the same for ~/references.
 *
 * Tools (all read-only; collecting and writing stay in the `ref` CLI):
 *   list_collections · search_references · get_reference · search_findings · get_patterns · get_board
 *
 * Run: node bin/mcp.mjs (stdio). Register: claude mcp add reference-library -s user -- node <path>/bin/mcp.mjs
 */
// stdio carries JSON-RPC — anything a dependency prints must go to stderr
console.log = (...a) => console.error(...a);

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { axisOf, readAxes, tagIndex, tagLabel } from "./axes.mjs";
import { collectionClaims } from "./evidence.mjs";
import { LIB, abs, collectionDir, collectionName, latestSnapshot, listCollections, readClaims, readCollection, readRefs, readRuns } from "./store.mjs";

const text = (o) => ({ content: [{ type: "text", text: typeof o === "string" ? o : JSON.stringify(o, null, 2) }] });
const KIND = { pattern: "패턴", benchmark: "기준치", fact: "사실", gap: "빈틈", failure: "실패 사례", opinion: "의견", hypothesis: "가설" };

async function titles() {
  return new Map((await listCollections()).map((c) => [c.name, c.title ?? c.name]));
}

function refBrief(r, axes, idx, t) {
  const s = latestSnapshot(r);
  return {
    id: r.id,
    product: r.product,
    page: r.page,
    url: r.url,
    categories: (r.categories ?? []).map((c) => t.get(c) ?? c),
    patterns: [...new Set((r.tags ?? []).map((x) => axisOf(idx, x)).filter((x) => !x.startsWith("#")).map((x) => axes.axes.find((a) => a.id === x)?.label))].filter(Boolean),
    captured: s?.at?.slice(0, 10) ?? null,
    preview_image: s?.files?.preview ? abs(s.files.preview) : null,
    note_excerpt: r.notes?.at(-1)?.text?.replace(/\s+/g, " ").slice(0, 280) ?? null,
  };
}

const textMatch = (hay, q) => {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const h = hay.toLowerCase();
  return terms.filter((t) => h.includes(t)).length / Math.max(1, terms.length);
};

const server = new McpServer({ name: "reference-library", version: "1.0.0" });

server.registerTool(
  "list_collections",
  {
    title: "List research collections",
    description: "List every research collection (category) in the reference library with its goal, kind, domain, counts and board path.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const [cols, claims, runs] = await Promise.all([listCollections(), readClaims(), readRuns()]);
    return text(
      cols.map((c) => ({
        name: c.name,
        title: c.title ?? c.name,
        description: c.description ?? null,
        kind: c.kind,
        domain: c.domain,
        references: c.members.length,
        findings: claims.filter((x) => (x.collections ?? []).includes(c.name) && x.status === "active").length,
        last_run: runs.filter((r) => r.collection === c.name).at(-1)?.startedAt?.slice(0, 10) ?? null,
        board: path.join(collectionDir(c.name), "index.html"),
      })),
    );
  },
);

server.registerTool(
  "search_references",
  {
    title: "Search references",
    description:
      "Find references (captured product pages, app screens, articles) by meaning and keywords across all collections. Returns ids, products, patterns, a note excerpt and a local preview image path you can open.",
    inputSchema: {
      query: z.string().describe("What you are looking for, e.g. '사용량 한도 표시', 'onboarding with progress', 'pricing page 2 tiers'"),
      collection: z.string().optional().describe("Limit to one collection name"),
      limit: z.number().int().min(1).max(30).optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ query, collection, limit = 8 }) => {
    const [refs, axes, t] = await Promise.all([readRefs(), readAxes(), titles()]);
    const idx = tagIndex(axes);
    const col = collection ? collectionName(collection) : null;
    const pool = refs.filter((r) => !col || (r.categories ?? []).includes(col));
    let sem = new Map();
    try {
      const { similar } = await import("./embed.mjs");
      sem = new Map((await similar(query, { scope: "refs", k: 60 })).map((h) => [h.id, h.score]));
    } catch (e) {
      console.error("embedding search unavailable:", e.message);
    }
    const scored = pool
      .map((r) => {
        const hay = [r.product, r.page, r.label, r.title, r.description, ...(r.tags ?? []).map((x) => tagLabel(axes, x)), ...(r.notes ?? []).map((n) => n.text)].join(" ");
        return { r, score: (sem.get(r.id) ?? 0) + 0.15 * textMatch(hay, query) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return text({ query, results: scored.map(({ r, score }) => ({ score: +score.toFixed(3), ...refBrief(r, axes, idx, t) })) });
  },
);

server.registerTool(
  "get_reference",
  {
    title: "Get one reference",
    description: "Everything about one reference: product, categories, all notes (from every collection), capture snapshots with local image paths (preview, scroll frames, full page, store screens), recorded changes over time, and the findings that cite it.",
    inputSchema: { id: z.string().describe("Reference id like S12") },
    annotations: { readOnlyHint: true },
  },
  async ({ id }) => {
    const [refs, claims, axes, t] = await Promise.all([readRefs(), readClaims(), readAxes(), titles()]);
    const r = refs.find((x) => x.id === id);
    if (!r) return text(`reference not found: ${id}`);
    const idx = tagIndex(axes);
    return text({
      ...refBrief(r, axes, idx, t),
      type: r.type,
      credibility: r.credibility,
      publisher: r.publisher,
      notes: (r.notes ?? []).map((n) => ({ collection: t.get(n.collection) ?? n.collection, date: n.at?.slice(0, 10), text: n.text })),
      snapshots: (r.snapshots ?? []).map((s) => ({
        date: s.at.slice(0, 10),
        preview: s.files.preview ? abs(s.files.preview) : null,
        frames: (s.files.frames ?? []).map(abs),
        full_page: (s.files.fullParts ?? (s.files.full ? [s.files.full] : [])).map(abs),
        screens: (s.files.screens ?? []).map(abs),
      })),
      changes: (r.changes ?? []).map((c) => ({ date: c.at.slice(0, 10), since: c.from.slice(0, 10), changes: c.lines })),
      cited_by: claims.filter((c) => c.sources.includes(r.id) && c.status === "active").map((c) => ({ id: c.id, kind: KIND[c.kind] ?? c.kind, text: c.text, confidence: c.confidence })),
    });
  },
);

server.registerTool(
  "search_findings",
  {
    title: "Search findings",
    description: "Search research findings (claims) — patterns, benchmarks, facts, gaps, failures — each with its evidence references and a computed confidence. Use this to ground a recommendation in prior research.",
    inputSchema: {
      query: z.string().optional().describe("Topic to search; omit to list"),
      collection: z.string().optional(),
      kind: z.enum(["pattern", "benchmark", "fact", "gap", "failure", "opinion", "hypothesis"]).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ query, collection, kind, limit = 12 }) => {
    const [claims, refs, t] = await Promise.all([readClaims(), readRefs(), titles()]);
    const col = collection ? collectionName(collection) : null;
    let pool = claims.filter((c) => c.status === "active" && (!col || (c.collections ?? []).includes(col)) && (!kind || c.kind === kind));
    if (query) {
      let sem = new Map();
      try {
        const { similar } = await import("./embed.mjs");
        sem = new Map((await similar(query, { scope: "claims", k: 80 })).map((h) => [h.id, h.score]));
      } catch (e) {
        console.error("embedding search unavailable:", e.message);
      }
      pool = pool.map((c) => ({ c, s: (sem.get(c.id) ?? 0) + 0.15 * textMatch(`${c.subject ?? ""} ${c.text}`, query) })).sort((a, b) => b.s - a.s).map((x) => x.c);
    }
    const byId = new Map(refs.map((r) => [r.id, r]));
    return text(
      pool.slice(0, limit).map((c) => ({
        id: c.id,
        kind: KIND[c.kind] ?? c.kind,
        subject: c.subject,
        text: c.text,
        confidence: c.confidence,
        collections: (c.collections ?? []).map((x) => t.get(x) ?? x),
        evidence: c.sources.map((s) => ({ id: s, label: byId.get(s)?.label ?? byId.get(s)?.url, url: byId.get(s)?.url })),
      })),
    );
  },
);

server.registerTool(
  "get_patterns",
  {
    title: "Get patterns",
    description: "Normalized patterns (axes): for each, the question it answers and how each product answers it, per collection — plus which collections share it. Good for 'how do others solve X?'.",
    inputSchema: {
      collection: z.string().optional(),
      query: z.string().optional().describe("Filter patterns by words in label/question"),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ collection, query }) => {
    const [refs, axes, t] = await Promise.all([readRefs(), readAxes(), titles()]);
    const col = collection ? collectionName(collection) : null;
    const out = [];
    for (const ax of axes.axes) {
      if (query && textMatch(`${ax.label} ${ax.question ?? ""} ${ax.description ?? ""}`, query) === 0) continue;
      const users = refs.filter((r) => (r.tags ?? []).some((x) => ax.tags.includes(x)) && (!col || (r.categories ?? []).includes(col)));
      if (!users.length) continue;
      const byProduct = new Map();
      for (const r of users) {
        const p = r.product ?? r.label ?? r.id;
        const e = byProduct.get(p) ?? { product: p, how: new Set(), refs: new Set(), collections: new Set() };
        for (const x of r.tags ?? []) if (ax.tags.includes(x)) e.how.add(tagLabel(axes, x));
        e.refs.add(r.id);
        for (const c of r.categories ?? []) e.collections.add(t.get(c) ?? c);
        byProduct.set(p, e);
      }
      out.push({
        id: ax.id,
        label: ax.label,
        facet: ax.facet ?? "pattern",
        question: ax.question ?? null,
        products: [...byProduct.values()].map((e) => ({ product: e.product, how: [...e.how], refs: [...e.refs], collections: [...e.collections] })),
      });
    }
    out.sort((a, b) => b.products.length - a.products.length);
    return text(out);
  },
);

server.registerTool(
  "get_board",
  {
    title: "Get a collection board",
    description: "A collection's summary (markdown with [C#]/[S#] citations), counts, the findings recorded in it, and the path of its HTML board.",
    inputSchema: { collection: z.string() },
    annotations: { readOnlyHint: true },
  },
  async ({ collection }) => {
    const name = collectionName(collection);
    const col = await readCollection(name);
    if (!col) return text(`collection not found: ${collection}`);
    const claims = await readClaims();
    const { own } = collectionClaims(col, claims);
    const summary = await fs.readFile(path.join(collectionDir(name), "SUMMARY.md"), "utf8").catch(() => null);
    return text({
      name,
      title: col.title ?? name,
      description: col.description ?? null,
      references: col.members.length,
      board: path.join(collectionDir(name), "index.html"),
      summary,
      findings: own.filter((c) => c.status === "active").map((c) => ({ id: c.id, kind: KIND[c.kind] ?? c.kind, text: c.text, confidence: c.confidence, evidence: c.sources })),
    });
  },
);

await server.connect(new StdioServerTransport());
console.error(`reference-library MCP ready (library: ${LIB})`);
