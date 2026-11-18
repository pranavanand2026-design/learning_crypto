from decimal import Decimal

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from . import engine, heat, market, news
from .models import Trade, TradeNote


class MarketThrottle(SimpleRateThrottle):
    scope = "market"

    def get_cache_key(self, request, view):
        user = request.user
        ident = user.pk if user and user.is_authenticated else self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class OrderThrottle(MarketThrottle):
    scope = "orders"


def unavailable(exc):
    return Response({"detail": "Market data is temporarily unavailable.", "code": "market_unavailable"},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE)


def rejected(exc: engine.OrderRejected):
    body = {"detail": exc.message, "code": exc.code}
    if exc.retry_at:
        body["retry_at"] = exc.retry_at.isoformat()
    return Response(body, status=status.HTTP_409_CONFLICT if exc.retry_at else status.HTTP_400_BAD_REQUEST)


def _num(value):
    return float(value) if value is not None else None


# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def app_config(request):
    return Response({
        "recaptcha_site_key": settings.RECAPTCHA_SITE_KEY if settings.RECAPTCHA_REQUIRED else None,
        "starting_cash": float(engine.Account._meta.get_field("cash").default),
        "fee_rate": float(market.FEE_RATE),
    })


# --------------------------------------------------------------------------
# Market
# --------------------------------------------------------------------------
def _signals():
    """Shared inputs for heat: headline counts and trending coins (both cached)."""
    try:
        mentions = news.mention_counts()
    except Exception:  # news is best-effort and must never break prices
        mentions = {}
    return mentions, set(market.trending_ids())


