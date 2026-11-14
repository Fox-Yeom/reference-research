/**
 * merge — fold one reference into another (#22): two records for the same work, made before same-work ids were matched (v3 M8).
 *
 *   ref source merge '{"keep":"S180","drop":"S1190"}' [--dry-run]
 *
 * The kept ref takes the dropped one's URL (as an alias), ids, notes, snapshots, changes, categories, tags and course; every
 * collection member, claim source and claim `against` pointing at the dropped id moves to the kept id. The dropped record stays
 * as a tombstone ({mergedInto, mergedAt}) so old summaries, links and commits that name it still resolve. Snapshot files stay
 * where they are (their paths are stored on the snapshot). Nothing is written with --dry-run.
 */
import { bad, confidence, listCollections, readClaims, readRefs, sameWork, saveClaims, saveRefs, writeCollection } from "./store.mjs";

const uniq = (xs) => [...new Set(xs.filter((x) => x != null && x !== ""))];
const byAt = (a, b) => String(a.at ?? "").localeCompare(String(b.at ?? ""));
const minIso = (...xs) => xs.filter(Boolean).sort()[0] ?? null;
const maxIso = (...xs) => xs.filter(Boolean).sort().at(-1) ?? null;

export async function mergeRefs(params, { dryRun = false } = {}) {
  const { keep: keepId, drop: dropId } = params ?? {};
  if (!keepId || !dropId) bad('usage: ref source merge \'{"keep":"S#","drop":"S#"}\' [--dry-run]');
  if (keepId === dropId) bad("keep and drop are the same reference");
  const [refs, claims, cols] = await Promise.all([readRefs(), readClaims(), listCollections()]);
  const keep = refs.find((r) => r.id === keepId) ?? bad(`ref ${keepId} not found`);
  const drop = refs.find((r) => r.id === dropId) ?? bad(`ref ${dropId} not found`);
  for (const r of [keep, drop]) if (r.mergedInto) bad(`${r.id} was already merged into ${r.mergedInto}`);

  // a claim may not end up citing the kept ref both for and against itself
  const swap = (ids) => uniq((ids ?? []).map((s) => (s === dropId ? keepId : s)));
  const touched = claims.filter((c) => (c.sources ?? []).includes(dropId) || (c.against ?? []).includes(dropId));
  const clash = touched.filter((c) => swap(c.sources).some((s) => swap(c.against).includes(s)));
  if (clash.length) bad(`merging would make ${clash.map((c) => c.id).join(", ")} cite ${keepId} both for and against itself: fix those claims first`);

  const out = [];
  const same = sameWork(keep.ids ?? {}, drop.ids ?? {});
  out.push(`${dryRun ? "would merge" : "merged"} ${dropId} → ${keepId}${same ? " (same work id)" : " (no shared work id: check they are the same page or document)"}`);

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
    read: keep.read === "full" || drop.read === "full" ? "full" : keep.read ?? drop.read,
    firstSeen: minIso(keep.firstSeen, drop.firstSeen),
    lastSeen: maxIso(keep.lastSeen, drop.lastSeen),
    lastCaptured: maxIso(keep.lastCaptured, drop.lastCaptured),
  };
  for (const k of ["entity", "org", "published", "publishedFrom", "updated", "firstArchived", "course", "summary", "publisher", "product", "page"]) merged[k] ??= drop[k];
  for (const k of ["firstSeen", "lastSeen", "lastCaptured", "read"]) if (merged[k] == null) delete merged[k];
  const tomb = { ...drop, mergedInto: keepId, mergedAt: new Date().toISOString(), categories: [] };
  out.push(`  ${keepId}: +${(drop.notes ?? []).length} notes, +${(drop.snapshots ?? []).length} snapshots, aliases ${merged.aliases.length}, categories ${merged.categories.join(", ") || "-"}`);

  const colChanges = [];
  for (const col of cols) {
    const i = col.members.findIndex((m) => m.ref === dropId);
    if (i < 0) continue;
    const hasKeep = col.members.some((m) => m.ref === keepId);
    colChanges.push([col, i, hasKeep]);
    out.push(`  ${col.name}: ${hasKeep ? `member ${dropId} removed (${keepId} already a member)` : `member ${dropId} → ${keepId}`}`);
  }
  const claimChanges = touched.map((c) => ({ ...c, sources: swap(c.sources), ...(c.against ? { against: swap(c.against) } : {}), updatedAt: new Date().toISOString() }));
  if (claimChanges.length) out.push(`  claims: ${claimChanges.map((c) => c.id).join(", ")} now cite ${keepId}`);
  if (dryRun) return [...out, "(dry run — nothing written)"].join("\n");

  for (const [col, i, hasKeep] of colChanges) {
    if (hasKeep) col.members.splice(i, 1);
    else col.members[i] = { ...col.members[i], ref: keepId };
    await writeCollection(col);
  }
  await saveRefs([merged, tomb]);
  // strength depends on independent publishers and reading level: recompute for the claims that moved
  const byId = new Map(refs.map((r) => [r.id, r.id === keepId ? merged : r.id === dropId ? tomb : r]));
  await saveClaims(claimChanges.map((c) => ({ ...c, confidence: confidence(c, byId) })));
  out.push(`  ${dropId} kept as a pointer (mergedInto ${keepId}); run \`ref report\` for the collections above`);
  return out.join("\n");
}
