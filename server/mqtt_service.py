import json
import logging
import threading
from datetime import datetime
import paho.mqtt.client as mqtt

from database import SessionLocal
from models import Device, Student, ExamRoomStudent, AttendanceStatus

logging.basicConfig(level=logging.INFO)

MQTT_BROKER = "mqtt.toolhub.app"
MQTT_PORT = 1883
MQTT_USER = "demo"
MQTT_PASS = "demo"

mqtt_client = None
main_loop = None

def subscribe_assigned_devices(client):
    db = SessionLocal()
    try:
        devices = db.query(Device).filter(Device.assigned_room_id.isnot(None)).all()
        for device in devices:
            client.subscribe(f"monitor_student/{device.device_id}/rfid")
            client.subscribe(f"monitor_student/{device.device_id}/nfc")
            client.subscribe(f"monitor_student/{device.device_id}/qr")
            logging.info(f"[MQTT] Subscribed to topics for assigned device: {device.device_id}")
    except Exception as e:
        logging.error(f"[MQTT] Error subscribing assigned devices: {e}")
    finally:
        db.close()

def subscribe_to_device(device_id: str):
    if mqtt_client:
        mqtt_client.subscribe(f"monitor_student/{device_id}/rfid")
        mqtt_client.subscribe(f"monitor_student/{device_id}/nfc")
        mqtt_client.subscribe(f"monitor_student/{device_id}/qr")
        logging.info(f"[MQTT] Dynamically subscribed to topics for device {device_id}")

def unsubscribe_from_device(device_id: str):
    if mqtt_client:
        mqtt_client.unsubscribe(f"monitor_student/{device_id}/rfid")
        mqtt_client.unsubscribe(f"monitor_student/{device_id}/nfc")
        mqtt_client.unsubscribe(f"monitor_student/{device_id}/qr")
        logging.info(f"[MQTT] Unsubscribed from topics for device {device_id}")

def on_connect(client, userdata, flags, rc):
    logging.info(f"[MQTT] Connected with result code {rc}")
    subscribe_assigned_devices(client)

def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        payload = msg.payload.decode('utf-8')
        logging.info(f"[MQTT] Received message on {topic}: {payload}")
        
        parts = topic.split('/')
        if len(parts) != 3 or parts[0] != 'monitor_student':
            return
            
        device_id = parts[1]
        scan_type = parts[2]
        
        data = json.loads(payload)
        process_scan(device_id, scan_type, data)
        
    except Exception as e:
        logging.error(f"[MQTT] Error processing message: {e}")

def process_scan(device_id: str, scan_type: str, data: dict):
    db = SessionLocal()
    try:
        logging.info(f"[MQTT] Processing scan - Device: {device_id}, Type: {scan_type}, Data: {data}")
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device or not device.assigned_room_id:
            logging.warning(f"[MQTT] Device {device_id} is not assigned to any room. Ignoring scan.")
            return

        room_id = device.assigned_room_id
        student = None
        
        if scan_type in ["rfid", "nfc"]:
            raw_uid = data.get("uid", "")
            uid_strip = raw_uid.strip()
            uid_nospace = raw_uid.replace(" ", "").upper()
            
            student = db.query(Student).filter(
                (Student.card_id == raw_uid) | 
                (Student.card_id == uid_strip) | 
                (Student.card_id == uid_nospace)
            ).first()
            
            # Nếu vẫn không tìm thấy, thử convert tất cả trong DB về nospace để so sánh
            if not student:
                students = db.query(Student).filter(Student.card_id.isnot(None)).all()
                for s in students:
                    if s.card_id.replace(" ", "").upper() == uid_nospace:
                        student = s
                        break

        elif scan_type == "qr":
            qr_data = data.get("qr_data", "")
            if "ctsv.hust.edu.vn/#/card/" in qr_data:
                try:
                    tail = qr_data.split("#/card/")[1]
                    mssv = tail.split('/')[0]
                    student = db.query(Student).filter(Student.mssv == mssv).first()
                except Exception as e:
                    logging.error(f"[MQTT] Error parsing QR data: {e}")
            else:
                student = db.query(Student).filter(Student.mssv == qr_data).first()

        if student:
            logging.info(f"[MQTT] Found student: {student.full_name} ({student.mssv})")
            relation = db.query(ExamRoomStudent).filter(
                ExamRoomStudent.exam_room_id == room_id,
                ExamRoomStudent.student_id == student.id
            ).first()
            if relation:
                relation.attendance_status = AttendanceStatus.PRESENT
                relation.check_in_device_id = device.id
                relation.checked_in_at = datetime.utcnow()
                db.commit()
                logging.info(f"[MQTT] Successfully marked student {student.mssv} PRESENT in room {room_id}")
                
                # Publish result back to ESP32
                if mqtt_client:
                    response = {
                        "action": "verify_result",
                        "status": "accepted",
                        "mssv": student.mssv,
                        "name": student.full_name
                    }
                    mqtt_client.publish(f"monitor_student/{device_id}/cmd", json.dumps(response))

                # Broadcast websocket
                if main_loop:
                    import asyncio
                    from websocket_manager import manager
                    asyncio.run_coroutine_threadsafe(
                        manager.broadcast_to_room(room_id, {
                            "event": "student_checked_in",
                            "mssv": student.mssv,
                            "status": "PRESENT"
                        }),
                        main_loop
                    )
            else:
                logging.warning(f"[MQTT] Student {student.mssv} is not enrolled in exam room {room_id}")
                if mqtt_client:
                    response = {"action": "verify_result", "status": "denied", "message": "Not in room"}
                    mqtt_client.publish(f"monitor_student/{device_id}/cmd", json.dumps(response))
        else:
            logging.warning(f"[MQTT] Student not found in DB for scan data: {data}")
            if mqtt_client:
                response = {"action": "verify_result", "status": "denied", "message": "Not found"}
                mqtt_client.publish(f"monitor_student/{device_id}/cmd", json.dumps(response))
            
    finally:
        db.close()

def start_mqtt(loop):
    global mqtt_client, main_loop
    main_loop = loop
    import uuid
    client_id = f"backend_server_{uuid.uuid4().hex[:8]}"
    mqtt_client = mqtt.Client(client_id=client_id)
    mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message
    
    try:
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        # Run in background thread
        thread = threading.Thread(target=mqtt_client.loop_forever, daemon=True)
        thread.start()
        logging.info("[MQTT] Client thread started successfully.")
    except Exception as e:
        logging.error(f"[MQTT] Failed to start client: {e}")

def stop_mqtt():
    global mqtt_client
    if mqtt_client:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
        logging.info("[MQTT] Client disconnected.")
