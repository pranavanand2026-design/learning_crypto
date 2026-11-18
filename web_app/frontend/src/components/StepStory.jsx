import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { money } from "../lib/format";

const STEPS = [
  { kicker: "01 · The market", title: "Trade the real market", body: "Live prices, real fees. Pretend money." },
  { kicker: "02 · The thinking", title: "Say why", body: "Every buy asks why, and how sure you are." },
  { kicker: "03 · The revelation", title: "Discover your investor behaviour", body: "Your habits, made visible." },
];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const span = (p, a, b) => clamp((p - a) / (b - a)); // 0..1 as p moves from a to b
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ 01 */
function useCandles(n = 46) {
  return useMemo(() => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let price = 100;
    return Array.from({ length: n }, (_, i) => {
      const open = price;
      const drift = 0.35 + Math.sin(i / 5) * 0.9;
      const close = open + drift + (rnd() - 0.48) * 3.2;
      const high = Math.max(open, close) + rnd() * 1.6;
      const low = Math.min(open, close) - rnd() * 1.6;
      price = close;
      return { open, close, high, low };
    });
  }, [n]);
}

function Cursor({ x, y, pressing }) {
  return (
    <div className="pointer-events-none absolute z-20 transition-[left,top] duration-500 ease-out" style={{ left: x, top: y }}>
      {pressing && <span className="absolute -left-3 -top-3 h-8 w-8 animate-ping rounded-full bg-accent-hi/50" />}
      <svg width="22" height="22" viewBox="0 0 24 24" className="drop-shadow-[0_2px_4px_rgb(0_0_0/0.4)]">
        <path d="M4 3l7 17 2.5-7L21 10.5z" fill="#fff" stroke="#16302A" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function MarketCard({ p, price }) {
  const candles = useCandles();
  const visible = 24;
  const offset = Math.round(p * (candles.length - visible));
  const shown = candles.slice(offset, offset + visible);
  const lo = Math.min(...shown.map((c) => c.low));
  const hi = Math.max(...shown.map((c) => c.high));
  const y = (v) => 8 + (1 - (v - lo) / (hi - lo || 1)) * 124;
  const balance = Math.round(10000 * span(p, 0.25, 0.55));
  const armed = p > 0.62;
  const clicked = p > 0.8;
  const cursor = p < 0.62 ? { x: "62%", y: "34%" } : { x: "80%", y: "83%" };

  return (
    <div className="relative w-full max-w-[440px]">
      <div className="relative overflow-hidden rounded-[22px] bg-[#0f211c]/90 p-5 text-on-floor shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/10 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#f7931a] text-[11px] font-bold text-white">₿</span>
            <span className="font-medium">BTC/USD</span>
            <span className="flex items-center gap-1 text-xs text-accent-hi">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-hi" />
              live
            </span>
          </div>
          <span className="num text-sm">{money(price)}</span>
        </div>

        <svg viewBox="0 0 264 140" preserveAspectRatio="none" className="mt-4 h-40 w-full" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1="0" x2="264" y1={10 + i * 40} y2={10 + i * 40} stroke="white" strokeOpacity="0.06" />
          ))}
          {shown.map((c, i) => {
            const up = c.close >= c.open;
            const x = 6 + i * 10.6;
            const col = up ? "rgb(var(--accent-hi))" : "rgb(var(--loss-hi))";
            return (
              <g key={offset + i}>
                <line x1={x + 3} x2={x + 3} y1={y(c.high)} y2={y(c.low)} stroke={col} strokeOpacity="0.8" />
                <rect x={x} y={y(Math.max(c.open, c.close))} width="6" height={Math.max(1.5, Math.abs(y(c.open) - y(c.close)))} rx="1" fill={col} />
              </g>
            );
          })}
        </svg>

        <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
          <div>
            <div className="text-xs text-on-floor/50">Practice balance</div>
            <div className="num text-2xl font-light">{money(balance, { digits: 0 })}</div>
          </div>
          <button
            type="button"
            tabIndex={-1}
            className={`rounded-chip px-6 py-2.5 text-sm font-medium transition-all duration-500 ${
              armed ? "bg-accent-hi text-floor shadow-[0_0_24px_rgb(var(--accent-hi)/0.55)]" : "bg-white/10 text-on-floor/40"
            } ${clicked ? "scale-95" : ""}`}
          >
            Buy
          </button>
        </div>
      </div>

      {/* floating order card */}
      <div
        className={`absolute -bottom-20 left-8 w-52 rounded-sheet bg-sheet p-4 text-ink shadow-[0_20px_50px_-12px_rgb(0_0_0/0.55)] transition-all duration-500 ${
          clicked ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between text-xs text-graphite">
          <span>Order filled</span>
          <span className="h-2 w-2 rounded-full bg-accent" />
        </div>
        <div className="num mt-1 text-lg">0.0231 BTC</div>
        <div className="num text-xs text-graphite">{money(1500, { digits: 0 })} at market</div>
      </div>

      <Cursor x={cursor.x} y={cursor.y} pressing={clicked && p < 0.92} />
    </div>
  );
}

/* ------------------------------------------------------------------ 02 */
const ANSWER = "Fear is high and outflows are slowing. I'll give it a week.";

function JournalCard({ p }) {
  const typed = Math.round(ANSWER.length * span(p, 0.15, 0.55));
  const sure = 50 + Math.round(span(p, 0.55, 0.85) * 20);
  const timeframe = p > 0.5;
  return (
    <div className="relative w-full max-w-[440px]">
      {/* thought bubbles */}
      {["Is this hype?", "Where do I get out?", "Would I buy tomorrow?"].map((t, i) => (
        <span
          key={t}
          className="absolute z-10 rounded-chip bg-floor/90 px-3 py-1.5 text-xs text-on-floor/80 shadow-lg ring-1 ring-white/10 transition-all duration-700"
          style={{
            left: ["-6%", "62%", "-10%"][i],
            top: ["-9%", "-14%", "82%"][i],
            opacity: span(p, 0.1 + i * 0.2, 0.25 + i * 0.2),
            transform: `translateY(${(1 - span(p, 0.1 + i * 0.2, 0.4 + i * 0.2)) * 14 - p * 10}px)`,
          }}
        >
          {t}
        </span>
      ))}

      <div className="rounded-[22px] bg-sheet p-6 text-ink shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)]">
        <div className="font-serif text-xl italic">Why are you buying?</div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {["Momentum", "In the news", "Long-term belief"].map((r) => (
            <span key={r} className={`chip ${r === "Long-term belief" && p > 0.08 ? "border-accent bg-marker text-on-marker" : ""}`}>
              {r}
            </span>
          ))}
        </div>
        <div className="mt-4 min-h-[3.5rem] rounded-field border border-rule bg-paper/60 px-3 py-2.5 font-serif text-md leading-snug">
          {ANSWER.slice(0, typed)}
          {typed < ANSWER.length && <span className="ml-0.5 inline-block h-5 w-px translate-y-1 animate-pulse bg-ink" />}
        </div>
        <div className="mt-5 flex gap-1.5">
          {["Tomorrow", "In a week", "In a month"].map((h) => (
            <span key={h} className={`chip transition-colors ${timeframe && h === "In a week" ? "border-accent bg-marker text-on-marker" : ""}`}>
              {h}
            </span>
          ))}
        </div>
        <div className="mt-5 flex items-baseline justify-between">
          <span className="text-sm text-graphite">Confidence</span>
          <span className="num text-2xl font-light">{sure}%</span>
        </div>
        <div className="relative mt-2 h-1.5 rounded-full bg-rule">
          <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${((sure - 50) / 40) * 100}%` }} />
          <div className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-sheet bg-accent shadow" style={{ left: `${((sure - 50) / 40) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 03 */
