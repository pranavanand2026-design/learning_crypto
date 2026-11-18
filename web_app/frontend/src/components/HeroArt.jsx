import { useState } from "react";

// Landing hero background: coin stacks that grow into trees. Money, planted
// patiently, compounding. Uses the photo at public/hero.webp; if it's missing,
// falls back to the same idea drawn in SVG in the brand palette.

const GROUND = 418;
const COIN_H = 8;
const STACKS = [
  { x: 690, coins: 4, canopy: 30 },
  { x: 800, coins: 8, canopy: 40 },
  { x: 915, coins: 13, canopy: 52 },
  { x: 1045, coins: 19, canopy: 68 },
];

// A soft cluster of leaves: fixed offsets so the shape is stable across renders.
const LEAVES = [
  [0, 0, 1], [-0.62, 0.18, 0.72], [0.62, 0.16, 0.74], [-0.34, -0.42, 0.7], [0.36, -0.44, 0.7],
  [0, -0.7, 0.6], [-0.85, -0.2, 0.5], [0.86, -0.18, 0.52], [-0.2, 0.4, 0.62], [0.28, 0.42, 0.6],
];

function Stack({ x, coins, canopy, i }) {
  const top = GROUND - coins * COIN_H;
  const trunkTop = top - canopy * 1.25;
  const cy = trunkTop - canopy * 0.35;
  const delay = 0.25 + i * 0.22;
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x} cy={GROUND + 10} rx={58} ry={9} fill="rgb(0 0 0)" fillOpacity="0.22" />
      {/* coins */}
      <g className="grove-rise" style={{ animationDelay: `${delay}s` }}>
        {Array.from({ length: coins }, (_, c) => {
          const y = GROUND - c * COIN_H;
          return (
            <g key={c}>
              <path
                d={`M${x - 42},${y - 4} v${COIN_H} a42,11 0 0 0 84,0 v-${COIN_H}`}
                fill="url(#coin-side)"
                stroke="rgb(var(--accent-hi))"
                strokeOpacity="0.25"
                strokeWidth="0.8"
              />
            </g>
          );
        })}
        <ellipse cx={x} cy={top - 4} rx={42} ry={11} fill="url(#coin-top)" stroke="rgb(var(--accent-hi))" strokeOpacity="0.45" />
        <ellipse cx={x} cy={top - 4} rx={30} ry={7.5} fill="none" stroke="rgb(var(--accent-hi))" strokeOpacity="0.3" />
      </g>
      {/* tree */}
      <g className="grove-grow" style={{ animationDelay: `${delay + 0.55}s` }}>
        <path
          d={`M${x},${top - 4} C${x - 3},${top - canopy * 0.5} ${x + 4},${top - canopy * 0.9} ${x},${trunkTop}`}
          stroke="#7A6A55"
          strokeWidth={Math.max(2.5, canopy / 12)}
          strokeLinecap="round"
          fill="none"
        />
        <path d={`M${x},${top - canopy * 0.7} q${canopy * 0.25},-${canopy * 0.2} ${canopy * 0.4},-${canopy * 0.45}`} stroke="#7A6A55" strokeWidth="2" fill="none" strokeLinecap="round" />
        {LEAVES.map(([dx, dy, r], k) => (
          <circle key={k} cx={x + dx * canopy} cy={cy + dy * canopy} r={r * canopy * 0.62} fill={k % 3 === 0 ? "#3E9A78" : k % 3 === 1 ? "#2E7D62" : "#57AE8A"} />
        ))}
        <circle cx={x - canopy * 0.25} cy={cy - canopy * 0.3} r={canopy * 0.55} fill="url(#leaf-light)" />
      </g>
    </g>
  );
}

export default function HeroArt() {
  const [photo, setPhoto] = useState(true);
  if (photo) {
    return (
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <img
          src="/hero.webp"
          alt=""
          onError={() => setPhoto(false)}
          className="hero-photo absolute inset-0 h-full w-full object-cover object-[78%_center] opacity-35 md:opacity-100"
        />
        {/* keep the text side calm and blend the photo into the band */}
        <div className="absolute inset-0 bg-gradient-to-r from-floor via-floor/60 to-transparent md:via-floor/10" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-floor/70 to-transparent" />
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 500" preserveAspectRatio="xMaxYMax slice">
        <defs>
          <linearGradient id="coin-side" x1="0" x2="1">
            <stop offset="0" stopColor="#5E7F74" />
            <stop offset="0.45" stopColor="#B9D3C7" />
            <stop offset="1" stopColor="#4C6A60" />
          </linearGradient>
          <linearGradient id="coin-top" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#D8E9E0" />
            <stop offset="1" stopColor="#8FAEA2" />
          </linearGradient>
          <radialGradient id="leaf-light">
            <stop offset="0" stopColor="#B8E6CF" stopOpacity="0.45" />
            <stop offset="1" stopColor="#B8E6CF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sun" cx="0.92" cy="0.05" r="0.75">
            <stop offset="0" stopColor="#F3E9C6" stopOpacity="0.22" />
            <stop offset="0.5" stopColor="#8FD6B4" stopOpacity="0.07" />
            <stop offset="1" stopColor="#8FD6B4" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="table" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ECF3EF" stopOpacity="0.07" />
            <stop offset="1" stopColor="#ECF3EF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="1200" height="500" fill="url(#sun)" />
        <rect x="0" y={GROUND - 6} width="1200" height={500 - GROUND + 6} fill="url(#table)" />
        <g opacity="0.55">
          {STACKS.map((s, i) => (
            <Stack key={s.x} {...s} i={i} />
          ))}
        </g>
      </svg>
      {/* keep the text side calm */}
      <div className="absolute inset-0 bg-gradient-to-r from-floor via-floor/80 to-transparent md:via-floor/40" />
    </div>
  );
}
