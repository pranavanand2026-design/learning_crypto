const LABEL = { quiet: "Quiet", warm: "Warm", hot: "Hot" };
// The thermometer reads cool to hot along its length, whatever the level.
const tickColor = (i, ticks) => (i / ticks < 0.35 ? "bg-graphite/70" : i / ticks < 0.65 ? "bg-marker" : "bg-loss");

/** A thermometer of twenty ticks; how far a coin runs ahead of its normal. */
export function HeatMeter({ heat, ticks = 20, showLabel = true, size = "sm", empty = "bg-rule" }) {
  if (!heat) return null;
  const filled = Math.round((heat.score / 100) * ticks);
  const h = size === "lg" ? "h-5" : "h-3";
  return (
    <span className="inline-flex items-center gap-2" title={`Heat ${heat.score} of 100`}>
      <span className={`flex ${h} items-end gap-[2px]`} aria-hidden>
        {Array.from({ length: ticks }, (_, i) => (
          <span
            key={i}
            className={`w-[3px] rounded-full ${i < filled ? tickColor(i, ticks) : empty}`}
            style={{ height: `${45 + (i / ticks) * 55}%` }}
          />
        ))}
      </span>
      {showLabel && (
        <span className={`text-xs ${heat.level === "hot" ? "font-medium text-loss" : "text-graphite"}`}>
          {LABEL[heat.level]}
          <span className="sr-only">, heat {heat.score} of 100</span>
        </span>
      )}
    </span>
  );
}
