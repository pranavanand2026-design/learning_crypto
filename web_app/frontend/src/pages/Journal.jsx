import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { money, qty } from "../lib/format";
import CoinMark from "../components/CoinMark";
import { Empty, Loading, Problem } from "../components/States";

const FILTERS = [
  { id: "all", label: "Everything", fn: () => true },
  { id: "buy", label: "Buys", fn: (t) => t.side === "buy" },
  { id: "sell", label: "Sells", fn: (t) => t.side === "sell" },
  { id: "open", label: "Calls in progress", fn: (t) => t.resolves_at && t.outcome_correct === null },
];

function Outcome({ t }) {
  if (t.side !== "buy" || !t.resolves_at) return null;
  if (t.outcome_correct === null) {
    return (
      <span className="text-graphite">
        Checks on {new Date(t.resolves_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </span>
    );
  }
  return (
    <span className={t.outcome_correct ? "text-gain" : "text-loss"}>
      {t.outcome_correct ? "Called it" : "Missed"}: {money(t.outcome_price)} after {t.horizon_days === 1 ? "a day" : t.horizon_days === 7 ? "a week" : "a month"}
    </span>
  );
}

function Entry({ t, onNote }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const context = [];
  if (t.heat !== null && t.heat >= 65) context.push(`Heat was ${t.heat}`);
  if (t.minutes_since_loss !== null && t.minutes_since_loss <= 30) context.push(`${t.minutes_since_loss} min after a loss`);
  if (t.mood) context.push(`Felt ${t.mood}`);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api(`/journal/${t.id}/notes/`, { method: "POST", body: { text } });
      onNote(updated);
      setText("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid grid-cols-[2rem_1fr] gap-x-4 py-6 sm:grid-cols-[4.5rem_2rem_1fr]">
      <time className="num hidden pt-1 text-xs text-graphite sm:block" dateTime={t.created_at}>
        {new Date(t.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
      </time>
      <CoinMark src={t.image} symbol={t.symbol} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p>
            <span className={t.side === "buy" ? "" : "text-graphite"}>{t.side === "buy" ? "Bought" : "Sold"}</span>{" "}
            <span className="num">{qty(t.quantity)}</span>{" "}
            <Link to={`/coin/${t.coin_id}`} className="link">
              {t.symbol}
            </Link>{" "}
            at <span className="num">{money(t.price)}</span>
            {t.realized_pnl !== null && (
              <span className={`num ml-2 ${t.realized_pnl >= 0 ? "text-gain" : "text-loss"}`}>
                {money(t.realized_pnl, { sign: true, digits: 2 })}
              </span>
            )}
          </p>
          {t.conviction && (
            <span className="text-sm text-graphite">
              {t.conviction}% sure, {t.horizon_days === 1 ? "1 day" : t.horizon_days === 7 ? "1 week" : "1 month"}
            </span>
          )}
        </div>

        {t.thesis && <blockquote className="mt-2 max-w-2xl font-serif text-md italic leading-snug">“{t.thesis}”</blockquote>}

        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Outcome t={t} />
          {context.map((c) => (
            <span key={c} className="text-graphite">
              {c}
            </span>
          ))}
        </div>

        {t.notes.length > 0 && (
          <ul className="mt-3 space-y-2 border-l-2 border-marker pl-4">
            {t.notes.map((n) => (
              <li key={n.created_at} className="text-sm">
                <span className="font-serif text-base">{n.text}</span>
                <span className="ml-2 text-xs text-graphite">{new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </li>
            ))}
          </ul>
        )}

        {open ? (
          <form onSubmit={save} className="mt-3 flex max-w-2xl gap-2">
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What did you learn?"
              className="field font-serif"
            />
            <button className="btn-ink" disabled={!text.trim() || busy}>
              Add
            </button>
          </form>
        ) : (
          <button onClick={() => setOpen(true)} className="mt-3 text-sm text-graphite hover:text-ink">
            Add a note
          </button>
        )}
      </div>
    </li>
  );
}

export default function Journal() {
  const journal = useApi("/journal/");
  const [filter, setFilter] = useState("all");

  const days = useMemo(() => {
    const list = (journal.data?.results || []).filter(FILTERS.find((f) => f.id === filter).fn);
    const groups = [];
    for (const t of list) {
      const day = new Date(t.created_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
      if (groups.at(-1)?.day !== day) groups.push({ day, trades: [] });
      groups.at(-1).trades.push(t);
    }
    return groups;
  }, [journal.data, filter]);

  const replace = (updated) =>
    journal.setData({ results: journal.data.results.map((t) => (t.id === updated.id ? updated : t)) });

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-light tracking-tight">Journal</h1>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.id} role="radio" aria-checked={filter === f.id} onClick={() => setFilter(f.id)} className="chip">
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {journal.loading && !journal.data ? (
        <Loading />
      ) : journal.error ? (
        <Problem error={journal.error} onRetry={journal.reload} />
      ) : days.length === 0 ? (
        <Empty title={filter === "all" ? "Your journal is empty." : "Nothing here yet."}>
          Every trade you make lands here with the reason you gave.
        </Empty>
      ) : (
        days.map((g) => (
          <section key={g.day} className="mt-10">
            <h2 className="border-b border-ink pb-2 text-sm font-medium">{g.day}</h2>
            <ol className="ruled">
              {g.trades.map((t) => (
                <Entry key={t.id} t={t} onNote={replace} />
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
