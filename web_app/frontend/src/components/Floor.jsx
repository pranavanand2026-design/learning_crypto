import { Link } from "react-router-dom";
import { useAuth } from "../state/auth";
import { money, pct } from "../lib/format";
import CoinMark from "./CoinMark";
import Sparkline from "./Sparkline";
import LivePrice from "./LivePrice";
import { HeatMeter } from "./Heat";

const isPegged = (r) => {
  const s = r.sparkline || [];
  if (s.length < 10) return false;
  const lo = Math.min(...s);
  return (Math.max(...s) - lo) / lo < 0.015;
};

function spotlight(rows) {
  const candidates = rows.filter((r) => !isPegged(r));
  const hottest = [...candidates].sort((a, b) => b.heat.score - a.heat.score)[0];
  if (hottest && hottest.heat.score >= 35) {
    const move = hottest.change_24h ?? 0;
    const line =
      Math.abs(move) >= 3
        ? `${hottest.name} is ${move > 0 ? "up" : "down"} ${Math.abs(move).toFixed(1)}% today.`
        : `${hottest.name} is drawing attention.`;
    // The headline already states the move; keep only the context around it.
    const why = hottest.heat.drivers.filter((d) => !/^(Up|Down) /.test(d));
    if (Math.abs(move) >= 3 && hottest.heat.move_ratio >= 1.5) {
      why.unshift(`That's ${hottest.heat.move_ratio.toFixed(1)}× its usual daily move`);
    }
    return { coin: hottest, line, why: why.slice(0, 2) };
  }
  const btc = rows.find((r) => r.id === "bitcoin") || rows[0];
  const move = btc?.change_24h ?? 0;
  return {
    coin: btc,
    line: `A quiet market. ${btc?.name} is ${move >= 0 ? "up" : "down"} ${Math.abs(move).toFixed(1)}% today.`,
    why: [],
  };
}

const changeTone = (v) => (v > 0 ? "text-gain-hi" : v < 0 ? "text-loss-hi" : "text-on-floor/60");

/**
 * The trading floor: the coin attracting the most heat right now, the
 * majors ticking live, and a tape of everything else.
 */
export default function Floor({ rows, ticks }) {
  const { user, config } = useAuth();
  if (!rows?.length) return null;
  const { coin, line, why } = spotlight(rows);
  const price = (r) => ticks[r.live_product]?.price ?? r.price;
  const majors = rows.filter((r) => !isPegged(r) && r.id !== coin.id).slice(0, 8);
  const tape = rows.filter((r) => !isPegged(r)).slice(0, 40);

  return (
    <section
      aria-label="Market now"
      className="relative left-1/2 -mt-6 mb-10 w-screen -translate-x-1/2 overflow-hidden bg-floor text-on-floor md:-mt-10"
    >
      <div className="mx-auto grid max-w-page gap-10 px-4 pb-10 pt-10 md:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-14">
        <div className="flex min-w-0 flex-col">
          <Link to={`/coin/${coin.id}`} className="flex items-center gap-3 text-on-floor/70 hover:text-on-floor">
            <CoinMark src={coin.image} symbol={coin.symbol} size={28} />
            <span>{coin.name}</span>
            <LivePrice value={price(coin)} className="text-on-floor" />
            <HeatMeter heat={coin.heat} empty="bg-on-floor/15" />
          </Link>
          <h1 className="mt-5 max-w-xl text-3xl font-light leading-[1.05] tracking-tight md:text-4xl">{line}</h1>
          {why.length > 0 && (
            <ul className="mt-4 space-y-1 text-on-floor/65">
              {why.map((w) => (
                <li key={w}>{w}.</li>
              ))}
            </ul>
          )}
          <Sparkline points={coin.sparkline} width={560} height={120} fluid area className="mt-8 h-20 text-marker md:h-[120px]" />
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to={`/coin/${coin.id}`} className="btn-marker">
              Look closer
            </Link>
            {!user && (
              <Link to="/signup" className="btn border border-on-floor/25 text-on-floor hover:border-on-floor/60">
                Practice with {money(config.starting_cash, { digits: 0 })}
              </Link>
            )}
          </div>
        </div>

        <ul className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-sheet bg-on-floor/10 sm:grid-cols-4 lg:grid-cols-2">
          {majors.map((r) => (
            <li key={r.id} className="bg-floor">
              <Link to={`/coin/${r.id}`} className="block p-4 transition-colors hover:bg-on-floor/[0.06]">
                <div className="flex items-center gap-2 text-sm">
                  <CoinMark src={r.image} symbol={r.symbol} size={20} />
                  <span className="font-medium">{r.symbol}</span>
                  <span className={`num ml-auto text-xs ${changeTone(r.change_24h)}`}>{pct(r.change_24h)}</span>
                </div>
                <LivePrice value={price(r)} className="mt-3 block text-lg font-light" />
                <Sparkline points={r.sparkline} width={160} height={28} fluid className="mt-2 text-on-floor/45" />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="scroll-x overflow-x-auto border-t border-on-floor/10 py-3 text-sm" aria-hidden>
        <div className="tape flex gap-8 pl-4">
          {[...tape, ...tape].map((r, i) => (
            <span key={`${r.id}-${i}`} className="flex shrink-0 items-center gap-2">
              <span className="text-on-floor/60">{r.symbol}</span>
              <span className="num">{money(price(r))}</span>
              <span className={`num ${changeTone(r.change_24h)}`}>{pct(r.change_24h)}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
