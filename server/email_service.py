import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logger = logging.getLogger(__name__)

def send_registration_email(to_email: str, full_name: str):
    """
    Gửi email thông báo đăng ký thành công.
    Nếu chưa cấu hình SMTP trong biến môi trường, sẽ in log.
    """
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASS = os.getenv("SMTP_PASS", "")

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
    
    if not SMTP_USER or not SMTP_PASS:
        logger.warning(f"Chưa cấu hình SMTP. Bỏ qua gửi email tới: {to_email}")
        logger.info(f"Nội dung email:\n{body}")
        return False
        
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))

        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)
        server.quit()
        
        logger.info(f"Đã gửi email đăng ký thành công tới {to_email}")
        return True
    except Exception as e:
        logger.error(f"Lỗi khi gửi email tới {to_email}: {e}")
        return False
