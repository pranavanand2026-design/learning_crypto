import { useId } from "react";

/**
 * A stepped slider over a list of stops (which needn't be evenly spaced).
 * Shows the current value in words above the track and a few anchor labels below.
 */
export default function Slider({ stops, value, onChange, format, anchors = [], label, describe }) {
  const id = useId();
  const index = Math.max(0, stops.findIndex((s) => s === value));
  const pct = (index / (stops.length - 1)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <output htmlFor={id} className="num text-2xl font-light tracking-tight">
          {format(value)}
        </output>
        {describe && <span className="text-sm text-graphite">{describe(value)}</span>}
      </div>
      <div className="relative mt-3 h-6">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-rule" />
        <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ink" style={{ width: `${pct}%` }} />
        <input
          id={id}
          type="range"
          min={0}
          max={stops.length - 1}
          step={1}
          value={index}
          aria-label={label}
          aria-valuetext={format(value)}
          onChange={(e) => onChange(stops[Number(e.target.value)])}
          className="slider absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
        />
      </div>
      {anchors.length > 0 && (
        <div className="relative mt-1 h-4 text-[11px] text-graphite">
          {anchors.map((a) => {
            const i = stops.findIndex((s) => s === a.value);
            const left = (i / (stops.length - 1)) * 100;
            return (
              <button
                key={a.label}
                type="button"
                onClick={() => onChange(a.value)}
                className="absolute -translate-x-1/2 whitespace-nowrap hover:text-ink"
                style={{ left: `clamp(1.5rem, ${left}%, calc(100% - 1.5rem))` }}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
