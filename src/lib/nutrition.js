import { supabase } from "./supabase.js";

export const MEALS = ["breakfast", "lunch", "dinner", "snacks", "pre-workout", "post-workout"];
export const MEAL_LABELS = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner",
  snacks: "Snacks", "pre-workout": "Pre-workout", "post-workout": "Post-workout",
};

// Gym-focused one-tap presets (per 100g). Customizable later (TODO).
export const QUICK_FOODS = [
  { name: "Whey protein", calories_per_100g: 400, protein_per_100g: 80, carbs_per_100g: 8, fat_per_100g: 6, serving_size: 30 },
  { name: "Chicken breast", calories_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6, serving_size: 150 },
  { name: "Whole eggs", calories_per_100g: 143, protein_per_100g: 13, carbs_per_100g: 1.1, fat_per_100g: 9.5, serving_size: 50 },
  { name: "Cooked rice", calories_per_100g: 130, protein_per_100g: 2.7, carbs_per_100g: 28, fat_per_100g: 0.3, serving_size: 150 },
  { name: "Oats", calories_per_100g: 379, protein_per_100g: 13, carbs_per_100g: 67, fat_per_100g: 7, serving_size: 80 },
  { name: "Banana", calories_per_100g: 89, protein_per_100g: 1.1, carbs_per_100g: 23, fat_per_100g: 0.3, serving_size: 120 },
  { name: "Skyr", calories_per_100g: 63, protein_per_100g: 11, carbs_per_100g: 4, fat_per_100g: 0.2, serving_size: 200 },
  { name: "Magerquark", calories_per_100g: 67, protein_per_100g: 12, carbs_per_100g: 4, fat_per_100g: 0.3, serving_size: 250 },
  { name: "Greek yogurt", calories_per_100g: 97, protein_per_100g: 9, carbs_per_100g: 4, fat_per_100g: 5, serving_size: 150 },
  { name: "Tuna (canned)", calories_per_100g: 116, protein_per_100g: 26, carbs_per_100g: 0, fat_per_100g: 1, serving_size: 100 },
  { name: "Pasta (cooked)", calories_per_100g: 158, protein_per_100g: 6, carbs_per_100g: 31, fat_per_100g: 0.9, serving_size: 150 },
  { name: "Milk", calories_per_100g: 60, protein_per_100g: 3.3, carbs_per_100g: 5, fat_per_100g: 3.3, serving_size: 200 },
];

