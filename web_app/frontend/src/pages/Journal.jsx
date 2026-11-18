import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { day, money, qty, time } from "../lib/format";
import { Loading, Problem } from "../components/States";
import Tour from "../components/Tour";
import { horizonPhrase } from "../lib/plan";

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

function NoteComposer({ trade, onNote, tour }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const area = useRef(null);

  useEffect(() => {
    if (open) area.current?.focus();
  }, [open]);

  async function save() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      onNote(await api(`/journal/${trade.id}/notes/`, { method: "POST", body: { text: text.trim() } }));
      setText("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        data-tour={tour ? "note" : undefined}
        onClick={() => setOpen(true)}
        className="group inline-flex h-8 items-center gap-2 font-sans text-sm text-graphite hover:text-ink"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
        </svg>
        <span className="underline decoration-transparent underline-offset-4 group-hover:decoration-marker">Add a note</span>
      </button>
    );
  }

  return (
    <div className="border-l-2 border-marker pl-3">
      <textarea
        ref={area}
        rows={2}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Looking back…"
        aria-label={`Note on ${trade.name}`}
        className="block w-full resize-none bg-transparent font-serif text-md leading-8 outline-none placeholder:italic placeholder:text-graphite/60"
      />
      <div className="flex h-8 items-center gap-3 font-sans text-sm">
        <button onClick={save} disabled={!text.trim() || busy} className="btn-ink !px-4 !py-1.5 !text-xs">
          {busy ? "Saving…" : "Save note"}
        </button>
        <button onClick={() => setOpen(false)} className="text-graphite hover:text-ink">
          Cancel
        </button>
        <span className="ml-auto hidden text-xs text-graphite sm:inline">Ctrl or ⌘ + Enter to save</span>
      </div>
    </div>
  );
}

function Entry({ t, onNote, first }) {
  const bought = t.side === "buy";
  const context = [];
  if (t.mood) context.push(`I was feeling ${t.mood}.`);
  if (t.heat !== null && t.heat >= 65) context.push(`${t.name} was running hot.`);
  if (t.minutes_since_loss !== null && t.minutes_since_loss <= 30) context.push(`This came ${t.minutes_since_loss} minutes after a losing sale.`);

  return (
    <article className="relative grid grid-cols-[4.5rem_1fr] gap-x-6 pt-8 sm:grid-cols-[6rem_1fr]">
      <div className="text-right">
        <time className="num block text-xs leading-8 text-graphite" dateTime={t.created_at}>
          {time(t.created_at)}
        </time>
        <div className="mt-1">
          <Verdict t={t} />
        </div>
      </div>
      <div className="min-w-0 font-serif text-md leading-8">
        <p>
          {bought ? "Bought" : "Sold"} <span className="num">{qty(t.quantity)}</span>{" "}
          <Link to={`/coin/${t.coin_id}`} className="underline decoration-marker decoration-2 underline-offset-4">
            {t.name}
          </Link>{" "}
          at <span className="num">{money(t.price)}</span>
          {t.realized_pnl !== null && (
            <>
              {" "}for <span className={`num ${t.realized_pnl >= 0 ? "text-gain" : "text-loss"}`}>{t.realized_pnl >= 0 ? "a gain" : "a loss"} of {money(Math.abs(t.realized_pnl), { digits: 2 })}</span>
            </>
          )}
          .
          {bought && t.conviction ? ` I was ${t.conviction}% sure it would rise ${horizonPhrase(t.horizon_days)}` : ""}
          {bought && t.conviction && t.target_pct ? `, by about ${Math.round(t.target_pct)}%.` : bought && t.conviction ? "." : ""}
        </p>
        {t.thesis && <p className="italic">“{t.thesis}”</p>}
        {context.length > 0 && <p className="text-graphite">{context.join(" ")}</p>}
        {t.outcome_correct !== null && t.outcome_price && (
          <p className="text-graphite">When checked, it was at {money(t.outcome_price)}.</p>
        )}

        {t.notes.map((n) => (
          <p key={n.created_at} className="border-l-2 border-marker pl-3">
            {n.text}
            <span className="ml-2 font-sans text-xs text-graphite">{day(n.created_at)}</span>
          </p>
        ))}

        <NoteComposer trade={t} onNote={onNote} tour={first} />
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
      <Tour id="journal" ready={Boolean(journal.data)} />
      {/* The page: ruled lines and a margin, like a trading notebook */}
      <div
        data-tour="page"
        className="relative overflow-hidden rounded-[4px_18px_18px_4px] bg-sheet px-5 pb-16 pt-8 shadow-[0_1px_0_rgb(var(--rule)),0_24px_48px_-24px_rgb(var(--ink)/0.25)] sm:px-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0, transparent calc(2rem - 1px), rgb(var(--rule) / 0.7) calc(2rem - 1px), rgb(var(--rule) / 0.7) 2rem)",
        }}
      >
        <span className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-ink/10 to-transparent" aria-hidden />
        <span className="absolute inset-y-0 left-[6.5rem] w-px bg-loss/40 sm:left-[9.25rem]" aria-hidden />
        <header className="pl-[6rem] sm:pl-[7.5rem]">
          <h1 className="font-serif text-3xl italic leading-[4rem] tracking-tight">My trading journal</h1>
          <p className="text-sm leading-8 text-graphite">
            {all.length ? `${all.length} entr${all.length === 1 ? "y" : "ies"}` : ""}
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
            <section key={g.day} className="mt-8">
              <h2 className="pl-[6rem] font-serif text-lg font-medium leading-8 sm:pl-[7.5rem]">{g.day}</h2>
              {g.trades.map((t) => (
                <Entry key={t.id} t={t} onNote={replace} first={t.id === all[0]?.id} />
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
