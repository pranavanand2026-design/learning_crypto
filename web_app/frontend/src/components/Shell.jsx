import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../state/auth";
import { useAccount } from "../state/account";
import { money } from "../lib/format";
import { Wordmark } from "./Brand";
import Avatar from "./Avatar";

const NAV = [
  { to: "/", label: "Market", end: true },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/journal", label: "Journal" },
  { to: "/progress", label: "Progress" },
];


export default function Shell() {
  const { user } = useAuth();
  const { data: account } = useAccount();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // First visit after signing up: set up before trading.
  if (user && account && !account.onboarded) return <Navigate to="/welcome" replace />;

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
            {user ? (
              <>
                <div className="flex items-center rounded-chip border border-rule bg-sheet py-1 pl-4 pr-1">
                  {account && (
                    <Link to="/portfolio" className="mr-3 hidden leading-tight sm:block" title="Cash available to trade">
                      <span className="block text-[11px] text-graphite">Cash</span>
                      <span className="num block text-sm font-medium">{money(account.cash, { digits: 0 })}</span>
                    </Link>
                  )}
                  <Link to="/settings" aria-label="Settings" className="rounded-full">
                    <Avatar user={user} size={32} />
                  </Link>
                </div>
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
          <span>Prices from CoinGecko and Coinbase</span>
        </div>
      </footer>
    </div>
  );
}
