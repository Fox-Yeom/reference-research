/**
 * registry — v3 topic and entity registries (docs/DATA-MODEL.md M1, M7).
 *
 *   ref topic set '<json>'   {topics:[{id, label, description?, order?}], assign:{"<collection>": "<topic id>" | null}}
 *   ref topic show           topics with their collections; collections without a topic
 *   ref entity set '<json>'  {entities:[{id?, kind: product|org, name, aliases?, org?, parent?, access?}], link:{"S#": "E#|name"}, link_org:{"S#": "E#|name"}}
 *   ref entity show [query]  entities (name/alias match) with the refs pointing at them
 *   ref entity merge '{"keep":"E#","drop":"E#"}' [--dry-run]   fold one entity into another of the same kind (#23)
 *   ref entity remove E# [E# …] [--dry-run]                    delete entities nothing points at (#23)
 *   ref entity review [--out file]                              preview: entities the product rule would not make, merge and org candidates
 *
 * A merged entity stays in entities.json as a pointer {id, kind, name, mergedInto, mergedAt}: findEntity() follows it, name lookups
 * and listings skip it, nextId() still counts it.
 */
import { bad, collectionName, ENTITY_KINDS, findEntity, hostOf, writeReport, isProductRef, listCollections, nextId, normName, readClaims, readCollection, readEntities, readRefs, readTopics, resolveRefId, saveClaims, saveRefs, writeCollection, writeEntities, writeTopics } from "./store.mjs";

const TOPIC_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

export async function setTopics(params) {
  const topics = await readTopics();
  const out = [];
  for (const t of params.topics ?? []) {
    if (!TOPIC_ID.test(t.id ?? "")) bad(`topic id must be lowercase letters, digits and "-" (got "${t.id}")`);
    const old = topics.find((x) => x.id === t.id);
    if (!old && !t.label?.trim()) bad(`topic ${t.id}: label is required`);
    const next = { ...(old ?? { id: t.id }), ...(t.label ? { label: t.label.trim() } : {}), ...(t.description !== undefined ? { description: t.description || null } : {}), ...(t.order !== undefined ? { order: Number(t.order) } : {}) };
    if (old) Object.assign(old, next);
    else topics.push(next);
    out.push(`${old ? "updated" : "added"} topic ${t.id} · ${next.label}`);
  }
  // check every assignment first, so a bad entry leaves nothing half-written
  const plan = [];
  for (const [name, topic] of Object.entries(params.assign ?? {})) {
    const col = await readCollection(collectionName(name));
    if (!col) bad(`collection ${name} not found`);
    if (topic && !topics.some((t) => t.id === topic)) bad(`topic "${topic}" is not in topics.json`);
    plan.push([col, topic]);
  }
  if (params.topics?.length) await writeTopics(topics);
  for (const [col, topic] of plan) {
    col.topic = topic || null;
    await writeCollection(col);
    out.push(`${col.name} → ${topic || "(no topic)"}`);
  }
  return out.join("\n") || "nothing to do: give topics[] and/or assign{}";
}

export async function showTopics() {
  const [topics, cols] = await Promise.all([readTopics(), listCollections()]);
  const lines = topics
    .slice()
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.label.localeCompare(b.label))
    .map((t) => {
      const cs = cols.filter((c) => c.topic === t.id);
      return `- ${t.id} · ${t.label} (${cs.length})${t.description ? ` — ${t.description}` : ""}${cs.length ? `\n    ${cs.map((c) => c.name).join(", ")}` : ""}`;
    });
  const none = cols.filter((c) => !c.topic || !topics.some((t) => t.id === c.topic));
  if (none.length) lines.push(`\nNo topic (${none.length}): ${none.map((c) => c.name).join(", ")}`);
  return lines.join("\n") || "(no topics yet — ref topic set)";
}

