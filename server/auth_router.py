"""
Authentication API router: register, login, get current user profile,
and password reset (forgot password) flow.
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_db
from models import User
from auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from email_service import send_registration_email
from password_reset_service import (
    generate_otp,
    store_otp,
    verify_otp,
    send_password_reset_email,
)


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    department: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    department: str | None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RequestResetRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Đăng ký tài khoản giảng viên mới."""
    # Check email uniqueness
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email này đã được sử dụng.",
        )

    # Validate password length
    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu phải có ít nhất 6 ký tự.",
        )

    new_user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        department=payload.department,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(data={"sub": str(new_user.id)})

    # Gửi email thông báo đăng ký thành công trong background
    background_tasks.add_task(send_registration_email, new_user.email, new_user.full_name)

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(new_user),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Đăng nhập bằng email + mật khẩu, trả về JWT token."""
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không đúng.",
        )

    token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Lấy thông tin user hiện tại từ JWT token."""
    return UserResponse.model_validate(current_user)


# ---------------------------------------------------------------------------
# Password Reset (Forgot Password) endpoints
# ---------------------------------------------------------------------------

@router.post("/request-reset")
def request_password_reset(
    payload: RequestResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Gửi mã OTP qua email để đặt lại mật khẩu.
    Luôn trả về 200 để tránh lộ email tồn tại hay không.
    """
    user = db.query(User).filter(User.email == payload.email).first()

    if not user:
        # Không tiết lộ email không tồn tại
        return {"message": "Nếu email tồn tại, mã xác nhận đã được gửi."}

    otp_code = generate_otp()
    store_otp(payload.email, otp_code)

    # Gửi email trong background để response nhanh
    background_tasks.add_task(send_password_reset_email, payload.email, otp_code)

    return {"message": "Nếu email tồn tại, mã xác nhận đã được gửi."}


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Xác nhận mã OTP và đặt mật khẩu mới.
    """
    # Validate new password
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới phải có ít nhất 6 ký tự.",
        )

    # Verify OTP
    if not verify_otp(payload.email, payload.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã xác nhận không đúng hoặc đã hết hạn.",
        )

    # Find user and update password
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản.",
        )

    user.password_hash = hash_password(payload.new_password)
    db.commit()

    return {"message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập."}
