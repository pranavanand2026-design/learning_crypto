import { useState } from "react";

export default function CoinMark({ src, symbol, size = 28 }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (!src || broken) {
    return (
      <span
        style={style}
        className="inline-grid shrink-0 place-items-center rounded-full bg-rule text-[10px] font-semibold text-graphite"
        aria-hidden
      >
        {(symbol || "?").slice(0, 3)}
      </span>
    );
  }
  return (
    <img src={src} alt="" style={style} loading="lazy" onError={() => setBroken(true)} className="shrink-0 rounded-full" />
  );
}
