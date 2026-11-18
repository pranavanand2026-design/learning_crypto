import { Link } from "react-router-dom";
import { useApi } from "../lib/hooks";
import { useLiveTicks } from "../lib/live";
import { day, greeting, money, pct, qty, tone, until } from "../lib/format";
import { useAuth } from "../state/auth";
import { useAccount } from "../state/account";
import CoinMark from "../components/CoinMark";
import LivePrice from "../components/LivePrice";
import { Loading, Problem } from "../components/States";

// Ink shades for the allocation bar, largest holding darkest.
const SHADES = ["bg-ink", "bg-ink/75", "bg-ink/55", "bg-ink/40", "bg-ink/30", "bg-ink/20"];

function Allocation({ cash, positions, equity }) {
  const parts = [
    ...positions.map((p, i) => ({ key: p.coin_id, label: p.symbol, value: p.value, cls: SHADES[Math.min(i, SHADES.length - 1)] })),
    { key: "cash", label: "Cash", value: cash, cls: "bg-marker" },
  ];
  return (
    <section aria-label="Where your money is">
      <div className="flex h-3 overflow-hidden rounded-full bg-rule">
        {parts.map((p) => (
          <span key={p.key} className={`${p.cls} h-full`} style={{ width: `${(p.value / equity) * 100}%` }} title={`${p.label} ${money(p.value)}`} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${p.cls}`} />
            <span>{p.label}</span>
            <span className="num text-graphite">{pct((p.value / equity) * 100, { sign: false, digits: 0 })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Today({ account }) {
  const { today, rules } = account;
  const cap = rules.max_trades_per_day;
  return (
    <section className="flex flex-col gap-3 rounded-sheet bg-sheet px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {cap ? (
          <span className="flex gap-1" aria-hidden>
            {Array.from({ length: cap }, (_, i) => (
              <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < today.trades ? "bg-ink" : "border border-ink/30"}`} />
            ))}
          </span>
        ) : null}
        <span>
          {today.blocked ? (
            <>
              {today.blocked.detail} <span className="text-graphite">Buying opens in {until(today.blocked.retry_at)}.</span>
            </>
          ) : cap ? (
            `${Math.max(cap - today.trades, 0)} of ${cap} trades left today`
          ) : (
            `${today.trades} trade${today.trades === 1 ? "" : "s"} today`
          )}
        </span>
      </div>
      <Link to="/settings#rules" className="text-sm text-graphite hover:text-ink">
        Your rules
      </Link>
    </section>
  );
}

