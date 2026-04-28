from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from database import get_db
from models import Device, User
from auth_service import get_current_user

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
    return db.query(Device).all()

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
