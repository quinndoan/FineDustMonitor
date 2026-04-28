from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import date, time

from database import get_db
from models import ExamRoom, User, ExamRoomStudent, Student, AttendanceStatus
from auth_service import get_current_user
from sheet_service import create_sheet_service

router = APIRouter(prefix="/api/exam-rooms", tags=["Exam Rooms"])

class ExamRoomCreate(BaseModel):
    room_name: str
    subject: str
    exam_date: date
    start_time: time
    end_time: time

class ExamRoomStudentAdd(BaseModel):
    mssv: str

class ExamRoomStudentResponse(BaseModel):
    id: int
    mssv: str
    full_name: str
    card_id: str | None
    attendance_status: str

    class Config:
        from_attributes = True

class ExamRoomUpdate(BaseModel):
    room_name: str | None = None
    subject: str | None = None
    exam_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None

class ExamRoomResponse(BaseModel):
    id: int
    room_name: str
    subject: str
    exam_date: date
    start_time: time
    end_time: time
    created_by: int | None

    class Config:
        from_attributes = True

@router.get("", response_model=List[ExamRoomResponse])
def get_exam_rooms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), date_filter: Optional[date] = None):
    """Lấy danh sách các lớp thi, có thể lọc theo ngày"""
    query = db.query(ExamRoom)
    if date_filter:
        query = query.filter(ExamRoom.exam_date == date_filter)
    return query.order_by(ExamRoom.exam_date.desc(), ExamRoom.start_time.desc()).all()