export async function setEntities(params) {
  const [entities, refs] = await Promise.all([readEntities(), readRefs()]);
  const out = [];
  for (const e of params.entities ?? []) {
    if (!ENTITY_KINDS.includes(e.kind) && !e.id) bad(`entity kind must be one of ${ENTITY_KINDS.join(", ")}`);
    const ptr = e.id && entities.find((x) => x.id === e.id && x.mergedInto);
    if (ptr) bad(`${e.id} was merged into ${ptr.mergedInto}: edit ${ptr.mergedInto}`);
    const old = e.id ? findEntity(entities, e.id) : findEntity(entities, e.name, e.kind);
    if (e.id && !old) bad(`entity ${e.id} not found`);
    if (!old && !e.name?.trim()) bad("a new entity needs a name");
    for (const k of ["org", "parent"]) if (e[k] && !findEntity(entities, e[k], k === "org" ? "org" : old?.kind ?? e.kind)) bad(`${k} "${e[k]}" is not in entities.json`);
    const ent = old ?? { id: nextId("E", entities), kind: e.kind, name: e.name.trim(), aliases: [] };
    if (!old) entities.push(ent);
    if (e.name && old) ent.name = e.name.trim();
    if (e.aliases) ent.aliases = [...new Set([...(ent.aliases ?? []), ...e.aliases.map((a) => String(a).trim()).filter((a) => a && normName(a) !== normName(ent.name))])];
    if (e.org !== undefined) ent.org = e.org ? findEntity(entities, e.org, "org").id : null;
    if (e.parent !== undefined) ent.parent = e.parent ? findEntity(entities, e.parent, ent.kind).id : null;
    if (e.access !== undefined) ent.access = e.access || null;
    out.push(`${old ? "updated" : "added"} ${ent.id} [${ent.kind}] ${ent.name}${ent.aliases?.length ? ` (aka ${ent.aliases.join(", ")})` : ""}`);
  }
  const touched = new Map();
  for (const [field, kind, map] of [["entity", "product", params.link], ["org", "org", params.link_org]]) {
    for (const [sid, key] of Object.entries(map ?? {})) {
      const r = refs.find((x) => x.id === resolveRefId(refs, sid)) ?? bad(`ref ${sid} not found`);
      const ent = key ? findEntity(entities, key, kind) ?? bad(`${field} "${key}" is not in entities.json`) : null;
      r[field] = ent?.id ?? null;
      touched.set(r.id, r);
      out.push(`${sid}.${field} → ${ent ? `${ent.id} ${ent.name}` : "(none)"}`);
    }
  }
  if (params.entities?.length) await writeEntities(entities);
  if (touched.size) await saveRefs([...touched.values()]);
  return out.join("\n") || "nothing to do: give entities[] and/or link{} / link_org{}";
}

export async function showEntities(query) {
  const [entities, refs] = await Promise.all([readEntities(), readRefs()]);
  const q = query ? normName(query) : null;
  const hit = entities.filter((e) => !e.mergedInto).filter((e) => !q || normName(e.name).includes(q) || (e.aliases ?? []).some((a) => normName(a).includes(q)));
  return (
    hit
      .map((e) => {
        const rs = refs.filter((r) => r.entity === e.id || r.org === e.id);
        const org = e.org ? entities.find((x) => x.id === e.org) : null;
        return `- ${e.id} [${e.kind}] ${e.name}${e.aliases?.length ? ` (aka ${e.aliases.join(", ")})` : ""}${org ? ` · org ${org.id} ${org.name}` : ""}${e.access ? ` · access: ${e.access}` : ""} — ${rs.length} refs${rs.length ? `: ${rs.slice(0, 8).map((r) => r.id).join(", ")}${rs.length > 8 ? " …" : ""}` : ""}`;
      })
      .join("\n") || (query ? `(no entity matches "${query}")` : "(no entities yet — ref entity set)")
  );
}

// ---------- cleanup (#23): merge, remove, review ----------

const ENTITY_ID = /^E\d+$/;
const uniqBy = (xs, key) => [...new Map(xs.map((x) => [key(x), x])).values()];

/** ref id → member roles across collections */
export function rolesByRef(cols) {
  const m = new Map();
  for (const c of cols) for (const x of c.members ?? []) if (x.role) (m.get(x.ref) ?? m.set(x.ref, []).get(x.ref)).push(x.role);
  return m;
}

