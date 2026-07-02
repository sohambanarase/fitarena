// ============================================================
// scripts/build-exercises.mjs
// Regenerates public/exercises.json from the public-domain yuhonas/free-exercise-db.
// The repo already ships a built copy; run `npm run data` only to refresh it.
// ============================================================
import { writeFile } from "node:fs/promises";

const SRC = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

console.log("Fetching upstream dataset…");
const res = await fetch(SRC);
if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
const raw = await res.json();

const trimmed = raw.map((e) => {
  const prim = e.primaryMuscles || [];
  return {
    id: e.id,
    name: e.name,
    category: e.category,
    level: e.level,
    equipment: e.equipment || "none",
    muscle: prim[0] || null,
    primary: prim,
    secondary: e.secondaryMuscles || [],
    steps: e.instructions || [],
    images: e.images || [], // paths like "Air_Bike/0.jpg"
  };
});

await writeFile(new URL("../public/exercises.json", import.meta.url), JSON.stringify(trimmed));
console.log(`Wrote ${trimmed.length} exercises to public/exercises.json`);
