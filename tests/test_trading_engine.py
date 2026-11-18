from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from trading import engine, market
from trading.models import Account, Trade
from web_app.models import User

BTC = {"id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "image": "", "current_price": 50000.0,
       "total_volume": 30_000_000_000, "price_change_percentage_24h": 1.5}
TINY = {"id": "tinycoin", "symbol": "tiny", "name": "Tiny", "image": "", "current_price": 2.0,
        "total_volume": 50_000, "price_change_percentage_24h": 40.0}
ROWS = {"bitcoin": BTC, "tinycoin": TINY}

BOOK = {
    "bids": [["49990", "0.5", 1], ["49980", "1", 1]],
    "asks": [["50010", "0.1", 1], ["50020", "0.1", 1], ["50100", "10", 1]],
}


@pytest.fixture(autouse=True)
def fake_market(monkeypatch):
    monkeypatch.setattr(market, "market_row", lambda cid: ROWS[cid])
    monkeypatch.setattr(market, "markets", lambda **kw: [ROWS[i] for i in kw.get("ids") or ROWS])
    monkeypatch.setattr(market, "coinbase_bases", lambda: {"BTC"})
    monkeypatch.setattr(market, "order_book", lambda product: BOOK)


@pytest.fixture
def user(db):
    return User.objects.create_user(email="t@example.com", username="t@example.com",
                                    password="Password123!", display_name="T")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def buy(user, coin="bitcoin", notional="1000", **plan):
    plan.setdefault("thesis", "Testing a thesis for this trade")
    return engine.place_order(user, coin, "buy", notional=Decimal(notional), plan=plan)


# ---------------------------------------------------------------- fills
def test_walk_book_buy_consumes_levels():
    fill = market.simulate_fill(BTC, "buy", notional=Decimal("15000"))
    assert fill.source == "coinbase"
    # Mid is 50000; first two levels hold ~$10k, the rest fills at 50100
    assert Decimal("50010") < fill.price < Decimal("50100")
    assert fill.slippage_bps > 0
    assert fill.fee == (fill.notional * market.FEE_RATE).quantize(Decimal("0.01"))
    assert fill.total == fill.notional + fill.fee


def test_sell_walks_bids_and_deducts_fee():
    fill = market.simulate_fill(BTC, "sell", quantity=Decimal("1"))
    assert fill.price < Decimal("50000")
    assert fill.total == fill.notional - fill.fee


def test_model_fill_for_unlisted_thin_coin_has_large_impact():
    big = market.simulate_fill(TINY, "buy", notional=Decimal("5000"))
    small = market.simulate_fill(TINY, "buy", notional=Decimal("10"))
    assert big.source == "model"
    assert big.slippage_bps > small.slippage_bps > 0


def test_exhausted_book_charges_penalty():
    fill = market.simulate_fill(BTC, "buy", notional=Decimal("2000000"))
    assert fill.price > Decimal("50100")


# ---------------------------------------------------------------- orders
@pytest.mark.django_db
def test_buy_reduces_cash_and_opens_position(user):
    trade, fill = buy(user)
    account = Account.objects.get(user=user)
    assert account.cash == Decimal("10000.00") - fill.total
    pos = account.positions.get(coin_id="bitcoin")
    assert pos.quantity == fill.quantity
    assert pos.cost_basis == fill.total
    assert trade.price_source == "coinbase"


@pytest.mark.django_db
def test_buy_requires_thesis(user):
    with pytest.raises(engine.OrderRejected) as exc:
        engine.place_order(user, "bitcoin", "buy", notional=Decimal("100"), plan={"thesis": "yolo"})
    assert exc.value.code == "thesis_required"


@pytest.mark.django_db
def test_cannot_spend_more_than_cash(user):
    with pytest.raises(engine.OrderRejected) as exc:
        buy(user, notional="10000")  # fee pushes it over
    assert exc.value.code == "insufficient_cash"


@pytest.mark.django_db
def test_sell_realizes_pnl_and_closes_position(user):
    _, fill = buy(user)
    trade, sell = engine.place_order(user, "bitcoin", "sell", quantity=fill.quantity)
    account = Account.objects.get(user=user)
    assert not account.positions.exists()
    assert trade.realized_pnl == sell.total - fill.total
    assert trade.realized_pnl < 0  # spread + fees cost money on a round trip


@pytest.mark.django_db
def test_cannot_oversell(user):
    _, fill = buy(user)
    with pytest.raises(engine.OrderRejected) as exc:
        engine.place_order(user, "bitcoin", "sell", quantity=fill.quantity * 2)
    assert exc.value.code == "insufficient_quantity"


