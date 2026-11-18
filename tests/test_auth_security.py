from unittest.mock import patch

import pytest
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.urls import reverse
from rest_framework.test import APIClient

from web_app import security
from web_app.models import User


@pytest.fixture
def client():
    return APIClient()


def make_user(email="a@example.com", password="Sturdy-pass-2024"):
    return User.objects.create_user(email=email, username=email, password=password, display_name="A")


# ------------------------------------------------------------ passwords
@pytest.mark.django_db
@pytest.mark.parametrize("pw", ["short1", "onlyletterslong", "1234567890123", "password123"])
def test_weak_passwords_rejected(pw):
    with pytest.raises(ValidationError):
        validate_password(pw)


@pytest.mark.django_db
def test_strong_password_accepted():
    validate_password("Sturdy-pass-2024")


@pytest.mark.django_db
def test_breached_password_rejected(settings):
    settings.PASSWORD_BREACH_CHECK = True
    import hashlib
    suffix = hashlib.sha1(b"Sturdy-pass-2024").hexdigest().upper()[5:]

    class Resp:
        text = f"0000000000000000000000000000000000A:1\r\n{suffix}:42"
        def raise_for_status(self):
            pass

    with patch("web_app.security.requests.get", return_value=Resp()):
        with pytest.raises(ValidationError) as exc:
            validate_password("Sturdy-pass-2024")
    assert "breach" in str(exc.value)


@pytest.mark.django_db
def test_breach_check_fails_open(settings):
    settings.PASSWORD_BREACH_CHECK = True
    import requests
    with patch("web_app.security.requests.get", side_effect=requests.ConnectionError()):
        validate_password("Sturdy-pass-2024")


@pytest.mark.django_db
def test_register_enforces_policy_and_unique_email(client):
    url = reverse("register")
    weak = client.post(url, {"email": "n@example.com", "password": "abc12345", "display_name": "N"})
    assert weak.status_code == 400
    ok = client.post(url, {"email": "N@Example.com", "password": "Sturdy-pass-2024", "display_name": "N"})
    assert ok.status_code == 201
    assert User.objects.get(email="n@example.com")
    dup = client.post(url, {"email": "n@example.com", "password": "Sturdy-pass-2024", "display_name": "N"})
    assert dup.status_code == 400


# ------------------------------------------------------------ login
@pytest.mark.django_db
def test_login_locks_after_repeated_failures(client, settings):
    settings.RECAPTCHA_REQUIRED = False
    make_user()
    url = reverse("login")
    for _ in range(security.MAX_FAILURES):
        assert client.post(url, {"email": "a@example.com", "password": "nope-nope-1"}).status_code == 401
    locked = client.post(url, {"email": "a@example.com", "password": "Sturdy-pass-2024"})
    assert locked.status_code == 429
    assert "retry_at" in locked.data


@pytest.mark.django_db
def test_login_is_case_insensitive_and_clears_failures(client, settings):
    settings.RECAPTCHA_REQUIRED = False
    make_user()
    url = reverse("login")
    client.post(url, {"email": "a@example.com", "password": "wrong-pass-1"})
    resp = client.post(url, {"email": "A@Example.com ", "password": "Sturdy-pass-2024"})
    assert resp.status_code == 200
    assert resp.cookies["refresh_token"]["httponly"]


# ------------------------------------------------------------ google
CLAIMS = {"iss": "https://accounts.google.com", "email": "g@example.com", "email_verified": True, "name": "Gee Person"}


@pytest.mark.django_db
def test_google_login_creates_account(client, settings):
    settings.GOOGLE_CLIENT_ID = "test-client"
    with patch("web_app.security.verify_google_credential", return_value=CLAIMS):
        resp = client.post(reverse("google-login"), {"credential": "tok"})
    assert resp.status_code == 200
    assert resp.data["created"] is True
    user = User.objects.get(email="g@example.com")
    assert user.display_name == "Gee Person"
    assert not user.has_usable_password()


@pytest.mark.django_db
def test_google_login_links_existing_account(client):
    make_user("g@example.com")
    with patch("web_app.security.verify_google_credential", return_value=CLAIMS):
        resp = client.post(reverse("google-login"), {"credential": "tok"})
    assert resp.status_code == 200
    assert resp.data["created"] is False
    assert User.objects.filter(email="g@example.com").count() == 1


@pytest.mark.django_db
def test_google_login_rejects_bad_token(client, settings):
    settings.GOOGLE_CLIENT_ID = "test-client"
    with patch("google.oauth2.id_token.verify_oauth2_token", side_effect=ValueError("bad")):
        resp = client.post(reverse("google-login"), {"credential": "tok"})
    assert resp.status_code == 401


@pytest.mark.django_db
def test_google_login_requires_configuration(client, settings):
    settings.GOOGLE_CLIENT_ID = ""
    assert client.post(reverse("google-login"), {"credential": "tok"}).status_code == 401


def test_unverified_google_email_rejected(settings):
    settings.GOOGLE_CLIENT_ID = "test-client"
    with patch("google.oauth2.id_token.verify_oauth2_token", return_value={**CLAIMS, "email_verified": False}):
        with pytest.raises(security.GoogleAuthError):
            security.verify_google_credential("tok")


@pytest.mark.django_db
def test_config_exposes_google_client_id(client, settings):
    settings.GOOGLE_CLIENT_ID = "abc.apps.googleusercontent.com"
    assert client.get("/api/config/").data["google_client_id"] == "abc.apps.googleusercontent.com"


@pytest.mark.django_db
def test_one_users_typos_dont_lock_others_on_same_network(client, settings):
    settings.RECAPTCHA_REQUIRED = False
    make_user("a@example.com")
    make_user("b@example.com")
    url = reverse("login")
    for _ in range(security.MAX_FAILURES):
        client.post(url, {"email": "a@example.com", "password": "nope-nope-1"})
    assert client.post(url, {"email": "b@example.com", "password": "Sturdy-pass-2024"}).status_code == 200


@pytest.mark.django_db
def test_ip_locks_after_many_failures_across_accounts(client, settings):
    settings.RECAPTCHA_REQUIRED = False
    url = reverse("login")
    for i in range(security.MAX_IP_FAILURES):
        client.post(url, {"email": f"x{i}@example.com", "password": "nope-nope-1"})
    assert client.post(url, {"email": "new@example.com", "password": "whatever-1"}).status_code == 429