function HowItWorks() {
  const { data } = useApi("/market/");
  const coins = (data?.results || []).filter((r) => r.live_product).slice(0, 4);
  const steps = [
    ["Pick a coin", "Buy with practice money at live prices, with real fees."],
    ["Say why", "A sentence on your reason and how sure you are."],
    ["See how you did", "When your time's up we check the call, and Progress shows how your judgment holds up."],
  ];
  return (
    <section className="rounded-sheet bg-sheet px-6 py-8 md:px-10">
      <h2 className="text-xl font-light tracking-tight">How this works</h2>
      <ol className="mt-6 grid gap-6 md:grid-cols-3">
        {steps.map(([title, body], i) => (
          <li key={title} className="flex gap-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-marker text-sm font-semibold text-[rgb(20_36_48)]">{i + 1}</span>
            <span>
              <span className="block font-medium">{title}</span>
              <span className="mt-1 block text-sm text-graphite">{body}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm text-graphite">Start with</span>
        {coins.map((c) => (
          <Link key={c.id} to={`/coin/${c.id}?trade=buy`} className="chip gap-2 !px-4 !py-2 !text-sm">
            <CoinMark src={c.image} symbol={c.symbol} size={18} />
            {c.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

function NextUp() {
  const { data } = useApi("/progress/");
  if (!data || !data.trades) return null;
  const cal = data.calibration;
  return (
    <Link to={cal.pending ? "/journal" : "/progress"} className="flex items-center justify-between gap-4 rounded-sheet border border-rule px-5 py-4 hover:border-ink/40">
      <span>
        <span className="block text-xs text-graphite">Next up</span>
        <span className="mt-0.5 block">
          {cal.pending
            ? `${cal.pending} call${cal.pending > 1 ? "s" : ""} waiting. The next is checked ${day(cal.next_resolves_at)}.`
            : cal.resolved
              ? `${cal.resolved} call${cal.resolved > 1 ? "s" : ""} checked. See how your confidence held up.`
              : "Buy with a reason and a time frame to start tracking your calls."}
        </span>
      </span>
      <span className="text-graphite" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
      </span>
    </Link>
  );
}

function PlanState({ p }) {
  if (p.stop_price && p.price < p.stop_price) return <span className="text-loss">Below your stop</span>;
  if (p.target_price && p.price > p.target_price) return <span className="text-gain">Past your target</span>;
  if (p.stop_price || p.target_price) return <span className="text-graphite">On plan</span>;
  return <span className="text-graphite">No exit planned</span>;
}

export default function Portfolio() {
  const { user } = useAuth();
  const { data: account, error, loading, reload } = useAccount();
  const ticks = useLiveTicks(account?.positions.map((p) => p.live_product) || []);
  if (loading && !account) return <Loading />;
  if (error && !account) return <Problem error={error} onRetry={reload} />;
  if (!account) return null;

  const positions = account.positions
    .map((p) => {
      const price = ticks[p.live_product]?.price ?? p.price;
      const value = price ? p.quantity * price : p.cost_basis;
      return { ...p, price, value, pnl: value - p.cost_basis, pnl_pct: (value / p.cost_basis - 1) * 100 };
    })
    .sort((a, b) => b.value - a.value);
  const equity = account.cash + positions.reduce((s, p) => s + p.value, 0);
  const ret = (equity / account.starting_cash - 1) * 100;
  const btcRet = account.benchmark_equity ? (account.benchmark_equity / account.starting_cash - 1) * 100 : null;
  const first = (user?.display_name || "").split(" ")[0];

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-graphite">
          {greeting()}
          {first ? `, ${first}` : ""}.
        </h1>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="num text-4xl font-light tracking-tight">{money(equity)}</span>
          <span className={`num text-md ${tone(ret)}`}>{pct(ret)}</span>
        </div>
        <p className="mt-1 text-sm text-graphite">Practice money. Trade it like it's yours.</p>
        {btcRet !== null && (
          <p className="mt-2 text-graphite">
            Holding Bitcoin over the same time: <span className={`num ${tone(btcRet)}`}>{pct(btcRet)}</span>.{" "}
            {Math.abs(ret - btcRet) < 0.05 ? "You're level." : ret > btcRet ? "You're ahead." : "You're behind."}
          </p>
        )}
      </section>

      {account.positions.length === 0 && !account.today.trades ? <HowItWorks /> : <NextUp />}

      <Today account={account} />

      {positions.length === 0 ? (
        <p className="text-graphite">
          All cash right now.{" "}
          <Link to="/" className="link text-ink">
            Find a coin
          </Link>
        </p>
      ) : (
        <>
          <Allocation cash={account.cash} positions={positions} equity={equity} />
          <section>
            <h2 className="text-lg font-medium tracking-tight">Holdings</h2>
            <ul className="ruled mt-3">
              {positions.map((p) => (
                <li key={p.coin_id}>
                  <Link to={`/coin/${p.coin_id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 py-4 hover:bg-sheet sm:grid-cols-[1fr_8rem_8rem_9rem]">
                    <span className="flex items-center gap-3">
                      <CoinMark src={p.image} symbol={p.symbol} size={32} />
                      <span>
                        <span className="block font-medium">{p.name}</span>
                        <span className="num block text-xs text-graphite">
                          {qty(p.quantity)} {p.symbol}
                        </span>
                      </span>
                    </span>
                    <span className="hidden text-right sm:block">
                      <LivePrice value={p.price} className="text-sm" />
                    </span>
                    <span className="text-right">
                      <span className="num block">{money(p.value, { digits: 2 })}</span>
                      <span className={`num block text-xs ${tone(p.pnl)}`}>
                        {money(p.pnl, { sign: true, digits: 2 })} ({pct(p.pnl_pct)})
                      </span>
                    </span>
                    <span className="hidden text-right text-sm sm:block">
                      <PlanState p={p} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
