from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from trading import engine, insights, market
from trading.models import Trade
from web_app.models import User

PRICE = {"value": 100.0}


def row(cid="alpha"):
    return {"id": cid, "symbol": cid[:3], "name": cid.title(), "image": "", "current_price": PRICE["value"],
            "total_volume": 1e12, "price_change_percentage_24h": 0}


@pytest.fixture(autouse=True)
def fake_market(monkeypatch):
    PRICE["value"] = 100.0
    monkeypatch.setattr(market, "market_row", lambda cid: row(cid))
    monkeypatch.setattr(market, "markets", lambda **kw: [row(i) for i in kw.get("ids") or ["alpha"]])
    monkeypatch.setattr(market, "coinbase_bases", lambda: set())


@pytest.fixture
def user(db):
    u = User.objects.create_user(email="i@example.com", username="i@example.com", password="Password123!", display_name="I")
    a = engine.get_account(u)
    a.max_trades_per_day = None
    a.cooldown_minutes = 0
    a.save()
    return u


def buy(user, **plan):
    plan.setdefault("thesis", "Momentum plus a catalyst")
    trade, _ = engine.place_order(user, "alpha", "buy", notional=Decimal("100"), plan=plan, heat=plan.pop("heat", None))
    return trade


@pytest.mark.django_db
def test_calibration_resolves_due_calls(user, monkeypatch):
    t1 = buy(user, conviction=90, horizon_days=1)
    t2 = buy(user, conviction=90, horizon_days=1)
    Trade.objects.filter(id__in=[t1.id, t2.id]).update(created_at=timezone.now() - timedelta(days=2))
    at_ms = (timezone.now() - timedelta(days=1)).timestamp() * 1000
    monkeypatch.setattr(market, "price_history", lambda cid, s, e: [[at_ms, 90.0]])
    data = insights.build(engine.get_account(user))
    bucket = next(b for b in data["calibration"]["buckets"] if b["conviction"] == 90)
    assert bucket["calls"] == 2
    assert bucket["hit_rate"] == 0
    assert data["calibration"]["gap"] == 90.0


@pytest.mark.django_db
def test_hot_vs_calm_and_after_loss_groups(user):
    buy(user, heat=80)
    buy(user, heat=10, mood="calm")
    PRICE["value"] = 110.0
    data = insights.build(engine.get_account(user))
    assert data["heat"]["hot_buys"] == 1
    assert data["heat"]["calm_buys"] == 1
    assert data["heat"]["hot_return"] > 0
    assert data["mood"][0]["mood"] == "calm"
    assert data["costs"]["fees"] > 0


@pytest.mark.django_db
def test_stop_breach_detected(user):
    trade = buy(user, stop_pct=5)
    PRICE["value"] = 80.0
    engine.place_order(user, "alpha", "sell", quantity=trade.quantity)
    data = insights.build(engine.get_account(user))
    assert data["plan"]["stop_breaches"] == 1
    assert data["closed"]["losses"] == 1


@pytest.mark.django_db
def test_progress_api(user):
    c = APIClient()
    c.force_authenticate(user=user)
    resp = c.get("/api/progress/")
    assert resp.status_code == 200
    assert resp.data["trades"] == 0
