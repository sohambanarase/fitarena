import { useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function AuthScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup | magic
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) throw error;
        setMsg({ ok: true, text: "Check your email for the magic link." });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        setMsg({ ok: true, text: "Account created. You're in." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="phone justify-center px-6">
      <div className="mb-8 text-center">
        <p className="eyebrow text-gold">2-month transformation</p>
        <h1 className="font-display text-6xl uppercase leading-none tracking-wide">
          Fit<span className="text-gold">Arena</span>
        </h1>
        <p className="mt-2 text-sm text-muted">Show up. Out-train your friends. Ends Aug 31.</p>
      </div>

      <div className="card space-y-3">
        {mode === "signup" && (
          <input
            className="w-full rounded-xl bg-surface2 px-4 py-3 outline-none placeholder:text-muted"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          className="w-full rounded-xl bg-surface2 px-4 py-3 outline-none placeholder:text-muted"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {mode !== "magic" && (
          <input
            className="w-full rounded-xl bg-surface2 px-4 py-3 outline-none placeholder:text-muted"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        )}

        {msg && (
          <p className={`text-sm ${msg.ok ? "text-mint" : "text-ember"}`}>{msg.text}</p>
        )}

        <button className="btn-primary w-full" onClick={submit} disabled={busy || !email}>
          {busy ? "…" : mode === "signup" ? "Create account" : mode === "magic" ? "Send magic link" : "Sign in"}
        </button>
      </div>

      <div className="mt-4 flex justify-center gap-4 text-sm text-muted">
        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Need an account?" : "Have an account?"}
        </button>
        <span>·</span>
        <button onClick={() => setMode("magic")}>Magic link</button>
      </div>
    </div>
  );
}
