"""
Password reset service: generates OTP codes, stores them in-memory with expiry,
and sends reset emails via Resend API (HTTPS).
"""
import os
import random
import string
import logging
import httpx
from datetime import datetime, timedelta
from threading import Lock

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory OTP store  {email: {"code": str, "expires_at": datetime}}
# For production, consider Redis or DB-backed storage.
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
            # Expired — clean up
            del _otp_store[email.lower()]
            return False
        # Valid — consume it
        del _otp_store[email.lower()]
        return True


def send_password_reset_email(to_email: str, otp_code: str) -> bool:
    """
    Send password reset OTP email via Resend API.
    Returns True on success, False on failure.
    """
    RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
    SMTP_USER = os.getenv("SMTP_USER", "")

    subject = "Mã xác nhận đặt lại mật khẩu - Hệ thống Quản lý Sinh viên"
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background: #f4f6f9; padding: 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
          <h2 style="color: #1e293b; text-align: center;">Đặt lại mật khẩu</h2>
          <p style="color: #475569;">Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng sử dụng mã xác nhận bên dưới:</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #6366f1; background: #eef2ff; padding: 16px 32px; border-radius: 12px;">{otp_code}</span>
          </div>
          <p style="color: #475569; font-size: 14px;">Mã này có hiệu lực trong <strong>{OTP_EXPIRY_MINUTES} phút</strong>.</p>
          <p style="color: #94a3b8; font-size: 13px;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">Ban Quản Trị Hệ Thống</p>
        </div>
      </body>
    </html>
    """

    if not RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY chưa cấu hình. OTP cho {to_email}: {otp_code}")
        return True

    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": f"Hệ thống Quản lý <onboarding@resend.dev>",
                "to": [to_email],
                "subject": subject,
                "html": body,
            },
            timeout=10,
        )

        if response.status_code == 200:
            logger.info(f"Đã gửi mã đặt lại mật khẩu tới {to_email}")
            return True
        else:
            logger.error(f"[RESEND ERROR] {response.status_code}: {response.text}")
            return False
    except Exception as e:
        logger.error(f"[RESEND ERROR] Lỗi gửi email tới {to_email}: {type(e).__name__}: {e}")
        return False
