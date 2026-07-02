// Loads the trimmed exercise dataset (from the public-domain yuhonas/free-exercise-db)
// once and caches it. Images are stable, free, hotlink-friendly GitHub-hosted photos
// served via the jsDelivr CDN (with a raw.githubusercontent fallback).

let cache = null;
const JSDELIVR = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";
const RAW = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

export async function loadExercises() {
  if (cache) return cache;
  const res = await fetch("/exercises.json");
  cache = await res.json();
  return cache;
}

// Primary CDN url for an image path like "Air_Bike/0.jpg".
export function imageUrl(path) {
  return path ? JSDELIVR + path : null;
}
// Fallback url (used by <img onError>) if the CDN misses.
export function imageFallback(path) {
  return path ? RAW + path : null;
}

export function facets(list) {
  const uniq = (k) => [...new Set(list.map((e) => e[k]).filter(Boolean))].sort();
  return { muscle: uniq("muscle"), equipment: uniq("equipment"), category: uniq("category") };
}

export function filterExercises(list, { q = "", muscle = "", equipment = "", category = "" }) {
  const needle = q.trim().toLowerCase();
  return list.filter((e) => {
    if (muscle && e.muscle !== muscle) return false;
    if (equipment && e.equipment !== equipment) return false;
    if (category && e.category !== category) return false;
    if (needle && !e.name.toLowerCase().includes(needle)) return false;
    return true;
  });
}
