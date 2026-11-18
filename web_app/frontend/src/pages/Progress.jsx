import { Link } from "react-router-dom";
import { useApi } from "../lib/hooks";
import { day, money, pct, tone } from "../lib/format";
import { Milestones, Activity } from "../components/Training";
import { Loading, Problem } from "../components/States";

function Calibration({ cal }) {
  const W = 480;
  const H = 300;
  const pad = { l: 44, r: 16, t: 20, b: 52 };
  const x = (c) => pad.l + ((c - 45) / 50) * (W - pad.l - pad.r);
  const y = (h) => pad.t + (1 - h / 100) * (H - pad.t - pad.b);
  const points = cal.buckets.filter((b) => b.calls > 0);
  const top = [...points].sort((a, b) => b.calls - a.calls)[0];

  let headline;
  if (cal.resolved >= 3 && top) {
    headline = `When you feel ${top.conviction}% sure, you're right ${Math.round(top.hit_rate)}% of the time.`;
  } else if (cal.pending) {
    headline = `${cal.pending} call${cal.pending > 1 ? "s" : ""} in progress. The next one is checked ${day(cal.next_resolves_at)}.`;
  } else {
    headline = "Make a few calls to see how well your confidence matches what happens.";
  }

  return (
    <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
      <div className="max-w-md">
        <h2 className="text-sm text-graphite">Confidence</h2>
        <p className="mt-2 text-xl font-light leading-snug tracking-tight">{headline}</p>
        {cal.gap !== null && cal.resolved >= 3 && (
          <p className="mt-3 text-graphite">
            {Math.abs(cal.gap) < 8
              ? "Your confidence is well matched to your results."
              : cal.gap > 0
                ? `On average you're ${Math.round(cal.gap)} points more confident than your results support.`
                : `You're right more often than you expect, by ${Math.round(-cal.gap)} points.`}
          </p>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[520px] justify-self-end text-graphite" role="img" aria-label="Confidence versus results">
        {[0, 25, 50, 75, 100].map((h) => (
          <g key={h}>
            <line x1={pad.l} x2={W - pad.r} y1={y(h)} y2={y(h)} className="stroke-rule" />
            <text x={pad.l - 8} y={y(h) + 4} textAnchor="end" className="fill-current text-[11px]">
              {h}%
            </text>
          </g>
        ))}
        {[50, 60, 70, 80, 90].map((c) => (
          <text key={c} x={x(c)} y={H - pad.b + 20} textAnchor="middle" className="fill-current text-[11px]">
            {c}%
          </text>
        ))}
        <line x1={x(45)} y1={y(45)} x2={x(95)} y2={y(95)} className="stroke-ink/40" strokeDasharray="4 4" />
        <text x={x(93)} y={y(95) - 6} textAnchor="end" className="fill-current text-[11px]">
          Perfectly matched
        </text>
        {points.length === 0 &&
          [50, 60, 70, 80, 90].map((c) => (
            <circle key={c} cx={x(c)} cy={y(c)} r="9" className="fill-none stroke-graphite/40" strokeDasharray="3 3" />
          ))}
        {points.map((b) => (
          <g key={b.conviction}>
            <line x1={x(b.conviction)} x2={x(b.conviction)} y1={y(b.conviction)} y2={y(b.hit_rate)} className="stroke-loss/50" />
            <circle cx={x(b.conviction)} cy={y(b.hit_rate)} r={5 + Math.min(b.calls, 10)} className="fill-marker stroke-ink" strokeWidth="1.5" />
          </g>
        ))}
        <text x={(W + pad.l) / 2} y={H - 6} textAnchor="middle" className="fill-current text-[12px]">
          How sure you said you were
        </text>
      </svg>
    </section>
  );
}

function Locked({ title, unlock }) {
  return (
    <section className="rounded-sheet border border-dashed border-rule px-5 py-6">
      <h2 className="text-sm text-graphite">{title}</h2>
      <p className="mt-2 text-graphite">{unlock}</p>
    </section>
  );
}

function Compare({ title, sentence, rows, unlock }) {
  // A comparison needs both sides; until then, say what unlocks it.
  if (unlock && rows.some((r) => !r.n || r.value === null)) return <Locked title={title} unlock={unlock} />;
  const vals = rows.map((r) => Math.abs(r.value ?? 0));
  const max = Math.max(...vals, 1);
  return (
    <section>
      <h2 className="text-sm text-graphite">{title}</h2>
      <p className="mt-2 max-w-md text-md leading-snug">{sentence}</p>
      <div className="mt-5 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[9rem_1fr_4.5rem] items-center gap-3 text-sm">
            <span className="text-graphite">
              {r.label} <span className="num text-xs">({r.n})</span>
            </span>
            <span className="relative block h-2">
              <span className="absolute inset-y-0 left-1/2 w-px bg-rule" />
              {r.value !== null && (
                <span
                  className={`absolute inset-y-0 rounded-full ${r.value >= 0 ? "left-1/2 bg-gain" : "right-1/2 bg-loss"}`}
                  style={{ width: `${(Math.abs(r.value) / max) * 50}%` }}
                />
              )}
            </span>
            <span className={`num text-right ${tone(r.value)}`}>{r.value === null ? "–" : pct(r.value)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Figure({ label, value, hint }) {
  return (
    <div>
      <div className="text-sm text-graphite">{label}</div>
      <div className="num mt-1 text-2xl font-light tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-graphite">{hint}</div>}
    </div>
  );
}

export default function Progress() {
  const { data, error, loading, reload } = useApi("/progress/");
  if (loading && !data) return <Loading />;
  if (error && !data) return <Problem error={error} onRetry={reload} />;

  if (!data.trades) {
    return (
      <div className="max-w-xl py-10">
        <h1 className="text-2xl font-light tracking-tight">Progress</h1>
        <p className="mt-4 text-md text-graphite">
          This fills in as you trade: how well your confidence holds up, how you do when markets run hot, and what your habits cost.
        </p>
        <Link to="/" className="btn-ink mt-8">
          Go to the market
        </Link>
      </div>
    );
  }

  const { closed, costs, heat, after_loss: afterLoss, plan, mood } = data;
  const heatSentence =
    heat.hot_buys && heat.calm_buys && heat.hot_return !== null && heat.calm_return !== null
      ? heat.hot_return < heat.calm_return
        ? "Your buys into hot markets have done worse than your calmer picks."
        : "So far your buys into hot markets have held up better than calm ones."
      : "Compare how you do buying into hype against calmer markets.";
  const lossSentence =
    afterLoss.buys > 0
      ? `${afterLoss.buys} of your buys came within 30 minutes of a losing exit.`
      : "You haven't jumped straight back in after a loss.";

  return (
    <div className="space-y-16">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-light tracking-tight">Progress</h1>
        <span className="text-sm text-graphite">
          {data.trades} trade{data.trades === 1 ? "" : "s"} over {data.active_days} day{data.active_days === 1 ? "" : "s"}
        </span>
      </div>

      <Milestones data={data} />

      <Calibration cal={data.calibration} />

      <Activity daily={data.daily} cap={data.max_trades_per_day} />

      <section className="grid grid-cols-2 gap-x-8 gap-y-10 border-y border-rule py-10 md:grid-cols-4">
        <Figure
          label="Winning exits"
          value={closed.win_rate === null ? "–" : pct(closed.win_rate, { sign: false, digits: 0 })}
          hint={closed.wins + closed.losses ? `${closed.wins} of ${closed.wins + closed.losses}` : "After your first sale"}
        />
        <Figure
          label="Average win"
          value={closed.avg_win === null ? "–" : money(closed.avg_win, { digits: 2 })}
          hint={closed.avg_loss !== null ? `Average loss ${money(closed.avg_loss, { digits: 2 })}` : null}
        />
        <Figure label="Trades per active day" value={data.trades_per_active_day} />
        <Figure label="Paid in costs" value={money(costs.fees + costs.slippage, { digits: 2 })} hint={`${money(costs.fees, { digits: 2 })} fees, ${money(costs.slippage, { digits: 2 })} slippage`} />
      </section>

      <div className="grid gap-16 lg:grid-cols-2">
        <Compare
          title="Hype"
          unlock="Unlocks once you've bought into both hot and calm markets."
          sentence={heatSentence}
          rows={[
            { label: "Into the heat", n: heat.hot_buys, value: heat.hot_return },
            { label: "Calm markets", n: heat.calm_buys, value: heat.calm_return },
          ]}
        />
        <Compare
          title="After a loss"
          unlock="Unlocks after your first losing exit."
          sentence={lossSentence}
          rows={[
            { label: "Right after", n: afterLoss.buys, value: afterLoss.return },
            { label: "Every other buy", n: data.buys - afterLoss.buys, value: afterLoss.others_return },
          ]}
        />
        {mood.length > 0 ? (
          <Compare
            title="Mood"
            sentence="How your buys have done, by how you felt when you placed them."
            rows={mood.map((m) => ({ label: m.mood[0].toUpperCase() + m.mood.slice(1), n: m.buys, value: m.return }))}
          />
        ) : (
          <Locked title="Mood" unlock="Note how you feel when you buy, and this shows which moods serve you." />
        )}
        <section>
          <h2 className="text-sm text-graphite">Exit plans</h2>
          <p className="mt-2 max-w-md text-md leading-snug">
            {plan.stop_rate === null
              ? "Set a stop when you buy to see how well you stick to it."
              : `You set a stop on ${Math.round(plan.stop_rate)}% of your buys.`}
          </p>
          {plan.stop_breaches > 0 && (
            <p className="mt-3 text-graphite">
              {plan.stop_breaches} exit{plan.stop_breaches > 1 ? "s" : ""} came well below the stop you planned.
            </p>
          )}
        </section>
      </div>
      <p className="text-sm text-graphite">
        Returns use each buy's price when its call was checked, or today's price if it's still open.
      </p>
    </div>
  );
}
