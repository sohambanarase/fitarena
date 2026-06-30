// ============================================================
// scripts/build-exercises.mjs
// Regenerates public/exercises.json (English-only, trimmed) from the upstream
// dataset. The repo already ships a built copy, so you only need this if you
// want to refresh it. Run: npm run data
// ============================================================
import { writeFile } from "node:fs/promises";

const SRC =
  "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json";

console.log("Fetching upstream dataset…");
const res = await fetch(SRC);
if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
const raw = await res.json();

const trimmed = raw.map((e) => ({
  id: e.id,
  name: e.name,
  category: e.category,
  bodyPart: e.body_part,
  equipment: e.equipment,
  target: e.target,
  muscle: e.muscle_group,
  secondary: e.secondary_muscles || [],
  steps: e.instruction_steps?.en || [],
  mediaId: e.media_id, // thumbnail → https://static.exercisedb.dev/media/{mediaId}.gif
}));

await writeFile(
  new URL("../public/exercises.json", import.meta.url),
  JSON.stringify(trimmed)
);
console.log(`Wrote ${trimmed.length} exercises to public/exercises.json`);
