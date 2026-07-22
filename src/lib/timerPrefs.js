// Local, per-device workout timer preferences (no server needed).
const KEY = "fitarena.timerPrefs";
const DEFAULTS = { setRest: 90, exRest: 120 };   // seconds; 0 = no target

export function loadTimerPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      setRest: Number.isFinite(v.setRest) ? v.setRest : DEFAULTS.setRest,
      exRest: Number.isFinite(v.exRest) ? v.exRest : DEFAULTS.exRest,
    };
  } catch { return { ...DEFAULTS }; }
}
export function saveTimerPrefs(prefs) {
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
}
