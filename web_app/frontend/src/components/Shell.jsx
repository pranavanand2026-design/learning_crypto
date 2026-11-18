import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../state/auth";
import { useAccount } from "../state/account";
import { money } from "../lib/format";
import { useTheme } from "../lib/theme";
import { useLiveStatus } from "../lib/live";

const NAV = [
  { to: "/", label: "Market", end: true },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/journal", label: "Journal" },
  { to: "/progress", label: "Progress" },
];

export function Wordmark({ className = "" }) {
  return (
    <Link to="/" className={`group inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-ink" />
        <path d="M7 21l5-6 4 3 4-7 5 5" fill="none" className="stroke-marker" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>CryptoDash</span>
    </Link>
  );
}

function LiveDot() {
  const status = useLiveStatus();
  if (status === "idle") return null;
  const label = status === "live" ? "Live prices" : status === "connecting" ? "Connecting" : "Prices delayed";
  return (
    <span className="hidden items-center gap-1.5 text-xs text-graphite lg:inline-flex" title={label}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "live" ? "bg-gain" : "bg-graphite/50"}`} />
      {label}
    </span>
  );
}

export default function Shell() {
  const { user } = useAuth();
  const { data: account } = useAccount();
  const [theme, setTheme] = useTheme();
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-sheet focus:p-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-page items-center gap-6 px-4 md:px-6">
          <Wordmark />
          {user && (
            <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `rounded-chip px-3 py-1.5 text-sm transition-colors ${isActive ? "bg-ink text-paper" : "text-graphite hover:text-ink"}`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-3">
            <LiveDot />
            {user ? (
              <>
                {account && (
                  <Link to="/portfolio" className="num hidden text-sm sm:block" title="Cash available">
                    <span className="text-graphite">Cash </span>
                    {money(account.cash)}
                  </Link>
                )}
                <Link
                  to="/account"
                  className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-semibold text-paper"
                  aria-label="Account"
                >
                  {(user.display_name || user.email || "?").slice(0, 1).toUpperCase()}
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-graphite hover:text-ink">
                  Log in
                </Link>
                <Link to="/signup" className="btn-ink !px-4 !py-2">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
        {user && (
          <nav className="scroll-x flex gap-1 overflow-x-auto border-t border-rule px-4 py-2 md:hidden" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `shrink-0 rounded-chip px-3 py-1 text-sm ${isActive ? "bg-ink text-paper" : "text-graphite"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-page flex-1 px-4 pb-20 pt-6 md:px-6 md:pt-10">
        <Outlet />
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-graphite md:px-6">
          <span>Practice money, live markets. Nothing here is financial advice.</span>
          <span className="flex items-center gap-4">
            <span>Prices from CoinGecko and Coinbase</span>
            <button className="link" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </button>
          </span>
        </div>
      </footer>
    </div>
  );
}