// ---- Goals ----
export async function loadGoals(userId) {
  const { data } = await supabase.from("nutrition_goals").select("*").eq("user_id", userId).maybeSingle();
  return data || null;
}
export async function saveGoals(userId, g) {
  return supabase.from("nutrition_goals")
    .upsert({ user_id: userId, ...g, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select().single();
}

// ---- Foods ----
export async function addFood(food) { return supabase.from("foods").insert(food).select().single(); }
export function normalizeQuery(q) {
  return (q || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s%]/g, " ").replace(/\s+/g, " ").trim();
}
// Matches every word anywhere in the name OR brand, in any order.
export async function searchFoods(userId, q) {
  let query = supabase.from("foods").select("*").or(`user_id.eq.${userId},user_id.is.null`);
  const tokens = normalizeQuery(q).split(" ").filter(Boolean).slice(0, 5);
  tokens.forEach((t) => { query = query.or(`name.ilike.%${t}%,brand.ilike.%${t}%`); });
  const { data } = await query.order("created_at", { ascending: false }).limit(40);
  return data || [];
}
export async function recentFoods(userId, n = 12) {
  const { data } = await supabase.from("food_logs").select("food_id, created_at")
    .eq("user_id", userId).not("food_id", "is", null).order("created_at", { ascending: false }).limit(60);
  const ids = [];
  const seen = new Set();
  (data || []).forEach((l) => { if (l.food_id && !seen.has(l.food_id)) { seen.add(l.food_id); ids.push(l.food_id); } });
  if (!ids.length) return [];
  const { data: foods } = await supabase.from("foods").select("*").in("id", ids.slice(0, n));
  const map = {}; (foods || []).forEach((f) => (map[f.id] = f));
  return ids.slice(0, n).map((id) => map[id]).filter(Boolean);
}

// ---- Logs ----
export async function loadLogs(userId, date) {
  const { data } = await supabase.from("food_logs").select("*").eq("user_id", userId).eq("log_date", date).order("created_at", { ascending: true });
  return data || [];
}
export async function logFood(entry) { return supabase.from("food_logs").insert(entry).select().single(); }
export async function removeLog(id) { return supabase.from("food_logs").delete().eq("id", id); }

// ---- Calc ----
export function macrosFor(food, grams) {
  const f = grams / 100;
  const r = (v) => (v == null || v === "" ? null : Math.round(Number(v) * f * 10) / 10);
  return {
    calories: Math.round(Number(food.calories_per_100g || 0) * f),
    protein: r(food.protein_per_100g), carbs: r(food.carbs_per_100g), fat: r(food.fat_per_100g),
    sugar: r(food.sugar_per_100g), salt: r(food.salt_per_100g), fiber: r(food.fiber_per_100g),
  };
}
export function dayTotals(logs) {
  return logs.reduce((t, l) => ({
    calories: t.calories + (Number(l.calculated_calories) || 0),
    protein: t.protein + (Number(l.calculated_protein) || 0),
    carbs: t.carbs + (Number(l.calculated_carbs) || 0),
    fat: t.fat + (Number(l.calculated_fat) || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ---- Open Food Facts (barcode + name search; EU/German products) ----
function mapOff(p, barcode) {
  const n = p.nutriments || {};
  const kcal = n["energy-kcal_100g"] ?? (n["energy_100g"] ? Math.round(n["energy_100g"] / 4.184) : null);
  return {
    source: "off", barcode: barcode || p.code || null,
    name: p.product_name || "Unknown product",
    brand: (p.brands || "").split(",")[0] || null,
    image_url: p.image_front_small_url || null,
    calories_per_100g: kcal,
    protein_per_100g: n.proteins_100g ?? null,
    carbs_per_100g: n.carbohydrates_100g ?? null,
    fat_per_100g: n.fat_100g ?? null,
    sugar_per_100g: n.sugars_100g ?? null,
    salt_per_100g: n.salt_100g ?? null,
    fiber_per_100g: n.fiber_100g ?? null,
    serving_quantity: p.serving_quantity ? Number(p.serving_quantity) : null,
    serving_size: p.serving_quantity ? Number(p.serving_quantity) : null,
  };
}
export async function lookupBarcode(barcode) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const url = "https://world.openfoodfacts.org/api/v2/product/" + encodeURIComponent(barcode) +
      ".json?fields=code,product_name,brands,image_front_small_url,nutriments,serving_quantity,serving_size";
    const res = await fetch(url, { signal: ctrl.signal });
    const j = await res.json();
    if (!j || j.status !== 1 || !j.product) return null;
    return mapOff(j.product, barcode);
  } catch { return null; } finally { clearTimeout(t); }
}
const OFF_FIELDS = "code,product_name,brands,image_front_small_url,nutriments,serving_quantity";
async function getJSON(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 9000);
  try { const r = await fetch(url, { signal: ctrl.signal }); if (!r.ok) return null; return await r.json(); }
  catch { return null; } finally { clearTimeout(t); }
}
const cleanHits = (arr) => (arr || []).map((p) => mapOff(p)).filter((f) => f.name && f.calories_per_100g != null);

// Search Open Food Facts by name (products without a handy barcode, e.g. "starbucks latte").
// Two independent search backends + a progressive word-drop retry, so results don't depend on
// exact wording or on one endpoint being slow/rate-limited on a given device/network.
export async function searchOFF(query) {
  const q = normalizeQuery(query);
  if (!q) return [];
  const modern = async (term) => {
    const j = await getJSON("https://search.openfoodfacts.org/api/v1/search?q=" + encodeURIComponent(term) + "&page_size=20&fields=" + OFF_FIELDS, 8000);
    return cleanHits(j && (j.hits || j.products));
  };
  const legacy = async (term) => {
    const j = await getJSON("https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + encodeURIComponent(term) +
      "&search_simple=1&action=process&json=1&page_size=20&fields=" + OFF_FIELDS, 9000);
    return cleanHits(j && j.products);
  };
  // both backends in parallel for the full phrase — take whatever comes back
  const [a, b] = await Promise.all([modern(q).catch(() => []), legacy(q).catch(() => [])]);
  let out = dedupeFoods([...(a || []), ...(b || [])]);
  if (out.length) return out;
  // still nothing: retry with fewer words (handles "extra word kills the match")
  const words = q.split(" ");
  for (let n = words.length - 1; n >= 1 && !out.length; n--) {
    const term = words.slice(0, n).join(" ");
    const [c, d] = await Promise.all([modern(term).catch(() => []), legacy(term).catch(() => [])]);
    out = dedupeFoods([...(c || []), ...(d || [])]);
  }
  return out;
}
function dedupeFoods(list) {
  const seen = new Set(); const out = [];
  list.forEach((f) => { const k = (f.barcode || "") + "|" + (f.name || "").toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(f); } });
  return out;
}
// Cache a public OFF food into our foods table (so it's searchable & favouritable). Dedupes by barcode.
export async function cacheOffFood(food) {
  if (food.id) return food;
  if (food.barcode) {
    const { data: existing } = await supabase.from("foods").select("*").is("user_id", null).eq("barcode", food.barcode).maybeSingle();
    if (existing) return existing;
  }
  const row = {
    user_id: null, source: "off", barcode: food.barcode || null, name: food.name, brand: food.brand || null, image_url: food.image_url || null,
    calories_per_100g: food.calories_per_100g, protein_per_100g: food.protein_per_100g, carbs_per_100g: food.carbs_per_100g, fat_per_100g: food.fat_per_100g,
    sugar_per_100g: food.sugar_per_100g, salt_per_100g: food.salt_per_100g, fiber_per_100g: food.fiber_per_100g, serving_size: food.serving_size || null,
  };
  const { data, error } = await supabase.from("foods").insert(row).select().single();
  if (error && food.barcode) { const { data: again } = await supabase.from("foods").select("*").is("user_id", null).eq("barcode", food.barcode).maybeSingle(); return again || food; }
  return data || food;
}

// ---- Favorites ----
export async function loadFavorites(userId) {
  const { data } = await supabase.from("favorite_foods").select("food_id, created_at").eq("user_id", userId).order("created_at", { ascending: false });
  const ids = (data || []).map((r) => r.food_id);
  if (!ids.length) return [];
  const { data: foods } = await supabase.from("foods").select("*").in("id", ids);
  const map = {}; (foods || []).forEach((f) => (map[f.id] = f));
  return ids.map((id) => map[id]).filter(Boolean);
}
export async function isFavorite(userId, foodId) {
  if (!foodId) return false;
  const { data } = await supabase.from("favorite_foods").select("id").eq("user_id", userId).eq("food_id", foodId).maybeSingle();
  return !!data;
}
export async function setFavorite(userId, foodId, on) {
  if (!foodId) return;
  if (on) return supabase.from("favorite_foods").upsert({ user_id: userId, food_id: foodId }, { onConflict: "user_id,food_id" });
  return supabase.from("favorite_foods").delete().eq("user_id", userId).eq("food_id", foodId);
}
// Ensure a food exists in the DB (custom/quick foods get saved so they can be favourited/reused).
// Reuses an existing row with the same name so tapping the star twice can't create duplicates.
export async function ensureFood(userId, food) {
  if (food.id) return food;
  if (food.barcode) { const { data: byCode } = await supabase.from("foods").select("*").eq("barcode", food.barcode).limit(1).maybeSingle(); if (byCode) return byCode; }
  const { data: byName } = await supabase.from("foods").select("*").eq("user_id", userId).ilike("name", (food.name || "").trim()).limit(1).maybeSingle();
  if (byName) return byName;
  const { data } = await addFood({ user_id: userId, source: food.source || "custom", name: food.name, brand: food.brand || null,
    calories_per_100g: food.calories_per_100g, protein_per_100g: food.protein_per_100g, carbs_per_100g: food.carbs_per_100g, fat_per_100g: food.fat_per_100g,
    sugar_per_100g: food.sugar_per_100g, salt_per_100g: food.salt_per_100g, fiber_per_100g: food.fiber_per_100g, serving_size: food.serving_size || null });
  return data || food;
}

// ---- Insights ----
export async function loadRange(userId, sinceISO) {
  const { data } = await supabase.from("food_logs").select("log_date, calculated_calories, calculated_protein").eq("user_id", userId).gte("log_date", sinceISO);
  return data || [];
}
export function weeklyInsights(rangeLogs, goals) {
  const byDay = {};
  rangeLogs.forEach((l) => { (byDay[l.log_date] || (byDay[l.log_date] = { cal: 0, p: 0 })); byDay[l.log_date].cal += Number(l.calculated_calories) || 0; byDay[l.log_date].p += Number(l.calculated_protein) || 0; });
  const days = Object.keys(byDay);
  const n = days.length || 1;
  const sum = (k) => days.reduce((s, d) => s + byDay[d][k], 0);
  return {
    daysLogged: days.length,
    avgCal: Math.round(sum("cal") / n),
    avgProtein: Math.round(sum("p") / n),
    proteinHit: goals?.protein_goal ? days.filter((d) => byDay[d].p >= goals.protein_goal).length : null,
    calWithin: goals?.calories_goal ? days.filter((d) => byDay[d].cal <= goals.calories_goal * 1.05).length : null,
  };
}

// ---- Saved meals (templates) ----
export async function loadSavedMeals(userId) {
  const { data: meals } = await supabase.from("saved_meals").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (!meals || !meals.length) return [];
  const ids = meals.map((m) => m.id);
  const { data: items } = await supabase.from("saved_meal_items").select("*").in("saved_meal_id", ids);
  const foodIds = [...new Set((items || []).map((it) => it.food_id).filter(Boolean))];
  const foodMap = {};
  if (foodIds.length) { const { data: foods } = await supabase.from("foods").select("*").in("id", foodIds); (foods || []).forEach((f) => (foodMap[f.id] = f)); }
  const byMeal = {};
  (items || []).forEach((it) => (byMeal[it.saved_meal_id] || (byMeal[it.saved_meal_id] = [])).push({ ...it, food: foodMap[it.food_id] }));
  return meals.map((m) => ({ ...m, items: byMeal[m.id] || [] }));
}
export async function createSavedMeal(userId, name, items) {
  const { data: meal } = await supabase.from("saved_meals").insert({ user_id: userId, meal_name: name }).select().single();
  if (!meal) return null;
  const rows = items.map((it) => ({ saved_meal_id: meal.id, food_id: it.food_id, quantity: it.grams, quantity_unit: "g", quantity_grams: it.grams }));
  if (rows.length) await supabase.from("saved_meal_items").insert(rows);
  return meal;
}
export async function deleteSavedMeal(id) { return supabase.from("saved_meals").delete().eq("id", id); }
export async function logSavedMeal(userId, date, mealType, savedMeal) {
  const rows = (savedMeal.items || []).filter((it) => it.food).map((it) => {
    const m = macrosFor(it.food, it.quantity_grams || 100);
    return {
      user_id: userId, food_id: it.food_id, name: it.food.name, log_date: date, meal_type: mealType,
      quantity: it.quantity_grams, quantity_unit: "g", quantity_grams: it.quantity_grams,
      calculated_calories: m.calories, calculated_protein: m.protein, calculated_carbs: m.carbs, calculated_fat: m.fat,
      calculated_sugar: m.sugar, calculated_salt: m.salt, calculated_fiber: m.fiber,
    };
  });
  if (rows.length) return supabase.from("food_logs").insert(rows);
}
export function savedMealTotals(savedMeal) {
  return (savedMeal.items || []).reduce((t, it) => {
    if (!it.food) return t;
    const m = macrosFor(it.food, it.quantity_grams || 100);
    return { cal: t.cal + (m.calories || 0), p: t.p + (m.protein || 0) };
  }, { cal: 0, p: 0 });
}

// ---- Quick add: built-in staples + the user's own, editable ----
const HIDDEN_KEY = "fitarena.quickHidden";
function hiddenDefaults() { try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]"); } catch { return []; } }
function setHiddenDefaults(list) { try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(list)); } catch {} }
export function hideDefaultQuick(name) { const h = hiddenDefaults(); if (!h.includes(name)) setHiddenDefaults([...h, name]); }
export function restoreDefaultQuick() { setHiddenDefaults([]); }
export function hiddenDefaultCount() { return hiddenDefaults().length; }

