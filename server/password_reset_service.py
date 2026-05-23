"""
Password reset service: generates OTP codes and stores them in-memory with expiry.
Email sending is handled by the frontend via EmailJS.
"""
import os
import random
import string
import logging
from datetime import datetime, timedelta
from threading import Lock

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory OTP store  {email: {"code": str, "expires_at": datetime}}
# ---------------------------------------------------------------------------
_otp_store: dict[str, dict] = {}
_lock = Lock()

OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 10


def generate_otp() -> str:
    """Generate a random numeric OTP code."""
    return ''.join(random.choices(string.digits, k=OTP_LENGTH))


def store_otp(email: str, code: str) -> None:
    """Store OTP with expiry for a given email."""
    with _lock:
        _otp_store[email.lower()] = {
            "code": code,
            "expires_at": datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES),
        }


def verify_otp(email: str, code: str) -> bool:
    """
    Verify OTP code for an email.
    Returns True if valid and not expired, False otherwise.
    Consumes the OTP on successful verification.
    """
    with _lock:
        entry = _otp_store.get(email.lower())
        if not entry:
            return False
        if entry["code"] != code:
            return False
        if datetime.utcnow() > entry["expires_at"]:
            del _otp_store[email.lower()]
            return False
        del _otp_store[email.lower()]
        return True
