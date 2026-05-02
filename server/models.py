"""
SQLAlchemy ORM models matching the PostgreSQL schema.
Tables are created via raw SQL (see implementation_plan.md).
These models are used for querying only.
"""
import enum
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Date, Time, Boolean,
    DateTime, ForeignKey, Enum as SAEnum, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


# ---------------------------------------------------------------------------
# Python Enums (mirror the PostgreSQL ENUM types)
# ---------------------------------------------------------------------------

class StudentStatus(str, enum.Enum):
    BLOCKED = "BLOCKED"
    UNBLOCKED = "UNBLOCKED"


class AttendanceStatus(str, enum.Enum):
    PENDING = "PENDING"
    PRESENT = "PRESENT"
    LATE = "LATE"
    ABSENT = "ABSENT"


# ---------------------------------------------------------------------------
# ORM Models
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    department = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    exam_rooms = relationship("ExamRoom", back_populates="creator")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    mssv = Column(String(50), unique=True, nullable=False, index=True)
    card_id = Column(String(100), unique=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255))
    faculty = Column(String(255))  # Khoa / Trường (e.g. "CNTT và Truyền thông")
    class_name = Column(String(100))  # Lớp (e.g. "KHMT", "KTMT")
    status = Column(
        SAEnum(StudentStatus, name="student_status"),
        default=StudentStatus.UNBLOCKED,
    )
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    exam_entries = relationship("ExamRoomStudent", back_populates="student")


class ExamRoom(Base):
    __tablename__ = "exam_rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_name = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    exam_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="exam_rooms")
    students = relationship("ExamRoomStudent", back_populates="exam_room")
    devices = relationship("Device", back_populates="assigned_room")


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    assigned_room_id = Column(Integer, ForeignKey("exam_rooms.id", ondelete="SET NULL"))
    last_seen = Column(DateTime)
    is_online = Column(Boolean, default=False)

    # Relationships
    assigned_room = relationship("ExamRoom", back_populates="devices")


class ExamRoomStudent(Base):
    __tablename__ = "exam_room_students"

    id = Column(Integer, primary_key=True, index=True)
    exam_room_id = Column(Integer, ForeignKey("exam_rooms.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    attendance_status = Column(
        SAEnum(AttendanceStatus, name="attendance_enum"),
        default=AttendanceStatus.PENDING,
    )
    checked_in_at = Column(DateTime)
    check_in_device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"))

    # Unique constraint: one student per exam room
    __table_args__ = (
        UniqueConstraint("exam_room_id", "student_id", name="uq_exam_room_student"),
    )

    # Relationships
    exam_room = relationship("ExamRoom", back_populates="students")
    student = relationship("Student", back_populates="exam_entries")


class ScanLog(Base):
    """Logs every scan attempt (RFID/NFC/QR) for dashboard analytics."""
    __tablename__ = "scan_logs"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), nullable=False, index=True)
    scan_type = Column(String(10), nullable=False)  # "rfid", "nfc", "qr"
    scan_data = Column(String(255))  # raw UID or QR data
    result = Column(String(20), nullable=False)  # "accepted", "denied"
    student_mssv = Column(String(50))  # MSSV if student was found
    student_name = Column(String(255))  # Student name if found
    room_id = Column(Integer, ForeignKey("exam_rooms.id", ondelete="SET NULL"))
    scanned_at = Column(DateTime, default=datetime.utcnow, index=True)
