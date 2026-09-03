// /api/ai-status.js — is the AI fallback chain actually wired up?
//
// Answers the only two questions worth asking from outside: which providers have a key,
// and is anything currently in the penalty box. Never returns key values, only booleans.
// Note the state is per warm serverless instance, so `benched` may read empty on a cold
// start even if another instance is throttled. That's expected, not a bug.
import { _state } from "./_ai.js";

export default async function handler(req, res) {
  const s = _state();
  const order = {
    text: ["gemini", "groq", "openrouter"].filter((n) => s.configured[n]),
    images: ["gemini", "openrouter"].filter((n) => s.configured[n]),
  };
  if (process.env.GROQ_VISION_MODEL && s.configured.groq) order.images.splice(1, 0, "groq");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: order.text.length > 0, ...s, chain: order });
}
