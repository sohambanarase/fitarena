// Loads the trimmed exercise dataset once and caches it in memory.
// Thumbnails come from the ExerciseDB CDN derived from mediaId.
// NOTE: the dataset is licensed for educational / non-commercial use. Fine for a
// private group of friends; don't ship this commercially without sorting media rights.

let cache = null;

export async function loadExercises() {
  if (cache) return cache;
  const res = await fetch("/exercises.json");
  cache = await res.json();
  return cache;
}

export function mediaUrl(mediaId) {
  return mediaId ? `https://static.exercisedb.dev/media/${mediaId}.gif` : null;
}

export function facets(list) {
  const uniq = (k) => [...new Set(list.map((e) => e[k]).filter(Boolean))].sort();
  return { bodyPart: uniq("bodyPart"), equipment: uniq("equipment"), target: uniq("target") };
}

export function filterExercises(list, { q = "", bodyPart = "", equipment = "", target = "" }) {
  const needle = q.trim().toLowerCase();
  return list.filter((e) => {
    if (bodyPart && e.bodyPart !== bodyPart) return false;
    if (equipment && e.equipment !== equipment) return false;
    if (target && e.target !== target) return false;
    if (needle && !e.name.toLowerCase().includes(needle)) return false;
    return true;
  });
}
