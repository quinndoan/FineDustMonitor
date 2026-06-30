# Monitor Student System

Hệ thống giám sát điểm danh sinh viên phòng thi sử dụng thiết bị IoT (ESP32) kết hợp RFID/NFC/QR, backend FastAPI và giao diện web React.

> **Đồ án tốt nghiệp** — Đoàn Thị Thu Quyên — ĐHBK Hà Nội

---

## Tổng quan kiến trúc

```
┌────────────────┐     MQTT (rfid/nfc/qr)     ┌──────────────────┐     REST + WS      ┌─────────────────┐
│   ESP32 Device │ ◄──────────────────────────► │  FastAPI Backend │ ◄────────────────► │  React Web UI   │
│(RFID/NFC/QR)   │   broker: mqtt.toolhub.app  │  (Python 3.10+)  │   HTTP + WebSocket │  (Vite + React) │
└────────────────┘                              └────────┬─────────┘                    └─────────────────┘
                                                         │
                                          ┌──────────────┼──────────────┐
                                          │              │              │
                                     PostgreSQL    Google Sheets    EmailJS
                                      Database       (Sync)       (OTP Email)
```

### Luồng hoạt động chính

1. **Giáo viên** tạo phòng thi, gán danh sách sinh viên và thiết bị ESP32 trên Web UI
2. **Bật điểm danh** → Backend đánh dấu phòng đang hoạt động và bắt đầu chấp nhận dữ liệu quét từ thiết bị đã gán
3. **Sinh viên** quẹt thẻ RFID/NFC hoặc QR → ESP32 gửi dữ liệu quét lên MQTT broker
4. **Backend** nhận dữ liệu, tra cứu sinh viên, ghi nhận điểm danh, broadcast qua WebSocket
5. **Web UI** cập nhật trạng thái điểm danh real-time không cần reload trang

---

## Cấu trúc thư mục

```
FineDustMonitor/
├── src/                    # Firmware ESP32 (PlatformIO + Arduino)
│   ├── main.cpp            # Logic chính: quét thẻ/QR, hiển thị và cấu hình
│   ├── HardwareConfig.h    # Cấu hình chân GPIO & feature flags
│   ├── MqttManager.*       # Giao tiếp MQTT (publish rfid/nfc/qr, subscribe cmd)
│   ├── NfcManager.*        # Đọc thẻ NFC MFRC522 (13.56 MHz, SPI)
│   ├── Rfid125khzManager.* # Đọc thẻ RFID 125 kHz (UART)
│   ├── WiFiManager.*       # Kết nối WiFi (đọc SSID/pass từ LittleFS)
│   ├── WiFiSelfEnroll.*    # Captive portal cấu hình WiFi qua AP
│   ├── WiFiEnrollBySerial.*# Cấu hình WiFi qua Serial Monitor
│   ├── OledBackdrop.*      # Hiển thị OLED SH1106 128x64 (U8g2)
│   ├── BuzzerManager.*     # Phản hồi âm thanh (buzzer)
│   ├── ButtonGestures.*    # Xử lý nút nhấn (short/long/double press)
│   ├── QrManager.*         # Xử lý QR code
│   ├── ApiManager.*        # HTTP client fallback (POST check-in)
│   └── configmanager.*     # Đọc/ghi config LittleFS
├── data/                   # Tệp LittleFS (upload lên ESP32)
│   ├── enroll.html         # Trang cấu hình WiFi (captive portal)
│   ├── index.html          # Trang thông tin thiết bị
│   ├── ssid.txt            # SSID WiFi đã lưu
│   ├── password.txt        # Mật khẩu WiFi đã lưu
│   ├── deviceid.txt        # ID thiết bị
│   ├── wifienabled.txt     # Cờ bật/tắt WiFi
│   └── mqtt_enabled.txt    # Cờ bật/tắt MQTT
├── server/                 # Backend FastAPI
│   ├── main.py             # Entry point, lifespan, CORS, mount routers
│   ├── database.py         # SQLAlchemy engine (PostgreSQL)
│   ├── models.py           # ORM models (User, Student, ExamRoom, Device, ...)
│   ├── auth_router.py      # API xác thực (login, register, reset password)
│   ├── auth_service.py     # JWT + bcrypt logic
│   ├── student_router.py   # CRUD sinh viên + sync Google Sheets
│   ├── exam_room_router.py # CRUD phòng thi + điểm danh + WebSocket
│   ├── device_router.py    # CRUD thiết bị ESP32
│   ├── dashboard_router.py # Thống kê tổng hợp + WebSocket real-time
│   ├── mqtt_service.py     # MQTT client (subscribe scan, publish cmd)
│   ├── sheet_service.py    # Google Sheets API (đồng bộ 2 chiều)
│   ├── websocket_manager.py# WebSocket connection manager
│   ├── email_service.py    # Email service (stub, dùng EmailJS phía frontend)
│   ├── password_reset_service.py # OTP in-memory store
│   ├── schemas.py          # Pydantic schemas
│   └── requirements.txt    # Python dependencies
├── web_ui/                 # Frontend React + Vite
│   ├── src/
│   │   ├── main.jsx        # Entry point (StrictMode + BrowserRouter)
│   │   ├── App.jsx         # Routes + ProtectedRoute guard
│   │   ├── config.js       # API_BASE_URL + WS_BASE_URL
│   │   ├── index.css       # Design system (CSS variables, animations)
│   │   ├── contexts/       # AuthProvider + useAuth hook
│   │   ├── components/     # AppLayout, StudentFormModal, ExamRoomFormModal, Toast
│   │   └── pages/          # Dashboard, Students, ExamRooms, Devices, Profile, Schedule
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json         # Vercel SPA fallback config
├── platformio.ini          # PlatformIO build config (ESP32)
└── README.md
```

