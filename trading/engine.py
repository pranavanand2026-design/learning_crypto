"""Order execution and the personal rules that gate it."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from . import market
from .models import Account, Position, Trade

CONVICTION_CHOICES = (50, 60, 70, 80, 90)
HORIZON_CHOICES = (1, 7, 30)


class OrderRejected(Exception):
    def __init__(self, code, message, retry_at=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retry_at = retry_at


def get_account(user) -> Account:
    account, created = Account.objects.get_or_create(user=user)
    if created or account.btc_price_at_start is None:
        try:
            account.btc_price_at_start = Decimal(str(market.market_row("bitcoin")["current_price"]))
            account.save(update_fields=["btc_price_at_start"])
        except market.MarketUnavailable:
            pass
    return account


def _day_start(now):
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


@dataclass
class RuleState:
    trades_today: int
    realized_today: Decimal
    last_loss_at: object
    blocked: OrderRejected | None


def rule_state(account: Account, side: str, now=None) -> RuleState:
    """Evaluate the user's own rules. Sells are never blocked: you can always exit."""
    now = now or timezone.now()
    today = account.trades.filter(created_at__gte=_day_start(now))
    trades_today = today.count()
    realized_today = sum((t.realized_pnl or Decimal("0")) for t in today.filter(side=Trade.SELL))
    last_loss = account.trades.filter(side=Trade.SELL, realized_pnl__lt=0).order_by("-created_at").first()
    last_loss_at = last_loss.created_at if last_loss else None
    tomorrow = _day_start(now) + timedelta(days=1)

    blocked = None
    if side == Trade.BUY:
        if account.max_trades_per_day and trades_today >= account.max_trades_per_day:
            blocked = OrderRejected("daily_limit", f"You've made {trades_today} trades today, your limit.", tomorrow)
        elif account.max_daily_loss_pct and realized_today < 0:
            limit = account.starting_cash * account.max_daily_loss_pct / 100
            if -realized_today >= limit:
                blocked = OrderRejected("loss_limit", "You've reached today's loss limit.", tomorrow)
        if not blocked and last_loss_at and account.cooldown_minutes:
            ready = last_loss_at + timedelta(minutes=account.cooldown_minutes)
            if ready > now:
                blocked = OrderRejected("cooldown", "Your last trade closed at a loss.", ready)
    return RuleState(trades_today, realized_today, last_loss_at, blocked)


def _clean_plan(plan):
    conviction = plan.get("conviction")
    if conviction is not None:
        conviction = int(conviction)
        if conviction not in CONVICTION_CHOICES:
            raise OrderRejected("invalid", "Conviction must be one of 50, 60, 70, 80 or 90.")
    horizon = plan.get("horizon_days")
    if horizon is not None:
        horizon = int(horizon)
        if horizon not in HORIZON_CHOICES:
            raise OrderRejected("invalid", "Horizon must be 1, 7 or 30 days.")

    def pct(name, lo, hi):
        value = plan.get(name)
        if value in (None, ""):
            return None
        value = Decimal(str(value))
        if not lo <= value <= hi:
            raise OrderRejected("invalid", f"{name.replace('_', ' ')} must be between {lo} and {hi}.")
        return value

    mood = plan.get("mood") or ""
    if mood and mood not in dict(Trade.MOODS):
        raise OrderRejected("invalid", "Unknown mood.")
    return {
        "thesis": (plan.get("thesis") or "").strip()[:1000],
        "conviction": conviction,
        "horizon_days": horizon,
        "stop_pct": pct("stop_pct", Decimal("0.5"), Decimal("90")),
        "target_pct": pct("target_pct", Decimal("0.5"), Decimal("1000")),
        "mood": mood,
    }


