import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../lib/hooks";
import { useLiveTicks } from "../lib/live";
import { compact, money, pct, qty, tone, when } from "../lib/format";
import { useAuth } from "../state/auth";
import { useAccount } from "../state/account";
import CoinMark from "../components/CoinMark";
import LivePrice from "../components/LivePrice";
import PriceChart from "../components/PriceChart";
import PlanBar from "../components/PlanBar";
import Ticket from "../components/Ticket";
import { HeatMeter } from "../components/Heat";
import { Headline } from "../components/Headlines";
import { Loading, Problem } from "../components/States";

const RANGES = [
  { days: "1", label: "1D" },
  { days: "7", label: "1W" },
  { days: "30", label: "1M" },
  { days: "90", label: "3M" },
  { days: "365", label: "1Y" },
];

function Stat({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-graphite">{label}</dt>
      <dd className="num text-right">{children}</dd>
    </div>
  );
}

export default function Coin() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: account } = useAccount();
  const [range, setRange] = useState("7");
  const [ticket, setTicket] = useState(null);
  const coin = useApi(`/market/${id}/`, { interval: 120000 });
  const chart = useApi(`/market/${id}/chart/?days=${range}`);
  const news = useApi(`/market/${id}/news/`);
  const journal = useApi(user ? `/journal/?coin=${id}` : null);
  const ticks = useLiveTicks([coin.data?.live_product]);

  if (coin.loading && !coin.data) return <Loading />;
  if (coin.error && !coin.data) return <Problem error={coin.error} onRetry={coin.reload} />;

  const c = coin.data;
  const live = ticks[c.live_product]?.price;
  const price = live ?? c.price;
  const position = account?.positions.find((p) => p.coin_id === id);
  const trades = journal.data?.results || [];

  return (
    <div>
      <Link to="/" className="text-sm text-graphite hover:text-ink">
        Market
      </Link>

      <header className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <CoinMark src={c.image} symbol={c.symbol} size={36} />
            <h1 className="text-xl font-medium tracking-tight">{c.name}</h1>
            <span className="text-graphite">{c.symbol}</span>
            {c.rank && <span className="chip !py-0.5 text-graphite">#{c.rank}</span>}
          </div>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <LivePrice value={price} className="text-3xl font-light tracking-tight md:text-4xl" />
            <span className={`num text-md ${tone(c.change_24h)}`}>{pct(c.change_24h)} today</span>
            {live && <span className="text-xs text-graphite">Live from Coinbase</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {user ? (
            <>
              {position && (
                <button onClick={() => setTicket("sell")} className="btn-quiet">
                  Sell
                </button>
              )}
              <button onClick={() => setTicket("buy")} className="btn-ink min-w-28">
                Buy
              </button>
            </>
          ) : (
            <Link to="/signup" className="btn-ink">
              Create account to trade
            </Link>
          )}
        </div>
      </header>

      <section className="mt-8">
        <div className="mb-2 flex justify-end gap-1" role="radiogroup" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r.days} role="radio" aria-checked={range === r.days} onClick={() => setRange(r.days)} className="chip !px-2.5">
              {r.label}
            </button>
          ))}
        </div>
        <div className="rounded-sheet border border-rule bg-sheet/60 p-2 md:p-4">
          {chart.data ? (
            <PriceChart prices={chart.data.prices} trades={trades} avgCost={position?.avg_cost} livePrice={live} />
          ) : (
            <div className="grid h-[340px] place-items-center text-sm text-graphite">{chart.error ? "Chart unavailable" : "Loading chart"}</div>
          )}
        </div>
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-12">
          <section>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-medium tracking-tight">What's moving it</h2>
              <HeatMeter heat={c.heat} size="lg" />
            </div>
            {c.heat.drivers.length ? (
              <ul className="mt-4 space-y-2">
                {c.heat.drivers.map((d) => (
                  <li key={d} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-marker" aria-hidden />
                    {d}.
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-graphite">
                A normal day. {c.heat.typical_move ? `It usually moves about ${c.heat.typical_move.toFixed(1)}% in a day.` : ""}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-lg font-medium tracking-tight">Headlines</h2>
            {news.data?.results?.length ? (
              <div className="ruled mt-2">
                {news.data.results.map((item) => (
                  <div key={item.url} className="py-4">
                    <Headline item={item} showCoins={false} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-graphite">{news.loading ? "Loading headlines" : `No recent headlines mention ${c.name}.`}</p>
            )}
          </section>
        </div>

        <aside className="space-y-12">
          {position && (
            <section>
              <h2 className="text-lg font-medium tracking-tight">Your position</h2>
              <dl className="ruled mt-2 text-sm">
                <Stat label="Holding">
                  {qty(position.quantity)} {c.symbol}
                </Stat>
                <Stat label="Value">{money(position.quantity * price, { digits: 2 })}</Stat>
                <Stat label="Return">
                  <span className={tone(position.pnl)}>
                    {money(position.quantity * price - position.cost_basis, { sign: true, digits: 2 })}
                  </span>
                </Stat>
              </dl>
              <PlanBar position={{ ...position, price }} />
            </section>
          )}

          <section>
            <h2 className="text-lg font-medium tracking-tight">Key numbers</h2>
            <dl className="ruled mt-2 text-sm">
              <Stat label="Market cap">{compact(c.market_cap)}</Stat>
              <Stat label="Volume, 24h">{compact(c.volume_24h)}</Stat>
              <Stat label="Range, 24h">
                {money(c.low_24h)} to {money(c.high_24h)}
              </Stat>
              <Stat label="Change, 30 days">
                <span className={tone(c.change_30d)}>{pct(c.change_30d)}</span>
              </Stat>
              <Stat label="All-time high">
                {money(c.ath)} <span className="text-graphite">({pct(c.ath_change)})</span>
              </Stat>
              {c.circulating_supply && (
                <Stat label="Supply">
                  {compact(c.circulating_supply).replace("$", "")}
                  {c.max_supply ? ` of ${compact(c.max_supply).replace("$", "")}` : ""}
                </Stat>
              )}
            </dl>
          </section>

          {c.description && (
            <section>
              <h2 className="text-lg font-medium tracking-tight">About</h2>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-graphite">{c.description.replace(/<[^>]+>/g, "")}</p>
            </section>
          )}

          {trades.length > 0 && (
            <section>
              <h2 className="text-lg font-medium tracking-tight">Your notes</h2>
              <ul className="ruled mt-2">
                {trades.slice(0, 4).map((t) => (
                  <li key={t.id} className="py-3 text-sm">
                    <div className="text-xs text-graphite">
                      {t.side === "buy" ? "Bought" : "Sold"} {when(t.created_at)}
                    </div>
                    {t.thesis && <p className="mt-1 font-serif text-base italic">“{t.thesis}”</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {ticket && (
        <Ticket
          coin={{ ...c, price }}
          initialSide={ticket}
          onClose={() => setTicket(null)}
          onFilled={() => journal.reload()}
        />
      )}
    </div>
  );
}
