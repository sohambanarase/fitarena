import { IFCT } from "./ifct.js";

// Common Indian dishes, per 100g as normally cooked/served.
// These are typical recipe values (restaurant/home average) — always editable before logging.
// [name, kcal, protein, carbs, fat, typicalServing(g)]
const DISH_ROWS = [
  ["Chapati / Roti", 260, 8.5, 50, 3.5, 40],
  ["Phulka (no oil)", 245, 8.5, 50, 2, 35],
  ["Paratha, plain", 320, 7, 45, 12, 60],
  ["Aloo paratha", 250, 5.5, 36, 9, 100],
  ["Naan", 310, 9, 50, 8, 90],
  ["Puri", 380, 7, 44, 19, 25],
  ["Bhatura", 330, 7, 40, 15, 80],
  ["Rice, cooked (plain)", 130, 2.7, 28, 0.3, 150],
  ["Jeera rice", 165, 3, 30, 3.5, 150],
  ["Veg pulao", 150, 3.5, 24, 4.5, 200],
  ["Veg biryani", 165, 4, 25, 5.5, 250],
  ["Chicken biryani", 180, 9, 22, 6, 250],
  ["Khichdi", 120, 4, 20, 2.5, 250],
  ["Curd rice", 120, 3.5, 19, 3, 200],
  ["Dal tadka", 115, 5.5, 14, 4, 150],
  ["Dal fry", 120, 5.5, 14, 4.5, 150],
  ["Dal makhani", 165, 6, 15, 9, 150],
  ["Sambar", 65, 3, 8, 2.5, 150],
  ["Rasam", 35, 1.2, 5, 1, 150],
  ["Kadhi", 95, 3.5, 8, 5.5, 150],
  ["Rajma masala", 125, 6, 17, 3.5, 150],
  ["Chole / chana masala", 140, 6, 18, 4.5, 150],
  ["Chana dal cooked", 130, 7, 19, 2.5, 150],
  ["Butter chicken", 190, 12, 6, 13, 200],
  ["Chicken curry", 150, 13, 4, 9, 200],
  ["Tandoori chicken", 165, 25, 2, 6.5, 150],
  ["Chicken tikka", 175, 24, 3, 7.5, 150],
  ["Egg curry", 145, 8, 5, 10, 200],
  ["Fish curry", 130, 12, 4, 7, 200],
  ["Mutton curry", 195, 14, 4, 14, 200],
  ["Paneer butter masala", 230, 8, 8, 18, 150],
  ["Palak paneer", 165, 7.5, 6, 12, 150],
  ["Matar paneer", 175, 7, 9, 12, 150],
  ["Paneer tikka", 220, 14, 6, 15, 120],
  ["Aloo gobi", 100, 2.5, 10, 5.5, 150],
  ["Bhindi masala", 110, 2, 8, 8, 150],
  ["Baingan bharta", 95, 2, 8, 6, 150],
  ["Mixed veg curry", 105, 3, 10, 6, 150],
  ["Aloo matar", 110, 3, 13, 5, 150],
  ["Idli", 130, 4, 26, 0.6, 40],
  ["Dosa, plain", 165, 4, 28, 4, 80],
  ["Masala dosa", 185, 4, 30, 5.5, 150],
  ["Uttapam", 155, 4, 26, 4, 120],
  ["Medu vada", 265, 6, 30, 13, 50],
  ["Upma", 145, 3.5, 22, 4.5, 200],
  ["Poha (cooked)", 130, 2.5, 22, 3.5, 200],
  ["Pav bhaji", 145, 3.5, 18, 6.5, 250],
  ["Samosa", 300, 5, 32, 17, 60],
  ["Pakora / bhaji", 315, 7, 30, 18, 50],
  ["Dhokla", 160, 6, 22, 5, 100],
  ["Raita", 65, 2.8, 5, 3.4, 100],
  ["Curd / dahi", 60, 3.1, 4.7, 3.3, 150],
  ["Lassi, sweet", 95, 2.6, 15, 2.6, 250],
  ["Masala chai (with milk & sugar)", 55, 1.5, 8, 1.8, 150],
  ["Kheer", 145, 3.5, 22, 4.5, 150],
  ["Gulab jamun", 300, 4, 45, 12, 40],
  ["Suji halwa", 320, 4, 45, 14, 100],
  // common ingredients IFCT doesn't list separately
  ["Besan (gram flour)", 387, 22, 58, 6.7, 30],
  ["Idli batter (fermented)", 155, 4.5, 31, 0.8, 100],
  ["Ghee", 900, 0, 0, 100, 10],
  ["Paneer, low fat", 190, 22, 4, 10, 100],
  ["Sabudana (sago)", 351, 0.2, 87, 0.2, 60],
];

