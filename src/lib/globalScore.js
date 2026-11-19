import { supabase } from "./supabase.js";
import { computeScore } from "./score.js";

// Your permanent score is recomputed from your whole history, then published to the
// board. Recomputing (rather than incrementing) means it can never drift or double-count.
export async function loadMyHistory(userId) {
  const [{ data: logs }, { data: wins }, { data: profile }] = await Promise.all([
    supabase.from("daily_logs").select("log_date, workout_type").eq("user_id", userId),
    supabase.from("achievements").select("kind").eq("user_id", userId),
    supabase.from("profiles").select("weekly_goal, name").eq("id", userId).maybeSingle(),
  ]);
  return { logs: logs || [], wins: wins || [], weeklyGoal: profile?.weekly_goal ?? 4, name: profile?.name || null };
}

export async function syncMyScore(userId, { logs, wins, weeklyGoal }) {
  const s = computeScore(logs, wins, weeklyGoal);
  await supabase.from("global_scores").upsert({
    user_id: userId,
    points: s.points,
    current_streak: s.currentStreak,
    best_streak: s.bestStreak,
    active_days: s.activeDays,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  return s;
}

export async function loadLeaderboard(limit = 100) {
  const { data } = await supabase
    .from("global_scores")
    .select("user_id, nickname, points, current_streak, best_streak, active_days, updated_at")
    .order("points", { ascending: false })
    .limit(limit);
  return (data || []).map((r, i) => ({ ...r, rank: i + 1 }));
}

// Raw scoring history for anyone on the board (check-in dates + types, PR/brag dates,
// weekly goal). Served by the board_history() function from migration v17. Returns null
// if the function isn't installed yet or the person isn't on the board.
export async function loadBoardHistory(targetId) {
  const { data, error } = await supabase.rpc("board_history", { target: targetId });
  if (error || !data) return null;
  return { logs: data.logs || [], wins: data.wins || [], weeklyGoal: data.weekly_goal ?? 4 };
}

export async function loadMyScoreRow(userId) {
  const { data } = await supabase.from("global_scores").select("*").eq("user_id", userId).maybeSingle();
  return data || null;
}

// Nicknames are unique (case-insensitive) — the DB index enforces it.
export async function setNickname(userId, nickname) {
  const clean = (nickname || "").trim().slice(0, 20);
  if (!clean) return { error: { message: "Pick a nickname first." } };
  const { error } = await supabase.from("global_scores").upsert({ user_id: userId, nickname: clean, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error && /duplicate|unique/i.test(error.message || "")) return { error: { message: "That nickname is taken — try another." } };
  return { error };
}
