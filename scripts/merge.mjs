/**
 * merge — fold one reference into another (#22): two records for the same work, made before same-work ids were matched (v3 M8).
 *
 *   ref source merge '{"keep":"S180","drop":"S1190"}' [--dry-run]      same work id (DOI, PMID, PMCID, arXiv, app) required
 *   ref source merge '{"keep":"S12","drop":"S40","force":true}'       no shared work id: the person has checked they are one page
 *
 * The kept ref takes the dropped one's URL (as an alias), ids, notes, snapshots, changes, categories, tags and course; every
 * collection member, claim source and claim `against` pointing at the dropped id moves to the kept id. The dropped record becomes
 * a small pointer {id, slug, url, normUrl, label, mergedInto, mergedAt}: readRefs() never returns it, resolveRefId() follows it
 * (old summaries, links, commits and other pointers that name it still land on the kept ref), and nextId() never reuses its id.
 * Snapshot files stay where they are (their paths are stored on the snapshot). Nothing is written with --dry-run.
 *
 * Writes go claims → collections → refs: if one fails, the claims already cite the kept ref and running the merge again finishes it.
 */
import { ID_KINDS, bad, listCollections, readClaims, readRefs, recomputeConfidence, sameWork, saveClaims, saveRefs, writeCollection } from "./store.mjs";

const uniq = (xs) => [...new Set(xs.filter((x) => x != null && x !== ""))];
const byAt = (a, b) => String(a.at ?? "").localeCompare(String(b.at ?? ""));
const minIso = (...xs) => xs.filter(Boolean).sort()[0] ?? null;
const maxIso = (...xs) => xs.filter(Boolean).sort().at(-1) ?? null;
const REF_ID = /^S\d+$/;

