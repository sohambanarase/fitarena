// FitArena push sender. Polled by a GitHub Action (every ~20 min).
// Detects new wins, new joins, leaderboard overtakes, and sends a once-a-day
// check-in reminder. Guarded by NOTIFY_SECRET; uses the Supabase service-role key.
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

function startOfWeekISO(ref = new Date()) {
  const d = new Date(ref);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.toISOString().slice(0, 10);
}

// minimal mirror of the app's scoring (consistency + capped win bonus)
function leaderboard(memberIds, logs, wins, goalOf, weekStart) {
  const GYM = new Set(["lift", "cardio"]);
  const logsBy = {}, winsBy = {};
  for (const l of logs) (logsBy[l.user_id] ||= []).push(l);
  for (const w of wins) (winsBy[w.user_id] ||= []).push(w);
  return memberIds
    .map((id) => {
      const days = (logsBy[id] || []).filter((l) => l.log_date >= weekStart && GYM.has(l.workout_type)).length;
      const goal = Math.max(1, goalOf[id] ?? 4);
      const score = Math.min(100, Math.round((days / goal) * 100));
      let bonus = 0;
      for (const w of winsBy[id] || []) bonus += w.kind === "pr" ? 3 : 1;
      return { id, total: score + Math.min(15, bonus), raw: days / goal };
    })
    .sort((a, b) => b.total - a.total || b.raw - a.raw)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export default async function handler(req, res) {
  const secret = (req.query && req.query.secret) || req.headers["x-notify-secret"];
  if (!process.env.NOTIFY_SECRET || secret !== process.env.NOTIFY_SECRET)
    return res.status(401).json({ error: "unauthorized" });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!url || !serviceKey || !vapidPublic || !vapidPrivate)
    return res.status(500).json({ error: "missing env (supabase admin or VAPID)" });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:fitarena@fitarena.app", vapidPublic, vapidPrivate);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const nowISO = new Date().toISOString();

  // subscriptions
  const { data: subsRows, error: subsErr } = await db.from("push_subscriptions").select("user_id, endpoint, subscription");
  const subsByUser = {};
  for (const r of subsRows || []) (subsByUser[r.user_id] ||= []).push(r);
  const subscribed = new Set(Object.keys(subsByUser));
  if (subscribed.size === 0)
    return res.json({ ok: true, note: "no subscribers", rowsSeen: subsRows?.length ?? 0, dbError: subsErr?.message || null });

  // state
  const { data: stRow } = await db.from("notify_state").select("state").eq("id", 1).single();
  const state = (stRow && stRow.state) || {};

  // lookups (small app: load all)
  const [{ data: profs }, { data: challenges }, { data: mems }] = await Promise.all([
    db.from("profiles").select("id, name, weekly_goal"),
    db.from("challenges").select("id, name"),
    db.from("challenge_members").select("challenge_id, user_id, joined_at"),
  ]);
  const nameOf = {}, goalOf = {}, chName = {}, membersOf = {};
  for (const p of profs || []) { nameOf[p.id] = p.name || "A teammate"; goalOf[p.id] = p.weekly_goal ?? 4; }
  for (const c of challenges || []) chName[c.id] = c.name || "your challenge";
  for (const m of mems || []) (membersOf[m.challenge_id] ||= []).push(m.user_id);

  const queue = []; // { userIds, title, body, tag }

  // 1) NEW WINS
  {
    const cursor = state.lastWinAt || nowISO;
    const { data: wins } = await db.from("achievements")
      .select("user_id, challenge_id, kind, text, created_at")
      .gt("created_at", cursor).order("created_at", { ascending: true });
    let maxAt = cursor;
    for (const w of wins || []) {
      if (w.created_at > maxAt) maxAt = w.created_at;
      if (!w.challenge_id) continue;
      const to = (membersOf[w.challenge_id] || []).filter((u) => u !== w.user_id && subscribed.has(u));
      if (!to.length) continue;
      const who = nameOf[w.user_id];
      const verb = w.kind === "pr" ? "hit a new PR" : "posted a win";
      queue.push({ userIds: to, title: "🏆 " + who, body: who + " " + verb + (w.text ? ": " + w.text : "") + ". Your move.", tag: "win-" + w.challenge_id });
    }
    state.lastWinAt = maxAt;
  }

  // 2) NEW JOINS
  {
    const cursor = state.lastJoinAt || nowISO;
    const { data: joins } = await db.from("challenge_members")
      .select("challenge_id, user_id, joined_at")
      .gt("joined_at", cursor).order("joined_at", { ascending: true });
    let maxAt = cursor;
    for (const j of joins || []) {
      if (j.joined_at > maxAt) maxAt = j.joined_at;
      const to = (membersOf[j.challenge_id] || []).filter((u) => u !== j.user_id && subscribed.has(u));
      if (!to.length) continue;
      queue.push({ userIds: to, title: "New challenger", body: nameOf[j.user_id] + " joined " + chName[j.challenge_id] + ". Game on.", tag: "join-" + j.challenge_id });
    }
    state.lastJoinAt = maxAt;
  }

  // 3) OVERTAKES
  {
    const prevRanks = state.ranks || {};
    const weekStart = startOfWeekISO();
    for (const cid of Object.keys(membersOf)) {
      const ids = membersOf[cid];
      if (ids.length < 2 || !ids.some((u) => subscribed.has(u))) continue;
      const [{ data: logs }, { data: wins }] = await Promise.all([
        db.from("daily_logs").select("user_id, log_date, workout_type").in("user_id", ids).gte("log_date", weekStart),
        db.from("achievements").select("user_id, kind, log_date").eq("challenge_id", cid).gte("log_date", weekStart),
      ]);
      const board = leaderboard(ids, logs || [], wins || [], goalOf, weekStart);
      const before = prevRanks[cid] || {};
      const after = {};
      board.forEach((b) => (after[b.id] = b.rank));
      for (const b of board) {
        if (before[b.id] != null && b.rank > before[b.id] && subscribed.has(b.id))
          queue.push({ userIds: [b.id], title: "You just got passed", body: "Someone overtook you — you're #" + b.rank + " now. Time to train.", tag: "overtake-" + cid });
      }
      prevRanks[cid] = after;
    }
    state.ranks = prevRanks;
  }

  // 4) DAILY REMINDER (first run at/after REMINDER_HOUR_UTC each day)
  {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const remHour = Number(process.env.REMINDER_HOUR_UTC ?? 16); // ~18:00 CEST
    if (now.getUTCHours() >= remHour && state.lastReminderDate !== today) {
      const { data: todayLogs } = await db.from("daily_logs").select("user_id").eq("log_date", today);
      const logged = new Set((todayLogs || []).map((r) => r.user_id));
      const targets = [...subscribed].filter((u) => !logged.has(u));
      if (targets.length)
        queue.push({ userIds: targets, title: "Did you train today? 💪", body: "Log it before midnight to protect your rank and streak.", tag: "daily-reminder" });
      state.lastReminderDate = today;
    }
  }

  // 5) HYDRATION NUDGES (only while behind the goal, inside the user's own local window)
  {
    const { data: hyd } = await db.from("nutrition_goals")
      .select("user_id, water_goal_ml, water_every_h, water_from_h, water_to_h, water_tz_min, water_last_ping")
      .eq("water_reminders", true);
    const now = new Date();
    for (const row of hyd || []) {
      if (!subscribed.has(row.user_id)) continue;
      const tz = Number(row.water_tz_min) || 0;
      const local = new Date(now.getTime() + tz * 60000);
      const hour = local.getUTCHours();
      const from = row.water_from_h ?? 9, to = row.water_to_h ?? 21;
      if (hour < from || hour >= to) continue;
      const everyMs = Math.max(1, Number(row.water_every_h) || 2) * 3600000;
      if (row.water_last_ping && now - new Date(row.water_last_ping) < everyMs) continue;
      const localDate = local.toISOString().slice(0, 10);
      const { data: wl } = await db.from("water_logs").select("ml").eq("user_id", row.user_id).eq("log_date", localDate);
      const drank = (wl || []).reduce((n, r) => n + (Number(r.ml) || 0), 0);
      const goal = Number(row.water_goal_ml) || 2500;
      if (drank >= goal) continue;                       // already there, leave them alone
      const left = goal - drank;
      queue.push({ userIds: [row.user_id], title: "Water break 💧", body: left + " ml to go today. Grab a glass.", tag: "water" });
      await db.from("nutrition_goals").update({ water_last_ping: now.toISOString() }).eq("user_id", row.user_id);
    }
  }

  // SEND
  let sent = 0, pruned = 0;
  for (const item of queue) {
    const payload = JSON.stringify({ title: item.title, body: item.body, url: "/", tag: item.tag });
    for (const uid of item.userIds) {
      for (const s of subsByUser[uid] || []) {
        try { await webpush.sendNotification(s.subscription, payload); sent++; }
        catch (err) {
          if (err && (err.statusCode === 404 || err.statusCode === 410)) {
            await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint); pruned++;
          }
        }
      }
    }
  }

  await db.from("notify_state").upsert({ id: 1, state, updated_at: nowISO });
  return res.json({ ok: true, queued: queue.length, sent, pruned });
}
