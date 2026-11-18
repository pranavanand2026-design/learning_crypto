// Background for the landing hero: chart paper, calm contour lines, and one
// price line annotated with the moments CryptoDash cares about.
const POINTS = [
  [0, 372], [110, 352], [210, 380], [320, 330], [420, 346], [510, 292], [600, 314],
  [690, 240], [770, 266], [850, 200], [930, 226], [1010, 158], [1090, 178], [1200, 116],
];

/** Smooth a polyline into cubic Béziers (Catmull-Rom). */
function smooth(points) {
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i - 1] || points[i];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[i + 2] || points[i + 1];
    d += ` C${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ${x2},${y2}`;
  }
  return d;
}

// Sit the line low and to the right so it never runs under the headline.
const LIFT = 92;
for (const pt of POINTS) pt[1] += LIFT;

const LINE = smooth(POINTS);
const CONTOURS = [48, 96, 150, 210].map((dy, k) =>
  smooth(POINTS.map(([x, y], i) => [x, y + dy + Math.sin(i * 1.3 + k) * (10 + k * 4)])),
);
const MARKS = [
  { at: 7, label: "Bought, 70% sure", delay: 1.3 },
  { at: 9, label: "Checked: called it", delay: 1.7 },
  { at: 11, label: "Held my plan", delay: 2.1 },
];

export default function HeroArt() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1200 500"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden
    >
      <defs>
        <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="rgb(var(--on-floor))" strokeOpacity="0.07" strokeWidth="1" />
        </pattern>
        <linearGradient id="hero-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0.25" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="hero-mask">
          <rect width="1200" height="500" fill="url(#hero-fade)" />
        </mask>
        <radialGradient id="hero-glow" cx="0.82" cy="0.3" r="0.55">
          <stop offset="0" stopColor="rgb(var(--accent-hi))" stopOpacity="0.16" />
          <stop offset="1" stopColor="rgb(var(--accent-hi))" stopOpacity="0" />
        </radialGradient>
        <filter id="hero-blur" x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <rect width="1200" height="500" fill="url(#hero-glow)" />
      <g mask="url(#hero-mask)">
        <rect width="1200" height="500" fill="url(#hero-grid)" />
        {CONTOURS.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="rgb(var(--accent-hi))" strokeOpacity={0.14 - i * 0.025} strokeWidth="1.2" />
        ))}
        <path d={LINE} fill="none" stroke="rgb(var(--accent-hi))" strokeOpacity="0.45" strokeWidth="8" filter="url(#hero-blur)" className="hero-draw" />
        <path d={LINE} fill="none" stroke="rgb(var(--accent-hi))" strokeWidth="2.5" strokeLinecap="round" className="hero-draw" />
        {MARKS.map(({ at, label, delay }) => {
          const [x, y] = POINTS[at];
          const w = label.length * 7.4 + 24;
          return (
            <g key={label} className="hero-mark" style={{ animationDelay: `${delay}s` }}>
              <circle cx={x} cy={y} r="11" fill="rgb(var(--accent-hi))" fillOpacity="0.18" />
              <circle cx={x} cy={y} r="5" fill="rgb(var(--floor))" stroke="rgb(var(--accent-hi))" strokeWidth="2.5" />
              <g transform={`translate(${x - w / 2}, ${y - 52})`}>
                <rect width={w} height="28" rx="14" fill="rgb(var(--floor))" stroke="rgb(var(--accent-hi))" strokeOpacity="0.5" />
                <text x={w / 2} y="18.5" textAnchor="middle" fontSize="13" fill="rgb(var(--on-floor))" fillOpacity="0.9" fontFamily="Geist Variable, sans-serif">
                  {label}
                </text>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
