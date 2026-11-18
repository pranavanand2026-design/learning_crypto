import { Link } from "react-router-dom";
import { when } from "../lib/format";
import CoinMark from "./CoinMark";

export function Headline({ item, showCoins = true, size = "md" }) {
  return (
    <article className="group">
      <div className="mb-1 flex items-center gap-3 text-xs text-graphite">
        <span className="text-ink/80">{item.source}</span>
        <time dateTime={item.published}>{when(item.published)}</time>
      </div>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`font-serif ${size === "lg" ? "text-lg" : "text-md"} leading-snug decoration-marker decoration-2 underline-offset-4 hover:underline`}
      >
        {item.title}
      </a>
      {showCoins && item.coins?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.coins.map((c) => (
            <Link key={c.id} to={`/coin/${c.id}`} className="chip gap-1.5 !py-0.5">
              <CoinMark src={c.image} symbol={c.symbol} size={14} />
              {c.symbol}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

export function Wire({ items }) {
  if (!items?.length) return null;
  const [lead, ...rest] = items;
  return (
    <section aria-label="Headlines" className="grid gap-x-10 gap-y-6 border-b border-rule pb-8 md:grid-cols-[1.4fr_1fr_1fr]">
      <Headline item={lead} size="lg" />
      {rest.slice(0, 2).map((i) => (
        <Headline key={i.url} item={i} />
      ))}
    </section>
  );
}
