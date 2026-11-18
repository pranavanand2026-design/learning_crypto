import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CoinMark from "./CoinMark";
import LivePrice from "./LivePrice";
import Sparkline from "./Sparkline";
import { JournalIcon, MarketIcon, ProgressIcon } from "./Icons";

const STEPS = [
  {
    Icon: MarketIcon,
    title: "Trade the real market",
    body: "Live prices, real fees. Pretend money.",
  },
  {
    Icon: JournalIcon,
    title: "Say why",
    body: "Every buy asks why, and how sure you are.",
  },
  {
    Icon: ProgressIcon,
    title: "See what kind of investor you are",
    body: "We check your calls and show your patterns.",
  },
];

const THESIS = "Fear is high and outflows are slowing. I think the bottom is near.";
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Visual 1: the live market ---------- */
function LiveDemo({ coin, price }) {
  if (!coin) return <div className="h-40" />;
  return (
    <div className="w-full max-w-sm rounded-sheet bg-floor/80 p-6 shadow-[0_24px_60px_rgb(0_0_0/0.35)] ring-1 ring-on-floor/10 backdrop-blur">
      <div className="flex items-center gap-3">
        <CoinMark src={coin.image} symbol={coin.symbol} size={36} />
        <div>
          <div className="font-medium">{coin.name}</div>
          <div className="flex items-center gap-1.5 text-xs text-on-floor/60">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-hi" /> live
          </div>
        </div>
      </div>
      <LivePrice value={price} className="mt-5 text-4xl font-light tracking-tight" />
      <Sparkline points={coin.sparkline} width={300} height={70} fluid area className="mt-4 text-accent-hi" />
      <div className="mt-4 flex gap-2 text-xs">
        <span className="rounded-chip bg-on-floor/10 px-2.5 py-1">0.4% fee</span>
        <span className="rounded-chip bg-on-floor/10 px-2.5 py-1">Real order book</span>
      </div>
    </div>
  );
}

/* ---------- Visual 2: the trade ticket asks why ---------- */
function WhyDemo({ active }) {
  const [typed, setTyped] = useState(reduced() ? THESIS.length : 0);
  const [sure, setSure] = useState(reduced() ? 70 : 50);
  useEffect(() => {
    if (!active || reduced()) return;
    setTyped(0);
    setSure(50);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setTyped(i);
      if (i >= THESIS.length) clearInterval(t);
    }, 38);
    const s = setTimeout(() => setSure(70), THESIS.length * 38 + 200);
    return () => {
      clearInterval(t);
      clearTimeout(s);
    };
  }, [active]);
  return (
    <div className="w-full max-w-sm rounded-sheet bg-sheet p-6 text-ink shadow-[0_24px_60px_rgb(0_0_0/0.35)]">
      <div className="text-sm text-graphite">Why this, why now?</div>
      <div className="mt-2 min-h-[4.5rem] rounded-field border border-rule bg-paper/50 px-3 py-2.5 font-serif text-md leading-snug">
        {THESIS.slice(0, typed)}
        <span className="ml-0.5 inline-block h-5 w-px translate-y-1 animate-pulse bg-ink" />
      </div>
      <div className="mt-5 flex items-baseline justify-between">
        <span className="text-sm text-graphite">How sure are you?</span>
        <span className="num text-xl font-light">{sure}%</span>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-rule">
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${((sure - 50) / 40) * 100}%` }} />
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-sheet bg-accent shadow transition-[left] duration-700 ease-out"
          style={{ left: `${((sure - 50) / 40) * 100}%` }}
        />
      </div>
      <div className="mt-5 flex gap-1.5">
        {["Tomorrow", "In a week", "In a month"].map((h) => (
          <span key={h} className={`chip ${h === "In a week" ? "border-accent bg-marker text-on-marker" : ""}`}>
            {h}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Visual 3: the call is checked ---------- */
function ResultDemo({ active }) {
  return (
    <div className="relative w-full max-w-sm">
      <div className="rounded-sheet bg-sheet p-6 text-ink shadow-[0_24px_60px_rgb(0_0_0/0.35)]">
        <p className="font-serif text-md leading-snug">Bitcoin, 70% sure, one week.</p>
        <div className={`mt-4 inline-block -rotate-3 rounded-[6px] border-2 border-gain px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-gain ${active ? "stamp" : "opacity-0"}`}>
          Called it
        </div>
        <svg viewBox="0 0 240 120" className="mt-5 w-full text-graphite" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1="10" x2="230" y1={20 + i * 28} y2={20 + i * 28} className="stroke-rule" />
          ))}
          <line x1="10" y1="110" x2="230" y2="14" className="stroke-ink/40" strokeDasharray="4 4" />
          <circle cx="66" cy="86" r="6" className="fill-accent/40" />
          <circle cx="122" cy="66" r="7" className="fill-accent/60" />
          <circle cx="178" cy={active ? 40 : 4} r="9" className="fill-accent stroke-sheet transition-[cy] duration-700 ease-out" strokeWidth="2" style={{ transitionDelay: "300ms" }} />
        </svg>
      </div>
      <div
        className={`absolute -right-3 -top-5 flex items-center gap-2 rounded-chip bg-floor px-3 py-2 text-sm text-on-floor shadow-lg ring-1 ring-on-floor/10 transition-all duration-500 ${
          active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
        style={{ transitionDelay: "700ms" }}
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-accent-hi text-floor">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12l5 5 9-11" />
          </svg>
        </span>
        First call checked
      </div>
    </div>
  );
}

