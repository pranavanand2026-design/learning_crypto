export default function Sparkline({ points, width = 112, height = 32, className = "" }) {
  if (!points || points.length < 2) return <span className="inline-block" style={{ width, height }} />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${(height - 2 - ((p - min) / span) * (height - 4)).toFixed(1)}`)
    .join("");
  const lastY = height - 2 - ((points[points.length - 1] - min) / span) * (height - 4);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={lastY} r="2" fill="currentColor" />
    </svg>
  );
}
