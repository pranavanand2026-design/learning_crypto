"""Paper-trading ledger.

Every account starts with virtual cash. Trades are append-only: they can be
annotated with notes but never edited or deleted, so the journal is an honest
record of every decision.
"""
import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

STARTING_CASH = Decimal("10000.00")


class Account(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="paper_account")
    cash = models.DecimalField(max_digits=20, decimal_places=2, default=STARTING_CASH)
    starting_cash = models.DecimalField(max_digits=20, decimal_places=2, default=STARTING_CASH)
    started_at = models.DateTimeField(default=timezone.now)
    # Benchmark: what the starting cash would be worth held in BTC.
    btc_price_at_start = models.DecimalField(max_digits=24, decimal_places=8, null=True, blank=True)
    restarts = models.PositiveIntegerField(default=0)
    onboarded = models.BooleanField(default=False)

    # Personal rules the user sets for themselves. Null means "no limit".
    max_trades_per_day = models.PositiveSmallIntegerField(null=True, blank=True, default=8)
    max_daily_loss_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, default=Decimal("5.00"))
    cooldown_minutes = models.PositiveSmallIntegerField(default=10)
    max_position_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, default=Decimal("25.00"))

    def __str__(self):
        return f"Account<{self.user_id}> cash={self.cash}"


class Position(models.Model):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="positions")
    coin_id = models.CharField(max_length=100)
    symbol = models.CharField(max_length=20)
    name = models.CharField(max_length=100)
    image = models.URLField(max_length=500, blank=True)
    quantity = models.DecimalField(max_digits=30, decimal_places=12)
    cost_basis = models.DecimalField(max_digits=20, decimal_places=2)  # total USD incl. fees
    opened_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ("account", "coin_id")

    @property
    def avg_cost(self):
        return self.cost_basis / self.quantity if self.quantity else Decimal("0")


class Trade(models.Model):
    BUY, SELL = "buy", "sell"
    SIDES = [(BUY, "Buy"), (SELL, "Sell")]
    MOODS = [(m, m.title()) for m in ("calm", "curious", "excited", "anxious", "frustrated")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="trades")
    coin_id = models.CharField(max_length=100)
    symbol = models.CharField(max_length=20)
    name = models.CharField(max_length=100)
    image = models.URLField(max_length=500, blank=True)
    side = models.CharField(max_length=4, choices=SIDES)

    # Execution
    quantity = models.DecimalField(max_digits=30, decimal_places=12)
    price = models.DecimalField(max_digits=24, decimal_places=8)        # average fill price
    mid_price = models.DecimalField(max_digits=24, decimal_places=8)    # market mid at execution
    slippage_bps = models.DecimalField(max_digits=8, decimal_places=2)
    fee = models.DecimalField(max_digits=20, decimal_places=2)
    notional = models.DecimalField(max_digits=20, decimal_places=2)     # qty * fill price
    cash_after = models.DecimalField(max_digits=20, decimal_places=2)
    realized_pnl = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    price_source = models.CharField(max_length=20)

    # The plan, written before the trade
    thesis = models.TextField(blank=True)
    conviction = models.PositiveSmallIntegerField(null=True, blank=True)  # 50..90 (% sure)
    horizon_days = models.PositiveSmallIntegerField(null=True, blank=True)
    stop_pct = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    target_pct = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    mood = models.CharField(max_length=12, choices=MOODS, blank=True)

    # Market context captured at entry
    heat = models.PositiveSmallIntegerField(null=True, blank=True)
    change_24h = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    minutes_since_loss = models.PositiveIntegerField(null=True, blank=True)

    # Resolution of the call (for buys with a horizon)
    resolved_at = models.DateTimeField(null=True, blank=True)
    outcome_price = models.DecimalField(max_digits=24, decimal_places=8, null=True, blank=True)
    outcome_correct = models.BooleanField(null=True, blank=True)

    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def resolves_at(self):
        if self.side != self.BUY or not self.horizon_days:
            return None
        return self.created_at + timezone.timedelta(days=self.horizon_days)


class TradeNote(models.Model):
    trade = models.ForeignKey(Trade, on_delete=models.CASCADE, related_name="notes")
    text = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at"]
