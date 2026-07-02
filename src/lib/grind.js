import { supabase } from "./supabase.js";
import { toISO } from "./streak.js";

// ---- Goals ----
export async function loadGoals(userId) {
  const { data } = await supabase.from("goals").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return data || [];
}
export async function addGoal(g) { return supabase.from("goals").insert(g).select().single(); }
export async function setGoalProgress(id, current) { return supabase.from("goals").update({ current }).eq("id", id); }
export async function removeGoal(id) { return supabase.from("goals").delete().eq("id", id); }

// Recompute exercise-linked goals from the best weight ever logged for that exercise.
export async function syncGoalsForExercise(userId, exercise) {
  const { data: rows } = await supabase
    .from("workout_entries").select("sets_detail").eq("user_id", userId).ilike("exercise", exercise);
  let best = 0;
  (rows || []).forEach((r) => (r.sets_detail || []).forEach((s) => { if ((s.weight || 0) > best) best = s.weight; }));
  const { data: goals } = await supabase
    .from("goals").select("id").eq("user_id", userId).eq("metric", "weight").ilike("exercise", exercise);
  for (const g of goals || []) await supabase.from("goals").update({ current: best }).eq("id", g.id);
  return best;
}

// ---- Workout log (per-set, one row per exercise per day) ----
export async function logExercise(userId, date, exercise, sets) {
  const name = exercise.trim();
  const { data: existing } = await supabase
    .from("workout_entries").select("id, sets_detail").eq("user_id", userId).eq("log_date", date).ilike("exercise", name).limit(1);
  const prev = existing?.[0];
  const merged = [...(prev?.sets_detail || []), ...sets];
  const top = merged.reduce((m, s) => Math.max(m, s.weight || 0), 0);
  if (prev) {
    await supabase.from("workout_entries").update({ sets_detail: merged, sets: merged.length, weight_kg: top || null }).eq("id", prev.id);
  } else {
    await supabase.from("workout_entries").insert({ user_id: userId, log_date: date, exercise: name, sets_detail: merged, sets: merged.length, weight_kg: top || null });
  }
  await syncGoalsForExercise(userId, name);
}

export async function loadEntries(userId, sinceDays = 120) {
  const since = toISO(new Date(Date.now() - sinceDays * 86_400_000));
  const { data } = await supabase
    .from("workout_entries").select("*").eq("user_id", userId).gte("log_date", since)
    .order("log_date", { ascending: false }).order("created_at", { ascending: true });
  return data || [];
}
export async function removeEntry(id) { return supabase.from("workout_entries").delete().eq("id", id); }

// Back-compat: old rows may have no sets_detail but had weight/reps columns.
export function setsOf(entry) {
  if (entry.sets_detail?.length) return entry.sets_detail;
  if (entry.weight_kg || entry.reps) return [{ weight: entry.weight_kg || 0, reps: entry.reps || null }];
  return [];
}
