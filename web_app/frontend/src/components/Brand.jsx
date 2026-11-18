import { Link } from "react-router-dom";

/** The CryptoDash mark: a "C" that opens onto a rising arrow over bars. */
export function Mark({ size = 28, tile = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="cd-c" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3E46B" />
          <stop offset="1" stopColor="#D9C33A" />
        </linearGradient>
        <linearGradient id="cd-bars" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F3E46B" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F3E46B" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {tile && <rect width="64" height="64" rx="15" fill="#0E1418" />}
      <path d="M45.4 17.4A20.5 20.5 0 1 0 45.4 46.6" fill="none" stroke="url(#cd-c)" strokeWidth="8.5" strokeLinecap="butt" />
      <rect x="31" y="38" width="4" height="7" rx="1" fill="url(#cd-bars)" />
      <rect x="37" y="34" width="4" height="11" rx="1" fill="url(#cd-bars)" />
      <rect x="43" y="30" width="4" height="15" rx="1" fill="url(#cd-bars)" />
      <path d="M21 41l9.5-9.5 6 5L51 22" fill="none" stroke="#F3E46B" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M55.5 17.5l-1.6 9.6-8-7.4z" fill="#F3E46B" />
    </svg>
  );
}

export function Wordmark({ className = "", size = 28 }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 text-[17px] font-semibold tracking-tight ${className}`} aria-label="CryptoDash home">
      <Mark size={size} />
      <span>
        Crypto<span className="text-brand">Dash</span>
      </span>
    </Link>
  );
}