def quote(account, coin_id, side, notional=None, quantity=None):
    row = market.market_row(coin_id)
    if side == Trade.SELL:
        position = account.positions.filter(coin_id=coin_id).first()
        if not position:
            raise OrderRejected("no_position", "You don't hold this coin.")
        if quantity is None and notional is not None:
            quantity = min(position.quantity, Decimal(str(notional)) / Decimal(str(row["current_price"])))
        quantity = Decimal(str(quantity))
        if quantity <= 0 or quantity > position.quantity:
            raise OrderRejected("insufficient_quantity", "You can't sell more than you hold.")
        return row, market.simulate_fill(row, side, quantity=quantity)

    notional = Decimal(str(notional or 0))
    if notional < market.MIN_NOTIONAL:
        raise OrderRejected("too_small", "Minimum order is $1.")
    # Leave room for the fee so the total never exceeds available cash.
    if notional * (1 + market.FEE_RATE) > account.cash:
        raise OrderRejected("insufficient_cash", "Not enough cash for this order.")
    return row, market.simulate_fill(row, side, notional=notional)


def place_order(user, coin_id, side, notional=None, quantity=None, plan=None, heat=None):
    if side not in (Trade.BUY, Trade.SELL):
        raise OrderRejected("invalid", "Side must be buy or sell.")
    plan = _clean_plan(plan or {})
    if side == Trade.BUY and len(plan["thesis"]) < 8:
        raise OrderRejected("thesis_required", "Write a sentence on why you're buying.")

    with transaction.atomic():
        account = Account.objects.select_for_update().get(pk=get_account(user).pk)
        state = rule_state(account, side)
        if state.blocked:
            raise state.blocked

        row, fill = quote(account, coin_id, side, notional=notional, quantity=quantity)
        now = timezone.now()
        minutes_since_loss = None
        if state.last_loss_at:
            minutes_since_loss = int((now - state.last_loss_at).total_seconds() // 60)

        realized = None
        position = account.positions.filter(coin_id=coin_id).first()
        if side == Trade.BUY:
            if fill.total > account.cash:
                raise OrderRejected("insufficient_cash", "Not enough cash for this order.")
            account.cash -= fill.total
            if position:
                position.quantity += fill.quantity
                position.cost_basis += fill.total
            else:
                position = Position(
                    account=account, coin_id=coin_id, symbol=row["symbol"].upper(), name=row["name"],
                    image=row.get("image") or "", quantity=fill.quantity, cost_basis=fill.total, opened_at=now,
                )
            position.save()
        else:
            share = fill.quantity / position.quantity
            basis_out = (position.cost_basis * share).quantize(Decimal("0.01"))
            realized = fill.total - basis_out
            account.cash += fill.total
            position.quantity -= fill.quantity
            position.cost_basis -= basis_out
            if position.quantity <= Decimal("0.000000000001"):
                position.delete()
            else:
                position.save()
        account.save(update_fields=["cash"])

        change = row.get("price_change_percentage_24h")
        trade = Trade.objects.create(
            account=account, coin_id=coin_id, symbol=row["symbol"].upper(), name=row["name"],
            image=row.get("image") or "", side=side, quantity=fill.quantity, price=fill.price,
            mid_price=fill.mid_price, slippage_bps=fill.slippage_bps, fee=fill.fee, notional=fill.notional,
            cash_after=account.cash, realized_pnl=realized, price_source=fill.source,
            heat=heat, change_24h=Decimal(str(round(change, 2))) if change is not None else None,
            minutes_since_loss=minutes_since_loss, created_at=now,
            **(plan if side == Trade.BUY else {"thesis": plan["thesis"], "mood": plan["mood"]}),
        )
    return trade, fill


def restart(user):
    """Start over with fresh cash. History is kept; only open positions close."""
    with transaction.atomic():
        account = Account.objects.select_for_update().get(pk=get_account(user).pk)
        account.positions.all().delete()
        account.cash = account.starting_cash
        account.started_at = timezone.now()
        account.restarts += 1
        account.btc_price_at_start = None
        account.save()
    return get_account(user)