function Visual({ index, active, coin, price }) {
  if (index === 0) return <LiveDemo coin={coin} price={price} />;
  if (index === 1) return <WhyDemo active={active} />;
  return <ResultDemo active={active} />;
}

/** The three steps, told as you scroll: a sticky stage beside the words. */
export default function StepStory({ rows, ticks }) {
  const [active, setActive] = useState(0);
  const refs = useRef([]);
  const btc = rows?.find((r) => r.id === "bitcoin") || rows?.[0];
  const price = btc ? ticks[btc.live_product]?.price ?? btc.price : null;

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number(e.target.dataset.index))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section aria-label="How it works" className="relative py-16 md:py-24">
      <div className="md:grid md:grid-cols-[1.1fr_1fr] md:gap-16">
        {/* sticky stage (desktop) */}
        <div className="hidden md:block">
          <div className="sticky top-24 flex h-[72vh] min-h-[460px] items-center justify-center overflow-hidden rounded-[28px] bg-floor text-on-floor">
            <img src="/hero.webp" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[85%_bottom] opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-br from-floor/85 via-floor/40 to-transparent" />
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`absolute inset-0 flex items-center justify-center px-10 transition-all duration-500 ease-out ${
                  active === i ? "translate-y-0 opacity-100" : i < active ? "-translate-y-6 opacity-0" : "translate-y-6 opacity-0"
                }`}
                aria-hidden={active !== i}
              >
                <Visual index={i} active={active === i} coin={btc} price={price} />
              </div>
            ))}
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${active === i ? "w-8 bg-accent-hi" : "w-1.5 bg-on-floor/30"}`} />
              ))}
            </div>
          </div>
        </div>

        {/* the words */}
        <ol>
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              ref={(el) => (refs.current[i] = el)}
              data-index={i}
              className="flex flex-col justify-center py-10 md:min-h-[72vh] md:py-0"
            >
              <div className={`transition-opacity duration-500 ${active === i ? "md:opacity-100" : "md:opacity-35"}`}>
                <div className="flex items-center gap-3">
                  <span className={`grid h-11 w-11 place-items-center rounded-full transition-colors duration-300 ${active === i ? "bg-accent text-on-accent" : "bg-marker text-on-marker"}`}>
                    <step.Icon width={20} height={20} />
                  </span>
                </div>
                <h3 className="mt-5 text-2xl font-light tracking-tight md:text-3xl">{step.title}</h3>
                <p className="mt-3 max-w-md text-md leading-relaxed text-graphite">{step.body}</p>
              </div>
              {/* inline demo on phones */}
              <div className="mt-8 flex justify-center rounded-[22px] bg-floor px-5 py-10 text-on-floor md:hidden">
                <Visual index={i} active={active === i} coin={btc} price={price} />
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-6 flex justify-center md:mt-12">
        <Link to="/signup" className="btn-accent btn-lift !px-7 !py-3.5">
          Start practising free
        </Link>
      </div>
    </section>
  );
}