/** `publisher` on refs that are no product page and carry no entity or org → org candidates, biggest first (`product` there is a title) */
export function orgCandidates(refs, entities, roles) {
  const groups = new Map();
  for (const r of refs) {
    const name = (r.publisher ?? "").trim();
    if (!name || r.entity || r.org || isProductRef(r, roles.get(r.id))) continue;
    const k = normName(name);
    if (!k) continue;
    const g = groups.get(k) ?? groups.set(k, { names: new Map(), refs: [] }).get(k);
    g.names.set(name, (g.names.get(name) ?? 0) + 1);
    g.refs.push(r.id);
  }
  return [...groups.values()]
    .map((g) => {
      const name = [...g.names].sort((a, b) => b[1] - a[1])[0][0];
      return { name, refs: g.refs, registered: findEntity(entities, name, "org")?.id ?? null };
    })
    .sort((a, b) => b.refs.length - a.refs.length || a.name.localeCompare(b.name));
}

/** everything that names an entity id: ref entity/org, entity org/parent, claim about, merged entities pointing at it */
function linksOf(id, { entities, refs, claims }) {
  return [
    ...refs.filter((r) => r.entity === id).map((r) => `${r.id}.entity`),
    ...refs.filter((r) => r.org === id).map((r) => `${r.id}.org`),
    ...entities.filter((e) => !e.mergedInto && e.id !== id && (e.org === id || e.parent === id)).map((e) => `${e.id}.${e.org === id ? "org" : "parent"}`),
    ...claims.filter((c) => (c.about ?? []).includes(id)).map((c) => `${c.id}.about`),
    ...entities.filter((e) => e.mergedInto === id).map((e) => `${e.id} (merged into it)`),
  ];
}

function liveEntity(entities, id) {
  if (!ENTITY_ID.test(id ?? "")) bad(`"${id}" is not an entity id like "E12"`);
  const e = entities.find((x) => x.id === id) ?? bad(`entity ${id} not found`);
  if (e.mergedInto) bad(`${id} was already merged into ${e.mergedInto}`);
  return e;
}

export async function mergeEntities(params, { dryRun = false } = {}) {
  const { keep: keepId, drop: dropId } = params ?? {};
  for (const id of [keepId, dropId]) if (typeof id !== "string" || !ENTITY_ID.test(id)) bad('keep and drop must be entity ids like "E12": ref entity merge \'{"keep":"E#","drop":"E#"}\' [--dry-run]');
  if (keepId === dropId) bad("keep and drop are the same entity");
  const [entities, refs, claims] = await Promise.all([readEntities(), readRefs(), readClaims()]);
  const keep = liveEntity(entities, keepId);
  const drop = liveEntity(entities, dropId);
  if (keep.kind !== drop.kind) bad(`${keepId} is ${keep.kind}, ${dropId} is ${drop.kind}: only entities of the same kind merge`);

  const now = new Date().toISOString();
  const swap = (v) => (v === dropId ? keepId : v);
  const merged = { ...keep, aliases: uniqBy([...(keep.aliases ?? []), drop.name, ...(drop.aliases ?? [])], normName).filter((a) => normName(a) !== normName(keep.name)) };
  for (const k of ["org", "parent", "access"]) if (merged[k] == null && drop[k] != null) merged[k] = drop[k];
  const lost = ["org", "parent", "access"].filter((k) => drop[k] != null && merged[k] != null && drop[k] !== merged[k]);
  for (const k of ["org", "parent"]) if (merged[k] != null && [keepId, dropId].includes(merged[k])) merged[k] = null; // never its own parent
  const others = entities.filter((e) => e.id !== keepId && e.id !== dropId && !e.mergedInto && (e.org === dropId || e.parent === dropId));
  const repointed = entities.filter((e) => e.mergedInto === dropId);
  const refChanges = refs.filter((r) => r.entity === dropId || r.org === dropId).map((r) => ({ ...r, entity: swap(r.entity), org: swap(r.org) }));
  const claimChanges = claims.filter((c) => (c.about ?? []).includes(dropId)).map((c) => ({ ...c, about: [...new Set(c.about.map(swap))], updatedAt: now }));

  const out = [`${dryRun ? "would merge" : "merged"} ${dropId} ${drop.name} → ${keepId} ${keep.name} [${keep.kind}]`, `  ${keepId} aliases: ${merged.aliases.join(", ") || "-"}`];
  if (lost.length) out.push(`  ${keepId} keeps its own ${lost.map((k) => `${k} ${merged[k]}`).join(", ")}; ${dropId}'s ${lost.map((k) => `${k} ${drop[k]}`).join(", ")} is dropped`);
  if (refChanges.length) out.push(`  refs: ${refChanges.map((r) => r.id).join(", ")} now point at ${keepId}`);
  if (others.length) out.push(`  entities: ${others.map((e) => e.id).join(", ")} now name ${keepId} as org/parent`);
  if (claimChanges.length) out.push(`  claims: ${claimChanges.map((c) => c.id).join(", ")} now are about ${keepId}`);
  if (repointed.length) out.push(`  merged ids ${repointed.map((e) => e.id).join(", ")} now lead to ${keepId}`);
  if (dryRun) return [...out, "(dry run — nothing written)"].join("\n");

  // claims → refs → entities: if a write fails, running the merge again finishes it (drop is still live until the last write)
  await saveClaims(claimChanges);
  await saveRefs(refChanges);
  const next = entities.map((e) => {
    if (e.id === keepId) return merged;
    if (e.id === dropId) return { id: dropId, kind: drop.kind, name: drop.name, mergedInto: keepId, mergedAt: now };
    if (e.mergedInto === dropId) return { ...e, mergedInto: keepId };
    if (others.includes(e)) return { ...e, org: swap(e.org), parent: swap(e.parent) };
    return e;
  });
  await writeEntities(next);
  out.push(`  ${dropId} kept as a pointer to ${keepId}; run \`ref report\` for the collections that cite these refs`);
  return out.join("\n");
}

