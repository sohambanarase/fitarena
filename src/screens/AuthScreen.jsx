import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

// Supabase's default email template only contains the sign-in link — it has no
// {{ .Token }}, and free projects can't edit templates without custom SMTP. So we
// ask for a link, not a code. If you ever set up SMTP and add the token to the
// Magic Link template, flip this to true and the 6-digit code step comes back.
const EMAIL_CODES = false;

export default function AuthScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup | email (code or link)
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState(null);   // email we've sent a code to
  const [cooldown, setCooldown] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    setBusy(true); setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      if (error) throw error;
      setSentTo(email.trim()); setCode(""); setCooldown(45);
      setMsg({ ok: true, text: EMAIL_CODES
        ? "Sent. Enter the code from the email, or just tap the link in it."
        : "Check your email and tap the sign-in link. It works on this device or any other." });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  }

  async function verifyCode() {
    setBusy(true); setMsg(null);
    try {
      const token = code.replace(/[^0-9]/g, "");
      const { error } = await supabase.auth.verifyOtp({ email: sentTo, token, type: "email" });
      if (error) throw error;   // signed in — AuthContext takes over from here
    } catch (e) {
      setMsg({ ok: false, text: /expired|invalid/i.test(e.message) ? "That code didn't work. Codes expire after an hour — send a fresh one." : e.message });
    } finally { setBusy(false); }
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "email") {
        await sendCode();
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
        <img src="/icons/logo.png" alt="" width="112" height="112" className="mx-auto mb-3 h-28 w-28 object-contain drop-shadow-[0_8px_24px_rgba(150,90,190,0.35)]" />
        <p className="eyebrow text-gold">2-month transformation</p>
        <h1 className="font-display text-6xl uppercase leading-none tracking-wide">
          Fit<span className="text-gold">Arena</span>
        </h1>
        <p className="mt-2 text-sm text-muted">Show up. Out-train your friends.</p>
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
        {mode !== "email" && (
          <input
            className="w-full rounded-xl bg-surface2 px-4 py-3 outline-none placeholder:text-muted"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        )}

        {EMAIL_CODES && mode === "email" && sentTo && (
          <>
            <input
              className="w-full rounded-xl bg-surface2 px-4 py-3 text-center font-score text-2xl tracking-[0.4em] outline-none placeholder:tracking-normal placeholder:text-muted"
              placeholder="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && code.length >= 6 && verifyCode()}
            />
            <p className="text-center text-[11px] text-muted">Sent to {sentTo}. The email also has a link if you'd rather tap that.</p>
          </>
        )}

        {msg && (
          <p className={`text-sm ${msg.ok ? "text-mint" : "text-ember"}`}>{msg.text}</p>
        )}

        {mode === "email" && sentTo ? (
          <>
            {EMAIL_CODES && (
              <button className="btn-primary w-full" onClick={verifyCode} disabled={busy || code.length < 6}>
                {busy ? "…" : "Verify code"}
              </button>
            )}
            <div className="flex justify-center gap-4 text-[12px] text-muted">
              <button disabled={busy || cooldown > 0} onClick={sendCode} className="disabled:opacity-50">
                {cooldown > 0 ? `Resend in ${cooldown}s` : (EMAIL_CODES ? "Resend code" : "Resend link")}
              </button>
              <span>·</span>
              <button onClick={() => { setSentTo(null); setCode(""); setMsg(null); }}>Use another email</button>
            </div>
          </>
        ) : (
          <button className="btn-primary w-full" onClick={submit} disabled={busy || !email}>
            {busy ? "…" : mode === "signup" ? "Create account" : mode === "email" ? (EMAIL_CODES ? "Email me a code" : "Send sign-in link") : "Sign in"}
          </button>
        )}
      </div>

      <div className="mt-4 flex justify-center gap-4 text-sm text-muted">
        <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setSentTo(null); setMsg(null); }}>
          {mode === "signin" ? "Need an account?" : "Have an account?"}
        </button>
        <span>·</span>
        {mode === "email" ? (
          <button onClick={() => { setMode("signin"); setSentTo(null); setMsg(null); }}>Use a password</button>
        ) : (
          <button onClick={() => { setMode("email"); setMsg(null); }}>{EMAIL_CODES ? "Email me a code" : "Email me a link"}</button>
        )}
      </div>
    </div>
  );
}
