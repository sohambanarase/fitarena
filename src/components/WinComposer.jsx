import { useState } from "react";
import Sheet from "./Sheet.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { postWin, uploadWinPhoto } from "../lib/achievements.js";
import { toISO } from "../lib/streak.js";
import { Image as ImageIcon } from "lucide-react";

// Post a brag (text + optional photo) or a PR (exercise + weight/reps).
export default function WinComposer({ challengeId, onClose, onPosted }) {
  const { user } = useAuth();
  const [tab, setTab] = useState("brag");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [pr, setPr] = useState({ exercise: "", weight_kg: "", reps: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      let photo_url = null;
      if (tab === "brag" && file) {
        try { photo_url = await uploadWinPhoto(user.id, file); }
        catch { setErr("Photo couldn't upload (posting without it). Did you run the v2 migration?"); }
      }
      const win =
        tab === "brag"
          ? { user_id: user.id, kind: "brag", challenge_id: challengeId, text: text.trim() || "Showed up. 💪", photo_url, log_date: toISO(new Date()) }
          : { user_id: user.id, kind: "pr", challenge_id: challengeId, exercise: pr.exercise.trim(), weight_kg: num(pr.weight_kg), reps: num(pr.reps), text: text.trim() || null, log_date: toISO(new Date()) };
      const { error } = await postWin(win);
      if (error) throw error;
      onPosted?.();
      onClose();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const canPost = tab === "brag" ? (text.trim() || file) : pr.exercise.trim() && (pr.weight_kg || pr.reps);

  return (
    <Sheet title="Post a win" onClose={onClose}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button className={`pill py-2 ${tab === "brag" ? "pill-on" : ""}`} onClick={() => setTab("brag")}>Brag</button>
        <button className={`pill py-2 ${tab === "pr" ? "pill-on" : ""}`} onClick={() => setTab("pr")}>New PR</button>
      </div>

      {tab === "brag" ? (
        <div className="space-y-3">
          <textarea
            className="min-h-[90px] w-full rounded-xl bg-surface2 px-4 py-3 outline-none placeholder:text-muted"
            placeholder="What did you crush today?"
            value={text} onChange={(e) => setText(e.target.value)}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <ImageIcon size={18} />
            {file ? file.name : "Add a photo (optional)"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <input className="inp" placeholder="Exercise (e.g. Back squat)" value={pr.exercise} onChange={(e) => setPr({ ...pr, exercise: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className="inp" inputMode="decimal" placeholder="Weight (kg)" value={pr.weight_kg} onChange={(e) => setPr({ ...pr, weight_kg: e.target.value })} />
            <input className="inp" inputMode="numeric" placeholder="Reps" value={pr.reps} onChange={(e) => setPr({ ...pr, reps: e.target.value })} />
          </div>
          <input className="inp" placeholder="Note (optional)" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      )}

      {err && <p className="mt-2 text-sm text-ember">{err}</p>}
      <button className="btn-primary mt-3 w-full" onClick={submit} disabled={busy || !canPost}>
        {busy ? "Posting…" : tab === "pr" ? "Log PR (+3)" : "Post brag (+1)"}
      </button>
      <style>{`.inp{width:100%;border-radius:.75rem;background:#272231;padding:.7rem 1rem;outline:none}`}</style>
    </Sheet>
  );
}
const num = (v) => (v === "" || v == null ? null : Number(v));