def _market_payload(row, signals=None):
    mentions, trending = signals or ({}, set())
    spark = (row.get("sparkline_in_7d") or {}).get("price") or []
    step = max(len(spark) // 56, 1)
    return {
        "id": row["id"],
        "symbol": row["symbol"].upper(),
        "name": row["name"],
        "image": row.get("image"),
        "rank": row.get("market_cap_rank"),
        "price": row.get("current_price"),
        "change_1h": row.get("price_change_percentage_1h_in_currency"),
        "change_24h": row.get("price_change_percentage_24h_in_currency", row.get("price_change_percentage_24h")),
        "change_7d": row.get("price_change_percentage_7d_in_currency"),
        "market_cap": row.get("market_cap"),
        "volume_24h": row.get("total_volume"),
        "high_24h": row.get("high_24h"),
        "low_24h": row.get("low_24h"),
        "sparkline": spark[::step],
        "live_product": market.live_product(row.get("symbol")),
        "heat": heat.compute(row, mentions.get(row["id"], 0), row["id"] in trending),
    }


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([MarketThrottle])
def market_list(request):
    try:
        page = max(1, min(int(request.GET.get("page", 1)), 4))
        rows = market.markets(page=page)
    except (ValueError, market.MarketUnavailable) as exc:
        return unavailable(exc)
    signals = _signals()
    return Response({"results": [_market_payload(r, signals) for r in rows]})


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([MarketThrottle])
def market_detail(request, coin_id):
    try:
        row = market.market_row(coin_id)
        detail = market.coin_detail(coin_id)
    except market.MarketUnavailable as exc:
        return unavailable(exc)
    data = detail.get("market_data") or {}
    payload = _market_payload(row, _signals())
    payload.update({
        "categories": [c for c in (detail.get("categories") or []) if c][:3],
        "description": ((detail.get("description") or {}).get("en") or "").split("\r\n")[0][:600],
        "homepage": next(iter((detail.get("links") or {}).get("homepage") or []), None),
        "ath": (data.get("ath") or {}).get("usd"),
        "ath_change": (data.get("ath_change_percentage") or {}).get("usd"),
        "ath_date": (data.get("ath_date") or {}).get("usd"),
        "circulating_supply": data.get("circulating_supply"),
        "max_supply": data.get("max_supply"),
        "change_30d": data.get("price_change_percentage_30d"),
        "change_1y": data.get("price_change_percentage_1y"),
    })
    return Response(payload)


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([MarketThrottle])
def market_chart(request, coin_id):
    days = request.GET.get("days", "7")
    if days not in {"1", "7", "30", "90", "365"}:
        days = "7"
    try:
        data = market.chart(coin_id, days)
    except market.MarketUnavailable as exc:
        return unavailable(exc)
    return Response({"prices": data.get("prices", []), "volumes": data.get("total_volumes", [])})


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([MarketThrottle])
def market_news(request, coin_id):
    try:
        row = market.market_row(coin_id)
    except market.MarketUnavailable as exc:
        return unavailable(exc)
    return Response({"results": news.coin_headlines(coin_id, row["name"])})


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([MarketThrottle])
def news_feed(request):
    items = news.tagged_headlines()
    if request.GET.get("linked") == "1":
        items = [i for i in items if i["coins"]]
    return Response({"results": items[:40]})


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([MarketThrottle])
def market_search(request):
    q = (request.GET.get("q") or "").strip()
    if len(q) < 2:
        return Response({"results": []})
    try:
        coins = market.search(q)
    except market.MarketUnavailable as exc:
        return unavailable(exc)
    return Response({"results": [
        {"id": c["id"], "symbol": c["symbol"].upper(), "name": c["name"], "image": c.get("thumb"), "rank": c.get("market_cap_rank")}
        for c in coins
    ]})


# --------------------------------------------------------------------------
# Account
# --------------------------------------------------------------------------
def _valuations(positions):
    ids = [p.coin_id for p in positions]
    if not ids:
        return {}
    try:
        rows = market.markets(ids=ids, per_page=len(ids))
    except market.MarketUnavailable:
        return {}
    return {r["id"]: r for r in rows}


def _position_payload(p, row):
    price = Decimal(str(row["current_price"])) if row else None
    value = p.quantity * price if price is not None else None
    last_buy = p.account.trades.filter(coin_id=p.coin_id, side=Trade.BUY).order_by("-created_at").first()
    stop_price = target_price = None
    if last_buy and last_buy.stop_pct:
        stop_price = p.avg_cost * (1 - last_buy.stop_pct / 100)
    if last_buy and last_buy.target_pct:
        target_price = p.avg_cost * (1 + last_buy.target_pct / 100)
    return {
        "coin_id": p.coin_id, "symbol": p.symbol, "name": p.name, "image": p.image,
        "quantity": _num(p.quantity), "avg_cost": _num(p.avg_cost), "cost_basis": _num(p.cost_basis),
        "price": _num(price), "value": _num(value),
        "pnl": _num(value - p.cost_basis) if value is not None else None,
        "pnl_pct": _num((value / p.cost_basis - 1) * 100) if value is not None and p.cost_basis else None,
        "change_24h": row.get("price_change_percentage_24h") if row else None,
        "stop_price": _num(stop_price), "target_price": _num(target_price),
        "below_stop": bool(stop_price and price is not None and price < stop_price),
        "above_target": bool(target_price and price is not None and price > target_price),
        "opened_at": p.opened_at,
        "live_product": market.live_product(p.symbol),
    }


def account_payload(account):
    positions = list(account.positions.all())
    rows = _valuations(positions)
    items = [_position_payload(p, rows.get(p.coin_id)) for p in positions]
    invested = sum(i["value"] or i["cost_basis"] for i in items)
    equity = float(account.cash) + invested
    benchmark = None
    try:
        btc_now = market.market_row("bitcoin")["current_price"]
        if account.btc_price_at_start:
            benchmark = float(account.starting_cash) * btc_now / float(account.btc_price_at_start)
    except market.MarketUnavailable:
        pass
    state = engine.rule_state(account, Trade.BUY)
    items.sort(key=lambda i: -(i["value"] or 0))
    return {
        "cash": float(account.cash),
        "starting_cash": float(account.starting_cash),
        "equity": equity,
        "invested": invested,
        "return_pct": (equity / float(account.starting_cash) - 1) * 100,
        "benchmark_equity": benchmark,
        "started_at": account.started_at,
        "positions": items,
        "rules": {
            "max_trades_per_day": account.max_trades_per_day,
            "max_daily_loss_pct": _num(account.max_daily_loss_pct),
            "cooldown_minutes": account.cooldown_minutes,
            "max_position_pct": _num(account.max_position_pct),
        },
        "today": {
            "trades": state.trades_today,
            "realized": float(state.realized_today),
            "blocked": {"code": state.blocked.code, "detail": state.blocked.message,
                        "retry_at": state.blocked.retry_at} if state.blocked else None,
        },
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def account_view(request):
    return Response(account_payload(engine.get_account(request.user)))


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def account_rules(request):
    account = engine.get_account(request.user)
    limits = {
        "max_trades_per_day": (1, 100),
        "max_daily_loss_pct": (1, 100),
        "cooldown_minutes": (0, 240),
        "max_position_pct": (5, 100),
    }
    for field, (lo, hi) in limits.items():
        if field not in request.data:
            continue
        value = request.data[field]
        if value in (None, "") and field != "cooldown_minutes":
            setattr(account, field, None)
            continue
        try:
            value = Decimal(str(value))
        except Exception:
            return Response({"detail": f"{field} must be a number."}, status=400)
        if not lo <= value <= hi:
            return Response({"detail": f"{field} must be between {lo} and {hi}."}, status=400)
        setattr(account, field, int(value) if field in ("max_trades_per_day", "cooldown_minutes") else value)
    account.save()
    return Response(account_payload(account))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def account_restart(request):
    return Response(account_payload(engine.restart(request.user)))


# --------------------------------------------------------------------------
# Trading
# --------------------------------------------------------------------------
def _order_args(data):
    notional = data.get("notional")
    quantity = data.get("quantity")
    try:
        notional = Decimal(str(notional)) if notional not in (None, "") else None
        quantity = Decimal(str(quantity)) if quantity not in (None, "") else None
    except Exception:
        raise engine.OrderRejected("invalid", "Amount must be a number.")
    return notional, quantity


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([MarketThrottle])
def quote_view(request):
    account = engine.get_account(request.user)
    side = request.data.get("side", "buy")
    try:
        notional, quantity = _order_args(request.data)
        row, fill = engine.quote(account, request.data.get("coin_id"), side, notional=notional, quantity=quantity)
    except engine.OrderRejected as exc:
        return rejected(exc)
    except market.MarketUnavailable as exc:
        return unavailable(exc)
    state = engine.rule_state(account, side)
    equity = account_payload(account)["equity"]
    return Response({
        **fill.as_dict(),
        "position_pct": float(fill.notional) / equity * 100 if equity else None,
        "cash": float(account.cash),
        "blocked": {"code": state.blocked.code, "detail": state.blocked.message,
                    "retry_at": state.blocked.retry_at} if state.blocked else None,
    })


def trade_payload(t: Trade):
    return {
        "id": str(t.id), "coin_id": t.coin_id, "symbol": t.symbol, "name": t.name, "image": t.image,
        "side": t.side, "quantity": _num(t.quantity), "price": _num(t.price), "mid_price": _num(t.mid_price),
        "slippage_bps": _num(t.slippage_bps), "fee": _num(t.fee), "notional": _num(t.notional),
        "realized_pnl": _num(t.realized_pnl), "price_source": t.price_source,
        "thesis": t.thesis, "conviction": t.conviction, "horizon_days": t.horizon_days,
        "stop_pct": _num(t.stop_pct), "target_pct": _num(t.target_pct), "mood": t.mood,
        "heat": t.heat, "change_24h": _num(t.change_24h), "minutes_since_loss": t.minutes_since_loss,
        "resolves_at": t.resolves_at, "resolved_at": t.resolved_at,
        "outcome_price": _num(t.outcome_price), "outcome_correct": t.outcome_correct,
        "created_at": t.created_at,
        "notes": [{"text": n.text, "created_at": n.created_at} for n in t.notes.all()],
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([OrderThrottle])
def orders_view(request):
    data = request.data
    try:
        notional, quantity = _order_args(data)
        heat = data.get("heat")
        heat = max(0, min(int(heat), 100)) if heat not in (None, "") else None
        trade, _ = engine.place_order(
            request.user, data.get("coin_id"), data.get("side"), notional=notional, quantity=quantity,
            plan={k: data.get(k) for k in ("thesis", "conviction", "horizon_days", "stop_pct", "target_pct", "mood")},
            heat=heat,
        )
    except engine.OrderRejected as exc:
        return rejected(exc)
    except (ValueError, TypeError):
        return Response({"detail": "Invalid order.", "code": "invalid"}, status=400)
    except market.MarketUnavailable as exc:
        return unavailable(exc)
    return Response(trade_payload(trade), status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def journal_view(request):
    account = engine.get_account(request.user)
    trades = account.trades.prefetch_related("notes")
    coin = request.GET.get("coin")
    if coin:
        trades = trades.filter(coin_id=coin)
    return Response({"results": [trade_payload(t) for t in trades[:200]]})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def trade_note(request, trade_id):
    account = engine.get_account(request.user)
    trade = get_object_or_404(Trade, id=trade_id, account=account)
    text = (request.data.get("text") or "").strip()
    if not text:
        return Response({"detail": "Write something first."}, status=400)
    TradeNote.objects.create(trade=trade, text=text[:2000])
    return Response(trade_payload(trade), status=201)