export async function removeEntities(ids, { dryRun = false } = {}) {
  if (!ids.length) bad("usage: ref entity remove E# [E# …] [--dry-run]");
  const [entities, refs, claims] = await Promise.all([readEntities(), readRefs(), readClaims()]);
  const gone = [...new Set(ids)].map((id) => liveEntity(entities, id));
  // all or nothing: an entity something still names would leave a dangling id
  const held = gone.map((e) => [e, linksOf(e.id, { entities, refs, claims })]).filter(([, l]) => l.length);
  if (held.length) bad(`still linked — unlink first (ref entity set {link:{"S#":null}} or merge into another entity), nothing removed:\n${held.map(([e, l]) => `- ${e.id} ${e.name}: ${l.slice(0, 10).join(", ")}${l.length > 10 ? ` … ${l.length - 10} more` : ""}`).join("\n")}`);
  const out = gone.map((e) => `${dryRun ? "would remove" : "removed"} ${e.id} [${e.kind}] ${e.name}`);
  if (dryRun) return [...out, "(dry run — nothing written)"].join("\n");
  const drop = new Set(gone.map((e) => e.id));
  await writeEntities(entities.filter((e) => !drop.has(e.id)));
  return out.join("\n");
}

/** Read-only: re-judges existing entities with the product rule (isProductRef), lists merge and org candidates, prints the commands. */
export async function reviewEntities({ out = null } = {}) {
  const [entities, refs, claims, cols] = await Promise.all([readEntities(), readRefs(), readClaims(), listCollections()]);
  const roles = rolesByRef(cols);
  const live = entities.filter((e) => !e.mergedInto);
  const byEntity = new Map();
  for (const r of refs) if (r.entity) (byEntity.get(r.entity) ?? byEntity.set(r.entity, []).get(r.entity)).push(r);
  const refsOf = (id) => byEntity.get(id) ?? [];
  const products = live.filter((e) => e.kind === "product");
  const notProduct = products.filter((e) => refsOf(e.id).length && !refsOf(e.id).some((r) => isProductRef(r, roles.get(r.id))));
  const unused = live.filter((e) => !linksOf(e.id, { entities, refs, claims }).length);
  const isNot = new Set(notProduct.map((e) => e.id));
  const otherLinks = (e) => linksOf(e.id, { entities, refs, claims }).filter((l) => !l.endsWith(".entity"));

  // one host, names that contain each other: likely one product under two names
  const byHost = new Map();
  for (const r of refs) if (r.entity && !isNot.has(r.entity)) (byHost.get(hostOf(r.url)) ?? byHost.set(hostOf(r.url), new Set()).get(hostOf(r.url))).add(r.entity);
  const pairs = new Map();
  for (const [host, set] of byHost) {
    const es = [...set].map((id) => live.find((e) => e.id === id)).filter(Boolean);
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      // whole leading words only ("Acme" / "Acme Pro"), not any substring ("AI" / "Airbnb")
      const [a, b] = [es[i].name, es[j].name].map((n) => n.normalize("NFKC").toLowerCase().trim()).sort((x, y) => x.length - y.length);
      if (!a || !(a === b || b.startsWith(`${a} `))) continue;
      const [keep, drop] = refsOf(es[i].id).length >= refsOf(es[j].id).length ? [es[i], es[j]] : [es[j], es[i]];
      pairs.set(`${keep.id}|${drop.id}`, { keep, drop, host });
    }
  }
  const orgs = orgCandidates(refs, entities, roles);

  const unlink = Object.fromEntries(notProduct.flatMap((e) => refsOf(e.id).map((r) => [r.id, null])));
  const removable = [...notProduct.filter((e) => !otherLinks(e).length), ...unused];
  const render = (limit) => {
    const cap = (xs, f) => [...xs.slice(0, limit).map(f), ...(xs.length > limit ? [`- … ${xs.length - limit} more (--out <file> for all)`] : [])];
    const lines = [
      "# ref entity review (preview — nothing written)",
      "",
      `Product rule: a product entity needs a product's own page (type official, docs, store, repo; or capture/other in a direct/indirect role). ${products.length} product entities, ${live.length - products.length} org.`,
      "",
      `## Not a product: ${notProduct.length} product entities with no product page among their refs`,
      ...cap(notProduct, (e) => {
        const rs = refsOf(e.id);
        const ol = otherLinks(e);
        return `- ${e.id} ${e.name} — ${rs.slice(0, 6).map((r) => `${r.id} (${r.type ?? "?"})`).join(", ")}${rs.length > 6 ? " …" : ""}${ol.length ? ` · also ${ol.slice(0, 4).join(", ")}${ol.length > 4 ? " …" : ""} (fix before removing)` : ""}`;
      }),
      `## Unused: ${unused.length} entities nothing points at`,
      ...cap(unused, (e) => `- ${e.id} [${e.kind}] ${e.name}`),
      `## Same host, overlapping names: ${pairs.size} pairs (merge, or set parent with ref entity set)`,
      ...cap([...pairs.values()], (p) => `- ${p.host}: ${p.keep.id} ${p.keep.name} (${refsOf(p.keep.id).length} refs) ← ${p.drop.id} ${p.drop.name} (${refsOf(p.drop.id).length}) · ref entity merge '${JSON.stringify({ keep: p.keep.id, drop: p.drop.id })}' --dry-run`),
      `## Publisher (org) candidates: ${orgs.length} names`,
      ...cap(orgs, (o) => `- ${o.name} (${o.refs.length})${o.registered ? ` · registered ${o.registered}` : ""}: ${o.refs.slice(0, 8).join(", ")}${o.refs.length > 8 ? " …" : ""}`),
      "",
      "## Commands (show each list to the user and run only what they approve; commit the library first)",
    ];
    const cmds = [];
    if (Object.keys(unlink).length) cmds.push(`- unlink refs from non-product entities: ref entity set '${JSON.stringify({ link: unlink })}'`);
    if (removable.length) cmds.push(`- remove${Object.keys(unlink).length ? " (after unlinking)" : ""}: ref entity remove ${removable.map((e) => e.id).join(" ")} --dry-run   (then without --dry-run)`);
    if (pairs.size) cmds.push("- merge each pair above that is one product (the command is on its line); a sub-product gets parent instead");
    if (orgs.length) cmds.push(`- register publishers: ref entity set '{"entities":[{"kind":"org","name":"…"}],"link_org":{"S#":"…"}}'`);
    const big = Object.keys(unlink).length > limit || removable.length > limit;
    lines.push(...(big ? ["(lists too long for the terminal — run with --out <file> for the full commands)"] : cmds.length ? cmds : ["nothing to clean up"]));
    return lines.join("\n");
  };
  if (out) await writeReport(out, render(Infinity) + "\n");
  return render(60) + (out ? `\n\nfull report: ${out}` : "");
}
