from types import SimpleNamespace
from unittest.mock import patch

import pytest
from rest_framework import status

from web_app import views


def test_safe_response_wraps_payload():
    response = views.safe_response({"foo": "bar"}, code=7, status_code=status.HTTP_201_CREATED)
    assert response.status_code == status.HTTP_201_CREATED
    assert response.data == {"foo": "bar", "code": 7}


def test_handle_exception_returns_generic_error(monkeypatch):
    captured = []

    def fake_exception(msg):
        captured.append(msg)

    monkeypatch.setattr(views.logger, "exception", fake_exception)

    response = views.handle_exception(RuntimeError("boom"), "context")
    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert response.data["detail"] == "internal server error"
    assert captured  # logger.exception called


def test_verify_recaptcha_requires_token(settings):
    settings.RECAPTCHA_SITE_KEY = "key"
    settings.RECAPTCHA_PROJECT_ID = "project"
    settings.RECAPTCHA_API_KEY = "api"
    settings.DEBUG = False
    assert views.verify_recaptcha("", action="TEST") is False


def test_verify_recaptcha_allows_when_debug(settings):
    settings.RECAPTCHA_SITE_KEY = ""
    settings.RECAPTCHA_PROJECT_ID = ""
    settings.RECAPTCHA_API_KEY = ""
    settings.DEBUG = True
    assert views.verify_recaptcha("token", action="TEST") is True


@patch("web_app.views.requests.post")
def test_verify_recaptcha_success(mock_post, settings):
    settings.RECAPTCHA_SITE_KEY = "key"
    settings.RECAPTCHA_PROJECT_ID = "project"
    settings.RECAPTCHA_API_KEY = "api"
    settings.RECAPTCHA_MIN_SCORE = 0.3
    settings.DEBUG = False

    fake_response = SimpleNamespace(
        json=lambda: {
            "tokenProperties": {"valid": True, "action": "TEST"},
            "riskAnalysis": {"score": 0.9},
        },
        status_code=200,
        raise_for_status=lambda: None,
    )
    mock_post.return_value = fake_response

    assert views.verify_recaptcha("token", action="TEST") is True
    mock_post.assert_called_once()
