// Small line icons (24px grid, 1.8 stroke) used in navigation and lists.
const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

export const MarketIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-4 3 3 5-6" />
  </svg>
);
export const WalletIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M20 7H5a2 2 0 010-4h13v4" />
    <path d="M3 5v14a2 2 0 002 2h15V7" />
    <path d="M16 14h.01" />
  </svg>
);
export const JournalIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 4.5A2.5 2.5 0 016.5 2H20v18H6.5A2.5 2.5 0 004 22.5z" />
    <path d="M4 4.5V20" />
    <path d="M9 7h7M9 11h5" />
  </svg>
);
export const ProgressIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);
export const PenIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
  </svg>
);
