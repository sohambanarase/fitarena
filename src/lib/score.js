// ============================================================
// FitArena — permanent global score
// ============================================================
// Unlike the weekly challenge board (which resets), this score only ever grows.
// It's recomputed from your full log history every time, so it can never drift
// or double-count, and it survives challenges ending.
//
//   Active day (lift/cardio)  +10
//   Streak bonus              +1 per consecutive active day, capped at +15/day
//   Weekly goal met           +25 for each week you hit your gym-days target
//   PR logged                 +5     Brag logged  +2
//   Streak milestones         +25 at 7 days, +100 at 30, +250 at 100
//
//   Rest days earn nothing but keep the streak alive — up to 3 in a row.
//   A 4th straight rest day, or a day with nothing logged at all, resets the streak.
//   Today never breaks your streak until the day is over.
// ============================================================

export const POINTS = {
  activeDay: 10,
  streakPerDay: 1,
  streakBonusCap: 15,
  weeklyGoal: 25,
  pr: 5,
  brag: 2,
};
export const REST_ALLOWANCE = 3;
export const MILESTONES = { 7: 25, 30: 100, 100: 250 };

const GYM = new Set(["lift", "cardio"]);

const pad = (n) => String(n).padStart(2, "0");
export function iso(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
function addDays(isoDate, delta) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return iso(new Date(y, m - 1, d + delta));
}
function mondayOf(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return iso(dt);
}

/**
 * logs:  [{ log_date, workout_type }]  — full history, any order
 * wins:  [{ kind }]                    — 'pr' | 'brag'
 */
export function computeScore(logs = [], wins = [], weeklyGoal = 4, ref = new Date()) {
  const today = iso(ref);
  const byDate = new Map();
  logs.forEach((l) => { if (l && l.log_date) byDate.set(l.log_date, l.workout_type); });

  const empty = {
    points: 0, currentStreak: 0, bestStreak: 0, activeDays: 0, restDays: 0,
    weeksHit: 0, milestonesHit: [], breakdown: { activity: 0, streak: 0, weekly: 0, wins: 0, milestones: 0 },
  };
  if (byDate.size === 0) return { ...empty, ...winPoints(wins, empty) };

  const dates = [...byDate.keys()].sort();
  let cursor = dates[0];
  let streak = 0, best = 0, restRun = 0, activeDays = 0, restDays = 0;
  let activity = 0, streakPts = 0, milestonePts = 0;
  const milestonesHit = [];
  const gymByWeek = {};

  while (cursor <= today) {
    const type = byDate.get(cursor);
    if (type && GYM.has(type)) {
      restRun = 0;
      streak += 1;
      activeDays += 1;
      activity += POINTS.activeDay;
      streakPts += Math.min(streak * POINTS.streakPerDay, POINTS.streakBonusCap);
      if (MILESTONES[streak]) { milestonePts += MILESTONES[streak]; milestonesHit.push(streak); }
      const wk = mondayOf(cursor);
      gymByWeek[wk] = (gymByWeek[wk] || 0) + 1;
      if (streak > best) best = streak;
    } else if (type === "rest") {
      restDays += 1;
      restRun += 1;
      if (restRun > REST_ALLOWANCE) streak = 0;
    } else if (cursor !== today) {
      // nothing logged on a day that's already over
      streak = 0;
      restRun = 0;
    }
    cursor = addDays(cursor, 1);
  }

  const goal = Math.max(1, weeklyGoal);
  const weeksHit = Object.values(gymByWeek).filter((n) => n >= goal).length;
  const weekly = weeksHit * POINTS.weeklyGoal;
  const w = winPoints(wins);

  return {
    points: activity + streakPts + weekly + milestonePts + w.winPts,
    currentStreak: streak,
    bestStreak: best,
    activeDays,
    restDays,
    weeksHit,
    milestonesHit,
    breakdown: { activity, streak: streakPts, weekly, wins: w.winPts, milestones: milestonePts },
  };
}

function winPoints(wins = []) {
  let winPts = 0;
  (wins || []).forEach((x) => { winPts += x && x.kind === "pr" ? POINTS.pr : POINTS.brag; });
  return { winPts, points: winPts, breakdown: { wins: winPts } };
}

// Friendly label for how safe the streak is right now.
export function streakState(logs = [], ref = new Date()) {
  const today = iso(ref);
  const byDate = new Map();
  logs.forEach((l) => { if (l && l.log_date) byDate.set(l.log_date, l.workout_type); });
  if (byDate.has(today) && GYM.has(byDate.get(today))) return { state: "trained", restLeft: REST_ALLOWANCE };
  let restRun = 0;
  let cursor = byDate.has(today) ? today : addDays(today, -1);
  while (restRun <= REST_ALLOWANCE) {
    const t = byDate.get(cursor);
    if (t && GYM.has(t)) break;
    if (t === "rest") { restRun += 1; cursor = addDays(cursor, -1); continue; }
    return { state: "broken", restLeft: 0 };
  }
  const restLeft = Math.max(0, REST_ALLOWANCE - restRun);
  return { state: restLeft > 0 ? "resting" : "broken", restLeft };
}
