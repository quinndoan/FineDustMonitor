from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from database import get_db
from models import Device, User
from auth_service import get_current_user
from sheet_service import create_sheet_service

router = APIRouter(prefix="/api/devices", tags=["Devices"])

class DeviceResponse(BaseModel):
    id: int
    device_id: str
    name: str
    assigned_room_id: int | None
    is_online: bool

    class Config:
        from_attributes = True

class DeviceCreate(BaseModel):
    device_id: str
    name: str

@router.get("", response_model=List[DeviceResponse])
def get_devices(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Lấy danh sách tất cả thiết bị"""
    return db.query(Device).order_by(Device.device_id).all()

@router.post("", response_model=DeviceResponse)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Tạo hoặc cập nhật thiết bị"""
    device = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if device:
        device.name = payload.name
    else:
        device = Device(device_id=payload.device_id, name=payload.name)
        db.add(device)
    db.commit()
    db.refresh(device)
    return device

class DeviceUpdate(BaseModel):
    name: str

@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(device_id: int, payload: DeviceUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Cập nhật thiết bị"""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị")
    device.name = payload.name
    db.commit()
    db.refresh(device)
    return device

@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(device_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Xóa thiết bị"""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị")
    db.delete(device)
    db.commit()
    return None

@router.post("/sync-from-sheets", status_code=status.HTTP_200_OK)
def sync_devices_from_sheets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Đồng bộ danh sách thiết bị từ Google Sheets (tab 'Device') vào Database.
    Mỗi sheet cần có header: Device ID | Tên Thiết bị (Vị trí)
    """
    sheet_service, mode = create_sheet_service()
    
    all_tabs = sheet_service.list_sheet_names()
    
    target_tab = None
    for tab in all_tabs:
        if tab.strip().lower() in ["device", "devices"]:
            target_tab = tab
            break
            
    if not target_tab:
        raise HTTPException(
            status_code=400, 
            detail=f"Không tìm thấy tab nào tên là 'Device'. Các tab hiện có: {', '.join(all_tabs)}"
        )

    try:
        rows = sheet_service.read_rows(target_tab)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc sheet: {e}")

    if not rows or len(rows) <= 1:
        return {"message": "Sheet trống hoặc chỉ có dòng tiêu đề", "added": 0, "updated": 0}

    added_count = 0
    updated_count = 0

    for row in rows[1:]:
        if not row or len(row) < 1:
            continue

        device_id = row[0].strip()
        if not device_id:
            continue
            
        name = row[1].strip() if len(row) > 1 and row[1].strip() else "Unknown Device"

        existing = db.query(Device).filter(Device.device_id == device_id).first()
        if existing:
            if existing.name != name:
                existing.name = name
                updated_count += 1
        else:
            new_device = Device(device_id=device_id, name=name)
            db.add(new_device)
            added_count += 1

    if added_count > 0 or updated_count > 0:
        db.commit()

    parts = []
    if added_count > 0:
        parts.append(f"Thêm mới {added_count}")
    if updated_count > 0:
        parts.append(f"Cập nhật {updated_count}")
    if added_count == 0 and updated_count == 0:
        parts.append("Không có thay đổi")

    msg = "Đồng bộ thiết bị thành công. " + ", ".join(parts) + "."

    return {
        "message": msg,
        "added": added_count,
        "updated": updated_count
    }
