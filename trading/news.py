"""Crypto headlines from public RSS feeds, linked to the coins they mention."""
from __future__ import annotations

import html
import logging
import re
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone as dt_timezone
from email.utils import parsedate_to_datetime

import requests
from django.core.cache import cache

from . import market

logger = logging.getLogger(__name__)

FEEDS = [
    ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
    ("Cointelegraph", "https://cointelegraph.com/rss"),
    ("Decrypt", "https://decrypt.co/feed"),
]
GDELT = "https://api.gdeltproject.org/api/v2/doc/doc"
GOOGLE_NEWS = "https://news.google.com/rss/search"
MEDIA_NS = "{http://search.yahoo.com/mrss/}"
TAG_RE = re.compile(r"<[^>]+>")

# Symbols that are ordinary words in headlines.
AMBIGUOUS = {"ONE", "NEAR", "SUN", "CAT", "DOG", "GAS", "APE", "BEST", "FLOW", "MOVE", "JUST", "PEOPLE",
             "SAFE", "GT", "OM", "HT", "IP", "S", "ME", "AI", "IT", "US", "SO", "ALL", "MAGIC", "DEEP"}
ALIASES = {"ethereum": ["Ether"], "binancecoin": ["Binance Coin"], "ripple": ["Ripple"],
           "avalanche-2": ["Avalanche"], "the-open-network": ["Toncoin"], "shiba-inu": ["Shiba"]}


def _text(node, tag):
    child = node.find(tag)
    return (child.text or "").strip() if child is not None and child.text else ""


def _image(item):
    for tag in (f"{MEDIA_NS}content", f"{MEDIA_NS}thumbnail", "enclosure"):
        node = item.find(tag)
        if node is not None and node.get("url"):
            return node.get("url")
    return None


def _parse_feed(source, xml_bytes):
    root = ET.fromstring(xml_bytes)
    items = []
    for item in root.iter("item"):
        title = html.unescape(_text(item, "title"))
        link = _text(item, "link")
        if not title or not link:
            continue
        try:
            published = parsedate_to_datetime(_text(item, "pubDate")).astimezone(dt_timezone.utc)
        except (TypeError, ValueError):
            published = datetime.now(dt_timezone.utc)
        summary = html.unescape(TAG_RE.sub("", _text(item, "description"))).strip()
        publisher = item.find("source")
        item_source = source
        if publisher is not None and publisher.text:
            # Aggregated feeds name the real publisher and append it to the title.
            item_source = publisher.text.strip()
            title = re.sub(rf"\s+-\s+{re.escape(item_source)}$", "", title)
            summary = ""
        items.append({
            "title": title, "url": link, "source": item_source, "image": _image(item),
            "summary": summary[:240], "published": published.isoformat(),
        })
    return items


def _fetch_feed(feed):
    source, url = feed
    try:
        resp = requests.get(url, timeout=8, headers={"User-Agent": "CryptoDash/1.0 (news reader)"})
        resp.raise_for_status()
        return _parse_feed(source, resp.content)
    except (requests.RequestException, ET.ParseError) as exc:
        logger.warning("News feed %s failed: %s", source, exc)
        return []


def headlines():
    """All recent headlines, newest first (cached for 10 minutes)."""
    hit = cache.get("news:all")
    if hit is not None:
        return hit
    with ThreadPoolExecutor(max_workers=len(FEEDS)) as pool:
        batches = list(pool.map(_fetch_feed, FEEDS))
    items = [i for batch in batches for i in batch]
    if not items:
        return cache.get("news:all:stale") or []
    seen, unique = set(), []
    for item in sorted(items, key=lambda i: i["published"], reverse=True):
        key = item["title"].lower()[:80]
        if key not in seen:
            seen.add(key)
            unique.append(item)
    cache.set("news:all", unique, 600)
    cache.set("news:all:stale", unique, 24 * 60 * 60)
    return unique


def _patterns(rows):
    out = []
    for row in rows:
        terms = {row["name"]} | set(ALIASES.get(row["id"], []))
        symbol = row["symbol"].upper()
        if len(symbol) >= 2 and symbol not in AMBIGUOUS:
            terms.add(symbol)
        terms = [t for t in terms if len(t) >= 3 and t.upper() not in AMBIGUOUS]
        if terms:
            pattern = re.compile(r"(?<![\w$])(" + "|".join(re.escape(t) for t in terms) + r")(?![\w])")
            out.append((row, pattern))
    return out


