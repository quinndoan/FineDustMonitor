"""
Dashboard statistics API router.
Provides aggregated data for the dashboard from real database records.
"""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Student, Device, ExamRoom, ExamRoomStudent,
    AttendanceStatus, ScanLog, User,
)
from auth_service import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return aggregated dashboard statistics:
    - Total students, devices, exam rooms
    - Today's scan counts (accepted vs denied)
    - Students grouped by faculty
    - Scan activity over the last 7 days
    - Recent scan events
    """
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())

    # --- Core counts ---
    total_students = db.query(func.count(Student.id)).scalar() or 0
    total_devices = db.query(func.count(Device.id)).scalar() or 0
    total_exam_rooms = db.query(func.count(ExamRoom.id)).scalar() or 0

    # --- Today's scans ---
    today_scans_total = db.query(func.count(ScanLog.id)).filter(
        ScanLog.scanned_at >= today_start,
        ScanLog.scanned_at <= today_end,
    ).scalar() or 0

    today_scans_accepted = db.query(func.count(ScanLog.id)).filter(
        ScanLog.scanned_at >= today_start,
        ScanLog.scanned_at <= today_end,
        ScanLog.result == "accepted",
    ).scalar() or 0

    today_scans_denied = db.query(func.count(ScanLog.id)).filter(
        ScanLog.scanned_at >= today_start,
        ScanLog.scanned_at <= today_end,
        ScanLog.result == "denied",
    ).scalar() or 0

    # --- Pie chart: today's scan results ---
    today_scan_pie = [
        {"name": "Chấp nhận", "value": today_scans_accepted, "color": "#10b981"},
        {"name": "Từ chối", "value": today_scans_denied, "color": "#ef4444"},
    ]

    # --- Students by faculty ---
    faculty_rows = (
        db.query(Student.faculty, func.count(Student.id))
        .filter(Student.faculty.isnot(None), Student.faculty != "")
        .group_by(Student.faculty)
        .order_by(func.count(Student.id).desc())
        .all()
    )
    students_by_faculty = [
        {"name": _shorten_faculty(f), "full_name": f, "students": c}
        for f, c in faculty_rows
    ]

    # --- Scan activity: last 7 days ---
    weekly_activity = []
    day_labels_vi = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        d_start = datetime.combine(d, datetime.min.time())
        d_end = datetime.combine(d, datetime.max.time())
        count = db.query(func.count(ScanLog.id)).filter(
            ScanLog.scanned_at >= d_start,
            ScanLog.scanned_at <= d_end,
        ).scalar() or 0
        # isoweekday: Mon=1 ... Sun=7
        label = day_labels_vi[d.isoweekday() % 7]
        weekly_activity.append({
            "name": f"{label} ({d.strftime('%d/%m')})",
            "total": count,
        })

    # --- Today's scan breakdown by type (rfid / nfc / qr) ---
    scan_type_rows = (
        db.query(ScanLog.scan_type, func.count(ScanLog.id))
        .filter(
            ScanLog.scanned_at >= today_start,
            ScanLog.scanned_at <= today_end,
        )
        .group_by(ScanLog.scan_type)
        .all()
    )
    scan_by_type = {t: c for t, c in scan_type_rows}

    # --- Recent scans (last 10) ---
    recent_scans = (
        db.query(ScanLog)
        .order_by(ScanLog.scanned_at.desc())
        .limit(10)
        .all()
    )
    recent_list = [
        {
            "id": s.id,
            "device_id": s.device_id,
            "scan_type": s.scan_type,
            "result": s.result,
            "student_mssv": s.student_mssv,
            "student_name": s.student_name,
            "scanned_at": s.scanned_at.isoformat() if s.scanned_at else None,
        }
        for s in recent_scans
    ]

    return {
        "total_students": total_students,
        "total_devices": total_devices,
        "total_exam_rooms": total_exam_rooms,
        "today_scans_total": today_scans_total,
        "today_scans_accepted": today_scans_accepted,
        "today_scans_denied": today_scans_denied,
        "today_scan_pie": today_scan_pie,
        "students_by_faculty": students_by_faculty,
        "weekly_activity": weekly_activity,
        "scan_by_type": scan_by_type,
        "recent_scans": recent_list,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _shorten_faculty(name: str) -> str:
    """Shorten long faculty names for chart labels."""
    replacements = {
        "Trường Công nghệ Thông tin và Truyền thông": "CNTT & TT",
        "Trường Điện - Điện tử": "Điện - ĐT",
        "Trường Cơ khí": "Cơ khí",
        "Trường Vật liệu": "Vật liệu",
        "Trường Hóa và Khoa học sự sống": "Hóa & KHSS",
        "Trường Kinh tế": "Kinh tế",
        "Khoa Khoa học và Công nghệ Giáo dục": "KH & CN GD",
        "Khoa Vật lý kỹ thuật": "VL Kỹ thuật",
        "Khoa Toán - Tin": "Toán - Tin",
        "Khoa Ngoại ngữ": "Ngoại ngữ",
        "Khoa Giáo dục Quốc phòng và An ninh": "GD QP & AN",
        "Khoa Giáo dục thể chất": "GD Thể chất",
        "Khoa Lý luận chính trị": "LL Chính trị",
    }
    return replacements.get(name, name[:15])
