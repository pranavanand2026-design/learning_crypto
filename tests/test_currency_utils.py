import decimal
from unittest.mock import patch

import pytest

from web_app.utils import currency


def test_normalise_standardises_input():
    assert currency.normalise("  eur ") == "EUR"
    assert currency.normalise("") == currency.DEFAULT_CURRENCY
    assert currency.normalise(None) == currency.DEFAULT_CURRENCY


@patch("web_app.utils.currency.get_current_prices")
def test_usd_coin_rate_uses_cache(mock_prices):
    mock_prices.return_value = {
        currency.STABLE_COIN_ID: {"eur": "0.91"},
    }

    currency._usd_coin_rate.cache_clear()

    # First call should fetch from API through the patched function.
    rate = currency._usd_coin_rate("eur")
    assert rate == decimal.Decimal("0.91")
    mock_prices.assert_called_once()

    # Second call should use cached value and not call the API again.
    again = currency._usd_coin_rate("eur")
    assert again == rate
    mock_prices.assert_called_once()

    # Clear the cache for other tests.
    currency._usd_coin_rate.cache_clear()


@patch("web_app.utils.currency._usd_coin_rate")
def test_convert_amount_success(mock_rate):
    mock_rate.side_effect = [
        decimal.Decimal("2"),  # src currency rate
        decimal.Decimal("4"),  # dst currency rate
    ]
    result = currency.convert_amount("10", "CAD", "AUD")
    assert result == decimal.Decimal("20.0000000000")


@patch("web_app.utils.currency._usd_coin_rate", return_value=None)
def test_convert_amount_falls_back_when_rate_missing(mock_rate):
    amount = currency.convert_amount("15", "CAD", "JPY")
    assert amount == decimal.Decimal("15")
    mock_rate.assert_called()


def test_convert_amount_invalid_input_raises():
    with pytest.raises(ValueError):
        currency.convert_amount(object(), "USD", "EUR")
