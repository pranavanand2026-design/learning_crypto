"""Market data and execution prices.

Reference data (prices, charts, metadata) comes from CoinGecko. Fills are
simulated against Coinbase Exchange's live public order book when the coin is
listed there, so large orders in thin markets cost what they would in reality.
Everything is cached; when an upstream is unavailable the last good copy is
served instead of invented numbers.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, asdict
from datetime import datetime, timezone as dt_timezone
from decimal import Decimal, ROUND_DOWN

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

COINGECKO = "https://api.coingecko.com/api/v3"
COINBASE = "https://api.exchange.coinbase.com"
TIMEOUT = 10
STALE_TTL = 24 * 60 * 60

# Taker fee charged on every fill, in line with retail exchange pricing.
FEE_RATE = Decimal("0.004")
# Order sizes outside these bounds are rejected.
MIN_NOTIONAL = Decimal("1")


class MarketUnavailable(Exception):
    """Raised when no live or cached data exists for a request."""


def _cached_get(url, params=None, ttl=60, headers=None, key=None):
    cache_key = key or f"mkt:{url}:{sorted((params or {}).items())}"
    hit = cache.get(cache_key)
    if hit is not None:
        return hit
    try:
        resp = requests.get(url, params=params, headers=headers or {}, timeout=TIMEOUT)
        if resp.status_code in (400, 401) and headers:
            # A bad or revoked API key shouldn't take the app down.
            resp = requests.get(url, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        stale = cache.get(f"{cache_key}:stale")
        if stale is not None:
            logger.warning("Serving stale data for %s (%s)", url, exc)
            return stale
        raise MarketUnavailable(str(exc)) from exc
    cache.set(cache_key, data, ttl)
    cache.set(f"{cache_key}:stale", data, STALE_TTL)
    return data


def _cg(path, params=None, ttl=60):
    key = getattr(settings, "COINGECKO_API_KEY", "")
    headers = {"x-cg-demo-api-key": key} if key else None
    return _cached_get(f"{COINGECKO}{path}", params=params, ttl=ttl, headers=headers)


# --------------------------------------------------------------------------
# Reference data
# --------------------------------------------------------------------------
def markets(page=1, per_page=100, ids=None):
    params = {
        "vs_currency": "usd",
        "order": "market_cap_desc",
        "per_page": per_page,
        "page": page,
        "sparkline": "true",
        "price_change_percentage": "1h,24h,7d",
    }
    if ids:
        params["ids"] = ",".join(ids)
    return _cg("/coins/markets", params, ttl=90)


def market_row(coin_id):
    """Market snapshot for one coin (from the top list when possible)."""
    for row in markets():
        if row["id"] == coin_id:
            return row
    rows = markets(ids=[coin_id], per_page=1)
    if not rows:
        raise MarketUnavailable(f"Unknown coin {coin_id}")
    return rows[0]


def coin_detail(coin_id):
    return _cg(
        f"/coins/{coin_id}",
        {"localization": "false", "tickers": "false", "community_data": "false",
         "developer_data": "false", "sparkline": "false"},
        ttl=300,
    )


def chart(coin_id, days="7"):
    return _cg(f"/coins/{coin_id}/market_chart", {"vs_currency": "usd", "days": days}, ttl=300)


def price_history(coin_id, start: datetime, end: datetime):
    data = _cg(
        f"/coins/{coin_id}/market_chart/range",
        {"vs_currency": "usd", "from": int(start.timestamp()), "to": int(end.timestamp())},
        ttl=3600,
    )
    return data.get("prices", [])


def trending_ids():
    try:
        data = _cg("/search/trending", ttl=600)
    except MarketUnavailable:
        return []
    return [c["item"]["id"] for c in data.get("coins", [])]


def search(query):
    data = _cg("/search", {"query": query}, ttl=600)
    return data.get("coins", [])[:10]


# --------------------------------------------------------------------------
# Order book and fills
# --------------------------------------------------------------------------
def coinbase_bases():
    """Symbols with an online USD market on Coinbase Exchange."""
    try:
        products = _cached_get(f"{COINBASE}/products", ttl=6 * 60 * 60, key="cb:products")
    except MarketUnavailable:
        return set()
    return {
        p["base_currency"].upper()
        for p in products
        if p.get("quote_currency") == "USD" and p.get("status") == "online" and not p.get("trading_disabled")
    }


def live_product(symbol):
    symbol = (symbol or "").upper()
    return f"{symbol}-USD" if symbol in coinbase_bases() else None


def order_book(product_id):
    return _cached_get(f"{COINBASE}/products/{product_id}/book", {"level": 2}, ttl=4, key=f"cb:book:{product_id}")


@dataclass
class Fill:
    side: str
    quantity: Decimal
    price: Decimal          # average fill price
    mid_price: Decimal
    slippage_bps: Decimal
    notional: Decimal       # quantity * price
    fee: Decimal
    total: Decimal          # cash out for buys, cash in for sells
    source: str
    depth_used_pct: float | None = None

    def as_dict(self):
        out = asdict(self)
        return {k: (str(v) if isinstance(v, Decimal) else v) for k, v in out.items()}


def _q(value, places="0.01"):
    return Decimal(value).quantize(Decimal(places))


def _walk_book(levels, notional=None, quantity=None):
    """Consume book levels until the order is filled. Returns (qty, cost, exhausted)."""
    filled_qty, cost = Decimal("0"), Decimal("0")
    for price_s, size_s, *_ in levels:
        price, size = Decimal(price_s), Decimal(size_s)
        if notional is not None:
            remaining = notional - cost
            take = min(size, remaining / price)
        else:
            take = min(size, quantity - filled_qty)
        filled_qty += take
        cost += take * price
        if (notional is not None and cost >= notional) or (quantity is not None and filled_qty >= quantity):
            return filled_qty, cost, False
    return filled_qty, cost, True


def _impact_bps(notional: Decimal, volume_24h: float) -> Decimal:
    """Square-root market impact model used when no live book is available."""
    volume = max(float(volume_24h or 0), 1.0)
    bps = 5 + 30 * math.sqrt(float(notional) / (volume * 0.001))
    return Decimal(str(round(min(bps, 500.0), 2)))


def simulate_fill(row, side, notional=None, quantity=None) -> Fill:
    """Price an order of `notional` USD (buys) or `quantity` units (sells)."""
    if (notional is None) == (quantity is None):
        raise ValueError("Provide exactly one of notional or quantity")
    mid = Decimal(str(row["current_price"]))
    if mid <= 0:
        raise MarketUnavailable("No price available")

    product = live_product(row.get("symbol"))
    book = None
    if product:
        try:
            book = order_book(product)
        except MarketUnavailable:
            book = None

    depth_used = None
    if book and book.get("asks") and book.get("bids"):
        best_bid, best_ask = Decimal(book["bids"][0][0]), Decimal(book["asks"][0][0])
        mid = (best_bid + best_ask) / 2
        levels = book["asks"] if side == "buy" else book["bids"]
        qty, cost, exhausted = _walk_book(levels, notional=notional, quantity=quantity)
        if qty <= 0:
            raise MarketUnavailable("Order book is empty")
        avg = cost / qty
        if exhausted:
            # Beyond the visible book: fill the rest 2% past the last level.
            last = Decimal(levels[-1][0])
            extra_price = last * (Decimal("1.02") if side == "buy" else Decimal("0.98"))
            extra_qty = (notional - cost) / extra_price if notional is not None else quantity - qty
            cost += extra_qty * extra_price
            qty += extra_qty
            avg = cost / qty
        visible = sum(Decimal(l[0]) * Decimal(l[1]) for l in levels)
        depth_used = float(min(cost / visible, 1)) * 100 if visible else None
        source = "coinbase"
    else:
        size_usd = notional if notional is not None else quantity * mid
        impact = _impact_bps(size_usd, row.get("total_volume")) / Decimal(10000)
        avg = mid * (1 + impact) if side == "buy" else mid * (1 - impact)
        qty = notional / avg if notional is not None else quantity
        source = "model"

    if quantity is not None:
        qty = quantity
    qty = qty.quantize(Decimal("0.000000000001"), rounding=ROUND_DOWN)
    gross = _q(qty * avg)
    fee = _q(gross * FEE_RATE)
    slippage = abs(avg - mid) / mid * Decimal(10000)
    total = gross + fee if side == "buy" else gross - fee
    return Fill(
        side=side,
        quantity=qty,
        price=avg.quantize(Decimal("0.00000001")),
        mid_price=mid.quantize(Decimal("0.00000001")),
        slippage_bps=_q(slippage),
        notional=gross,
        fee=fee,
        total=_q(total),
        source=source,
        depth_used_pct=round(depth_used, 2) if depth_used is not None else None,
    )


def utc_from_ms(ms):
    return datetime.fromtimestamp(ms / 1000, tz=dt_timezone.utc)