// Built-ins are available synchronously so the list never waits on the network.
export function builtinQuickFoods() {
  const hidden = hiddenDefaults();
  return QUICK_FOODS.filter((f) => !hidden.includes(f.name)).map((f) => ({ ...f, builtin: true, source: "quickadd" }));
}
// Returns [{...food, builtin:true|false}] — built-ins first, then the user's own.
export async function loadQuickFoods(userId) {
  const builtins = builtinQuickFoods();
  let mine = [];
  try {
    // never let a slow/offline backend hide the staples
    const q = supabase.from("foods").select("*").eq("user_id", userId).eq("source", "quickadd").order("created_at", { ascending: true });
    const { data } = await Promise.race([q, new Promise((r) => setTimeout(() => r({ data: [] }), 6000))]);
    mine = data || [];
  } catch { mine = []; }
  return [...builtins, ...mine.map((f) => ({ ...f, builtin: false }))];
}
export async function addQuickFood(userId, food) {
  return supabase.from("foods").insert({
    user_id: userId, source: "quickadd", name: food.name, brand: food.brand || null,
    calories_per_100g: food.calories_per_100g, protein_per_100g: food.protein_per_100g,
    carbs_per_100g: food.carbs_per_100g, fat_per_100g: food.fat_per_100g, serving_size: food.serving_size || null,
  }).select().single();
}
export async function updateFoodRow(id, patch) {
  return supabase.from("foods").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
}
export async function deleteFoodRow(id) { return supabase.from("foods").delete().eq("id", id); }

// ---- Editing logged entries & managing your own foods ----
export async function getFood(id) {
  if (!id) return null;
  const { data } = await supabase.from("foods").select("*").eq("id", id).maybeSingle();
  return data || null;
}
export async function updateLog(id, patch) {
  return supabase.from("food_logs").update(patch).eq("id", id);
}
// Every food you own (custom, quick-add, AI-saved) — for the "My foods" manager.
export async function loadMyFoods(userId, q) {
  let query = supabase.from("foods").select("*").eq("user_id", userId);
  const tokens = normalizeQuery(q).split(" ").filter(Boolean).slice(0, 5);
  tokens.forEach((t) => { query = query.or(`name.ilike.%${t}%,brand.ilike.%${t}%`); });
  const { data } = await query.order("created_at", { ascending: false }).limit(100);
  return data || [];
}
