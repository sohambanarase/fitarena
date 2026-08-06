import { supabase } from "./supabase.js";
import { toISO } from "./streak.js";

export const DEFAULT_WATER_GOAL = 2500;
export const DEFAULT_PRESETS = [
  { label: "Glass", ml: 250 },
  { label: "Bottle", ml: 500 },
  { label: "Big bottle", ml: 750 },
];

// ---- logging ----
export async function loadWater(userId, date) {
  const { data } = await supabase.from("water_logs").select("*").eq("user_id", userId).eq("log_date", date).order("created_at", { ascending: true });
  return data || [];
}
export async function addWater(userId, date, ml, label) {
  return supabase.from("water_logs").insert({ user_id: userId, log_date: date, ml: Math.round(ml), label: label || null }).select().single();
}
export async function updateWater(id, ml) {
  return supabase.from("water_logs").update({ ml: Math.round(ml) }).eq("id", id);
}
export async function removeWater(id) { return supabase.from("water_logs").delete().eq("id", id); }
export function waterTotal(rows) { return (rows || []).reduce((n, r) => n + (Number(r.ml) || 0), 0); }

// ---- history ----
export async function loadWaterRange(userId, sinceISO) {
  const { data } = await supabase.from("water_logs").select("log_date, ml").eq("user_id", userId).gte("log_date", sinceISO);
  return data || [];
}

// One row per day, oldest first.
export function waterSeries(rows, days = 7, ref = new Date()) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(ref.getTime() - i * 86400000);
    const iso = toISO(d);
    const ml = (rows || []).filter((r) => r.log_date === iso).reduce((n, r) => n + (Number(r.ml) || 0), 0);
    out.push({ iso, day: d.toLocaleDateString(undefined, { weekday: "short" })[0], ml });
  }
  return out;
}

// Consecutive days (ending today or yesterday) where the goal was met.
export function hydrationStreak(rows, goal, ref = new Date()) {
  if (!goal) return 0;
  const byDay = {};
  (rows || []).forEach((r) => { byDay[r.log_date] = (byDay[r.log_date] || 0) + (Number(r.ml) || 0); });
  let streak = 0;
  const today = toISO(ref);
  let cursor = (byDay[today] || 0) >= goal ? today : toISO(new Date(ref.getTime() - 86400000));
  for (let i = 0; i < 400; i++) {
    if ((byDay[cursor] || 0) >= goal) { streak++; cursor = toISO(new Date(new Date(cursor + "T00:00:00").getTime() - 86400000)); }
    else break;
  }
  return streak;
}

export function hydrationInsights(rangeRows, goal, ref = new Date()) {
  const series = waterSeries(rangeRows, 7, ref);
  const logged = series.filter((d) => d.ml > 0);
  const avg = logged.length ? Math.round(logged.reduce((n, d) => n + d.ml, 0) / logged.length) : 0;
  const daysHit = goal ? series.filter((d) => d.ml >= goal).length : 0;
  return { series, avg, daysHit, daysLogged: logged.length, streak: hydrationStreak(rangeRows, goal, ref) };
}

// A nudge that reacts to the rest of the day: training and protein both raise needs.
// Deliberately modest — this is a suggestion, not a medical target.
export function suggestedGoal(baseGoal, { burnedKcal = 0, proteinG = 0 } = {}) {
  const base = baseGoal || DEFAULT_WATER_GOAL;
  let extra = 0;
  if (burnedKcal > 200) extra += Math.min(750, Math.round(burnedKcal / 200) * 250);
  if (proteinG > 120) extra += 250;
  return { goal: base + extra, extra };
}

export function hydrationTip({ total, goal, burnedKcal = 0, proteinG = 0, hour = new Date().getHours() }) {
  const left = Math.max(0, (goal || 0) - total);
  if (goal && total >= goal) return "Goal hit — nice work staying on top of it.";
  if (burnedKcal > 300 && left > 0) return "You trained today, so add a glass or two on top of the usual.";
  if (proteinG > 150 && left > 0) return "High protein day — water helps your kidneys handle it.";
  if (left > 0 && hour >= 18) return Math.round(left / 250) + " glass" + (Math.round(left / 250) !== 1 ? "es" : "") + " left before bed.";
  if (left > 0) return left + " ml to go.";
  return "Log a glass to get started.";
}
