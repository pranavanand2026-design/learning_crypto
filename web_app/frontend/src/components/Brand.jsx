import { Link } from "react-router-dom";

/** The CryptoDash mark: a "C" that opens onto a rising arrow over bars. */
export function Mark({ size = 28, className = "text-brand" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={`shrink-0 ${className}`}>
      <path d="M45.4 17.4A20.5 20.5 0 1 0 45.4 46.6" fill="none" stroke="currentColor" strokeWidth="8.5" />
      <rect x="31" y="38" width="4" height="7" rx="1" fill="currentColor" opacity="0.35" />
      <rect x="37" y="34" width="4" height="11" rx="1" fill="currentColor" opacity="0.35" />
      <rect x="43" y="30" width="4" height="15" rx="1" fill="currentColor" opacity="0.35" />
      <path d="M21 41l9.5-9.5 6 5L51 22" fill="none" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M55.5 17.5l-1.6 9.6-8-7.4z" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className = "", size = 28 }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2 text-[17px] font-semibold tracking-tight ${className}`} aria-label="CryptoDash home">
      <Mark size={size + 4} />
      <span>
        Crypto<span className="text-brand">Dash</span>
      </span>
    </Link>
  );
}
