import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { currencySymbol, day, money, pct, qty, toDisplay, toUsd, until } from "../lib/format";
import { useNow } from "../lib/hooks";
import { useAccount } from "../state/account";
import CoinMark from "./CoinMark";
import { Pills, Steps } from "./Pick";

const HORIZONS = [
  { value: 1, label: "Tomorrow" },
  { value: 7, label: "In a week" },
  { value: 30, label: "In a month" },
];
const CONVICTION = [50, 60, 70, 80, 90].map((c) => ({ value: c, label: `${c}%` }));
const STOPS = [5, 10, 20].map((s) => ({ value: s, label: `−${s}%` }));
const TARGETS = [10, 25, 50].map((t) => ({ value: t, label: `+${t}%` }));
const MOODS = ["calm", "curious", "excited", "anxious", "frustrated"].map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }));
const HOT_PAUSE_MS = 20000;

function Line({ label, children, strong }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${strong ? "font-medium" : ""}`}>
      <dt className="text-graphite">{label}</dt>
      <dd className="num text-right">{children}</dd>
    </div>
  );
}

function Section({ title, children, hint }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-md">{title}</h3>
        {hint && <p className="mt-0.5 text-sm text-graphite">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default function Ticket({ coin, initialSide = "buy", onClose, onFilled }) {
  const { data: account, reload: reloadAccount } = useAccount();
  const position = account?.positions.find((p) => p.coin_id === coin.id);
  const [side, setSide] = useState(position ? initialSide : "buy");
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState("");
  const [sellShare, setSellShare] = useState(null);
  const [thesis, setThesis] = useState("");
  const [horizon, setHorizon] = useState(7);
  const [conviction, setConviction] = useState(null);
  const [stop, setStop] = useState(null);
  const [target, setTarget] = useState(null);
  const [mood, setMood] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [filled, setFilled] = useState(null);
  const openedAt = useRef(Date.now());
  const panel = useRef(null);
  const now = useNow(500);

  const buying = side === "buy";
  const hot = buying && coin.heat?.level === "hot";
  const pauseLeft = hot ? Math.max(0, Math.ceil((openedAt.current + HOT_PAUSE_MS - now) / 1000)) : 0;
  const stepNames = buying ? ["Amount", "Reason", "Plan", "Review"] : ["Amount", "Review"];
  const last = stepNames.length - 1;

  const order = useMemo(() => {
    if (buying) {
      const n = Number(amount);
      return n > 0 ? { notional: toUsd(n).toFixed(2) } : null;
    }
    if (!position) return null;
    const q = sellShare ? position.quantity * sellShare : 0;
    return q > 0 ? { quantity: Math.min(q, position.quantity).toFixed(12) } : null;
  }, [buying, amount, sellShare, position]);

  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    if (!order) return;
    let cancelled = false;
    const get = () =>
      api("/quote/", { method: "POST", body: { coin_id: coin.id, side, ...order } })
        .then((q) => !cancelled && (setQuote(q), setQuoteError(null)))
        .catch((e) => !cancelled && setQuoteError(e.message));
    const t = setTimeout(get, 300);
    const i = setInterval(get, 8000);
    return () => {
      cancelled = true;
      clearTimeout(t);
      clearInterval(i);
    };
  }, [order, side, coin.id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    panel.current?.querySelector("[data-autofocus]")?.focus();
  }, [step, side]);

  const blocked = quote?.blocked || (buying ? account?.today?.blocked : null);
  const overSize = buying && quote?.position_pct && account?.rules?.max_position_pct && quote.position_pct > account.rules.max_position_pct;

  const stepReady = [
    Boolean(order && quote && !quoteError),
    thesis.trim().length >= 8 && Boolean(conviction),
    true,
    true,
  ];
  const nextLabel = buying
    ? [!order ? "Enter an amount" : "Next", thesis.trim().length < 8 ? "Write a sentence first" : !conviction ? "Choose how sure you are" : "Next", "Review", null][step]
    : [!order ? "Choose how much" : "Review", null][step];

  async function submit() {
    if (blocked || pauseLeft || busy) return;
    setBusy(true);
    setError(null);
    try {
      const trade = await api("/orders/", {
        method: "POST",
        body: {
          coin_id: coin.id,
          side,
          ...order,
          thesis,
          mood,
          heat: coin.heat?.score,
          ...(buying ? { conviction, horizon_days: horizon, stop_pct: stop, target_pct: target } : {}),
        },
      });
      setFilled(trade);
      reloadAccount();
      onFilled?.(trade);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const cash = toDisplay(account?.cash ?? 0);
  const horizonLabel = HORIZONS.find((h) => h.value === horizon)?.label.toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end md:items-stretch" role="dialog" aria-modal="true" aria-label={`Trade ${coin.name}`}>
      <button className="absolute inset-0 bg-ink/30" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div
        ref={panel}
        className="sheet-in relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-sheet bg-sheet shadow-[0_-12px_48px_rgb(var(--ink)/0.18)] md:max-h-none md:w-[440px] md:rounded-none md:rounded-l-sheet"
      >
        <div className="flex items-center gap-3 px-5 pb-3 pt-4">
          <CoinMark src={coin.image} symbol={coin.symbol} size={30} />
          <div className="min-w-0">
            <div className="truncate font-medium">
              {filled ? coin.name : `${buying ? "Buy" : "Sell"} ${coin.name}`}
            </div>
            <div className="num text-xs text-graphite">{money(coin.price)}</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded-full p-2 text-graphite hover:text-ink" aria-label="Close ticket">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {filled ? (
          <Filled trade={filled} onClose={onClose} />
        ) : (
          <>
            <div className="px-5 pb-4">
              <Steps count={stepNames.length} current={step} />
            </div>

            <div key={`${side}-${step}`} className="flex-1 space-y-8 overflow-y-auto px-5 pb-6 pt-2">
              {step === 0 && (
                <>
                  {position && (
                    <div className="grid grid-cols-2 rounded-chip border border-rule p-1" role="tablist" aria-label="Order side">
                      {["buy", "sell"].map((s) => (
                        <button
                          key={s}
                          type="button"
                          role="tab"
                          aria-selected={side === s}
                          onClick={() => {
                            setSide(s);
                            setAmount("");
                            setSellShare(null);
                          }}
                          className={`rounded-chip py-2 text-sm capitalize transition-colors ${side === s ? "bg-ink text-paper" : "text-graphite hover:text-ink"}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {hot && (
                    <div className="rounded-field border-l-2 border-loss bg-loss/[0.06] px-4 py-3 text-sm">
                      <p className="font-medium">{coin.name} is running hot.</p>
                      <p className="mt-1 text-graphite">{coin.heat.drivers[0]}.</p>
                    </div>
                  )}

                  {buying ? (
                    <Section title="How much?">
                      <div className="flex items-baseline gap-1 border-b border-rule pb-2 focus-within:border-ink">
                        <span className="text-2xl text-graphite">{currencySymbol()}</span>
                        <input
                          data-autofocus
                          inputMode="decimal"
                          autoComplete="off"
                          aria-label="Amount"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                          placeholder="0"
                          className="num w-full text-4xl font-light outline-none placeholder:text-rule"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <Pills
                          label="Share of cash"
                          value={null}
                          onChange={(f) => setAmount((Math.floor((cash * f) / 1.004 * 100) / 100).toString())}
                          options={[0.05, 0.1, 0.25].map((f) => ({ value: f, label: `${f * 100}%` }))}
                        />
                        <span className="num text-xs text-graphite">{money(account?.cash)} cash</span>
                      </div>
                    </Section>
                  ) : (
                    <Section title="How much will you sell?" hint={`You hold ${qty(position?.quantity)} ${coin.symbol}${position?.pnl_pct != null ? `, ${pct(position.pnl_pct)}` : ""}.`}>
                      <Pills
                        label="Share to sell"
                        value={sellShare}
                        onChange={setSellShare}
                        options={[0.25, 0.5, 1].map((f) => ({ value: f, label: f === 1 ? "All of it" : `${f * 100}%` }))}
                      />
                      {position?.below_stop && <p className="text-sm text-loss">Price is below the stop you planned.</p>}
                      {position?.above_target && <p className="text-sm text-gain">Price has passed your target.</p>}
                    </Section>
                  )}

                  {quote && (
                    <dl className="-my-1 text-sm">
                      <Line label={buying ? "You get" : "You sell"}>
                        {qty(Number(quote.quantity))} {coin.symbol}
                      </Line>
                      <Line label="Fee">{money(Number(quote.fee), { digits: 2 })}</Line>
                      <Line label={buying ? "Total" : "You receive"} strong>
                        {money(Number(quote.total), { digits: 2 })}
                      </Line>
                    </dl>
                  )}
                  {quoteError && <p className="text-sm text-loss">{quoteError}</p>}
                  {overSize && <p className="text-sm text-loss">That's more than your {account.rules.max_position_pct}% limit for one coin.</p>}
                </>
              )}

              {buying && step === 1 && (
                <>
                  <Section title="Why this, why now?" hint="One sentence you can check yourself against later.">
                    <textarea
                      data-autofocus
                      rows={3}
                      value={thesis}
                      maxLength={1000}
                      onChange={(e) => setThesis(e.target.value)}
                      aria-label="Your reason"
                      className="w-full resize-none rounded-field border border-rule bg-paper/40 px-3 py-2.5 font-serif text-md leading-snug outline-none focus:border-ink"
                    />
                  </Section>
                  <Section title={`When do you expect it to be higher?`}>
                    <Pills label="Horizon" value={horizon} onChange={setHorizon} options={HORIZONS} />
                  </Section>
                  <Section title="How sure are you?">
                    <Pills label="Conviction" value={conviction} onChange={setConviction} options={CONVICTION} />
                  </Section>
                </>
              )}

              {buying && step === 2 && (
                <>
                  <Section title="Where would you get out?" hint="Optional, but it's easier to decide now than in the moment.">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-graphite">If it falls</span>
                        <Pills label="Stop loss" allowNone value={stop} onChange={setStop} options={STOPS} />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-graphite">If it rises</span>
                        <Pills label="Target" allowNone value={target} onChange={setTarget} options={TARGETS} />
                      </div>
                    </div>
                  </Section>
                  <Section title="How are you feeling?">
                    <Pills label="Mood" allowNone value={mood} onChange={setMood} options={MOODS} />
                  </Section>
                </>
              )}

              {step === last && (
                <>
                  <div>
                    <p className="text-xl font-light leading-snug tracking-tight">
                      {buying ? "Buy" : "Sell"} <span className="num">{qty(Number(quote?.quantity))}</span> {coin.symbol} for{" "}
                      <span className="num">{money(Number(quote?.total), { digits: 2 })}</span>.
                    </p>
                    {buying && (
                      <p className="mt-2 text-graphite">
                        {conviction}% sure it's higher {horizonLabel}
                        {stop ? `, out at −${stop}%` : ""}
                        {target ? `, taking profit at +${target}%` : ""}.
                      </p>
                    )}
                    {buying && thesis && <blockquote className="mt-4 font-serif text-md italic">“{thesis}”</blockquote>}
                  </div>
                  {quote && (
                    <dl className="text-sm">
                      <Line label="Fill price">{money(Number(quote.price))}</Line>
                      <Line label={quote.source === "coinbase" ? "Slippage from the live order book" : "Estimated slippage"}>
                        {Number(quote.slippage_bps).toFixed(1)} bps
                      </Line>
                      <Line label="Fee">{money(Number(quote.fee), { digits: 2 })}</Line>
                      {buying && quote.position_pct !== null && <Line label="Share of portfolio">{pct(quote.position_pct, { sign: false, digits: 1 })}</Line>}
                    </dl>
                  )}
                  {!buying && (
                    <Section title="Anything to note? (optional)">
                      <textarea
                        rows={2}
                        value={thesis}
                        onChange={(e) => setThesis(e.target.value)}
                        aria-label="Note"
                        className="w-full resize-none rounded-field border border-rule bg-paper/40 px-3 py-2.5 font-serif text-md outline-none focus:border-ink"
                      />
                      <Pills label="Mood" allowNone value={mood} onChange={setMood} options={MOODS} />
                    </Section>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-rule px-5 py-4">
              {blocked ? (
                <p className="mb-3 text-sm">
                  {blocked.detail} <span className="text-graphite">You can buy again in {until(blocked.retry_at)}.</span>
                </p>
              ) : error ? (
                <p className="mb-3 text-sm text-loss">{error}</p>
              ) : null}
              <div className="flex gap-2">
                {step > 0 && (
                  <button type="button" className="btn-quiet" onClick={() => setStep(step - 1)}>
                    Back
                  </button>
                )}
                {step < last ? (
                  <button
                    type="button"
                    className="btn-ink flex-1 !py-3"
                    disabled={!stepReady[step] || Boolean(blocked)}
                    onClick={() => setStep(step + 1)}
                  >
                    {nextLabel}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${buying ? "btn-marker" : "btn-ink"} flex-1 !py-3`}
                    disabled={Boolean(blocked || pauseLeft || busy || !quote)}
                    onClick={submit}
                  >
                    {busy ? "Placing order…" : pauseLeft ? `Take a breath, ${pauseLeft}s` : buying ? `Buy ${coin.symbol}` : `Sell ${coin.symbol}`}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Filled({ trade, onClose }) {
  const bought = trade.side === "buy";
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
      <div className="stamp mb-8 rounded-[10px] border-[3px] border-ink px-6 py-2 text-xl font-semibold tracking-wide">Filled</div>
      <p className="text-md">
        {bought ? "Bought" : "Sold"} <span className="num">{qty(trade.quantity)}</span> {trade.symbol} at <span className="num">{money(trade.price)}</span>
      </p>
      <p className="num mt-1 text-sm text-graphite">{money(trade.fee, { digits: 2 })} in fees</p>
      {trade.realized_pnl !== null && (
        <p className={`num mt-3 ${trade.realized_pnl >= 0 ? "text-gain" : "text-loss"}`}>{money(trade.realized_pnl, { sign: true, digits: 2 })} realized</p>
      )}
      {trade.resolves_at && <p className="mt-6 text-sm text-graphite">Your journal will check this call on {day(trade.resolves_at)}.</p>}
      <div className="mt-10 flex gap-3">
        <button onClick={onClose} className="btn-ink">
          Done
        </button>
        <Link to="/journal" className="btn-quiet">
          Open journal
        </Link>
      </div>
    </div>
  );
}
