export default function Loader({ label = "Loading…" }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-muted">
      <div className="h-8 w-8 rounded-full border-2 border-line border-t-gold animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
