import { Link } from "react-router-dom";
import { money } from "../lib/format";
import { useAuth } from "../state/auth";
import { Tape } from "./Floor";
import HeroArt from "./HeroArt";
import StepStory from "./StepStory";

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
        <HeroArt />
        <div className="relative mx-auto max-w-page px-4 pb-16 pt-16 md:px-6 md:pb-28 md:pt-28">
          <h1 className="max-w-4xl text-[2.5rem] font-light leading-[1.04] tracking-tight md:text-[4.25rem]">
            Find out what kind of investor you are, before it costs you.
          </h1>
          <p className="mt-6 max-w-xl text-md leading-relaxed text-on-floor/75">
            Trade the live crypto market with {money(config.starting_cash, { digits: 0, raw: true })} of practice money. Every trade asks why you
            made it, and shows you how your judgment holds up.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link to="/signup" className="btn btn-lift bg-accent-hi !px-7 !py-3.5 text-floor">
              Start practising free
            </Link>
            <Link to="/login" className="link-draw text-sm text-on-floor/75 hover:text-on-floor">
              I already have an account
            </Link>
          </div>
        </div>
        {tape.length > 0 && (
          <div className="relative bg-floor/80 backdrop-blur-sm">
            <Tape rows={tape.slice(0, 40)} price={price} />
          </div>
        )}
      </section>

      <StepStory rows={rows} ticks={ticks} />

      <div className="border-t border-rule pt-14">
        <h2 className="text-xl font-medium tracking-tight">Today's market</h2>

      </div>
    </>
  );
}
