/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Colours are CSS variables (space-separated RGB) so the same class names
      // (bg-gold, text-mint, …) switch value between the dark and light themes.
      // In dark: gold=championship gold, ember=hot pink, mint=teal.
      // In light: gold=indigo (primary), ember=coral, mint=emerald.
      colors: {
        ink:      "rgb(var(--c-ink) / <alpha-value>)",
        surface:  "rgb(var(--c-surface) / <alpha-value>)",
        surface2: "rgb(var(--c-surface2) / <alpha-value>)",
        line:     "rgb(var(--c-line) / <alpha-value>)",
        gold:     "rgb(var(--c-gold) / <alpha-value>)",
        goldDim:  "rgb(var(--c-goldDim) / <alpha-value>)",
        ember:    "rgb(var(--c-ember) / <alpha-value>)",
        mint:     "rgb(var(--c-mint) / <alpha-value>)",
        paper:    "rgb(var(--c-paper) / <alpha-value>)",
        muted:    "rgb(var(--c-muted) / <alpha-value>)",
      },
      fontFamily: {
        display: ['Anton', 'Impact', 'sans-serif'],
        body:    ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        score:   ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        belt: "0 0 0 1px rgb(var(--c-gold) / .35), 0 8px 30px -8px rgb(var(--c-gold) / .45)",
      },
      keyframes: {
        stamp: { "0%": { transform: "scale(.6)", opacity: "0" }, "60%": { transform: "scale(1.12)", opacity: "1" }, "100%": { transform: "scale(1)" } },
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        stamp: "stamp .35s cubic-bezier(.2,1.3,.4,1) both",
        rise: "rise .35s ease both",
      },
    },
  },
  plugins: [],
};
