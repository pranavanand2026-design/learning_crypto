import { day } from "../lib/format";

const MILESTONES = [
  { id: "first", label: "First trade", goal: 1, value: (d) => d.trades },
  { id: "reasons", label: "Five reasons written", goal: 5, value: (d) => d.plan.with_thesis },
  { id: "checked", label: "First call checked", goal: 1, value: (d) => d.calibration.resolved },
  { id: "stops", label: "Five planned exits", goal: 5, value: (d) => d.plan.buys_with_stop },
  { id: "win", label: "A winning exit", goal: 1, value: (d) => d.closed.wins },
  { id: "week", label: "Seven days of practice", goal: 7, value: (d) => d.active_days },
];

function Medal({ done, progress }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden>
      <circle cx="30" cy="30" r={r} className={done ? "fill-accent" : "fill-sheet"} />
      <circle cx="30" cy="30" r={r} fill="none" className="stroke-rule" strokeWidth="3" />
      {!done && progress > 0 && (
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          className="stroke-ink"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${c * progress} ${c}`}
          transform="rotate(-90 30 30)"
        />
      )}
      {done && <path d="M20 31l7 7 13-15" fill="none" className="stroke-on-accent" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/** Small goals that mark the habits worth building. */
export function Milestones({ data }) {
  const items = MILESTONES.map((m) => {
    const v = Math.min(m.value(data) || 0, m.goal);
    return { ...m, v, done: v >= m.goal };
  });
  const done = items.filter((i) => i.done).length;
  return (
    <div>
      <p className="num text-sm text-graphite">
        {done} of {items.length} reached
      </p>
      <ul className="mt-5 grid grid-cols-3 gap-y-6 sm:grid-cols-6">
        {items.map((m) => (
          <li key={m.id} className="flex flex-col items-center text-center">
            <Medal done={m.done} progress={m.v / m.goal} />
            <span className={`mt-2 max-w-[8rem] text-xs leading-snug ${m.done ? "" : "text-graphite"}`}>{m.label}</span>
            {!m.done && m.goal > 1 && (
              <span className="num text-[11px] text-graphite">
                {m.v} of {m.goal}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Trades per day for two weeks, against the cap you set. */
export function Activity({ daily, cap }) {
  if (!daily?.length) return null;
  const max = Math.max(cap || 0, ...daily.map((d) => d.trades), 4);
  const over = daily.filter((d) => cap && d.trades > cap).length;
  return (
    <div>
      <h3 className="text-sm text-graphite">Rhythm</h3>
      <p className="mt-2 max-w-md text-md leading-snug">
        {over
          ? `You went over your daily cap on ${over} day${over > 1 ? "s" : ""} in the last two weeks.`
          : daily.some((d) => d.trades)
            ? "You've stayed within your daily cap for the last two weeks."
            : "No trades in the last two weeks yet."}
      </p>
      <div className="relative mt-6 flex h-32 items-end gap-1.5 sm:gap-2.5">
        {cap ? (
          <div className="absolute inset-x-0 border-t border-dashed border-loss/60" style={{ bottom: `${(cap / max) * 100}%` }}>
            <span className="absolute -top-5 right-0 text-[11px] text-loss">Your cap, {cap}</span>
          </div>
        ) : null}
        {daily.map((d) => (
          <div key={d.date} className="flex h-full flex-1 flex-col justify-end" title={`${day(d.date)}: ${d.trades}`}>
            <div
              className={`rounded-t-[4px] ${cap && d.trades > cap ? "bg-loss" : d.trades ? "bg-ink" : "bg-rule"}`}
              style={{ height: d.trades ? `${(d.trades / max) * 100}%` : "3px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-graphite">
        <span>{day(daily[0].date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
