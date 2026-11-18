import pytest


@pytest.fixture(autouse=True)
def _offline_security(settings):
    """Keep tests off the network and fast."""
    settings.PASSWORD_BREACH_CHECK = False
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@pytest.fixture(autouse=True)
def _clear_cache():
    from django.core.cache import cache
    cache.clear()
    yield
    cache.clear()
