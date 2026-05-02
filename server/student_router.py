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

    # Đồng bộ ngược lên Google Sheets (tìm MSSV trong tất cả tab SV_*)
    try:
        sheet_service, mode = create_sheet_service()
        if mode == "google_sheets":
            row_data = [
                student.mssv,
                student.card_id or "",
                student.full_name,
                student.email or "",
                student.faculty or "",
                student.class_name or "",
            ]
            sv_tabs = [t for t in sheet_service.list_sheet_names() if t.startswith("SV_")]
            for tab in sv_tabs:
                if sheet_service.update_row_by_key(tab, mssv, row_data):
                    break  # Đã tìm thấy và cập nhật, không cần tìm tiếp
    except Exception as e:
        print(f"⚠️ Không thể đồng bộ ngược lên Sheets: {e}")

    return student

@router.delete("/{mssv}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(mssv: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    student = db.query(Student).filter(Student.mssv == mssv).first()
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên")
    db.delete(student)
    db.commit()
    return None

@router.get("/sheet-tabs", status_code=status.HTTP_200_OK)
def get_sheet_tabs(current_user: User = Depends(get_current_user)):
    """Lấy danh sách các tab sheet có prefix SV_ từ Google Spreadsheet"""
    sheet_service, mode = create_sheet_service()
    all_tabs = sheet_service.list_sheet_names()
    sv_tabs = [t for t in all_tabs if t.startswith("SV_")]
    return {
        "mode": mode,
        "all_tabs": all_tabs,
        "sv_tabs": sv_tabs,
    }

@router.post("/sync-from-sheets", status_code=status.HTTP_200_OK)
def sync_students_from_sheets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Đồng bộ danh sách sinh viên từ Google Sheets vào Database.
    Tự động quét tất cả tab có prefix 'SV_' (vd: SV_KHMT, SV_KTMT).
    Tên lớp được lấy từ tên sheet (phần sau 'SV_').
    Mỗi sheet cần có header: MSSV | Card ID | Họ và tên | Email | Khoa
    (class_name tự động lấy từ tên sheet)
    """
    sheet_service, mode = create_sheet_service()
    
    # Tìm tất cả sheet tabs có prefix "SV_"
    all_tabs = sheet_service.list_sheet_names()
    sv_tabs = [t for t in all_tabs if t.startswith("SV_")]
    
    if not sv_tabs:
        raise HTTPException(
            status_code=400, 
            detail=f"Không tìm thấy tab nào có prefix 'SV_'. Các tab hiện có: {', '.join(all_tabs)}"
        )

    total_added = 0
    total_updated = 0
    total_duplicate_card = 0
    seen_card_ids = set()
    sheet_results = []

    for tab_name in sv_tabs:
        # Trích class_name từ tên sheet: "SV_KHMT" → "KHMT"
        class_name_from_sheet = tab_name[3:]  # Bỏ prefix "SV_"

        try:
            rows = sheet_service.read_rows(tab_name)
        except Exception as e:
            sheet_results.append({"sheet": tab_name, "error": str(e)})
            continue

        if not rows or len(rows) <= 1:
            sheet_results.append({"sheet": tab_name, "added": 0, "updated": 0, "note": "Trống hoặc chỉ có header"})
            continue

        added_count = 0
        updated_count = 0
        duplicate_card_count = 0

        for row in rows[1:]:
            if not row or len(row) < 3:
                continue

            mssv = row[0].strip()
            card_id = row[1].strip() if len(row) > 1 and row[1].strip() else None
            full_name = row[2].strip() if len(row) > 2 and row[2].strip() else "Unknown"
            email = row[3].strip() if len(row) > 3 and row[3].strip() else None
            # Khoa lấy từ cột 5 (index 4)
            # class_name: ưu tiên cột 6 (index 5) trên Sheet, nếu trống thì lấy từ tên tab
            faculty = row[4].strip() if len(row) > 4 and row[4].strip() else None
            class_name = row[5].strip() if len(row) > 5 and row[5].strip() else class_name_from_sheet

            # Kiểm tra card_id trùng lặp
            if card_id:
                if card_id in seen_card_ids:
                    duplicate_card_count += 1
                    card_id = None
                else:
                    seen_card_ids.add(card_id)

            # Upsert: update nếu đã tồn tại, insert nếu mới
            existing = db.query(Student).filter(Student.mssv == mssv).first()
            if existing:
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
                if class_name and existing.class_name != class_name:
                    existing.class_name = class_name
                    changed = True
                if card_id and existing.card_id != card_id:
                    conflict = db.query(Student).filter(Student.card_id == card_id, Student.id != existing.id).first()
                    if not conflict:
                        existing.card_id = card_id
                        changed = True
                    else:
                        duplicate_card_count += 1
                if changed:
                    updated_count += 1
                continue

            # Sinh viên mới
            if card_id:
                if db.query(Student).filter(Student.card_id == card_id).first():
                    duplicate_card_count += 1
                    card_id = None

            new_student = Student(
                mssv=mssv, card_id=card_id, full_name=full_name,
                email=email, faculty=faculty, class_name=class_name,
            )
            db.add(new_student)
            added_count += 1

        total_added += added_count
        total_updated += updated_count
        total_duplicate_card += duplicate_card_count
        sheet_results.append({
            "sheet": tab_name,
            "class_name": class_name_from_sheet,
            "added": added_count,
            "updated": updated_count,
        })

    if total_added > 0 or total_updated > 0:
        db.commit()

    # Tạo message tổng kết
    parts = []
    if total_added > 0:
        parts.append(f"Thêm mới {total_added}")
    if total_updated > 0:
        parts.append(f"Cập nhật {total_updated}")
    if total_added == 0 and total_updated == 0:
        parts.append("Không có thay đổi")
    
    msg = f"Đồng bộ {len(sv_tabs)} sheet thành công. " + ", ".join(parts) + " sinh viên."
    if total_duplicate_card > 0:
        msg += f" ({total_duplicate_card} mã thẻ trùng lặp, đã bỏ qua)."

    return {
        "message": msg,
        "added": total_added,
        "updated": total_updated,
        "sheets_processed": sheet_results,
    }

