import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useLiveTicks } from "../lib/live";
import { money, pct, qty, tone, until } from "../lib/format";
import { useAccount } from "../state/account";
import CoinMark from "../components/CoinMark";
import LivePrice from "../components/LivePrice";
import { Empty, Loading, Problem } from "../components/States";

function Versus({ equity, benchmark, start, startedAt }) {
  if (!benchmark) return null;
  const mine = (equity / start - 1) * 100;
  const btc = (benchmark / start - 1) * 100;
  const max = Math.max(Math.abs(mine), Math.abs(btc), 0.5);
  const ahead = mine >= btc;
  return (
    <section className="space-y-3">
      <p className="text-md">
        {ahead ? "You're ahead of" : "You're behind"} simply holding Bitcoin since{" "}
        {new Date(startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.
      </p>
      {[
        { label: "You", value: mine, total: equity },
        { label: "Holding Bitcoin", value: btc, total: benchmark },
      ].map((r) => (
        <div key={r.label} className="grid grid-cols-[7rem_1fr_5rem_6rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_5rem_6rem]">
          <span className="text-graphite">{r.label}</span>
          <span className="relative block h-2">
            <span className="absolute inset-y-[-4px] left-1/2 w-px bg-rule" />
            <span
              className={`absolute inset-y-0 rounded-full ${r.value >= 0 ? "left-1/2 bg-gain" : "right-1/2 bg-loss"}`}
              style={{ width: `${Math.max((Math.abs(r.value) / max) * 50, 0.6)}%` }}
            />
          </span>
          <span className={`num text-right ${tone(r.value)}`}>{pct(r.value)}</span>
          <span className="num text-right text-graphite">{money(r.total, { digits: 0 })}</span>
        </div>
      ))}
    </section>
  );
}

const RULES = [
  { key: "max_trades_per_day", label: "Trades per day", suffix: "", min: 1, max: 100 },
  { key: "max_daily_loss_pct", label: "Daily loss limit", suffix: "% of starting cash", min: 1, max: 100 },
  { key: "cooldown_minutes", label: "Pause after a losing exit", suffix: "minutes", min: 0, max: 240 },
  { key: "max_position_pct", label: "Largest single position", suffix: "% of portfolio", min: 5, max: 100 },
];

function Rules({ account, onSaved }) {
  const [values, setValues] = useState(account.rules);
  const [state, setState] = useState(null);
  useEffect(() => setValues(account.rules), [account.rules]);
  const dirty = RULES.some((r) => String(values[r.key] ?? "") !== String(account.rules[r.key] ?? ""));

  async function save(e) {
    e.preventDefault();
    setState("saving");
    try {
      await api("/account/rules/", { method: "PUT", body: values });
      setState("Saved");
      onSaved();
    } catch (err) {
      setState(err.message);
    }
  }

  return (
    <form onSubmit={save}>
      <h2 className="text-lg font-medium tracking-tight">Your rules</h2>
      <p className="mt-1 text-sm text-graphite">New buys pause when you hit one. Selling is always open.</p>
      <div className="ruled mt-4">
        {RULES.map((r) => (
          <label key={r.key} className="flex items-center justify-between gap-4 py-3 text-sm">
            <span>{r.label}</span>
            <span className="flex items-center gap-2 text-graphite">
              <input
                type="number"
                min={r.min}
                max={r.max}
                value={values[r.key] ?? ""}
                placeholder="Off"
                onChange={(e) => setValues({ ...values, [r.key]: e.target.value === "" ? null : Number(e.target.value) })}
                className="field num w-20 !py-1.5 text-right"
              />
              <span className="hidden w-32 sm:inline">{r.suffix}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn-ink" disabled={!dirty || state === "saving"}>
          Save rules
        </button>
        {state && state !== "saving" && <span className="text-sm text-graphite">{state}</span>}
      </div>
    </form>
  );
}

function Restart({ onDone }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <section>
      <h2 className="text-lg font-medium tracking-tight">Start over</h2>
      <p className="mt-1 text-sm text-graphite">Close every position and reset your cash. Your journal stays.</p>
      {confirm ? (
        <div className="mt-4 flex gap-3">
          <button
            className="btn bg-loss text-white"
            onClick={async () => {
              await api("/account/restart/", { method: "POST" });
              setConfirm(false);
              onDone();
            }}
          >
            Reset my portfolio
          </button>
          <button className="btn-quiet" onClick={() => setConfirm(false)}>
            Keep it
          </button>
        </div>
      ) : (
        <button className="btn-quiet mt-4" onClick={() => setConfirm(true)}>
          Start over
        </button>
      )}
    </section>
  );
}

export default function Portfolio() {
  const { data: account, error, loading, reload } = useAccount();
  const ticks = useLiveTicks(account?.positions.map((p) => p.live_product) || []);
  if (loading && !account) return <Loading />;
  if (error && !account) return <Problem error={error} onRetry={reload} />;
  if (!account) return null;

  const positions = account.positions.map((p) => {
    const price = ticks[p.live_product]?.price ?? p.price;
    const value = price ? p.quantity * price : p.cost_basis;
    return { ...p, price, value, pnl: value - p.cost_basis, pnl_pct: (value / p.cost_basis - 1) * 100 };
  });
  const equity = account.cash + positions.reduce((s, p) => s + p.value, 0);
  const ret = (equity / account.starting_cash - 1) * 100;
  const { today, rules } = account;

  return (
    <div className="space-y-14">
      <section className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="sr-only">Portfolio</h1>
          <div className="text-sm text-graphite">Portfolio value</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4">
            <span className="num text-4xl font-light tracking-tight">{money(equity, { digits: 2 })}</span>
            <span className={`num text-md ${tone(ret)}`}>{pct(ret)} since you started</span>
          </div>
          <div className="num mt-3 flex gap-6 text-sm text-graphite">
            <span>
              Cash <span className="text-ink">{money(account.cash)}</span>
            </span>
            <span>
              Invested <span className="text-ink">{money(equity - account.cash)}</span>
            </span>
          </div>
        </div>
        <div className="text-sm md:text-right">
          <div className="num">
            {today.trades}
            {rules.max_trades_per_day ? ` of ${rules.max_trades_per_day}` : ""} trades today
          </div>
          {today.blocked && (
            <div className="mt-1 text-graphite">
              {today.blocked.detail} Buying opens in {until(today.blocked.retry_at)}.
            </div>
          )}
        </div>
      </section>

      <Versus equity={equity} benchmark={account.benchmark_equity} start={account.starting_cash} startedAt={account.started_at} />

      <section>
        <h2 className="text-lg font-medium tracking-tight">Holdings</h2>
        {positions.length === 0 ? (
          <Empty title="Nothing held yet.">
            <Link to="/" className="link">
              Pick a coin from the market
            </Link>{" "}
            to place your first trade.
          </Empty>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs text-graphite">
              <tr className="border-b border-rule">
                <th className="py-3 font-normal">Coin</th>
                <th className="hidden py-3 text-right font-normal sm:table-cell">Price</th>
                <th className="py-3 text-right font-normal">Value</th>
                <th className="py-3 text-right font-normal">Return</th>
                <th className="hidden py-3 pl-6 font-normal md:table-cell">Plan</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.coin_id} className="border-b border-rule/70">
                  <td className="py-3">
                    <Link to={`/coin/${p.coin_id}`} className="flex items-center gap-3 hover:underline">
                      <CoinMark src={p.image} symbol={p.symbol} />
                      <span>
                        <span className="block font-medium">{p.name}</span>
                        <span className="num block text-xs text-graphite">
                          {qty(p.quantity)} {p.symbol}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden py-3 text-right sm:table-cell">
                    <LivePrice value={p.price} />
                  </td>
                  <td className="num py-3 text-right">{money(p.value, { digits: 2 })}</td>
                  <td className={`num py-3 text-right ${tone(p.pnl)}`}>
                    {money(p.pnl, { sign: true, digits: 2 })}
                    <span className="block text-xs">{pct(p.pnl_pct)}</span>
                  </td>
                  <td className="hidden py-3 pl-6 text-xs md:table-cell">
                    {p.stop_price && p.price < p.stop_price ? (
                      <span className="text-loss">Below your stop</span>
                    ) : p.target_price && p.price > p.target_price ? (
                      <span className="text-gain">Past your target</span>
                    ) : p.stop_price || p.target_price ? (
                      <span className="text-graphite">On plan</span>
                    ) : (
                      <span className="text-graphite">No exit set</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid gap-14 lg:grid-cols-2">
        <Rules account={account} onSaved={reload} />
        <Restart onDone={reload} />
      </div>
    </div>
  );
}
