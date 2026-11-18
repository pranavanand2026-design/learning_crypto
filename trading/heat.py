"""Heat: how far a coin's attention and price action run ahead of its normal.

The score blends four observable signals, each measured against the coin's
own baseline rather than an absolute threshold:

  move      today's 24h change vs. the typical 24h change over the past week
  turnover  24h volume as a share of market cap (crowding into a coin)
  news      headlines mentioning the coin in the last 48 hours
  trending  whether it is among the most searched coins right now
"""
from __future__ import annotations

import math
from statistics import median

QUIET, WARM, HOT = "quiet", "warm", "hot"
NORMAL_TURNOVER = 0.08


def typical_daily_move(sparkline):
    """Median absolute 24h change across a 7-day hourly sparkline, in %."""
    prices = [p for p in sparkline or [] if p]
    if len(prices) < 30:
        return None
    step = max(1, round(len(prices) / 7))  # one day of samples
    moves = [abs(prices[i] / prices[i - step] - 1) * 100 for i in range(step, len(prices))]
    return median(moves) if moves else None


def is_pegged(sparkline):
    prices = [p for p in sparkline or [] if p]
    if len(prices) < 30:
        return False
    lo, hi = min(prices), max(prices)
    return lo > 0 and (hi - lo) / lo < 0.015


def compute(row, mentions=0, trending=False):
    change = row.get("price_change_percentage_24h_in_currency", row.get("price_change_percentage_24h")) or 0
    sparkline = (row.get("sparkline_in_7d") or {}).get("price") or row.get("sparkline") or []
    typical = typical_daily_move(sparkline)
    move_ratio = abs(change) / max(typical or 2.5, 0.5)

    cap = row.get("market_cap") or 0
    volume = row.get("total_volume") or row.get("volume_24h") or 0
    turnover = volume / cap if cap else 0
    if is_pegged(sparkline):
        # Stablecoins churn constantly by design; volume says nothing about hype.
        turnover = 0

    raw = (
        0.5 * max(move_ratio - 1, 0)
        + 0.35 * max(turnover / NORMAL_TURNOVER - 1, 0)
        + min(mentions, 8) * 0.04
        + (0.35 if trending else 0)
    )
    score = round(100 * (1 - math.exp(-raw)))
    level = HOT if score >= 65 else WARM if score >= 35 else QUIET

    drivers = []
    if move_ratio >= 1.5:
        direction = "Up" if change > 0 else "Down"
        drivers.append(f"{direction} {abs(change):.1f}% today, {move_ratio:.1f}× its usual daily move")
    if turnover >= NORMAL_TURNOVER * 1.5:
        drivers.append(f"A day's volume equals {turnover * 100:.0f}% of its market cap")
    if mentions:
        drivers.append(f"In {mentions} headline{'s' if mentions != 1 else ''} over the last two days")
    if trending:
        drivers.append("Among the most searched coins right now")

    return {
        "score": score,
        "level": level,
        "drivers": drivers,
        "move_ratio": round(move_ratio, 2),
        "typical_move": round(typical, 2) if typical is not None else None,
        "turnover": round(turnover, 4),
        "mentions": mentions,
        "trending": trending,
    }