---

## 1) Phần cứng — ESP32 Firmware

### Yêu cầu phần mềm

- Visual Studio Code với extension PlatformIO IDE, hoặc PlatformIO Core CLI
- Cáp USB có truyền dữ liệu và driver USB-UART phù hợp với board ESP32

### Phần cứng sử dụng

| Thành phần | Module | Giao tiếp |
|---|---|---|
| MCU | ESP32 DevKit | — |
| Màn hình | OLED SH1106 128×64 | I2C (SDA=21, SCL=22) |
| Đầu đọc NFC | MFRC522 (13.56 MHz) | SPI (SS=5, RST=32) |
| Đầu đọc RFID | 125 kHz reader (RDM6300) | UART (RX=16, TX=17) |
| Máy quét QR | MH-ET LIVE QR Scanner | UART1 (RX=27, TX=33) |
| Còi | Buzzer | GPIO 12 |
| Nút cấu hình | Push button | GPIO 4 |

### Feature flags (build_flags trong `platformio.ini`)

```ini
-DENABLE_OLED_DISPLAY=1
-DENABLE_NFC_MFRC522=1
-DENABLE_RFID_125KHZ=1
-DENABLE_QR_SCANNER=1
-DENABLE_WIFI=1
-DENABLE_MQTT=1
-DENABLE_BUZZER=1
-DENABLE_CONFIG_BUTTON=1
-DOLED_DISPLAY_TYPE_SH1106=1
```

### MQTT Topics (Firmware ↔ Server)

| Hướng | Topic | Nội dung |
|---|---|---|
| ESP32 → Server | `monitor_student/{deviceId}/rfid` | `{"uid": "A1 B2 C3 D4"}` |
| ESP32 → Server | `monitor_student/{deviceId}/nfc` | `{"uid": "A1 B2 C3 D4"}` |
| ESP32 → Server | `monitor_student/{deviceId}/qr` | `{"qr_data": "20215xxx"}` |
| Server → ESP32 | `monitor_student/{deviceId}/cmd` | `{"action": "verify_result", "status": "accepted/denied", ...}` |

