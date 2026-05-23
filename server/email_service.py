import logging

logger = logging.getLogger(__name__)


def send_registration_email(to_email: str, full_name: str):
    """
    Log thông báo đăng ký thành công.
    Email gửi từ frontend nếu cần.
    """
    logger.info(f"[REGISTRATION] Tài khoản mới: {full_name} ({to_email})")
    return True