@pytest.mark.django_db
def test_daily_trade_limit_blocks_buys_not_sells(user):
    account = engine.get_account(user)
    account.max_trades_per_day = 1
    account.save()
    _, fill = buy(user)
    with pytest.raises(engine.OrderRejected) as exc:
        buy(user)
    assert exc.value.code == "daily_limit"
    engine.place_order(user, "bitcoin", "sell", quantity=fill.quantity)  # exits always allowed


@pytest.mark.django_db
def test_cooldown_after_losing_sell(user):
    _, fill = buy(user)
    engine.place_order(user, "bitcoin", "sell", quantity=fill.quantity)
    with pytest.raises(engine.OrderRejected) as exc:
        buy(user)
    assert exc.value.code == "cooldown"
    assert exc.value.retry_at > timezone.now()
    Trade.objects.filter(side="sell").update(created_at=timezone.now() - timedelta(minutes=30))
    trade, _ = buy(user)
    assert trade.minutes_since_loss >= 30


@pytest.mark.django_db
def test_invalid_plan_values_rejected(user):
    with pytest.raises(engine.OrderRejected):
        buy(user, conviction=75)
    with pytest.raises(engine.OrderRejected):
        buy(user, horizon_days=3)
    with pytest.raises(engine.OrderRejected):
        buy(user, stop_pct=95)


@pytest.mark.django_db
def test_restart_keeps_history(user):
    buy(user)
    account = engine.restart(user)
    assert account.cash == account.starting_cash
    assert not account.positions.exists()
    assert account.trades.count() == 1
    assert account.restarts == 1


# ---------------------------------------------------------------- API
@pytest.mark.django_db
def test_order_api_ignores_client_price(client):
    resp = client.post("/api/orders/", {"coin_id": "bitcoin", "side": "buy", "notional": 500,
                                        "price": 1, "thesis": "Client price must be ignored",
                                        "conviction": 70, "horizon_days": 7}, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["price"] > 50000
    assert resp.data["conviction"] == 70


@pytest.mark.django_db
def test_quote_api(client):
    resp = client.post("/api/quote/", {"coin_id": "bitcoin", "side": "buy", "notional": 2500}, format="json")
    assert resp.status_code == 200
    assert resp.data["source"] == "coinbase"
    assert resp.data["position_pct"] == pytest.approx(25, rel=0.05)


@pytest.mark.django_db
def test_account_api_and_rules(client):
    resp = client.get("/api/account/")
    assert resp.status_code == 200
    assert resp.data["cash"] == 10000.0
    assert resp.data["benchmark_equity"] == pytest.approx(10000.0)
    resp = client.put("/api/account/rules/", {"max_trades_per_day": 3, "cooldown_minutes": 0}, format="json")
    assert resp.data["rules"]["max_trades_per_day"] == 3
    resp = client.put("/api/account/rules/", {"max_trades_per_day": 0}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_journal_is_private_and_append_only(client, user):
    buy(user)
    other = User.objects.create_user(email="o@example.com", username="o@example.com", password="Password123!", display_name="O")
    foreign, _ = buy(other)
    trades = client.get("/api/journal/").data["results"]
    assert len(trades) == 1
    trade_id = trades[0]["id"]
    resp = client.post(f"/api/journal/{trade_id}/notes/", {"text": "Sold too early."}, format="json")
    assert resp.status_code == 201
    assert resp.data["notes"][0]["text"] == "Sold too early."
    assert client.post(f"/api/journal/{foreign.id}/notes/", {"text": "x"}, format="json").status_code == 404
    assert client.delete(f"/api/journal/{trade_id}/notes/").status_code == 405


@pytest.mark.django_db
def test_market_unavailable_returns_503(client, monkeypatch):
    def boom(**kw):
        raise market.MarketUnavailable("down")
    monkeypatch.setattr(market, "markets", boom)
    assert client.get("/api/market/").status_code == 503


@pytest.mark.django_db
def test_onboarding_flag(client):
    assert client.get("/api/account/").data["onboarded"] is False
    resp = client.put("/api/account/rules/", {"max_trades_per_day": 5, "onboarded": True}, format="json")
    assert resp.data["onboarded"] is True


@pytest.mark.django_db
def test_fx_rates(client, monkeypatch):
    monkeypatch.setattr(market, "fiat_rates", lambda: {"USD": 1.0, "EUR": 0.91})
    assert client.get("/api/fx/").data["rates"]["EUR"] == 0.91
