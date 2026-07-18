const KEY = "fitarena.theme";
export const THEMES = ["dark", "light", "bloom"];

export function currentTheme() {
  try { const t = localStorage.getItem(KEY); return THEMES.includes(t) ? t : "dark"; } catch { return "dark"; }
}

const BAR = { dark: "#12101A", light: "#F5F6F9", bloom: "#FCF7FB" };

export function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.remove("light", "bloom");
  if (theme === "light") root.classList.add("light");
  else if (theme === "bloom") root.classList.add("bloom");
  try { localStorage.setItem(KEY, theme); } catch {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", BAR[theme] || BAR.dark);
}
