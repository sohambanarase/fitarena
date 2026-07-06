import { supabase } from "./supabase.js";

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlB64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return typeof window !== "undefined" &&
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// iOS only allows push for a PWA opened from the home screen (standalone).
export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export async function pushStatus() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? "on" : "off";
  } catch { return "off"; }
}

export async function enablePush(userId) {
  if (!pushSupported()) throw new Error("This device or browser doesn't support notifications.");
  if (!VAPID_PUBLIC) throw new Error("Notifications aren't configured yet (missing VAPID key).");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications weren't allowed.");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
    });
  }
  const json = sub.toJSON();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: userId, endpoint: json.endpoint, subscription: json }, { onConflict: "endpoint" });
  if (error) throw error;
  return true;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

// Owner-only: ask the server to push a test notification to your own devices.

// Owner-only: ask the server to push a test notification to your own devices.
export async function sendTestPush(userId) {
  const res = await fetch("/api/test-push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Test failed.");
  return j;
}