Payload quét thực tế còn chứa trường `device_id`. Khi khởi động, ESP32 cũng gửi gói định danh lên topic `startup`.

### Build & Upload (PlatformIO)

```powershell
# Build firmware
pio run

# Upload firmware lên ESP32
pio run --target upload

# Upload filesystem (LittleFS) lên ESP32
pio run --target uploadfs

# Monitor Serial
pio device monitor --baud 115200
```

### Cấu hình WiFi cho ESP32

- **Captive Portal**: Nhấn giữ nút cấu hình 2 giây → ESP32 tạo AP `Esp32_AP` (mật khẩu mặc định `12345678`) → kết nối và nhập WiFi qua trình duyệt
- **Serial Monitor**: Trong chế độ cấu hình Serial, dùng `ssid=<tên_wifi>`, `pass=<mật_khẩu>`, `id=<mã_thiết_bị>`, sau đó nhập `exit`

---

## 2) Backend — FastAPI Server

Thư mục: `server/`

### Yêu cầu

- Python 3.10+ (khuyến nghị 3.11)
- PostgreSQL 14+ và database `MonitorStudentSystem`

Tạo database bằng pgAdmin hoặc lệnh:

```powershell
createdb -U postgres MonitorStudentSystem
```

### Cài đặt & chạy

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Tạo cấu hình local rồi sửa DATABASE_URL và JWT_SECRET_KEY
Copy-Item .env.example .env
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend sẽ chạy tại:
- API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

### Biến môi trường (`server/.env`)

Không đưa `.env` hoặc `credentials.json` thật lên Git/ZIP. Dùng `server/.env.example` làm mẫu.

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/MonitorStudentSystem

# JWT Authentication
JWT_SECRET_KEY=your_secret_key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=480

# Google Sheets (tùy chọn)
GOOGLE_SERVICE_ACCOUNT_FILE=credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_DEFAULT_RANGE=A:Z
```

### API Endpoints

#### Xác thực (`/api/auth`)

| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/auth/register` | Đăng ký tài khoản giáo viên |
| POST | `/api/auth/login` | Đăng nhập, trả về JWT token |
| GET | `/api/auth/me` | Lấy thông tin user hiện tại |
| PUT | `/api/auth/me` | Cập nhật profile |
| DELETE | `/api/auth/me` | Xóa tài khoản |
| POST | `/api/auth/request-reset` | Yêu cầu OTP reset mật khẩu |
| POST | `/api/auth/reset-password` | Xác nhận OTP + đặt mật khẩu mới |

#### Sinh viên (`/api/students`)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/students` | Danh sách sinh viên (sắp xếp theo MSSV) |
| POST | `/api/students` | Thêm sinh viên (mssv, card_id, full_name, email, faculty, class_name, course_year) |
| PUT | `/api/students/{mssv}` | Cập nhật sinh viên (đồng bộ ngược Google Sheets) |
| DELETE | `/api/students/{mssv}` | Xóa sinh viên |
| GET | `/api/students/sheet-tabs` | Liệt kê tab Google Sheets có prefix `SV_` |
| POST | `/api/students/sync-from-sheets` | Import sinh viên từ Google Sheets |

#### Phòng thi (`/api/exam-rooms`)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/exam-rooms` | Danh sách phòng thi (lọc theo ngày tùy chọn) |
| POST | `/api/exam-rooms` | Tạo phòng thi |
| PUT | `/api/exam-rooms/{id}` | Cập nhật phòng thi |
| DELETE | `/api/exam-rooms/{id}` | Xóa phòng thi |
| PATCH | `/api/exam-rooms/{id}/toggle-active` | Bật/tắt điểm danh |
| GET | `/api/exam-rooms/{id}/students` | Danh sách SV trong phòng + trạng thái điểm danh |
| POST | `/api/exam-rooms/{id}/students` | Thêm SV vào phòng theo MSSV |
| DELETE | `/api/exam-rooms/{id}/students/{mssv}` | Xóa SV khỏi phòng |
| POST | `/api/exam-rooms/{id}/students/sync` | Sync SV từ sheet tab cụ thể |
| POST | `/api/exam-rooms/sync-from-sheets` | Import phòng thi từ tab `LichThi_*` |
| GET | `/api/exam-rooms/{id}/devices` | Danh sách thiết bị gán cho phòng |
| POST | `/api/exam-rooms/{id}/devices/{device_id}` | Gán thiết bị vào phòng |
| DELETE | `/api/exam-rooms/{id}/devices/{device_id}` | Gỡ thiết bị khỏi phòng |
| WS | `/api/exam-rooms/ws/{room_id}` | WebSocket cập nhật điểm danh real-time |