export async function mergeRefs(params, { dryRun = false } = {}) {
  const { keep: keepId, drop: dropId, force = false } = params ?? {};
  if (!REF_ID.test(keepId ?? "") || !REF_ID.test(dropId ?? "")) bad('keep and drop must be ref ids like "S12": ref source merge \'{"keep":"S#","drop":"S#"}\' [--dry-run]');
  if (keepId === dropId) bad("keep and drop are the same reference");
  const [refs, claims, cols] = await Promise.all([readRefs(), readClaims(), listCollections()]);
  for (const id of [keepId, dropId]) if (refs.pointers.has(id)) bad(`${id} was already merged into ${refs.pointers.get(id)}${id === dropId ? " — nothing to do" : `: use ${refs.pointers.get(id)} as keep`}`);
  const keep = refs.find((r) => r.id === keepId) ?? bad(`ref ${keepId} not found`);
  const drop = refs.find((r) => r.id === dropId) ?? bad(`ref ${dropId} not found`);

  // same work, or the person says so: a wrong merge rewrites claims and moves ids onto the wrong record
  const conflicts = ID_KINDS.filter((k) => keep.ids?.[k] && drop.ids?.[k] && String(keep.ids[k]).toLowerCase() !== String(drop.ids[k]).toLowerCase());
  const same = sameWork(keep.ids ?? {}, drop.ids ?? {});
  if (!force && (!same || conflicts.length)) {
    bad(conflicts.length
      ? `${keepId} and ${dropId} carry different ${conflicts.join(", ")} ids (${conflicts.map((k) => `${keep.ids[k]} ≠ ${drop.ids[k]}`).join(", ")}): they look like different works`
      : `${keepId} and ${dropId} share no work id (DOI, PMID, PMCID, arXiv, app): check they are the same page or document, then pass "force": true`);
  }
  // a claim may not end up citing the kept ref both for and against itself
  const swap = (ids) => uniq((ids ?? []).map((s) => (s === dropId ? keepId : s)));
  const touched = claims.filter((c) => (c.sources ?? []).includes(dropId) || (c.against ?? []).includes(dropId));
  const clash = touched.filter((c) => swap(c.sources).some((s) => swap(c.against).includes(s)));
  if (clash.length) bad(`merging would make ${clash.map((c) => c.id).join(", ")} cite ${keepId} both for and against itself: fix those claims first`);

  const out = [`${dryRun ? "would merge" : "merged"} ${dropId} → ${keepId}${same ? " (same work id)" : " (forced: no shared work id)"}`];
  if (conflicts.length) out.push(`  ${keepId} keeps its ${conflicts.join(", ")}; ${dropId}'s ${conflicts.map((k) => drop.ids[k]).join(", ")} is dropped`);
  const merged = {
    ...keep,
    aliases: uniq([...(keep.aliases ?? []), drop.normUrl, ...(drop.aliases ?? [])]).filter((a) => a !== keep.normUrl),
    ids: { ...(drop.ids ?? {}), ...(keep.ids ?? {}) },
    notes: [...(keep.notes ?? []), ...(drop.notes ?? [])].sort(byAt),
    snapshots: [...(keep.snapshots ?? []), ...(drop.snapshots ?? [])].sort(byAt),
    changes: [...(keep.changes ?? []), ...(drop.changes ?? [])].sort(byAt),
    categories: uniq([...(keep.categories ?? []), ...(drop.categories ?? [])]),
    tags: uniq([...(keep.tags ?? []), ...(drop.tags ?? [])]),
    screens: uniq([...(keep.screens ?? []), ...(drop.screens ?? [])]),
  };
  if (keep.read === "full" || drop.read === "full") merged.read = "full";
  else if (keep.read ?? drop.read) merged.read = keep.read ?? drop.read;
  for (const [k, v] of [["firstSeen", minIso(keep.firstSeen, drop.firstSeen)], ["lastSeen", maxIso(keep.lastSeen, drop.lastSeen)], ["lastCaptured", maxIso(keep.lastCaptured, drop.lastCaptured)]]) if (v) merged[k] = v;
  for (const k of ["entity", "org", "published", "publishedFrom", "updated", "firstArchived", "course", "summary", "publisher", "product", "page"]) if (merged[k] == null && drop[k] != null) merged[k] = drop[k];
  const now = new Date().toISOString();
  const pointer = { id: dropId, slug: drop.slug, url: drop.url, normUrl: drop.normUrl, label: drop.label ?? null, mergedInto: keepId, mergedAt: now };
  // pointers that led to the dropped ref now lead straight to the kept one
  const repointed = refs.retired.filter((p) => p.mergedInto === dropId).map((p) => ({ ...p, mergedInto: keepId }));
  out.push(`  ${keepId}: +${(drop.notes ?? []).length} notes, +${(drop.snapshots ?? []).length} snapshots, aliases ${merged.aliases.length}, categories ${merged.categories.join(", ") || "-"}`);
  if (repointed.length) out.push(`  pointers ${repointed.map((p) => p.id).join(", ")} now lead to ${keepId}`);

  const colChanges = [];
  for (const col of cols) {
    const i = col.members.findIndex((m) => m.ref === dropId);
    if (i < 0) continue;
    const hasKeep = col.members.some((m) => m.ref === keepId);
    colChanges.push([col, i, hasKeep]);
    out.push(`  ${col.name}: ${hasKeep ? `member ${dropId} removed (${keepId} already a member)` : `member ${dropId} → ${keepId}`}`);
  }
  const claimChanges = touched.map((c) => ({ ...c, sources: swap(c.sources), ...(c.against ? { against: swap(c.against) } : {}), updatedAt: now }));
  if (claimChanges.length) out.push(`  claims: ${claimChanges.map((c) => c.id).join(", ")} now cite ${keepId}`);
  if (dryRun) return [...out, "(dry run — nothing written)"].join("\n");

  await saveClaims(claimChanges);
  for (const [col, i, hasKeep] of colChanges) {
    if (hasKeep) col.members.splice(i, 1);
    else col.members[i] = { ...col.members[i], ref: keepId };
    await writeCollection(col);
  }
  await saveRefs([merged, pointer, ...repointed]);
  // strength depends on independent publishers and reading level, and the kept ref may now count as read in full
  const strength = await recomputeConfidence();
  if (strength.length) out.push(`  evidence strength: ${strength.join(", ")}`);
  out.push(`  ${dropId} kept as a pointer to ${keepId}; run \`ref report\` for the collections above`);
  return out.join("\n");
}
