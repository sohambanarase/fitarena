// /api/test-push.js — sends a test notification to the signed-in user's own devices.
// Verifies the caller's Supabase session token, so you can only test-push yourself.
// Restricted to the owner email below.
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

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "no auth token" });

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Verify the caller and get their real user id.
  const { data: userData, error: uErr } = await db.auth.getUser(token);
  const user = userData?.user;
  if (uErr || !user) return res.status(401).json({ error: "invalid session" });
  if (OWNER_EMAIL && user.email !== OWNER_EMAIL) return res.status(403).json({ error: "not allowed" });

  // Read this user's devices (service role bypasses RLS — this doubles as a key check).
  const { data: subs, error: sErr } = await db
    .from("push_subscriptions").select("endpoint, subscription").eq("user_id", user.id);
  if (sErr) return res.status(500).json({ error: "db read failed: " + sErr.message });
  if (!subs || subs.length === 0)
    return res.json({ ok: true, sent: 0, note: "no devices subscribed for this account" });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:fitarena@fitarena.app", vapidPublic, vapidPrivate);
  const payload = JSON.stringify({
    title: "FitArena test 🔔",
    body: "If you can see this, notifications are working!",
    url: "/", tag: "fitarena-test",
  });

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
