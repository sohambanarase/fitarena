import { supabase } from "./supabase.js";
import { toISO } from "./streak.js";

// Sensible default for a new challenge: 30 days out, no fixed calendar date.
export function defaultEndDate(days = 30, ref = new Date()) {
  const d = new Date(ref);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function hasEnded(challenge, ref = new Date()) {
  if (!challenge || !challenge.end_date) return false;
  if (challenge.status === "completed") return true;
  return challenge.end_date < toISO(ref);
}

export function isCompleted(challenge) {
  return !!challenge && challenge.status === "completed";
}

// Push the finish line out and make sure the challenge is running again.
export async function extendChallenge(id, endDate) {
  return supabase.from("challenges").update({ end_date: endDate, status: "active", completed_at: null }).eq("id", id);
}

export async function completeChallenge(id) {
  return supabase.from("challenges").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
}
