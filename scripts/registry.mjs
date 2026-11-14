/**
 * registry — v3 topic and entity registries (docs/DATA-MODEL.md M1, M7).
 *
 *   ref topic set '<json>'   {topics:[{id, label, description?, order?}], assign:{"<collection>": "<topic id>" | null}}
 *   ref topic show           topics with their collections; collections without a topic
 *   ref entity set '<json>'  {entities:[{id?, kind: product|org, name, aliases?, org?, parent?, access?}], link:{"S#": "E#|name"}, link_org:{"S#": "E#|name"}}
 *   ref entity show [query]  entities (name/alias match) with the refs pointing at them
 */
import { ENTITY_KINDS, bad, collectionName, findEntity, listCollections, nextId, normName, readCollection, readEntities, readRefs, readTopics, saveRefs, writeCollection, writeEntities, writeTopics } from "./store.mjs";

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
    const old = e.id ? entities.find((x) => x.id === e.id) : findEntity(entities, e.name, e.kind);
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
      const r = refs.find((x) => x.id === sid) ?? bad(`ref ${sid} not found`);
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
  const hit = entities.filter((e) => !q || normName(e.name).includes(q) || (e.aliases ?? []).some((a) => normName(a).includes(q)));
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
