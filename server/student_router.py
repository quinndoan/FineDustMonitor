from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from database import get_db
from models import Student, User, StudentStatus
from auth_service import get_current_user
from sheet_service import create_sheet_service

router = APIRouter(prefix="/api/students", tags=["Students"])

class StudentCreate(BaseModel):
    mssv: str
    card_id: str | None = None
    full_name: str
    email: str | None = None
    faculty: str | None = None
    class_name: str | None = None

class StudentUpdate(BaseModel):
    card_id: str | None = None
    full_name: str | None = None
    email: str | None = None
    faculty: str | None = None
    class_name: str | None = None
    status: str | None = None

class StudentResponse(BaseModel):
    id: int
    mssv: str
    card_id: str | None
    full_name: str
    email: str | None
    faculty: str | None
    class_name: str | None
    status: str

    class Config:
        from_attributes = True

@router.get("", response_model=List[StudentResponse])
def get_students(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Lấy danh sách tất cả sinh viên"""
    return db.query(Student).all()

@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def create_student(payload: StudentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.query(Student).filter(Student.mssv == payload.mssv).first():
        raise HTTPException(status_code=400, detail="Mã số sinh viên đã tồn tại")
    
    if payload.card_id and db.query(Student).filter(Student.card_id == payload.card_id).first():
        raise HTTPException(status_code=400, detail="Mã thẻ đã được sử dụng")

    new_student = Student(
        mssv=payload.mssv,
        card_id=payload.card_id,
        full_name=payload.full_name,
        email=payload.email,
        faculty=payload.faculty,
        class_name=payload.class_name,
    )
    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    return new_student

@router.put("/{mssv}", response_model=StudentResponse)
def update_student(mssv: str, payload: StudentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    student = db.query(Student).filter(Student.mssv == mssv).first()
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên")
    
    if payload.card_id and payload.card_id != student.card_id:
        if db.query(Student).filter(Student.card_id == payload.card_id).first():
            raise HTTPException(status_code=400, detail="Mã thẻ đã được sử dụng")
        student.card_id = payload.card_id
        
    if payload.full_name is not None:
        student.full_name = payload.full_name
    if payload.email is not None:
        student.email = payload.email
    if payload.faculty is not None:
        student.faculty = payload.faculty
    if payload.class_name is not None:
        student.class_name = payload.class_name
    if payload.status is not None:
        student.status = payload.status

    db.commit()
    db.refresh(student)
    return student

@router.delete("/{mssv}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(mssv: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    student = db.query(Student).filter(Student.mssv == mssv).first()
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên")
    db.delete(student)
    db.commit()
    return None

@router.get("/debug-sheet", status_code=status.HTTP_200_OK)
def debug_sheet_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """[DEBUG] Xem raw data từ Google Sheet và so sánh với DB"""
    sheet_service, mode = create_sheet_service()
    try:
        rows = sheet_service.read_rows("Students")
    except Exception as e:
        return {"error": str(e), "mode": mode}

    # Lấy 5 SV đầu từ DB để so sánh
    db_students = db.query(Student).limit(5).all()
    db_data = [
        {"mssv": s.mssv, "card_id": s.card_id, "full_name": s.full_name, 
         "email": s.email, "faculty": s.faculty, "class_name": s.class_name}
        for s in db_students
    ]

    return {
        "mode": mode,
        "sheet_header": rows[0] if rows else [],
        "sheet_first_5_rows": rows[1:6] if len(rows) > 1 else [],
        "sheet_total_rows": len(rows) - 1 if rows else 0,
        "sheet_columns_count": len(rows[0]) if rows else 0,
        "db_first_5": db_data,
        "expected_mapping": {
            "row[0]": "MSSV",
            "row[1]": "Card ID",
            "row[2]": "Họ và Tên",
            "row[3]": "Email",
            "row[4]": "Khoa (faculty)",
            "row[5]": "Lớp (class_name)",
        }
    }

@router.post("/sync-from-sheets", status_code=status.HTTP_200_OK)
def sync_students_from_sheets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Đồng bộ danh sách sinh viên từ Google Sheets vào Database"""
    sheet_service, mode = create_sheet_service()
    try:
        rows = sheet_service.read_rows("Students")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi khi đọc Google Sheets: {str(e)}")

    if not rows or len(rows) <= 1:
        return {"message": "Sheet trống hoặc chỉ có header, không có dữ liệu để đồng bộ", "added": 0}


    # Bỏ qua dòng header (dòng 0)
    added_count = 0
    updated_count = 0
    duplicate_card_count = 0
    seen_card_ids = set()

    for row in rows[1:]:
        if not row or len(row) < 3:
            continue # Bỏ qua dòng thiếu dữ liệu
            
        mssv = row[0].strip()
        card_id = row[1].strip() if len(row) > 1 and row[1].strip() else None
        full_name = row[2].strip() if len(row) > 2 and row[2].strip() else "Unknown"
        email = row[3].strip() if len(row) > 3 and row[3].strip() else None
        faculty = row[4].strip() if len(row) > 4 and row[4].strip() else None
        class_name = row[5].strip() if len(row) > 5 and row[5].strip() else None

        # Kiểm tra card_id trùng lặp để tránh lỗi UNIQUE constraint của PostgreSQL
        if card_id:
            if card_id in seen_card_ids:
                duplicate_card_count += 1
                card_id = None
            else:
                seen_card_ids.add(card_id)

        # Kiểm tra xem mssv đã tồn tại chưa
        existing = db.query(Student).filter(Student.mssv == mssv).first()
        if existing:
            # Cập nhật thông tin cho sinh viên đã tồn tại
            changed = False
            if full_name and full_name != "Unknown" and existing.full_name != full_name:
                existing.full_name = full_name
                changed = True
            if email is not None and existing.email != email:
                existing.email = email
                changed = True
            if faculty is not None and existing.faculty != faculty:
                existing.faculty = faculty
                changed = True
            if class_name is not None and existing.class_name != class_name:
                existing.class_name = class_name
                changed = True
            # Cập nhật card_id nếu SV chưa có card_id hoặc card_id từ Sheet khác
            if card_id and existing.card_id != card_id:
                # Kiểm tra card_id mới có bị trùng với SV khác không
                conflict = db.query(Student).filter(Student.card_id == card_id, Student.id != existing.id).first()
                if not conflict:
                    existing.card_id = card_id
                    changed = True
                else:
                    duplicate_card_count += 1
            if changed:
                updated_count += 1
            continue
            
        # Sinh viên mới — kiểm tra card_id trùng trong DB
        if card_id:
            if db.query(Student).filter(Student.card_id == card_id).first():
                duplicate_card_count += 1
                card_id = None

        new_student = Student(mssv=mssv, card_id=card_id, full_name=full_name, email=email, faculty=faculty, class_name=class_name)
        db.add(new_student)
        added_count += 1
            
    if added_count > 0 or updated_count > 0:
        db.commit()

    parts = []
    if added_count > 0:
        parts.append(f"Thêm mới {added_count} sinh viên")
    if updated_count > 0:
        parts.append(f"Cập nhật {updated_count} sinh viên")
    if added_count == 0 and updated_count == 0:
        parts.append("Không có thay đổi nào")
    msg = "Đồng bộ thành công. " + ", ".join(parts) + "."
    if duplicate_card_count > 0:
        msg += f" (Phát hiện {duplicate_card_count} mã thẻ trùng lặp, đã bỏ qua)."

    return {"message": msg, "added": added_count, "updated": updated_count}
