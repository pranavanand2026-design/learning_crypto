import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { money, pct, qty, until } from "../lib/format";
import { useNow } from "../lib/hooks";
import { useAccount } from "../state/account";
import CoinMark from "./CoinMark";

const CONVICTION = [50, 60, 70, 80, 90];
const HORIZONS = [
  { days: 1, label: "a day" },
  { days: 7, label: "a week" },
  { days: 30, label: "a month" },
];
const STOPS = [5, 10, 20];
const TARGETS = [10, 25, 50];
const MOODS = ["calm", "curious", "excited", "anxious", "frustrated"];
const HOT_PAUSE_MS = 20000;

function Choice({ options, value, onChange, render, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const v = typeof o === "object" ? o.value : o;
        return (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={value === v}
            className="chip"
            onClick={() => onChange(value === v ? null : v)}
          >
            {render ? render(o) : String(o)}
          </button>
        );
      })}
    </div>
  );
}

function Row({ label, children, strong }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${strong ? "font-medium" : ""}`}>
      <dt className="text-graphite">{label}</dt>
      <dd className="num text-right">{children}</dd>
    </div>
  );
}

export default function Ticket({ coin, initialSide = "buy", onClose, onFilled }) {
  const { data: account, reload: reloadAccount } = useAccount();
  const position = account?.positions.find((p) => p.coin_id === coin.id);
  const [side, setSide] = useState(position ? initialSide : "buy");
  const [amount, setAmount] = useState("");
  const [sellShare, setSellShare] = useState(null);
  const [thesis, setThesis] = useState("");
  const [conviction, setConviction] = useState(null);
  const [horizon, setHorizon] = useState(7);
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

  const hot = side === "buy" && coin.heat?.level === "hot";
  const pauseLeft = hot ? Math.max(0, Math.ceil((openedAt.current + HOT_PAUSE_MS - now) / 1000)) : 0;

  const order = useMemo(() => {
    if (side === "buy") {
      const n = Number(amount);
      return n > 0 ? { notional: n } : null;
    }
    if (!position) return null;
    const q = sellShare ? position.quantity * sellShare : Number(amount) / (coin.price || 1);
    return q > 0 ? { quantity: Math.min(q, position.quantity).toFixed(12) } : null;
  }, [side, amount, sellShare, position, coin.price]);

  // Live quote, refreshed while the ticket is open.
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
    panel.current?.querySelector("input,textarea,button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const blocked = quote?.blocked || (side === "buy" ? account?.today?.blocked : null);
  const overSize =
    side === "buy" && quote?.position_pct && account?.rules?.max_position_pct && quote.position_pct > account.rules.max_position_pct;
  const missing =
    side === "buy"
      ? !order
        ? "Enter an amount"
        : thesis.trim().length < 8
          ? "Write why you're buying"
          : !conviction
            ? "Choose how sure you are"
            : null
      : !order
        ? "Choose how much to sell"
        : null;

  async function submit(e) {
    e.preventDefault();
    if (missing || blocked || pauseLeft || busy) return;
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
          ...(side === "buy" ? { conviction, horizon_days: horizon, stop_pct: stop, target_pct: target } : {}),
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

  const cash = account?.cash ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end md:items-stretch" role="dialog" aria-modal="true" aria-label={`Trade ${coin.name}`}>
      <button className="absolute inset-0 bg-ink/30" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div
        ref={panel}
        className="sheet-in relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-sheet bg-sheet shadow-[0_-12px_48px_rgb(var(--ink)/0.18)] md:max-h-none md:w-[460px] md:rounded-none md:rounded-l-sheet"
      >
        <div className="flex items-center gap-3 border-b border-rule px-5 py-4">
          <CoinMark src={coin.image} symbol={coin.symbol} size={30} />
          <div className="min-w-0">
            <div className="truncate font-medium">{coin.name}</div>
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
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-2 rounded-chip border border-rule p-1" role="tablist" aria-label="Order side">
                {["buy", "sell"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={side === s}
                    disabled={s === "sell" && !position}
                    onClick={() => {
                      setSide(s);
                      setAmount("");
                      setSellShare(null);
                    }}
                    className={`rounded-chip py-2 text-sm capitalize transition-colors disabled:opacity-40 ${
                      side === s ? "bg-ink text-paper" : "text-graphite hover:text-ink"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {hot && (
                <div className="rounded-field border-l-2 border-loss bg-loss/[0.06] px-4 py-3 text-sm">
                  <p className="font-medium">{coin.name} is running hot.</p>
                  <ul className="mt-1 space-y-0.5 text-graphite">
                    {coin.heat.drivers.slice(0, 3).map((d) => (
                      <li key={d}>{d}.</li>
                    ))}
                  </ul>
                </div>
              )}

              <section>
                {side === "buy" ? (
                  <>
                    <label htmlFor="amount" className="text-sm text-graphite">
                      Amount
                    </label>
                    <div className="mt-2 flex items-baseline gap-1 border-b border-rule pb-2 focus-within:border-ink">
                      <span className="text-2xl text-graphite">$</span>
                      <input
                        id="amount"
                        inputMode="decimal"
                        autoComplete="off"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="0"
                        className="num w-full text-3xl font-light outline-none placeholder:text-rule"
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex gap-1.5">
                        {[0.05, 0.1, 0.25].map((f) => (
                          <button
                            type="button"
                            key={f}
                            className="chip"
                            onClick={() => setAmount((Math.floor(((cash * f) / 1.004) * 100) / 100).toString())}
                          >
                            {f * 100}%
                          </button>
                        ))}
                      </div>
                      <span className="num text-xs text-graphite">{money(cash)} available</span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-graphite">
                      You hold <span className="num text-ink">{qty(position?.quantity)}</span> {coin.symbol}
                      {position?.pnl_pct !== null && (
                        <>
                          {" "}
                          at <span className="num">{pct(position.pnl_pct)}</span>
                        </>
                      )}
                    </p>
                    <div className="mt-3 flex gap-1.5">
                      {[0.25, 0.5, 1].map((f) => (
                        <button
                          type="button"
                          key={f}
                          aria-pressed={sellShare === f}
                          className="chip"
                          onClick={() => {
                            setSellShare(f);
                            setAmount("");
                          }}
                        >
                          {f === 1 ? "All" : `${f * 100}%`}
                        </button>
                      ))}
                    </div>
                    {position?.below_stop && <p className="mt-3 text-sm text-loss">Price is below the stop you planned.</p>}
                    {position?.above_target && <p className="mt-3 text-sm text-gain">Price has passed your target.</p>}
                  </>
                )}
              </section>

              {(quote || quoteError) && (
                <dl className="-my-1 text-sm">
                  {quoteError ? (
                    <p className="py-1.5 text-loss">{quoteError}</p>
                  ) : (
                    <>
                      <Row label={side === "buy" ? "You get" : "You sell"}>
                        {qty(Number(quote.quantity))} {coin.symbol}
                      </Row>
                      <Row label="Fill price">{money(Number(quote.price))}</Row>
                      <Row label={quote.source === "coinbase" ? "Slippage, live order book" : "Slippage, estimated"}>
                        {Number(quote.slippage_bps).toFixed(1)} bps
                      </Row>
                      <Row label="Fee">{money(Number(quote.fee), { digits: 2 })}</Row>
                      <Row label={side === "buy" ? "Total" : "You receive"} strong>
                        {money(Number(quote.total), { digits: 2 })}
                      </Row>
                      {side === "buy" && quote.position_pct !== null && (
                        <Row label="Share of portfolio">{pct(quote.position_pct, { sign: false, digits: 1 })}</Row>
                      )}
                    </>
                  )}
                </dl>
              )}
              {overSize && (
                <p className="-mt-4 text-sm text-loss">
                  That's more than your {account.rules.max_position_pct}% limit for one coin.
                </p>
              )}

              <section>
                <label htmlFor="thesis" className="text-sm text-graphite">
                  {side === "buy" ? "Why this, why now?" : "Why sell now? (optional)"}
                </label>
                <textarea
                  id="thesis"
                  rows={3}
                  value={thesis}
                  maxLength={1000}
                  onChange={(e) => setThesis(e.target.value)}
                  placeholder={side === "buy" ? "One or two sentences you can check later." : ""}
                  className="mt-2 w-full resize-none rounded-field border border-rule bg-paper/40 px-3 py-2.5 font-serif text-md leading-snug outline-none placeholder:font-sans placeholder:text-sm placeholder:text-graphite/70 focus:border-ink"
                />
              </section>

              {side === "buy" && (
                <>
                  <section className="space-y-3">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-sm text-graphite">
                      <span>How sure are you it's higher in</span>
                      <select
                        value={horizon}
                        onChange={(e) => setHorizon(Number(e.target.value))}
                        className="rounded-field border border-rule px-2 py-0.5 text-ink"
                        aria-label="Horizon"
                      >
                        {HORIZONS.map((h) => (
                          <option key={h.days} value={h.days}>
                            {h.label}
                          </option>
                        ))}
                      </select>
                      <span>?</span>
                    </div>
                    <Choice label="Conviction" options={CONVICTION} value={conviction} onChange={setConviction} render={(c) => `${c}%`} />
                  </section>

                  <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-sm text-graphite">Exit if it falls</div>
                      <Choice label="Stop loss" options={STOPS} value={stop} onChange={setStop} render={(s) => `−${s}%`} />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-graphite">Take profit at</div>
                      <Choice label="Target" options={TARGETS} value={target} onChange={setTarget} render={(t) => `+${t}%`} />
                    </div>
                  </section>
                </>
              )}

              <section className="space-y-2">
                <div className="text-sm text-graphite">Right now I feel</div>
                <Choice label="Mood" options={MOODS} value={mood} onChange={setMood} render={(m) => m[0].toUpperCase() + m.slice(1)} />
              </section>
            </div>

            <div className="border-t border-rule px-5 py-4">
              {blocked ? (
                <p className="mb-3 text-sm">
                  {blocked.detail} <span className="text-graphite">You can buy again in {until(blocked.retry_at)}.</span>
                </p>
              ) : error ? (
                <p className="mb-3 text-sm text-loss">{error}</p>
              ) : null}
              <button
                type="submit"
                disabled={Boolean(missing || blocked || pauseLeft || busy)}
                className={`${side === "buy" ? "btn-ink" : "btn-quiet"} w-full !py-3`}
              >
                {busy
                  ? "Placing order…"
                  : pauseLeft && !missing
                    ? `Take a breath, ${pauseLeft}s`
                    : missing || (side === "buy" ? `Buy ${coin.symbol}` : `Sell ${coin.symbol}`)}
              </button>
            </div>
          </form>
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
        {bought ? "Bought" : "Sold"} <span className="num">{qty(trade.quantity)}</span> {trade.symbol} at{" "}
        <span className="num">{money(trade.price)}</span>
      </p>
      <p className="num mt-1 text-sm text-graphite">
        {money(trade.fee, { digits: 2 })} fee, {trade.slippage_bps.toFixed(1)} bps slippage
      </p>
      {trade.realized_pnl !== null && (
        <p className={`num mt-3 ${trade.realized_pnl >= 0 ? "text-gain" : "text-loss"}`}>
          {money(trade.realized_pnl, { sign: true, digits: 2 })} realized
        </p>
      )}
      {trade.thesis && <blockquote className="mt-6 max-w-xs font-serif text-md italic text-graphite">“{trade.thesis}”</blockquote>}
      {trade.resolves_at && (
        <p className="mt-4 text-sm text-graphite">We'll check this call on {new Date(trade.resolves_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.</p>
      )}
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
