import { supabase } from "./supabase.js";
import { toISO } from "./streak.js";

// ---- Goals (private) ----
export async function loadGoals(userId) {
  const { data } = await supabase.from("goals").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return data || [];
}
export async function addGoal(g) { return supabase.from("goals").insert(g).select().single(); }
export async function setGoalProgress(id, current) { return supabase.from("goals").update({ current }).eq("id", id); }
export async function removeGoal(id) { return supabase.from("goals").delete().eq("id", id); }

// ---- Workout log (private) ----
export async function loadEntries(userId, sinceDays = 30) {
  const since = toISO(new Date(Date.now() - sinceDays * 86_400_000));
  const { data } = await supabase
    .from("workout_entries").select("*").eq("user_id", userId).gte("log_date", since)
    .order("log_date", { ascending: false }).order("created_at", { ascending: false });
  return data || [];
}
export async function addEntry(e) { return supabase.from("workout_entries").insert(e).select().single(); }
export async function removeEntry(id) { return supabase.from("workout_entries").delete().eq("id", id); }

// group entries by date -> [{ date, items: [...] }]
export function groupByDate(entries) {
  const map = new Map();
  for (const e of entries) { if (!map.has(e.log_date)) map.set(e.log_date, []); map.get(e.log_date).push(e); }
  return [...map.entries()].map(([date, items]) => ({ date, items }));
}
