// ============================================================
// FitArena — scoring engine (pure functions, easy to unit-test)
// ============================================================
//
//   CONSISTENCY (0–100)  base of the rank: gym days this week ÷ weekly goal.
//   BONUS (max +15)      light touch: PRs and brags logged this week.
//   TOTAL = consistency + bonus  → leaderboard rank.
//   STREAK               flair + tiebreak: rest days keep it alive, a miss breaks it.
//
// Bonus is capped well below the base so nobody brags their way past people
// who actually train.
// ============================================================

const GYM = new Set(["lift", "cardio"]);
const ALIVE = new Set(["lift", "cardio", "rest"]);

export const WIN_POINTS = { pr: 3, brag: 1 };
export const BONUS_CAP = 15;

// --- date helpers (local time, day-granular) ---
export function todayISO(d = new Date()) { return toISO(d); }
export function toISO(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
const pad = (n) => String(n).padStart(2, "0");
function addDays(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  return toISO(new Date(y, m - 1, d + delta));
}
export function startOfWeekISO(ref = new Date()) {
  const d = new Date(ref);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday start
  return toISO(d);
}

// --- metrics ---
export function gymDaysThisWeek(logs, ref = new Date()) {
  const ws = startOfWeekISO(ref);
  return logs.filter((l) => l.log_date >= ws && GYM.has(l.workout_type)).length;
}

export function consistencyScore(logs, weeklyGoal = 4, ref = new Date()) {
  const goal = Math.max(1, weeklyGoal);
  const days = gymDaysThisWeek(logs, ref);
  const raw = days / goal;
  return { days, goal, raw, score: Math.min(100, Math.round(raw * 100)) };
}

export function weeklyBonus(wins, ref = new Date()) {
  const ws = startOfWeekISO(ref);
  let pts = 0;
  for (const w of wins) {
    const d = w.log_date || (w.created_at ? w.created_at.slice(0, 10) : null);
    if (d && d >= ws) pts += w.kind === "pr" ? WIN_POINTS.pr : WIN_POINTS.brag;
  }
  return Math.min(BONUS_CAP, pts);
}

export function currentStreak(logs, ref = new Date()) {
  const byDate = new Map(logs.map((l) => [l.log_date, l.workout_type]));
  const today = toISO(ref);
  let streak = 0;
  let cursor = byDate.has(today) ? today : addDays(today, -1);
  while (true) {
    const kind = byDate.get(cursor);
    if (!kind || !ALIVE.has(kind)) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * members:    [{ id, name, weekly_goal }]
 * logsByUser: { [userId]: [{ log_date, workout_type }] }
 * winsByUser: { [userId]: [{ kind, log_date, created_at }] }
 */
export function buildLeaderboard(members, logsByUser, winsByUser = {}, ref = new Date()) {
  return members
    .map((m) => {
      const logs = logsByUser[m.id] || [];
      const c = consistencyScore(logs, m.weekly_goal ?? 4, ref);
      const bonus = weeklyBonus(winsByUser[m.id] || [], ref);
      return {
        ...m,
        ...c,
        bonus,
        total: c.score + bonus,
        streak: currentStreak(logs, ref),
        loggedToday: logs.some((l) => l.log_date === toISO(ref)),
      };
    })
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.raw - a.raw ||
        b.streak - a.streak ||
        (a.name || "").localeCompare(b.name || "")
    )
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

export function daysLeft(endDate, ref = new Date()) {
  const end = new Date(`${endDate}T23:59:59`);
  return Math.max(0, Math.ceil((end - ref) / 86_400_000));
}
