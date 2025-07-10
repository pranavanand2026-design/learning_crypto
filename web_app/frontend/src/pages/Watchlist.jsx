import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMarketsByIds } from "../services/coingecko";
import { useAuth } from "../state/AuthContext";
import { useUserCurrency } from "../hooks/useUserCurrency";
import {
  WATCHLIST_CHANGED_EVENT,
  fetchWatchlist,
  notifyWatchlistChanged,
  removeFromWatchlist,
} from "../services/watchlist";

const PAGE_SIZE = 10;

export default function Watchlist() {
  const { authFetch } = useAuth();
  const {
    currency: userCurrency,
    format: formatCurrency,
  } = useUserCurrency();

  const formatAbbrev = useCallback(
    (value) => {
      if (value == null) return "—";
      const abs = Math.abs(value);
      if (abs >= 1e12) return formatCurrency(value / 1e12) + "T";
      if (abs >= 1e9) return formatCurrency(value / 1e9) + "B";
      if (abs >= 1e6) return formatCurrency(value / 1e6) + "M";
      return formatCurrency(value);
    },
    [formatCurrency]
  );
  const [watchlist, setWatchlist] = useState([]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // UI controls
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("market_cap"); // 'price' | 'change' | 'market_cap'
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  const refreshWatchlist = useCallback(async () => {
    try {
      const list = await fetchWatchlist(authFetch);
      setWatchlist(list);
    } catch (e) {
      // ignore individual errors; transient
    }
  }, [authFetch]);

  // Load watchlist from backend
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (cancel) return;
      await refreshWatchlist();
    })();
    return () => {
      cancel = true;
    };
  }, [refreshWatchlist]);

  useEffect(() => {
    function handleWatchlistChange(evt) {
      if (evt?.detail?.source === "watchlist") return;
      refreshWatchlist();
    }
    window.addEventListener(WATCHLIST_CHANGED_EVENT, handleWatchlistChange);
    return () => {
      window.removeEventListener(WATCHLIST_CHANGED_EVENT, handleWatchlistChange);
    };
  }, [refreshWatchlist]);

  const watchedIds = useMemo(() => watchlist.map((w) => w.coin_id || w.coin?.id).filter(Boolean), [watchlist]);

  // fetch current data for watched ids
  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!watchedIds.length) {
        setRows([]);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchMarketsByIds({
          ids: watchedIds,
          vsCurrency: (userCurrency || "USD").toLowerCase(),
          order: "market_cap_desc",
          priceChangePct: "1h,24h,7d",
          sparkline: false,
        });
        if (!cancel) setRows(data);
      } catch (e) {
        if (!cancel) setErr(e.message || "Failed to load watchlist");
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => { cancel = true; clearInterval(id); };
  }, [watchedIds, userCurrency]);

  async function remove(id) {
    const item = watchlist.find((w) => (w.coin_id || w.coin?.id) === id);
    if (!item) return;
    try {
      await removeFromWatchlist(authFetch, item.id);
      setWatchlist((prev) => prev.filter((w) => (w.coin_id || w.coin?.id) !== id));
      notifyWatchlistChanged({ type: "removed", coinId: id, source: "watchlist" });
    } catch (e) {
      setErr(e.message || "Failed to update watchlist");
    }
  }

  // filter + sort
  const filtered = useMemo(() => {
    let out = rows;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.symbol || "").toLowerCase().includes(q)
      );
    }
    return [...out].sort((a, b) => {
      let aVal = 0, bVal = 0;
      if (sortKey === "price") {
        aVal = a.current_price ?? 0; bVal = b.current_price ?? 0;
      } else if (sortKey === "change") {
        aVal = a.ch24h ?? -Infinity; bVal = b.ch24h ?? -Infinity;
      } else {
        aVal = a.market_cap ?? 0; bVal = b.market_cap ?? 0;
      }
      if (aVal === bVal) return 0;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [rows, query, sortKey, sortDir]);

  // paginate
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const trend = (v) => (v == null ? "" : v >= 0 ? "text-success" : "text-error");

  return (
    <div className="min-h-screen bg-base-200">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Watchlist</h1>
            <p className="text-sm text-base-content/70">
              Your tracked coins with live prices and 24h changes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input input-bordered input-sm"
              placeholder="Search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            />
            <select
              className="select select-bordered select-sm"
              value={sortKey}
              onChange={(e) => { setSortKey(e.target.value); setPage(1); }}
            >
              <option value="market_cap">Market cap</option>
              <option value="price">Price</option>
              <option value="change">24h change</option>
            </select>
            <select
              className="select select-bordered select-sm"
              value={sortDir}
              onChange={(e) => { setSortDir(e.target.value); setPage(1); }}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>

        {!watchedIds.length ? (
          <div className="rounded-box bg-base-100 p-6 text-sm shadow">
            You haven’t added any coins yet. Go to the <span className="font-medium">Dashboard</span> and click “Add” next to a coin to start your watchlist.
          </div>
        ) : (
          <div className="rounded-box bg-base-100 p-6 shadow">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Price</th>
                    <th>1 h</th>
                    <th>24 h</th>
                    <th>7 d</th>
                    <th>Market Cap</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-sm text-base-content/60">
                        <div className="flex items-center gap-2">
                          <span className="loading loading-spinner loading-sm" />
                          Loading watchlist…
                        </div>
                      </td>
                    </tr>
                  ) : err ? (
                    <tr>
                      <td colSpan={7} className="text-sm text-error">
                        {err}
                      </td>
                    </tr>
                  ) : pageRows.length ? (
                    pageRows.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <img src={c.image} alt={c.name} className="h-8 w-8 rounded-full" />
                            <div>
                              <div className="font-semibold">{c.name}</div>
                              <div className="text-xs uppercase text-base-content/70">
                                {c.symbol}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="font-mono text-sm">{formatCurrency(c.current_price)}</td>
                        <td className={`text-sm ${trend(c.ch1h)}`}>
                          {c.ch1h == null ? "—" : `${c.ch1h >= 0 ? "+" : ""}${c.ch1h.toFixed(2)}%`}
                        </td>
                        <td className={`text-sm ${trend(c.ch24h)}`}>
                          {c.ch24h == null ? "—" : `${c.ch24h >= 0 ? "+" : ""}${c.ch24h.toFixed(2)}%`}
                        </td>
                        <td className={`text-sm ${trend(c.ch7d)}`}>
                          {c.ch7d == null ? "—" : `${c.ch7d >= 0 ? "+" : ""}${c.ch7d.toFixed(2)}%`}
                        </td>
                        <td className="text-sm text-base-content/70">
                          {formatAbbrev(c.market_cap)}
                        </td>
                        <td className="text-right">
                          <button className="btn btn-xs btn-outline btn-error" onClick={() => remove(c.id)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center text-sm text-base-content/60">
                        No results.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* pager */}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="btn btn-sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Prev
              </button>
              <span className="text-sm">
                {page}/{totalPages}
              </span>
              <button className="btn btn-sm" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
