// ============================================================
// FitArena — scoring engine (pure functions, no React, easy to unit-test)
// ============================================================
//
// Two metrics on purpose, because they reward different things:
//
//   CONSISTENCY SCORE  → the leaderboard rank. Rewards actually training.
//                        gym days this week ÷ your weekly goal, capped at 100%.
//
//   STREAK             → the "don't break the chain" flair. Rewards showing up
//                        every day. A planned REST day keeps it alive; a SKIP
//                        (or a missed day with no log) breaks it.
//
// The tension is the point: you can rest to protect your streak, but resting
// tanks your consistency score — so you can't coast to the top of the board.
// ============================================================

const GYM = new Set(["lift", "cardio"]);
const ALIVE = new Set(["lift", "cardio", "rest"]); // keeps a streak going

// --- date helpers (all local-time, day-granular) ---

export function todayISO(d = new Date()) {
  return toISO(d);
}

export function toISO(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function addDays(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return toISO(dt);
}

// Monday as start of the ISO week.
export function startOfWeekISO(ref = new Date()) {
  const d = new Date(ref);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

// --- the metrics ---

/** logs: [{ log_date, workout_type }] for ONE user. */
export function gymDaysThisWeek(logs, ref = new Date()) {
  const weekStart = startOfWeekISO(ref);
  return logs.filter(
    (l) => l.log_date >= weekStart && GYM.has(l.workout_type)
  ).length;
}

/** 0–100, capped. Raw (uncapped) ratio is kept for tie-breaking. */
export function consistencyScore(logs, weeklyGoal = 4, ref = new Date()) {
  const goal = Math.max(1, weeklyGoal);
  const days = gymDaysThisWeek(logs, ref);
  const raw = days / goal;
  return { days, goal, raw, score: Math.min(100, Math.round(raw * 100)) };
}

/**
 * Consecutive-day streak counting back from today.
 * - today with no log yet → does NOT break it (day isn't over), just doesn't add.
 * - a past day with no log → breaks it.
 * - 'skip' breaks it; 'rest' keeps it; 'lift'/'cardio' keep + count it.
 */
export function currentStreak(logs, ref = new Date()) {
  const byDate = new Map(logs.map((l) => [l.log_date, l.workout_type]));
  const today = toISO(ref);
  let streak = 0;
  let cursor = today;

  // skip an empty *today* so an un-checked-in morning doesn't read as a break
  if (!byDate.has(today)) cursor = addDays(today, -1);

  while (true) {
    const kind = byDate.get(cursor);
    if (!kind || !ALIVE.has(kind)) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * Build a ranked leaderboard.
 * members:  [{ id, name, weekly_goal }]
 * logsByUser: { [userId]: [{ log_date, workout_type }] }
 * Sort: consistency score desc → raw ratio desc → streak desc → name asc.
 */
export function buildLeaderboard(members, logsByUser, ref = new Date()) {
  return members
    .map((m) => {
      const logs = logsByUser[m.id] || [];
      const c = consistencyScore(logs, m.weekly_goal ?? 4, ref);
      return {
        ...m,
        ...c,
        streak: currentStreak(logs, ref),
        loggedToday: logs.some((l) => l.log_date === toISO(ref)),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.raw - a.raw ||
        b.streak - a.streak ||
        (a.name || "").localeCompare(b.name || "")
    )
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/** Whole-numbers countdown to the final bell. */
export function daysLeft(endDate, ref = new Date()) {
  const end = new Date(`${endDate}T23:59:59`);
  const ms = end - ref;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
