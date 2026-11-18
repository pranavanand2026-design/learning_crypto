"""Account security: password rules, breach checks, login throttling and Google sign-in."""
from __future__ import annotations

import hashlib
import logging
import re

import requests
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.utils import timezone

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------
# Password validators (registered in AUTH_PASSWORD_VALIDATORS)
# --------------------------------------------------------------------------
# Each rule mirrors a line in the sign-up checklist.
CHARACTER_RULES = [
    (r"[A-Z]", "Add an uppercase letter."),
    (r"[a-z]", "Add a lowercase letter."),
    (r"\d", "Add a number."),
    (r"[^A-Za-z0-9]", "Add a symbol, like ! or #."),
]


class CharacterMixValidator:
    """Require uppercase, lowercase, a number and a symbol."""

    def validate(self, password, user=None):
        missing = [message for pattern, message in CHARACTER_RULES if not re.search(pattern, password)]
        if missing:
            raise ValidationError(missing, code="password_character_mix")

    def get_help_text(self):
        return "Your password must contain uppercase and lowercase letters, a number and a symbol."


# Backwards-compatible name
LetterAndNumberValidator = CharacterMixValidator


class BreachedPasswordValidator:
    """Reject passwords found in known data breaches (Have I Been Pwned).

    Uses the k-anonymity range API: only the first five characters of the
    SHA-1 hash leave the server. If the service can't be reached, the check
    is skipped rather than blocking sign-up.
    """

    URL = "https://api.pwnedpasswords.com/range/{}"

    def validate(self, password, user=None):
        if not getattr(settings, "PASSWORD_BREACH_CHECK", True):
            return
        digest = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
        prefix, suffix = digest[:5], digest[5:]
        try:
            resp = requests.get(self.URL.format(prefix), timeout=3, headers={"Add-Padding": "true"})
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.info("Breach check unavailable: %s", exc)
            return
        for line in resp.text.splitlines():
            found, _, count = line.partition(":")
            if found == suffix and count.strip() != "0":
                raise ValidationError(
                    "This password has appeared in a data breach. Choose a different one.",
                    code="password_breached",
                )

    def get_help_text(self):
        return "Your password can't be one that has appeared in a known data breach."


# --------------------------------------------------------------------------
# Login throttling
# --------------------------------------------------------------------------
MAX_FAILURES = 5          # per email address
MAX_IP_FAILURES = 20      # per IP (higher: shared networks like campuses)
LOCK_SECONDS = 15 * 60


def _keys(email, ip):
    email_key = hashlib.sha256((email or "").strip().lower().encode()).hexdigest()[:24]
    return [(f"login-fail:e:{email_key}", MAX_FAILURES), (f"login-fail:ip:{ip or 'unknown'}", MAX_IP_FAILURES)]


def client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def locked_until(email, ip):
    """Return when the lock lifts, or None if logins are allowed."""
    for key, limit in _keys(email, ip):
        state = cache.get(key)
        if state and state["count"] >= limit:
            return state["until"]
    return None


def record_failure(email, ip):
    now = timezone.now()
    for key, _ in _keys(email, ip):
        state = cache.get(key) or {"count": 0}
        state["count"] += 1
        state["until"] = now + timezone.timedelta(seconds=LOCK_SECONDS)
        cache.set(key, state, LOCK_SECONDS)


def clear_failures(email, ip):
    # Only the account's counter resets; the IP keeps its history.
    cache.delete(_keys(email, ip)[0][0])


# --------------------------------------------------------------------------
# Google sign-in
# --------------------------------------------------------------------------
class GoogleAuthError(Exception):
    pass


def verify_google_credential(credential):
    """Verify a Google Identity Services ID token and return its claims."""
    client_id = getattr(settings, "GOOGLE_CLIENT_ID", "")
    if not client_id:
        raise GoogleAuthError("Google sign-in isn't configured.")
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    try:
        claims = id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
    except ValueError as exc:
        raise GoogleAuthError("That Google sign-in couldn't be verified.") from exc
    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise GoogleAuthError("That Google sign-in couldn't be verified.")
    if not claims.get("email") or not claims.get("email_verified"):
        raise GoogleAuthError("Your Google account needs a verified email.")
    return claims
