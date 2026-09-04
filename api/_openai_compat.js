// api/_openai_compat.js — adapter that lets Groq and OpenRouter stand in for Gemini.
//
// Both speak the OpenAI chat-completions format, so one adapter covers both: only the
// base URL, the key and the model list differ. Everything here translates in two directions:
//
//   in : Gemini `parts`      -> OpenAI `messages[0].content`
//   out: OpenAI `choices[0]` -> a Gemini-shaped Response-like object
//
// Returning the Gemini shape is deliberate. coach.js and nutrition.js already dig into
// data.candidates[0].content.parts[0].text, check r.status === 429 and call r.text() on
// failures. Matching that contract means the fallback needed no changes to either caller.

const REQUEST_TIMEOUT = 20000; // a hung provider must not eat the whole serverless budget

// ---------- format translation ----------

// Gemini sends an array of parts. OpenAI wants either a plain string (text-only) or an
// array of typed blocks (when an image is involved).
export function toOpenAIContent(parts) {
  const blocks = [];
  for (const p of parts || []) {
    if (p.text) {
      blocks.push({ type: "text", text: p.text });
    } else if (p.inlineData) {
      const { mimeType = "image/jpeg", data } = p.inlineData;
      blocks.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${data}` } });
    }
  }
  const textOnly = blocks.every((b) => b.type === "text");
  return textOnly ? blocks.map((b) => b.text).join("\n") : blocks;
}

export function hasImage(parts) {
  return (parts || []).some((p) => p && p.inlineData);
}

// Wrap a successful completion so callers can treat it exactly like a Gemini response.
function asGeminiResponse(text) {
  const payload = { candidates: [{ content: { parts: [{ text }] } }] };
  const self = {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => text,
    clone: () => self,
  };
  return self;
}

// Wrap a failure the same way, keeping the real status so the 429 branches still fire.
function asFailure(status, raw) {
  const self = {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => raw,
    clone: () => self,
  };
  return self;
}

// ---------- the call ----------

// Sends one request to one OpenAI-compatible model. Returns a Gemini-shaped object either way.
export async function callOpenAICompat({ url, key, model, parts, temperature, maxOutputTokens, headers = {} }) {
  const body = {
    model,
    messages: [{ role: "user", content: toOpenAIContent(parts) }],
    temperature,
    max_tokens: maxOutputTokens,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);

  let r;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key, ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    // Abort and network errors are both "try the next one", so 503 rather than a hard error.
    return asFailure(503, String(e).slice(0, 200));
  }
  clearTimeout(timer);

  if (!r.ok) {
    const raw = await r.text().catch(() => "");
    return asFailure(r.status, raw.slice(0, 400));
  }

  let j;
  try { j = await r.json(); } catch { return asFailure(502, "Bad JSON from provider"); }

  const msg = j?.choices?.[0]?.message || {};
  // Some reasoning models put their scratchpad in a separate field, but a few inline it
  // as <think>…</think> inside content. Strip it so JSON parsing downstream sees the
  // answer and not the thinking — the same class of bug that broke nutrition.js.
  const text = String(msg.content || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (!text) return asFailure(502, "Empty completion");
  return asGeminiResponse(text);
}
