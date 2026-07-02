// Brags + PRs (personal records). Stored globally per user; visible to challenge-mates via RLS.
import { supabase } from "./supabase.js";
import { toISO } from "./streak.js";

export async function loadGroupWins(userIds, challengeId = null, sinceDays = 21) {
  if (!userIds.length) return [];
  const since = toISO(new Date(Date.now() - sinceDays * 86_400_000));
  let q = supabase
    .from("achievements")
    .select("id, user_id, kind, text, exercise, weight_kg, reps, photo_url, challenge_id, log_date, created_at")
    .in("user_id", userIds)
    .gte("log_date", since)
    .order("created_at", { ascending: false });
  if (challengeId) q = q.eq("challenge_id", challengeId);
  const { data } = await q;
  return data || [];
}

export async function postWin(win) {
  return supabase.from("achievements").insert(win).select().single();
}

export async function deleteWin(id) {
  return supabase.from("achievements").delete().eq("id", id);
}

// Optional photo upload to the public "wins" bucket. Returns a public URL or null.
export async function uploadWinPhoto(userId, file) {
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("wins").upload(path, file, { upsert: false });
  if (error) throw error;
  return supabase.storage.from("wins").getPublicUrl(path).data.publicUrl;
}

// Best weight per exercise from a user's PR history.
export function bestPRs(wins) {
  const best = {};
  for (const w of wins) {
    if (w.kind !== "pr" || !w.exercise) continue;
    const cur = best[w.exercise];
    if (!cur || (w.weight_kg ?? 0) > (cur.weight_kg ?? 0)) best[w.exercise] = w;
  }
  return Object.values(best).sort((a, b) => (b.weight_kg ?? 0) - (a.weight_kg ?? 0));
}