#### Thiết bị (`/api/devices`)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/devices` | Danh sách thiết bị |
| POST | `/api/devices` | Tạo/cập nhật thiết bị (upsert) |
| PUT | `/api/devices/{device_id}` | Cập nhật tên thiết bị |
| DELETE | `/api/devices/{device_id}` | Xóa thiết bị |
| POST | `/api/devices/sync-from-sheets` | Import thiết bị từ Google Sheets |

#### Dashboard (`/api/dashboard`)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/dashboard/stats` | Thống kê tổng hợp (SV, thiết bị, phòng, lượt quét, biểu đồ) |
| WS | `/api/dashboard/ws` | WebSocket thông báo quét thẻ real-time |

### Database Models

```
User 1──► N ExamRoom 1──► N ExamRoomStudent N ◄──1 Student
                     1──► N Device
ExamRoom 1──► N ScanLog
```

| Table | Mô tả |
|---|---|
| `users` | Tài khoản giáo viên (email, password_hash, full_name, department) |
| `students` | Sinh viên (mssv, card_id, full_name, email, faculty, class_name, course_year, status) |
| `exam_rooms` | Phòng thi (room_name, subject, exam_date, start/end_time, is_active) |
| `devices` | Thiết bị ESP32 (device_id, name, assigned_room_id, is_online) |
| `exam_room_students` | Bảng liên kết SV-Phòng (attendance_status: PENDING/PRESENT/LATE/ABSENT) |
| `scan_logs` | Log quét thẻ (device_id, scan_type, scan_data, result, student info) |

### Google Sheets Convention

| Tab prefix | Nội dung | Cột |
|---|---|---|
| `SV_*` | Danh sách sinh viên | MSSV, Card ID, Họ và tên, Email, Trường/Viện, Lớp, Khóa |
| `LichThi_*` | Lịch thi | Phòng thi, Môn thi, Ngày thi, Giờ bắt đầu, Giờ kết thúc |
| `Device` | Danh sách thiết bị | Device ID, Tên Thiết bị |

---

## 3) Frontend — React Web UI

Thư mục: `web_ui/`

### Tech Stack

| Layer | Công nghệ | Phiên bản |
|---|---|---|
| Framework | React | 19.x |
| Build Tool | Vite | 8.x |
| Routing | react-router-dom | 7.x |
| Charts | Recharts | 3.x |
| Icons | lucide-react | 1.x |
| Email (OTP) | @emailjs/browser | 4.x |
| CSS | Custom (dark glassmorphism theme) | — |

### Yêu cầu

- Node.js 20.19+ hoặc 22.12+
- npm đi kèm Node.js

### Cài đặt & chạy

```powershell
cd web_ui
Copy-Item .env.example .env
npm install
npm run dev
```

Web UI chạy mặc định tại: http://localhost:5173

Kiểm tra bản production bằng `npm run build`; kết quả được tạo trong `web_ui/dist/`.

### Biến môi trường (`web_ui/.env`)

File `.env` được tạo từ `web_ui/.env.example`. Các biến `VITE_*` sẽ xuất hiện trong bundle frontend, vì vậy không đặt khóa bí mật phía server tại đây.