export const DISHES = DISH_ROWS.map(([n, k, p, ch, f, sv], i) => ({
  id: null, source: "recipe", code: "R" + i,
  name: n, calories_per_100g: k, protein_per_100g: p, carbs_per_100g: ch, fat_per_100g: f, serving_size: sv,
}));

// Everyday words → the IFCT wording, so "besan" finds "Bengal gram, flour".
const ALIASES = {
  besan: "bengal gram flour", atta: "wheat flour atta", maida: "wheat flour refined",
  suji: "semolina", rava: "semolina", poha: "rice flakes", chiwda: "rice flakes",
  moong: "green gram", mung: "green gram", masoor: "lentil", toor: "red gram", arhar: "red gram",
  urad: "black gram", chana: "bengal gram", kabuli: "chickpea", rajma: "rajmah",
  jeera: "cumin", haldi: "turmeric", dhania: "coriander", methi: "fenugreek",
  sarson: "mustard", til: "sesame", sabudana: "sago", gud: "jaggery", jaggery: "jaggery",
  dahi: "curd", chawal: "rice", aata: "wheat flour atta", ghee: "ghee",
};

// Each search word becomes a group: the word itself plus any alias words.
// A group is satisfied if ANY word in it matches, so "moong dal" finds "Green gram, dal".
function groupsFor(tokens) {
  return tokens.map((t) => [...new Set([t, ...(ALIASES[t] ? ALIASES[t].split(" ") : [])])]);
}

const toFood = (r) => ({
  id: null, source: "ifct", code: r.c, name: r.n, brand: null,
  calories_per_100g: r.k, protein_per_100g: r.p, carbs_per_100g: r.ch, fat_per_100g: r.f, fiber_per_100g: r.fb,
  serving_size: null, group: r.g,
});

// Ranked local search over the dishes + IFCT tables. Instant, offline, no API.
export function searchIndian(query, limit = 14) {
  const q = (query || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!q || q.length < 2) return [];
  const groups = groupsFor(q.split(" ").filter(Boolean)).slice(0, 6);
  const score = (hayName, hayAlt) => {
    const name = hayName.toLowerCase(), alt = (hayAlt || "").toLowerCase();
    let s = 0;
    for (const group of groups) {
      let best = 0;
      for (const t of group) {
        if (name === t) best = Math.max(best, 12);
        else if (name.startsWith(t)) best = Math.max(best, 7);
        else if (name.includes(t)) best = Math.max(best, 4);
        else if (alt.includes(t)) best = Math.max(best, 3);
      }
      if (!best) return 0;                // every search word must match somewhere
      s += best;
    }
    if (name.length < 26) s += 1;         // prefer simple, common entries
    return s;
  };
  const hits = [];
  DISHES.forEach((d) => { const s = score(d.name, ""); if (s) hits.push({ s: s + 2, f: d }); });   // dishes rank first
  IFCT.forEach((r) => { if (!r.k) return; const s = score(r.n, r.a); if (s) hits.push({ s, f: toFood(r) }); });   // skip rows with no energy value
  return hits.sort((a, b) => b.s - a.s).slice(0, limit).map((h) => h.f);
}