const TRAITS = [
  { label: "Hype chasing", v: 0.72 },
  { label: "Overconfidence", v: 0.64 },
  { label: "Emotional trading", v: 0.38 },
  { label: "Patience", v: 0.55 },
  { label: "Planning", v: 0.82 },
];

function InsightsCard({ p }) {
  const grow = span(p, 0.1, 0.6);
  const cx = 160;
  const cy = 122;
  const R = 82;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = TRAITS.map((t, i) => pt(i, R * t.v * grow).join(",")).join(" ");
  const ring = (f) => TRAITS.map((_, i) => pt(i, R * f).join(",")).join(" ");
  return (
    <div className="relative w-full max-w-[440px]">
      <div className="rounded-[22px] bg-[#0f211c]/90 p-6 text-on-floor shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/10 backdrop-blur">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-on-floor/60">Your investor profile</span>
          <span className={`text-sm font-medium text-accent-hi transition-opacity duration-500 ${p > 0.6 ? "opacity-100" : "opacity-0"}`}>The Planner</span>
        </div>
        <svg viewBox="0 0 320 244" className="mt-2 w-full" aria-hidden>
          {[0.33, 0.66, 1].map((f) => (
            <polygon key={f} points={ring(f)} fill="none" stroke="white" strokeOpacity="0.1" />
          ))}
          {TRAITS.map((_, i) => {
            const [x, y] = pt(i, R);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="white" strokeOpacity="0.08" />;
          })}
          <polygon points={poly} fill="rgb(var(--accent-hi))" fillOpacity="0.22" stroke="rgb(var(--accent-hi))" strokeWidth="2" strokeLinejoin="round" />
          {TRAITS.map((t, i) => {
            const [x, y] = pt(i, R * t.v * grow);
            return <circle key={t.label} cx={x} cy={y} r="3.5" fill="rgb(var(--accent-hi))" opacity={grow} />;
          })}
          {TRAITS.map((t, i) => {
            const [x, y] = pt(i, R + 22);
            return (
              <text key={t.label} x={x} y={y + 4} textAnchor="middle" fontSize="10.5" fill="currentColor" fillOpacity="0.7">
                {t.label}
              </text>
            );
          })}
        </svg>
      </div>
      {[
        { t: "Overconfident by 18 points", tone: "text-loss-hi", at: 0.62, pos: "-bottom-5 -left-4" },
        { t: "Calm after losses", tone: "text-accent-hi", at: 0.78, pos: "-bottom-5 -right-3" },
      ].map((b) => (
        <span
          key={b.t}
          className={`absolute ${b.pos} rounded-chip bg-floor px-3.5 py-2 text-sm shadow-xl ring-1 ring-white/10 transition-all duration-500 ${b.tone} ${
            p > b.at ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          {b.t}
        </span>
      ))}
    </div>
  );
}

function Visual({ index, p, price }) {
  if (index === 0) return <MarketCard p={p} price={price} />;
  if (index === 1) return <JournalCard p={p} />;
  return <InsightsCard p={p} />;
}

/* ------------------------------------------------------------------ stage */
/** The three steps, driven by scroll: each card plays out as you move through it. */
export default function StepStory({ rows, ticks }) {
  const refs = useRef([]);
  const [prog, setProg] = useState([0, 0, 0]);
  const btc = rows?.find((r) => r.id === "bitcoin") || rows?.[0];
  const price = btc ? ticks[btc.live_product]?.price ?? btc.price : null;

  useEffect(() => {
    if (reduced()) {
      setProg([1, 1, 1]);
      return;
    }
    let frame = null;
    const measure = () => {
      frame = null;
      const vh = window.innerHeight;
      setProg(
        refs.current.map((el) => {
          if (!el) return 0;
          const r = el.getBoundingClientRect();
          return clamp((vh * 0.75 - r.top) / (r.height * 0.85));
        }),
      );
    };
    const onScroll = () => frame || (frame = requestAnimationFrame(measure));
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // The step in view is the last one that has started.
  const active = Math.max(0, prog.reduce((acc, v, i) => (v > 0.02 ? i : acc), 0));

  return (
    <section aria-label="How it works" className="relative py-16 md:py-24">
      <div className="md:grid md:grid-cols-[1.15fr_1fr] md:gap-16">
        <div className="hidden md:block">
          <div className="sticky top-20 flex h-[78vh] min-h-[520px] items-center justify-center overflow-hidden rounded-[28px] bg-floor text-on-floor">
            <img
              src="/hero.webp"
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover object-[85%_bottom] opacity-50"
              style={{ transform: `scale(1.1) translateY(${-prog.reduce((a, b) => a + b, 0) * 12}px)` }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-floor/90 via-floor/50 to-floor/20" />
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="absolute inset-0 flex items-center justify-center px-12 transition-[opacity,transform] duration-700 ease-out"
                style={{
                  opacity: active === i ? 1 : 0,
                  transform: active === i ? "none" : i < active ? "translateY(-40px) scale(0.94) rotate(-2deg)" : "translateY(40px) scale(0.96)",
                }}
                aria-hidden={active !== i}
              >
                <Visual index={i} p={prog[i]} price={price} />
              </div>
            ))}
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${active === i ? "w-8 bg-accent-hi" : "w-1.5 bg-on-floor/30"}`} />
              ))}
            </div>
          </div>
        </div>

        <ol>
          {STEPS.map((step, i) => (
            <li key={step.title} ref={(el) => (refs.current[i] = el)} className="flex flex-col justify-center py-10 md:min-h-[95vh] md:py-0">
              <div className={`transition-opacity duration-500 ${active === i ? "md:opacity-100" : "md:opacity-30"}`}>
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-accent">{step.kicker}</div>
                <h3 className="mt-4 text-3xl font-light leading-tight tracking-tight md:text-[2.6rem]">{step.title}</h3>
                <p className="mt-3 max-w-md text-md text-graphite">{step.body}</p>
              </div>
              <div className="relative mt-10 flex justify-center overflow-visible rounded-[22px] bg-floor px-6 py-14 text-on-floor md:hidden">
                <Visual index={i} p={prog[i]} price={price} />
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-6 flex justify-center md:mt-10">
        <Link to="/signup" className="btn-accent btn-lift !px-7 !py-3.5">
          Start practising free
        </Link>
      </div>
    </section>
  );
}
