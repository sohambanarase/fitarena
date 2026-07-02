@import url('https://fonts.googleapis.com/css2?family=Anton&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* ---------- DARK (default): fight-night ---------- */
  :root {
    --c-ink: 18 16 26;
    --c-surface: 28 25 37;
    --c-surface2: 39 34 49;
    --c-line: 51 44 64;
    --c-gold: 245 196 81;
    --c-goldDim: 202 162 63;
    --c-ember: 255 84 112;
    --c-mint: 70 224 176;
    --c-paper: 244 239 230;
    --c-muted: 154 147 166;
    /* graded accent fills (subtle same-family sheen in dark) */
    --grad-gold:  linear-gradient(135deg, rgb(255 214 110), rgb(224 168 46));
    --grad-mint:  linear-gradient(135deg, rgb(94 232 190), rgb(46 194 150));
    --grad-ember: linear-gradient(135deg, rgb(255 120 142), rgb(233 60 92));
    --bg-grad:
      radial-gradient(120% 60% at 50% -10%, rgba(245,196,81,.12), transparent 60%),
      radial-gradient(80% 50% at 100% 110%, rgba(70,224,176,.07), transparent 60%);
    --shadow-card: 0 10px 30px -12px rgba(0,0,0,.6);
    --btn-glow: 0 10px 26px -12px rgba(245,196,81,.5);
    --glass-bg: 30 27 40;
    --glass-alpha: .5;
    --sheen: .06;
    --hl: rgba(255,255,255,.07);
  }

  /* ---------- LIGHT: fresh, premium, graded, liquid-glass ---------- */
  .light {
    --c-ink: 244 245 250;
    --c-surface: 255 255 255;
    --c-surface2: 236 238 246;
    --c-line: 223 226 236;
    --c-gold: 91 74 235;       /* primary: indigo */
    --c-goldDim: 76 60 210;
    --c-ember: 244 63 94;      /* coral */
    --c-mint: 12 165 120;      /* emerald */
    --c-paper: 23 21 37;
    --c-muted: 108 104 128;
    /* graded accent fills: indigo→violet, emerald→teal, coral→pink */
    --grad-gold:  linear-gradient(135deg, rgb(99 91 255), rgb(139 69 233));
    --grad-mint:  linear-gradient(135deg, rgb(16 185 129), rgb(6 148 162));
    --grad-ember: linear-gradient(135deg, rgb(251 113 133), rgb(244 63 94));
    /* multi-colour wash canvas */
    --bg-grad:
      radial-gradient(75% 45% at 12% -6%, rgba(99,91,255,.16), transparent 60%),
      radial-gradient(70% 45% at 100% 4%, rgba(244,63,94,.11), transparent 58%),
      radial-gradient(90% 55% at 50% 116%, rgba(16,185,129,.12), transparent 62%);
    --shadow-card: 0 12px 34px -14px rgba(37,33,84,.22);
    --btn-glow: 0 12px 28px -12px rgba(99,91,255,.55);
    --glass-bg: 255 255 255;
    --glass-alpha: .58;
    --sheen: .65;
    --hl: rgba(255,255,255,.75);
  }

  html, body, #root { height: 100%; }
  body {
    @apply text-paper font-body antialiased;
    background-color: rgb(var(--c-ink));
    background-image: var(--bg-grad);
    background-attachment: fixed;
    transition: background-color .4s ease, color .4s ease;
  }
  #root { display: flex; justify-content: center; }
}

@layer components {
  .phone { @apply relative flex min-h-full w-full max-w-[440px] flex-col; }
  .screen {
    @apply flex-1 overflow-y-auto px-4 pb-28;
    padding-top: max(0.75rem, env(safe-area-inset-top));
  }

  /* liquid-glass card: translucent + blur + diagonal sheen + soft depth */
  .card {
    @apply rounded-2xl p-4;
    background-color: rgb(var(--c-surface) / .66);
    background-image: linear-gradient(140deg, rgba(255,255,255,var(--sheen)) 0%, transparent 46%);
    backdrop-filter: blur(18px) saturate(160%);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
    border: 1px solid rgb(var(--c-line) / .7);
    box-shadow: inset 0 1px 0 var(--hl), var(--shadow-card);
    transition: background-color .4s ease, border-color .4s ease, box-shadow .4s ease;
  }
  .glass {
    background-color: rgb(var(--glass-bg) / var(--glass-alpha));
    background-image: linear-gradient(140deg, rgba(255,255,255,var(--sheen)) 0%, transparent 50%);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgb(var(--c-line) / .6);
    box-shadow: inset 0 1px 0 var(--hl), var(--shadow-card);
    transition: background-color .4s ease, border-color .4s ease;
  }
  .glass-strong {
    background-color: rgb(var(--glass-bg) / calc(var(--glass-alpha) + 0.24));
    background-image: linear-gradient(140deg, rgba(255,255,255,var(--sheen)) 0%, transparent 55%);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border: 1px solid rgb(var(--c-line) / .6);
    transition: background-color .4s ease, border-color .4s ease;
  }

  .eyebrow { @apply text-[11px] font-bold uppercase tracking-[0.18em] text-muted; }
  .btn-primary {
    @apply rounded-xl bg-gold px-4 py-3 font-bold text-ink transition active:scale-[.98] disabled:opacity-50;
    background-image: var(--grad-gold);
    box-shadow: var(--btn-glow);
  }
  .pill { @apply whitespace-nowrap rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted transition active:scale-95; }
  .pill-on { @apply border-transparent bg-gold text-ink; background-image: var(--grad-gold); }

  /* graded fills wherever these accent backgrounds are used literally */
  .bg-gold  { background-image: var(--grad-gold); }
  .bg-mint  { background-image: var(--grad-mint); }
  .bg-ember { background-image: var(--grad-ember); }

  .inp {
    @apply w-full rounded-xl px-4 py-3 outline-none;
    background-color: rgb(var(--c-surface2));
    color: rgb(var(--c-paper));
    border: 1px solid rgb(var(--c-line) / .5);
    transition: background-color .4s ease, color .4s ease, border-color .4s ease;
  }
  .inp::placeholder { color: rgb(var(--c-muted)); }
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
