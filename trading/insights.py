"""Turn the trade journal into feedback on decision-making, not just P&L."""
from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from decimal import Decimal
from statistics import mean

from django.utils import timezone

from . import engine, market
from .models import Trade

HOT_HEAT = 65
QUICK_REENTRY_MIN = 30
RESOLVE_BATCH = 15


def resolve_due(account, now=None):
    """Score buys whose horizon has passed: was the price higher at the horizon?"""
    now = now or timezone.now()
    due = [t for t in account.trades.filter(side=Trade.BUY, resolved_at__isnull=True, horizon_days__isnull=False)
           .order_by("created_at")[:RESOLVE_BATCH * 3] if t.resolves_at and t.resolves_at <= now][:RESOLVE_BATCH]
    for trade in due:
        at = trade.resolves_at
        try:
            prices = market.price_history(trade.coin_id, at - timedelta(hours=3), at + timedelta(hours=3))
        except market.MarketUnavailable:
            continue
        if not prices:
            continue
        target_ms = at.timestamp() * 1000
        _, price = min(prices, key=lambda p: abs(p[0] - target_ms))
        trade.outcome_price = Decimal(str(price))
        trade.outcome_correct = trade.outcome_price > trade.price
        trade.resolved_at = now
        trade.save(update_fields=["outcome_price", "outcome_correct", "resolved_at"])


def _current_prices(coin_ids):
    if not coin_ids:
        return {}
    try:
        rows = market.markets(ids=sorted(coin_ids), per_page=len(coin_ids))
    except market.MarketUnavailable:
        return {}
    return {r["id"]: r["current_price"] for r in rows}


def _avg(values):
    return round(mean(values), 2) if values else None


def build(account):
    resolve_due(account)
    trades = list(account.trades.all().order_by("created_at"))
    buys = [t for t in trades if t.side == Trade.BUY]
    sells = [t for t in trades if t.side == Trade.SELL]
    prices = _current_prices({t.coin_id for t in buys})

    def buy_return(t):
        """Return of a buy: at its horizon if resolved, otherwise marked to market."""
        exit_price = t.outcome_price or (Decimal(str(prices[t.coin_id])) if t.coin_id in prices else None)
        if exit_price is None:
            return None
        return float((exit_price / t.price - 1) * 100)

    returns = {t.id: buy_return(t) for t in buys}

    def group_return(group):
        return _avg([returns[t.id] for t in group if returns[t.id] is not None])

    # Calibration: stated conviction vs. how often the call was right.
    buckets = defaultdict(list)
    for t in buys:
        if t.conviction and t.outcome_correct is not None:
            buckets[t.conviction].append(t.outcome_correct)
    calibration = [
        {"conviction": c, "calls": len(buckets[c]), "correct": sum(buckets[c]),
         "hit_rate": round(sum(buckets[c]) / len(buckets[c]) * 100, 1) if buckets[c] else None}
        for c in engine.CONVICTION_CHOICES
    ]
    resolved = [t for t in buys if t.outcome_correct is not None and t.conviction]
    pending = [t for t in buys if t.horizon_days and t.outcome_correct is None]
    gap = None
    if resolved:
        gap = round(mean(t.conviction for t in resolved) - sum(t.outcome_correct for t in resolved) / len(resolved) * 100, 1)

    hot = [t for t in buys if (t.heat or 0) >= HOT_HEAT]
    calm = [t for t in buys if t.heat is not None and t.heat < HOT_HEAT]
    quick = [t for t in buys if t.minutes_since_loss is not None and t.minutes_since_loss <= QUICK_REENTRY_MIN]

    by_mood = defaultdict(list)
    for t in buys:
        if t.mood:
            by_mood[t.mood].append(t)

    with_stop = [t for t in buys if t.stop_pct]
    stop_breaches = 0
    last_buy = {}
    for t in trades:
        if t.side == Trade.BUY:
            last_buy[t.coin_id] = t
        elif t.coin_id in last_buy and last_buy[t.coin_id].stop_pct:
            b = last_buy[t.coin_id]
            stop_price = b.price * (1 - b.stop_pct / 100)
            if t.price < stop_price * Decimal("0.98"):
                stop_breaches += 1

    active_days = {t.created_at.date() for t in trades}
    today = timezone.now().date()
    per_day = defaultdict(int)
    for t in trades:
        per_day[t.created_at.date()] += 1
    daily = [{"date": (today - timedelta(days=i)).isoformat(), "trades": per_day[today - timedelta(days=i)]}
             for i in range(13, -1, -1)]
    wins = [t for t in sells if (t.realized_pnl or 0) > 0]
    losses = [t for t in sells if (t.realized_pnl or 0) < 0]
    fees = sum((t.fee for t in trades), Decimal("0"))
    slippage_cost = sum((abs(t.price - t.mid_price) * t.quantity for t in trades), Decimal("0"))

    return {
        "trades": len(trades),
        "buys": len(buys),
        "sells": len(sells),
        "active_days": len(active_days),
        "trades_per_active_day": round(len(trades) / len(active_days), 1) if active_days else 0,
        "daily": daily,
        "max_trades_per_day": account.max_trades_per_day,
        "closed": {
            "wins": len(wins), "losses": len(losses),
            "win_rate": round(len(wins) / len(sells) * 100, 1) if sells else None,
            "avg_win": _avg([float(t.realized_pnl) for t in wins]),
            "avg_loss": _avg([float(t.realized_pnl) for t in losses]),
        },
        "costs": {"fees": float(fees), "slippage": round(float(slippage_cost), 2)},
        "calibration": {
            "buckets": calibration, "resolved": len(resolved), "pending": len(pending), "gap": gap,
            "next_resolves_at": min((t.resolves_at for t in pending), default=None),
        },
        "heat": {
            "hot_buys": len(hot), "hot_return": group_return(hot),
            "calm_buys": len(calm), "calm_return": group_return(calm),
        },
        "after_loss": {"buys": len(quick), "return": group_return(quick),
                       "others_return": group_return([t for t in buys if t not in quick])},
        "mood": [{"mood": m, "buys": len(g), "return": group_return(g)} for m, g in sorted(by_mood.items())],
        "plan": {
            "buys_with_stop": len(with_stop),
            "stop_rate": round(len(with_stop) / len(buys) * 100, 1) if buys else None,
            "stop_breaches": stop_breaches,
            "with_thesis": sum(1 for t in buys if t.thesis),
        },
    }
