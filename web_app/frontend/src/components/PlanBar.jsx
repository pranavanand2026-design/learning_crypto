import { money } from "../lib/format";

/** Where the price sits between your stop, your cost and your target. */
export default function PlanBar({ position }) {
  const { stop_price: stop, target_price: target, avg_cost: cost, price } = position;
  if (!price || (!stop && !target)) return null;
  const lo = Math.min(stop ?? cost * 0.9, price, cost) * 0.995;
  const hi = Math.max(target ?? cost * 1.1, price, cost) * 1.005;
  const at = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="pt-6" aria-label="Your plan">
      <div className="relative h-1.5 rounded-full bg-rule">
        {stop && <span className="absolute inset-y-0 left-0 rounded-l-full bg-loss/35" style={{ width: at(stop) }} />}
        {target && <span className="absolute inset-y-0 right-0 rounded-r-full bg-gain/35" style={{ left: at(target) }} />}
        <span className="absolute -top-1 h-3.5 w-px bg-graphite" style={{ left: at(cost) }} />
        <span
          className="absolute -top-[5px] h-4 w-4 -translate-x-1/2 rounded-full border-2 border-sheet bg-accent shadow"
          style={{ left: at(price) }}
          title={`Now ${money(price)}`}
        />
      </div>
      <div className="num mt-2 flex justify-between text-xs text-graphite">
        <span>{stop ? `Stop ${money(stop)}` : ""}</span>
        <span>Cost {money(cost)}</span>
        <span>{target ? `Target ${money(target)}` : ""}</span>
      </div>
    </div>
  );
}
