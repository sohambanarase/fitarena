// /api/test-push.js — sends a test notification to the owner's own devices.
// Looks the user up with the service-role admin API (no login token needed, so it
// won't fail on an expired session), and only allows the owner email below.
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const OWNER_EMAIL = "sohambanarase1999@gmail.com";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!url || !serviceKey || !vapidPublic || !vapidPrivate)
    return res.status(500).json({ error: "missing env (supabase admin or VAPID)" });

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const userId = body.userId;
  if (!userId) return res.status(400).json({ error: "no userId" });

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Confirm this id belongs to the owner (admin lookup, service-role only).
  const { data: uData, error: uErr } = await db.auth.admin.getUserById(userId);
  const email = uData?.user?.email;
  if (uErr || !email) return res.status(400).json({ error: "user lookup failed: " + (uErr?.message || "not found") });
  if (OWNER_EMAIL && email !== OWNER_EMAIL) return res.status(403).json({ error: "not allowed for this account" });

  const { data: subs, error: sErr } = await db
    .from("push_subscriptions").select("endpoint, subscription").eq("user_id", userId);
  if (sErr) return res.status(500).json({ error: "db read failed: " + sErr.message });
  if (!subs || subs.length === 0) return res.json({ ok: true, sent: 0, note: "no devices subscribed for this account" });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:fitarena@fitarena.app", vapidPublic, vapidPrivate);
  const payload = JSON.stringify({ title: "FitArena test 🔔", body: "If you can see this, notifications are working!", url: "/", tag: "fitarena-test" });

  let sent = 0, pruned = 0, lastErr = null;
  for (const s of subs) {
    try { await webpush.sendNotification(s.subscription, payload); sent++; }
    catch (err) {
      lastErr = (err && (err.body || err.message)) || String(err);
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint); pruned++;
      }
    }
  }
  return res.json({ ok: true, sent, pruned, devices: subs.length, lastError: sent === 0 ? lastErr : null });
}
function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
