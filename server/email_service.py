import os
import httpx
import logging

logger = logging.getLogger(__name__)


def send_registration_email(to_email: str, full_name: str):
    """Gửi email thông báo đăng ký thành công qua Resend API."""
    RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")

    subject = "Đăng ký tài khoản thành công - Hệ thống Quản lý Sinh viên"
    body = f"""
    <html>
      <body>
        <h2>Xin chào {full_name},</h2>
        <p>Chúc mừng bạn đã đăng ký thành công tài khoản trên Hệ thống Quản lý Sinh viên vào phòng thi.</p>
        <p>Tài khoản của bạn đã có thể sử dụng để đăng nhập vào hệ thống.</p>
        <p>Trân trọng,<br>Ban Quản Trị Hệ Thống.</p>
      </body>
    </html>
    """

    if not RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY chưa cấu hình. Bỏ qua gửi email tới: {to_email}")
        return False

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
            logger.info(f"Đã gửi email đăng ký thành công tới {to_email}")
            return True
        else:
            logger.error(f"[RESEND ERROR] {response.status_code}: {response.text}")
            return False
    except Exception as e:
        logger.error(f"[RESEND ERROR] Lỗi khi gửi email tới {to_email}: {e}")
        return False