@router.post("", response_model=ExamRoomResponse, status_code=status.HTTP_201_CREATED)
def create_exam_room(payload: ExamRoomCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Tạo lớp thi mới"""
    if payload.start_time >= payload.end_time:
        raise HTTPException(status_code=400, detail="Thời gian bắt đầu phải trước thời gian kết thúc")

    new_room = ExamRoom(
        room_name=payload.room_name,
        subject=payload.subject,
        exam_date=payload.exam_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        created_by=current_user.id
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    return new_room

@router.put("/{room_id}", response_model=ExamRoomResponse)
def update_exam_room(room_id: int, payload: ExamRoomUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Cập nhật lớp thi"""
    room = db.query(ExamRoom).filter(ExamRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp thi")
    
    if payload.room_name is not None: room.room_name = payload.room_name
    if payload.subject is not None: room.subject = payload.subject
    if payload.exam_date is not None: room.exam_date = payload.exam_date
    if payload.start_time is not None: room.start_time = payload.start_time
    if payload.end_time is not None: room.end_time = payload.end_time

    if room.start_time >= room.end_time:
        raise HTTPException(status_code=400, detail="Thời gian bắt đầu phải trước thời gian kết thúc")

    db.commit()
    db.refresh(room)
    return room

@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exam_room(room_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Xóa lớp thi"""
    room = db.query(ExamRoom).filter(ExamRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp thi")
    
    db.delete(room)
    db.commit()
    return None

# ==========================================
# QUẢN LÝ SINH VIÊN TRONG LỚP THI
# ==========================================

@router.get("/{room_id}/students", response_model=List[ExamRoomStudentResponse])
def get_students_in_room(room_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Lấy danh sách sinh viên trong lớp thi"""
    room = db.query(ExamRoom).filter(ExamRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp thi")
    
    results = db.query(Student, ExamRoomStudent).join(ExamRoomStudent, Student.id == ExamRoomStudent.student_id)\
                .filter(ExamRoomStudent.exam_room_id == room_id).all()
    
    students_list = []
    for student, relation in results:
        students_list.append({
            "id": student.id,
            "mssv": student.mssv,
            "full_name": student.full_name,
            "card_id": student.card_id,
            "attendance_status": relation.attendance_status.value
        })
    return students_list

@router.post("/{room_id}/students", response_model=ExamRoomStudentResponse)
def add_student_to_room(room_id: int, payload: ExamRoomStudentAdd, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Thêm sinh viên vào lớp thi bằng MSSV"""
    room = db.query(ExamRoom).filter(ExamRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp thi")
        
    student = db.query(Student).filter(Student.mssv == payload.mssv).first()
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên với MSSV này trong hệ thống")
        
    existing_relation = db.query(ExamRoomStudent).filter(
        ExamRoomStudent.exam_room_id == room_id,
        ExamRoomStudent.student_id == student.id
    ).first()
    
    if existing_relation:
        raise HTTPException(status_code=400, detail="Sinh viên này đã có trong lớp thi")
        
    new_relation = ExamRoomStudent(
        exam_room_id=room_id,
        student_id=student.id,
        attendance_status=AttendanceStatus.PENDING
    )
    db.add(new_relation)
    db.commit()
    db.refresh(new_relation)
    
    return {
        "id": student.id,
        "mssv": student.mssv,
        "full_name": student.full_name,
        "card_id": student.card_id,
        "attendance_status": new_relation.attendance_status.value
    }

@router.delete("/{room_id}/students/{mssv}", status_code=status.HTTP_204_NO_CONTENT)
def remove_student_from_room(room_id: int, mssv: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Xóa sinh viên khỏi lớp thi"""
    student = db.query(Student).filter(Student.mssv == mssv).first()
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên")
        
    relation = db.query(ExamRoomStudent).filter(
        ExamRoomStudent.exam_room_id == room_id,
        ExamRoomStudent.student_id == student.id
    ).first()
    
    if not relation:
        raise HTTPException(status_code=404, detail="Sinh viên này không nằm trong lớp thi")
        
    db.delete(relation)
    db.commit()
    return None

class SyncSheetRequest(BaseModel):
    sheet_name: str

@router.post("/{room_id}/students/sync", status_code=status.HTTP_200_OK)
def sync_students_to_room(room_id: int, payload: SyncSheetRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Đọc danh sách MSSV từ một sheet và thêm vào lớp thi"""
    room = db.query(ExamRoom).filter(ExamRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp thi")
        
    sheet_service, mode = create_sheet_service()
    try:
        rows = sheet_service.read_rows(payload.sheet_name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi khi đọc Google Sheets (Sheet: {payload.sheet_name}): {str(e)}")

    if not rows or len(rows) <= 1:
        return {"message": "Sheet trống hoặc chỉ có header", "added": 0, "not_found": 0}

    added_count = 0
    not_found_count = 0

    for row in rows[1:]:
        if not row: continue
        mssv = row[0].strip()
        if not mssv: continue
        
        student = db.query(Student).filter(Student.mssv == mssv).first()
        if not student:
            not_found_count += 1
            continue
            
        existing = db.query(ExamRoomStudent).filter(
            ExamRoomStudent.exam_room_id == room_id,
            ExamRoomStudent.student_id == student.id
        ).first()
        
        if not existing:
            new_relation = ExamRoomStudent(
                exam_room_id=room_id,
                student_id=student.id,
                attendance_status=AttendanceStatus.PENDING
            )
            db.add(new_relation)
            added_count += 1
            
    if added_count > 0:
        db.commit()

    return {
        "message": f"Đã thêm {added_count} sinh viên vào lớp. Có {not_found_count} MSSV không tồn tại trong hệ thống.",
        "added": added_count,
        "not_found": not_found_count
    }

# ==========================================
# QUẢN LÝ THIẾT BỊ TRONG LỚP THI
# ==========================================

class DeviceResponse(BaseModel):
    id: int
    device_id: str
    name: str
    is_online: bool
    class Config:
        from_attributes = True

@router.get("/{room_id}/devices", response_model=List[DeviceResponse])
def get_devices_in_room(room_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Lấy danh sách thiết bị được gán vào lớp thi"""
    from models import Device
    return db.query(Device).filter(Device.assigned_room_id == room_id).all()

@router.post("/{room_id}/devices/{device_id}", status_code=status.HTTP_200_OK)
def assign_device_to_room(room_id: int, device_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Gán thiết bị vào lớp thi"""
    from models import Device
    from mqtt_service import subscribe_to_device
    room = db.query(ExamRoom).filter(ExamRoom.id == room_id).first()
    if not room: raise HTTPException(status_code=404, detail="Không tìm thấy lớp thi")
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device: raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị")
    
    device.assigned_room_id = room_id
    db.commit()
    subscribe_to_device(device.device_id)
    return {"message": "Đã gán thiết bị vào lớp thi"}

@router.delete("/{room_id}/devices/{device_id}", status_code=status.HTTP_200_OK)
def remove_device_from_room(room_id: int, device_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Gỡ thiết bị khỏi lớp thi"""
    from models import Device
    from mqtt_service import unsubscribe_from_device
    device = db.query(Device).filter(Device.id == device_id, Device.assigned_room_id == room_id).first()
    if not device: raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị trong lớp thi này")
    
    dev_id_str = device.device_id
    device.assigned_room_id = None
    db.commit()
    unsubscribe_from_device(dev_id_str)
    return {"message": "Đã gỡ thiết bị khỏi lớp thi"}

# ==========================================
# WEBSOCKET REALTIME
# ==========================================

from websocket_manager import manager

@router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: int):
    await manager.connect(websocket, room_id)
    try:
        while True:
            # We don't expect client to send messages, just keep connection open
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)

