import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadExercises, imageUrl, imageFallback, facets, filterExercises } from "../lib/exercises.js";
import Loader from "../components/Loader.jsx";
import { Search, X } from "lucide-react";
import ScreenHeader from "../components/ScreenHeader.jsx";
import Sheet from "../components/Sheet.jsx";
import ExerciseInfoSheet from "../components/ExerciseInfoSheet.jsx";

export default function Playbook() {
  const navigate = useNavigate();
  const [all, setAll] = useState(null);
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState(null);
  const [limit, setLimit] = useState(30);

  useEffect(() => { loadExercises().then(setAll); }, []);

  const f = useMemo(() => {
    if (!all) return { muscle: [], equipment: [], category: [] };
    const uniq = (list, k) => [...new Set(list.map((e) => e[k]).filter(Boolean))].sort();
    // Each facet's options reflect the OTHER active filters + search, so you never
    // get a dead-end empty combination. The currently selected value is always kept.
    return {
      muscle: uniq(filterExercises(all, { q, equipment, category }), "muscle"),
      equipment: uniq(filterExercises(all, { q, muscle, category }), "equipment"),
      category: uniq(filterExercises(all, { q, muscle, equipment }), "category"),
    };
  }, [all, q, muscle, equipment, category]);
  const results = useMemo(
    () => (all ? filterExercises(all, { q, muscle, equipment, category }) : []),
    [all, q, muscle, equipment, category]
  );
  useEffect(() => setLimit(30), [q, muscle, equipment, category]);

  if (!all) return <div className="screen"><Loader label="Opening the playbook…" /></div>;

  return (
    <div className="screen animate-screen space-y-3">
      <ScreenHeader eyebrow={all.length + " moves"} title="The Playbook" />

      <div className="search-glass sticky top-1 z-30">
        <Search size={18} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises"
          className="w-full bg-transparent outline-none placeholder:text-muted" />
        {q && <button onClick={() => setQ("")}><X size={16} className="text-muted" /></button>}
      </div>

      <FilterRow label="Muscle" value={muscle} set={setMuscle} options={f.muscle} />
      <FilterRow label="Gear" value={equipment} set={setEquipment} options={f.equipment} />
      <FilterRow label="Type" value={category} set={setCategory} options={f.category} />

      <p className="text-xs text-muted">{results.length} results</p>

      <div className="grid grid-cols-2 gap-2">
        {results.slice(0, limit).map((e) => <Card key={e.id} ex={e} onClick={() => setOpen(e)} />)}
      </div>

      {results.length > limit && (
        <button className="btn-primary w-full" onClick={() => setLimit((l) => l + 30)}>Load more</button>
      )}

      {open && <ExerciseInfoSheet onLog={(e) => navigate("/grind", { state: { logExercise: e.name } })} ex={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function FilterRow({ label, value, set, options }) {
  // ensure the active selection is always present so the user can turn it off
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <span className="self-center text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <button className={"pill " + (value === "" ? "pill-on" : "")} onClick={() => set("")}>All</button>
      {opts.map((o) => (
        <button key={o} className={"pill capitalize " + (value === o ? "pill-on" : "")} onClick={() => set(o)}>{o}</button>
      ))}
    </div>
  );
}

// <img> that tries the CDN, then the raw GitHub url, then a lettered placeholder.
function ExImg({ path, name, className }) {
  const [stage, setStage] = useState(0); // 0=cdn 1=raw 2=placeholder
  const src = stage === 0 ? imageUrl(path) : stage === 1 ? imageFallback(path) : null;
  if (!path || stage === 2)
    return <div className={"grid place-items-center bg-surface2 text-3xl font-display text-line " + className}>{name?.[0]?.toUpperCase()}</div>;
  return <img src={src} alt={name} loading="lazy" onError={() => setStage((s) => s + 1)} className={className} />;
}

function Card({ ex, onClick }) {
  return (
    <button onClick={onClick} className="overflow-hidden rounded-2xl border border-line bg-surface text-left transition active:scale-[.98]">
      <ExImg path={ex.images[0]} name={ex.name} className="aspect-square h-auto w-full object-cover" />
      <div className="p-2">
        <p className="truncate text-sm font-bold capitalize">{ex.name}</p>
        <p className="truncate text-[11px] capitalize text-muted">{ex.muscle} · {ex.equipment}</p>
      </div>
    </button>
  );
}

function Detail({ ex, onClose }) {
  return (
    <Sheet title={ex.name} onClose={onClose}>
      <div className={"mb-3 grid gap-2 " + (ex.images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {(ex.images.length ? ex.images : [null]).map((p, i) => (
            <ExImg key={i} path={p} name={ex.name} className="aspect-square h-auto w-full rounded-2xl object-cover" />
          ))}
        </div>

        <div className="mb-3 flex flex-wrap gap-2 capitalize">
          {[ex.muscle, ex.category, ex.equipment, ex.level].filter(Boolean).map((t) => (
            <span key={t} className="pill pill-on">{t}</span>
          ))}
        </div>
        {ex.secondary?.length > 0 && (
          <p className="mb-3 text-sm capitalize text-muted">Also works: {ex.secondary.join(", ")}</p>
        )}
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
        {ex.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </Sheet>
  );
}