```env
# Backend API URL
VITE_API_BASE_URL=http://localhost:8000

# EmailJS config (dùng để gửi OTP reset mật khẩu)
VITE_EMAILJS_SERVICE_ID=your_service_id
VITE_EMAILJS_TEMPLATE_ID=your_template_id
VITE_EMAILJS_TEMPLATE_NOTIFY_ID=your_notify_template_id
VITE_EMAILJS_PUBLIC_KEY=your_public_key
```

### Các trang

| Route | Trang | Mô tả |
|---|---|---|
| `/login` | Login/Register/Forgot Password | Đăng nhập, đăng ký, quên mật khẩu (OTP qua EmailJS) |
| `/dashboard` | Dashboard | Thống kê tổng hợp, biểu đồ Recharts, WebSocket real-time |
| `/students` | Quản lý Sinh viên | CRUD, tìm kiếm, phân trang, sync từ Google Sheets |
| `/exam-rooms` | Quản lý Phòng thi | CRUD phòng thi, sync từ Google Sheets |
| `/exam-rooms/:roomId` | Chi tiết Phòng thi | Danh sách SV, điểm danh real-time (WebSocket), gán thiết bị, bật/tắt điểm danh |
| `/schedule` | Lịch thi | Xem lịch thi theo ngày |
| `/devices` | Quản lý Thiết bị | CRUD thiết bị ESP32, sync từ Google Sheets |
| `/profile` | Tài khoản | Chỉnh sửa profile, xóa tài khoản |

### Tính năng nổi bật

- 🔒 **Xác thực JWT** — ProtectedRoute guard, auto-redirect
- 📊 **Dashboard real-time** — Biểu đồ donut, area chart, bar chart (Recharts) + WebSocket
- 📡 **Điểm danh real-time** — WebSocket cập nhật trạng thái khi SV quẹt thẻ
- 📋 **Google Sheets sync** — Import/export dữ liệu 2 chiều
- 🎨 **Dark glassmorphism UI** — Glass cards, gradient, glow effects, animations
- 📧 **EmailJS** — Gửi OTP reset mật khẩu từ phía client
- 🔔 **Toast notifications** — Thông báo success/error/warning tự động ẩn

---

## 4) Chạy đồng thời (Development)

Mở 2 terminal:

```powershell
# Terminal 1 — Backend (port 8000)
cd server
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend (port 5173)
cd web_ui
npm run dev
```

Đảm bảo `VITE_API_BASE_URL=http://localhost:8000` trong `web_ui/.env` để kết nối local.

---

## 5) Deployment

| Thành phần | Platform | URL |
|---|---|---|
| Backend | Render | `https://datnmonitorstudents.onrender.com` |
| Frontend | Vercel | (cấu hình trong `vercel.json`) |
| MQTT Broker | toolhub.app | `mqtt.toolhub.app:1883` |

---

## Thư viện & Dependencies

### ESP32 Firmware (PlatformIO)

| Thư viện | Phiên bản | Mục đích |
|---|---|---|
| U8g2 | ^2.36.15 | Điều khiển OLED display |
| PubSubClient | ^2.8 | MQTT client |
| MFRC522 | ^1.4.11 | Đọc thẻ NFC (13.56 MHz) |
| ArduinoJson | ^6.21.3 | Serialize/deserialize JSON |

### Backend (Python)

| Package | Mục đích |
|---|---|
| fastapi + uvicorn | Web framework + ASGI server |
| sqlalchemy + psycopg2-binary | ORM + PostgreSQL driver |
| python-jose[cryptography] | JWT token |
| bcrypt | Password hashing |
| paho-mqtt | MQTT client |
| google-api-python-client + google-auth | Google Sheets API |
| python-dotenv | Đọc file .env |

### Frontend (Node.js)

| Package | Mục đích |
|---|---|
| react + react-dom | UI framework |
| react-router-dom | Client-side routing |
| recharts | Biểu đồ thống kê |
| lucide-react | Icon library |
| @emailjs/browser | Gửi email OTP phía client |
| vite | Build tool |