def tagged_headlines():
    """Headlines annotated with the coins (from the top 100) they mention."""
    items = headlines()
    try:
        rows = market.markets()
    except market.MarketUnavailable:
        rows = []
    patterns = _patterns(rows)
    tagged = []
    for item in items:
        coins = [
            {"id": row["id"], "symbol": row["symbol"].upper(), "name": row["name"], "image": row.get("image")}
            for row, pattern in patterns
            if pattern.search(item["title"])
        ]
        tagged.append({**item, "coins": coins[:4]})
    return tagged


def mention_counts(hours=48):
    cutoff = (datetime.now(dt_timezone.utc) - timedelta(hours=hours)).isoformat()
    counts = {}
    for item in tagged_headlines():
        if item["published"] < cutoff:
            continue
        for coin in item["coins"]:
            counts[coin["id"]] = counts.get(coin["id"], 0) + 1
    return counts


def _gdelt(name):
    key = f"news:gdelt:{abs(hash(name))}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    try:
        resp = requests.get(GDELT, params={
            "query": f'"{name}" (crypto OR token OR blockchain) sourcelang:english',
            "mode": "artlist", "format": "json", "maxrecords": 12, "sort": "datedesc", "timespan": "7d",
        }, timeout=5)
        resp.raise_for_status()
        articles = resp.json().get("articles", [])
    except (requests.RequestException, ValueError) as exc:
        logger.info("GDELT lookup failed for %s: %s", name, exc)
        return []
    items = []
    for a in articles:
        try:
            published = datetime.strptime(a["seendate"], "%Y%m%dT%H%M%SZ").replace(tzinfo=dt_timezone.utc)
        except (KeyError, ValueError):
            continue
        items.append({"title": a.get("title", "").strip(), "url": a.get("url"), "source": a.get("domain"),
                      "image": a.get("socialimage") or None, "summary": "", "published": published.isoformat()})
    cache.set(key, items, 1800)
    return items


def _google_news(name, symbol):
    key = f"news:gn:{abs(hash(name))}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    query = f'"{name}" (crypto OR token OR coin OR blockchain) when:14d'
    try:
        resp = requests.get(GOOGLE_NEWS, params={"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"},
                            timeout=8, headers={"User-Agent": "CryptoDash/1.0 (news reader)"})
        resp.raise_for_status()
        items = _parse_feed("Google News", resp.content)
    except (requests.RequestException, ET.ParseError) as exc:
        logger.info("Google News lookup failed for %s: %s", name, exc)
        return []
    items.sort(key=lambda i: i["published"], reverse=True)
    cache.set(key, items, 1800)
    return items


CRYPTO_CONTEXT = re.compile(
    r"crypto|token|coin|blockchain|defi|altcoin|airdrop|exchange|listing|staking|whale|price|rally|memecoin|web3|on-chain|\$",
    re.IGNORECASE,
)


def _relevant(item, name, symbol):
    """The headline must name the coin and read like crypto news."""
    title = item["title"]
    names_coin = re.search(rf"(?<!\w){re.escape(name)}(?!\w)", title, re.IGNORECASE) or (
        len(symbol) >= 3 and symbol not in AMBIGUOUS and re.search(rf"(?<![\w$]){re.escape(symbol)}(?!\w)", title)
    )
    return bool(names_coin and CRYPTO_CONTEXT.search(title))


def coin_headlines(coin_id, name, symbol="", limit=8):
    """Headlines about a coin, never empty.

    Sources in order: our feeds, Google News search, GDELT. If nothing names
    the coin, return market-wide headlines and say so (scope="market").
    """
    items = [i for i in tagged_headlines() if any(c["id"] == coin_id for c in i["coins"])]
    for source in (lambda: _google_news(name, symbol), lambda: _gdelt(name)):
        if len(items) >= limit:
            break
        known = {i["url"] for i in items} | {i["title"].lower() for i in items}
        items += [
            i for i in source()
            if i["title"] and i["url"] not in known and i["title"].lower() not in known and _relevant(i, name, symbol)
        ]
    if items:
        return {"scope": "coin", "results": items[:limit]}
    return {"scope": "market", "results": tagged_headlines()[:limit]}
