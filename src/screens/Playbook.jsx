import { useEffect, useMemo, useState } from "react";
import { loadExercises, mediaUrl, facets, filterExercises } from "../lib/exercises.js";
import Loader from "../components/Loader.jsx";
import { Search, X } from "lucide-react";

export default function Playbook() {
  const [all, setAll] = useState(null);
  const [q, setQ] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [equipment, setEquipment] = useState("");
  const [target, setTarget] = useState("");
  const [open, setOpen] = useState(null);
  const [limit, setLimit] = useState(30); // simple "load more" so we don't render 1,300 nodes at once

  useEffect(() => {
    loadExercises().then(setAll);
  }, []);

  const f = useMemo(() => (all ? facets(all) : null), [all]);
  const results = useMemo(
    () => (all ? filterExercises(all, { q, bodyPart, equipment, target }) : []),
    [all, q, bodyPart, equipment, target]
  );

  useEffect(() => setLimit(30), [q, bodyPart, equipment, target]);

  if (!all) return <div className="screen"><Loader label="Opening the playbook…" /></div>;

  return (
    <div className="screen space-y-3">
      <header className="pt-1">
        <p className="eyebrow">{all.length} moves</p>
        <h1 className="font-display text-3xl uppercase leading-none tracking-wide">The Playbook</h1>
      </header>

      <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 border border-line">
        <Search size={18} className="text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search exercises"
          className="w-full bg-transparent outline-none placeholder:text-muted"
        />
        {q && <button onClick={() => setQ("")}><X size={16} className="text-muted" /></button>}
      </div>

      <FilterRow label="Body" value={bodyPart} set={setBodyPart} options={f.bodyPart} />
      <FilterRow label="Target" value={target} set={setTarget} options={f.target} />
      <FilterRow label="Gear" value={equipment} set={setEquipment} options={f.equipment} />

      <p className="text-xs text-muted">{results.length} results</p>

      <div className="grid grid-cols-2 gap-2">
        {results.slice(0, limit).map((e) => (
          <Card key={e.id} ex={e} onClick={() => setOpen(e)} />
        ))}
      </div>

      {results.length > limit && (
        <button className="btn-primary w-full" onClick={() => setLimit((l) => l + 30)}>
          Load more
        </button>
      )}

      {open && <Detail ex={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function FilterRow({ label, value, set, options }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <span className="self-center text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <button className={`pill ${value === "" ? "pill-on" : ""}`} onClick={() => set("")}>All</button>
      {options.map((o) => (
        <button key={o} className={`pill capitalize ${value === o ? "pill-on" : ""}`} onClick={() => set(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

function Card({ ex, onClick }) {
  const [err, setErr] = useState(false);
  const src = mediaUrl(ex.mediaId);
  return (
    <button onClick={onClick} className="overflow-hidden rounded-2xl border border-line bg-surface text-left active:scale-[.98] transition">
      <div className="aspect-square bg-surface2">
        {src && !err ? (
          <img src={src} alt={ex.name} loading="lazy" onError={() => setErr(true)} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-3xl font-display text-line">{ex.name[0]?.toUpperCase()}</div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-sm font-bold capitalize">{ex.name}</p>
        <p className="truncate text-[11px] capitalize text-muted">{ex.target} · {ex.equipment}</p>
      </div>
    </button>
  );
}

function Detail({ ex, onClose }) {
  const [err, setErr] = useState(false);
  const src = mediaUrl(ex.mediaId);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="max-h-[88%] w-full max-w-[440px] overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 pb-10 animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl uppercase leading-tight tracking-wide">{ex.name}</h2>
          <button onClick={onClose} className="text-muted"><X size={22} /></button>
        </div>
        <div className="mb-3 aspect-square overflow-hidden rounded-2xl bg-surface2">
          {src && !err ? (
            <img src={src} alt={ex.name} onError={() => setErr(true)} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-muted">No preview</div>
          )}
        </div>
        <div className="mb-3 flex flex-wrap gap-2 capitalize">
          {[ex.bodyPart, ex.target, ex.equipment].filter(Boolean).map((t) => (
            <span key={t} className="pill pill-on">{t}</span>
          ))}
        </div>
        {ex.secondary?.length > 0 && (
          <p className="mb-3 text-sm text-muted capitalize">Also works: {ex.secondary.join(", ")}</p>
        )}
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          {ex.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </div>
    </div>
  );
}
