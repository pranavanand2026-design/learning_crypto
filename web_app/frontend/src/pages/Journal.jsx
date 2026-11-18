import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { day, money, qty, time } from "../lib/format";
import { Loading, Problem } from "../components/States";

const HORIZON = { 1: "by the next day", 7: "within a week", 30: "within a month" };
const PAGE = 12;

/** A rubber stamp in the margin: how the call turned out. */
function Verdict({ t }) {
  if (t.side !== "buy" || !t.resolves_at) return null;
  const pending = t.outcome_correct === null;
  const label = pending ? day(t.resolves_at) : t.outcome_correct ? "Called it" : "Missed";
  const cls = pending ? "border-graphite/50 text-graphite" : t.outcome_correct ? "border-gain text-gain" : "border-loss text-loss";
  return (
    <span title={pending ? "When this call is checked" : undefined} className={`inline-block -rotate-3 whitespace-nowrap rounded-[6px] border-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

function Entry({ t, onNote }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bought = t.side === "buy";

  const asides = [];
  if (t.heat !== null && t.heat >= 65) asides.push(`the market was running hot (heat ${t.heat})`);
  if (t.minutes_since_loss !== null && t.minutes_since_loss <= 30) asides.push(`${t.minutes_since_loss} minutes after a loss`);
  if (t.mood) asides.push(`feeling ${t.mood}`);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      onNote(await api(`/journal/${t.id}/notes/`, { method: "POST", body: { text } }));
      setText("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="relative grid grid-cols-[4.5rem_1fr] gap-x-6 py-6 sm:grid-cols-[6rem_1fr]">
      <div className="pt-1 text-right">
        <time className="num block text-xs text-graphite" dateTime={t.created_at}>
          {time(t.created_at)}
        </time>
        <div className="mt-3">
          <Verdict t={t} />
        </div>
      </div>
      <div className="min-w-0 font-serif text-md leading-relaxed">
        <p>
          {bought ? "Bought" : "Sold"} <span className="num font-sans text-base">{qty(t.quantity)}</span>{" "}
          <Link to={`/coin/${t.coin_id}`} className="underline decoration-marker decoration-2 underline-offset-4">
            {t.name}
          </Link>{" "}
          at <span className="num font-sans text-base">{money(t.price)}</span>
          {t.realized_pnl !== null && (
            <>
              , <span className={`num font-sans text-base ${t.realized_pnl >= 0 ? "text-gain" : "text-loss"}`}>{money(t.realized_pnl, { sign: true, digits: 2 })}</span>
            </>
          )}
          .{bought && t.conviction ? ` I was ${t.conviction}% sure it would rise ${HORIZON[t.horizon_days] || ""}.` : ""}
        </p>
        {t.thesis && <p className="mt-1 italic">“{t.thesis}”</p>}
        {asides.length > 0 && <p className="mt-1 text-base text-graphite">Placed {asides.join(", ")}.</p>}
        {t.outcome_correct !== null && t.outcome_price && (
          <p className="mt-1 text-base text-graphite">
            It was {money(t.outcome_price)} when checked.
          </p>
        )}

        {t.notes.map((n) => (
          <p key={n.created_at} className="mt-3 border-l-2 border-marker pl-3 text-base">
            {n.text}
            <span className="ml-2 font-sans text-xs text-graphite">{day(n.created_at)}</span>
          </p>
        ))}

        {open ? (
          <form onSubmit={save} className="mt-3 flex gap-2 font-sans">
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Looking back…" className="field font-serif" aria-label="Note" />
            <button className="btn-ink" disabled={!text.trim() || busy}>
              Add
            </button>
          </form>
        ) : (
          <button onClick={() => setOpen(true)} className="mt-2 font-sans text-sm text-graphite hover:text-ink">
            Add a note
          </button>
        )}
      </div>
    </article>
  );
}

export default function Journal() {
  const journal = useApi("/journal/");
  const [pages, setPages] = useState(1);

  const all = useMemo(() => journal.data?.results || [], [journal.data]);
  const days = useMemo(() => {
    const groups = [];
    for (const t of all.slice(0, pages * PAGE)) {
      const d = day(t.created_at, { weekday: "long", day: "numeric", month: "long" });
      if (groups.at(-1)?.day !== d) groups.push({ day: d, trades: [] });
      groups.at(-1).trades.push(t);
    }
    return groups;
  }, [all, pages]);

  const replace = (updated) => journal.setData({ results: all.map((t) => (t.id === updated.id ? updated : t)) });

  return (
    <div className="mx-auto max-w-3xl">
      {/* The page: ruled lines and a margin, like a trading notebook */}
      <div
        className="relative overflow-hidden rounded-[4px_18px_18px_4px] bg-sheet px-5 pb-12 pt-10 shadow-[0_1px_0_rgb(var(--rule)),0_24px_48px_-24px_rgb(var(--ink)/0.25)] sm:px-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0, transparent calc(2rem - 1px), rgb(var(--rule) / 0.7) calc(2rem - 1px), rgb(var(--rule) / 0.7) 2rem)",
        }}
      >
        <span className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-ink/10 to-transparent" aria-hidden />
        <span className="absolute inset-y-0 left-[6.5rem] w-px bg-loss/40 sm:left-[9.25rem]" aria-hidden />
        <header className="mb-8 pl-[6rem] sm:pl-[7.5rem]">
          <h1 className="font-serif text-3xl italic tracking-tight">My trading journal</h1>
          <p className="mt-1 text-sm text-graphite">
            {all.length ? `${all.length} entr${all.length === 1 ? "y" : "ies"}. Nothing here can be erased; add what you learn.` : ""}
          </p>
        </header>

        {journal.loading && !journal.data ? (
          <Loading />
        ) : journal.error ? (
          <Problem error={journal.error} onRetry={journal.reload} />
        ) : all.length === 0 ? (
          <div className="py-10 font-serif text-lg italic text-graphite pl-[6rem] sm:pl-[7.5rem]">
            The first page is blank. Every trade you make is written here with the reason you gave.
            <div className="mt-6 font-sans not-italic">
              <Link to="/" className="btn-ink">
                Find a coin
              </Link>
            </div>
          </div>
        ) : (
          days.map((g) => (
            <section key={g.day} className="mt-6">
              <h2 className="font-serif text-lg font-medium pl-[6rem] sm:pl-[7.5rem]">{g.day}</h2>
              {g.trades.map((t) => (
                <Entry key={t.id} t={t} onNote={replace} />
              ))}
            </section>
          ))
        )}

        {all.length > pages * PAGE && (
          <div className="mt-6 pl-[6rem] sm:pl-[7.5rem]">
            <button onClick={() => setPages(pages + 1)} className="btn-quiet">
              Turn the page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
