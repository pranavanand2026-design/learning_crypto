/** Large selectable tiles: the app's replacement for dropdowns. */
export function Tiles({ options, value, onChange, label, columns = "grid-cols-2 sm:grid-cols-4", size = "md" }) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2 ${columns}`}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`rounded-sheet border text-left transition-colors duration-150 ${
              size === "lg" ? "px-4 py-4" : "px-3.5 py-3"
            } ${selected ? "border-accent bg-marker text-on-marker" : "border-rule bg-sheet hover:border-ink/40"}`}
          >
            <span className={`block font-medium ${size === "lg" ? "text-lg" : ""}`}>{o.label}</span>
            {o.hint && <span className={`mt-0.5 block text-xs ${selected ? "text-on-marker/70" : "text-graphite"}`}>{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Compact pill choices for inline decisions. */
export function Pills({ options, value, onChange, label, allowNone = false }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="chip !px-3.5 !py-1.5 !text-sm"
          onClick={() => onChange(allowNone && value === o.value ? null : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Thin step indicator for multi-step flows. */
export function Steps({ count, current }) {
  return (
    <div className="flex gap-1.5" aria-label={`Step ${current + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= current ? "bg-ink" : "bg-rule"}`}
        />
      ))}
    </div>
  );
}
