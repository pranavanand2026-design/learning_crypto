import math

import pytest

from trading import heat, market, news

RSS = b"""<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
<item><title>Bitcoin slides as ETF outflows grow</title><link>https://ex.com/a</link>
<pubDate>Wed, 18 Nov 2026 02:39:52 +0000</pubDate><description>&lt;p&gt;Markets &amp;amp; more&lt;/p&gt;</description>
<media:content url="https://ex.com/a.jpg"/></item>
<item><title>Why NEAR is the one to watch</title><link>https://ex.com/b</link>
<pubDate>Tue, 17 Nov 2026 02:39:52 +0000</pubDate></item>
<item><title>No link here</title></item>
</channel></rss>"""

ROWS = [
    {"id": "bitcoin", "symbol": "btc", "name": "Bitcoin"},
    {"id": "near", "symbol": "near", "name": "NEAR Protocol"},
    {"id": "harmony", "symbol": "one", "name": "Harmony"},
]


def wave(n=168, amp=0.01, base=100.0):
    return [base * (1 + amp * math.sin(i / 6)) for i in range(n)]


def test_parse_feed_extracts_fields():
    items = news._parse_feed("Ex", RSS)
    assert len(items) == 2
    first = items[0]
    assert first["title"] == "Bitcoin slides as ETF outflows grow"
    assert first["image"] == "https://ex.com/a.jpg"
    assert "<p>" not in first["summary"]
    assert first["published"].startswith("2026-11-18T02:39:52")


def test_tagging_avoids_ambiguous_symbols(monkeypatch):
    monkeypatch.setattr(news, "headlines", lambda: news._parse_feed("Ex", RSS))
    monkeypatch.setattr(market, "markets", lambda **kw: ROWS)
    tagged = news.tagged_headlines()
    assert [c["id"] for c in tagged[0]["coins"]] == ["bitcoin"]
    # "NEAR" and "one" are ambiguous words; only the full name would tag them
    assert tagged[1]["coins"] == []


def test_heat_is_quiet_for_ordinary_day():
    row = {"price_change_percentage_24h": 0.5, "market_cap": 1e9, "total_volume": 5e7,
           "sparkline_in_7d": {"price": wave(amp=0.03)}}
    h = heat.compute(row)
    assert h["level"] == "quiet"
    assert h["drivers"] == []


def test_heat_rises_with_outsized_move_news_and_trending():
    row = {"price_change_percentage_24h": 35, "market_cap": 1e8, "total_volume": 6e7,
           "sparkline_in_7d": {"price": wave(amp=0.02)}}
    h = heat.compute(row, mentions=4, trending=True)
    assert h["level"] == "hot"
    assert h["score"] >= 65
    assert any("usual daily move" in d for d in h["drivers"])
    assert any("headlines" in d for d in h["drivers"])


def test_stablecoin_volume_is_not_hype():
    row = {"price_change_percentage_24h": 0.01, "market_cap": 1e9, "total_volume": 9e8,
           "sparkline_in_7d": {"price": wave(amp=0.001, base=1.0)}}
    assert heat.compute(row)["score"] == 0


@pytest.mark.django_db
def test_news_endpoint_returns_linked_items(monkeypatch):
    from rest_framework.test import APIClient
    monkeypatch.setattr(news, "headlines", lambda: news._parse_feed("Ex", RSS))
    monkeypatch.setattr(market, "markets", lambda **kw: ROWS)
    resp = APIClient().get("/api/news/?linked=1")
    assert resp.status_code == 200
    assert len(resp.data["results"]) == 1
    assert resp.data["results"][0]["coins"][0]["symbol"] == "BTC"


def test_relevance_filter_needs_coin_and_crypto_context():
    rel = lambda t: news._relevant({"title": t}, "Rain", "RAIN")
    assert rel("Rain falls 25% to lead crypto declines")
    assert not rel("Torrential rain floods shopping centre")
    assert not rel("Bitcoin price slides again")


def test_coin_headlines_fall_back_to_market(monkeypatch):
    monkeypatch.setattr(news, "headlines", lambda: news._parse_feed("Ex", RSS))
    monkeypatch.setattr(market, "markets", lambda **kw: ROWS)
    monkeypatch.setattr(news, "_google_news", lambda name, symbol: [{"title": "Weather: rain all week", "url": "u"}])
    monkeypatch.setattr(news, "_gdelt", lambda name: [])
    out = news.coin_headlines("harmony", "Harmony", "ONE")
    assert out["scope"] == "market"
    assert out["results"]
    out = news.coin_headlines("bitcoin", "Bitcoin", "BTC")
    assert out["scope"] == "coin"


def test_google_news_titles_drop_publisher_suffix():
    xml = b"""<rss><channel><item><title>Rain token jumps 30% - CoinTimes</title><link>https://x/1</link>
    <pubDate>Wed, 18 Nov 2026 02:39:52 +0000</pubDate><source url="https://ct">CoinTimes</source></item></channel></rss>"""
    item = news._parse_feed("Google News", xml)[0]
    assert item["title"] == "Rain token jumps 30%"
    assert item["source"] == "CoinTimes"
