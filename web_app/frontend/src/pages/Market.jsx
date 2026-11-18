import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../lib/hooks";
import { useLiveTicks } from "../lib/live";
import { compact, pct, tone } from "../lib/format";
import CoinMark from "../components/CoinMark";
import Sparkline from "../components/Sparkline";
import LivePrice from "../components/LivePrice";
import { HeatMeter } from "../components/Heat";
import { Wire } from "../components/Headlines";
import Floor from "../components/Floor";
import Landing from "../components/Landing";
import { useAuth } from "../state/auth";
import Tour from "../components/Tour";
import { Loading, Problem } from "../components/States";

const SORTS = [
  { id: "cap", label: "Market cap", fn: (a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) },
  { id: "heat", label: "Heat", fn: (a, b) => b.heat.score - a.heat.score },
  { id: "calm", label: "Calmest", fn: (a, b) => a.heat.score - b.heat.score },
];

export default function Market() {
  const { user } = useAuth();
  const markets = useApi("/market/", { interval: 90000 });
  const news = useApi("/news/?linked=1", { interval: 600000 });
  const [sort, setSort] = useState("cap");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(30);
  const navigate = useNavigate();

  const rows = useMemo(() => {
    const list = markets.data?.results || [];
    const q = query.trim().toLowerCase();
    const filtered = q ? list.filter((r) => r.name.toLowerCase().includes(q) || r.symbol.toLowerCase().startsWith(q)) : list;
    return [...filtered].sort(SORTS.find((s) => s.id === sort).fn);
  }, [markets.data, sort, query]);

  const visible = rows.slice(0, limit);
  const all = markets.data?.results || [];
  const ticks = useLiveTicks([...visible, ...all.slice(0, 40)].map((r) => r.live_product));
  const search = useApi(query.trim().length >= 2 && rows.length === 0 ? `/market/search/?q=${encodeURIComponent(query.trim())}` : null);

  return (
    <div>
      <Tour id="market" ready={Boolean(markets.data)} />
      {user ? (
        <>
          <Floor rows={all} ticks={ticks} />
          <Wire items={news.data?.results} />
        </>
      ) : (
        <Landing rows={all} ticks={ticks} />
      )}

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5" role="radiogroup" aria-label="Sort">
          {SORTS.map((s) => (
            <button key={s.id} role="radio" aria-checked={sort === s.id} onClick={() => setSort(s.id)} className="chip">
              {s.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search coins"
          className="field sm:max-w-xs"
          aria-label="Search coins"
        />
      </div>

      {markets.loading && !markets.data ? (
        <Loading label="Loading the market" />
      ) : markets.error && !markets.data ? (
        <Problem error={markets.error} onRetry={markets.reload} />
      ) : (
        <>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs text-graphite">
              <tr className="border-b border-rule">
                <th className="py-3 pr-2 font-normal">Coin</th>
                <th className="py-3 pr-2 text-right font-normal">Price</th>
                <th className="hidden py-3 pr-2 text-right font-normal sm:table-cell">24h</th>
                <th className="hidden py-3 pr-2 text-right font-normal lg:table-cell">Market cap</th>
                <th className="hidden py-3 pr-2 font-normal md:table-cell">
                  <span className="pl-3">7 days</span>
                </th>
                <th className="py-3 pl-2 font-normal" data-tour="heat">Heat</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const live = ticks[r.live_product]?.price;
                return (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/coin/${r.id}`)}
                    className="cursor-pointer border-b border-rule/70 transition-colors hover:bg-sheet"
                  >
                    <td className="py-3 pr-2">
                      <Link to={`/coin/${r.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <span className="num hidden w-6 text-right text-xs text-graphite sm:inline">{r.rank}</span>
                        <CoinMark src={r.image} symbol={r.symbol} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{r.name}</span>
                          <span className="block text-xs text-graphite">{r.symbol}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <LivePrice value={live ?? r.price} />
                      <span className={`num block text-xs sm:hidden ${tone(r.change_24h)}`}>{pct(r.change_24h)}</span>
                    </td>
                    <td className={`num hidden py-3 pr-2 text-right sm:table-cell ${tone(r.change_24h)}`}>{pct(r.change_24h)}</td>
                    <td className="num hidden py-3 pr-2 text-right text-graphite lg:table-cell">{compact(r.market_cap)}</td>
                    <td className="hidden py-3 pr-2 text-graphite md:table-cell">
                      <Sparkline points={r.sparkline} className="ml-3" />
                    </td>
                    <td className="py-3 pl-2">
                      <HeatMeter heat={r.heat} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="py-10 text-sm">
              {search.data?.results?.length ? (
                <ul className="space-y-2">
                  {search.data.results.map((c) => (
                    <li key={c.id}>
                      <Link to={`/coin/${c.id}`} className="flex items-center gap-3 hover:underline">
                        <CoinMark src={c.image} symbol={c.symbol} size={20} />
                        {c.name} <span className="text-graphite">{c.symbol}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-graphite">{search.loading ? "Searching…" : `No coins match “${query}”.`}</p>
              )}
            </div>
          )}

          {rows.length > limit && (
            <button onClick={() => setLimit((l) => l + 40)} className="btn-quiet mt-6">
              Show more coins
            </button>
          )}
        </>
      )}
    </div>
  );
}
