/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink:      "#12101A", // base — near-black with a plum tint (warmer than the usual fitness black)
        surface:  "#1C1925",
        surface2: "#272231",
        line:     "#332C40",
        gold:     "#F5C451", // the one bold brand colour: championship belt / streak fire / primary CTA
        goldDim:  "#caa23f",
        ember:    "#FF5470", // semantic: behind / slacking ("Roast")
        mint:     "#46E0B0", // semantic: ahead / crushing it ("Toast")
        paper:    "#F4EFE6", // warm off-white text
        muted:    "#9A93A6",
      },
      fontFamily: {
        display: ['Anton', 'Impact', 'sans-serif'],          // poster-weight, used with restraint
        body:    ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        score:   ['"Space Mono"', 'ui-monospace', 'monospace'], // scoreboard digits
      },
      boxShadow: {
        belt: "0 0 0 1px rgba(245,196,81,.35), 0 8px 30px -8px rgba(245,196,81,.45)",
      },
      keyframes: {
        stamp: { "0%": { transform: "scale(.6)", opacity: "0" }, "60%": { transform: "scale(1.12)", opacity: "1" }, "100%": { transform: "scale(1)" } },
        fillbar: { from: { width: "0%" } },
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
