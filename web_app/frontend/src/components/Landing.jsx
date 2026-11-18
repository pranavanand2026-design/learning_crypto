import { Link } from "react-router-dom";
import { money } from "../lib/format";
import { useAuth } from "../state/auth";
import { Tape } from "./Floor";
import { JournalIcon, MarketIcon, ProgressIcon } from "./Icons";

const STEPS = [
  {
    Icon: MarketIcon,
    title: "Trade the real market",
    body: "Live prices from real exchanges, real fees and slippage. Only the money is pretend.",
  },
  {
    Icon: JournalIcon,
    title: "Say why",
    body: "Every buy asks for your reason, your time frame and how sure you are. It all goes in your journal.",
  },
  {
    Icon: ProgressIcon,
    title: "See what kind of investor you are",
    body: "We check your calls when the time is up and show your patterns: chasing hype, trading on tilt, overconfidence.",
  },
];

/** What a first-time visitor sees above the market. */
export default function Landing({ rows, ticks }) {
  const { config } = useAuth();
  const price = (r) => ticks[r.live_product]?.price ?? r.price;
  const tape = (rows || []).filter((r) => {
    const s = r.sparkline || [];
    return s.length < 10 || (Math.max(...s) - Math.min(...s)) / Math.min(...s) >= 0.015;
  });

  return (
    <>
      <section className="relative left-1/2 -mt-6 w-screen -translate-x-1/2 overflow-hidden bg-floor text-on-floor md:-mt-10">
        <div className="mx-auto max-w-page px-4 pb-16 pt-16 md:px-6 md:pb-24 md:pt-24">
          <h1 className="max-w-4xl text-[2.5rem] font-light leading-[1.04] tracking-tight md:text-[4.25rem]">
            Find out what kind of investor you are, before it costs you.
          </h1>
          <p className="mt-6 max-w-xl text-md leading-relaxed text-on-floor/75">
            Trade the live crypto market with {money(config.starting_cash, { digits: 0, raw: true })} of practice money. Every trade asks why you
            made it, and shows you how your judgment holds up.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link to="/signup" className="btn bg-accent-hi !px-7 !py-3.5 text-floor hover:brightness-105">
              Start practising free
            </Link>
            <Link to="/login" className="text-sm text-on-floor/75 underline decoration-on-floor/30 underline-offset-4 hover:text-on-floor">
              I already have an account
            </Link>
          </div>
        </div>
        {tape.length > 0 && <Tape rows={tape.slice(0, 40)} price={price} />}
      </section>

      <section aria-label="How it works" className="border-b border-rule py-16 md:py-20">
        <ol className="grid gap-10 md:grid-cols-3 md:gap-12">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-marker text-on-marker">
                  <step.Icon width={20} height={20} />
                </span>
                <span className="num text-sm text-graphite">Step {i + 1}</span>
              </div>
              <h2 className="mt-5 text-lg font-medium tracking-tight">{step.title}</h2>
              <p className="mt-2 max-w-sm leading-relaxed text-graphite">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="pt-14">
        <h2 className="text-xl font-medium tracking-tight">Today's market</h2>
        <p className="mt-1 text-sm text-graphite">Live prices, and how much attention each coin is getting compared with its normal.</p>
      </div>
    </>
  );
}
