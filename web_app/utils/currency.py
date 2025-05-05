from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from functools import lru_cache
from typing import Optional

from .coingecko import get_current_prices

DEFAULT_CURRENCY = "USD"
STABLE_COIN_ID = "usd-coin"
DECIMAL_QUANTIZE = Decimal("0.0000000001")


def normalise(code: Optional[str]) -> str:
    if not code or not isinstance(code, str):
        return DEFAULT_CURRENCY
    return code.strip().upper() or DEFAULT_CURRENCY


@lru_cache(maxsize=64)
def _usd_coin_rate(currency: str) -> Optional[Decimal]:
    """
    Return the price of 1 USDC (≈ 1 USD) in the target currency.
    Falls back to Decimal('1') when the lookup fails for USD.
    """
    currency = normalise(currency)
    if currency == DEFAULT_CURRENCY:
        return Decimal("1")

    data = get_current_prices(STABLE_COIN_ID, currency.lower())
    try:
        price = data.get(STABLE_COIN_ID, {}).get(currency.lower())
    except AttributeError:
        price = None

    if price is None:
        return None

    try:
        return Decimal(str(price))
    except (InvalidOperation, TypeError, ValueError):
        return None


def convert_amount(amount, src_currency: Optional[str], dst_currency: Optional[str]) -> Decimal:
    """
    Convert amount from src_currency to dst_currency using USDC as the intermediary.
    Returns the original amount (as Decimal) when conversion rates are unavailable.
    """
    dst_currency = normalise(dst_currency)
    src_currency = normalise(src_currency)

    try:
        numeric = Decimal(str(amount))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("Unable to convert amount to Decimal")

    if src_currency == dst_currency:
        return numeric

    src_rate = _usd_coin_rate(src_currency)
    dst_rate = _usd_coin_rate(dst_currency)

    if src_rate is None or dst_rate is None or src_rate <= 0 or dst_rate <= 0:
        return numeric

    value_in_usd = numeric / src_rate
    converted = value_in_usd * dst_rate
    return converted.quantize(DECIMAL_QUANTIZE, rounding=ROUND_HALF_UP)
