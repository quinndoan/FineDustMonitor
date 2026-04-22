# FineDustMonitor - Quick Run

README nay huong dan chay nhanh 2 phan da co san:
- Backend server (FastAPI)
- Web UI (React + Vite)

## 1) Chay Backend Server

Thu muc backend: `server/`

### Yeu cau
- Python 3.10+ (khuyen nghi 3.11)

### Cac buoc
```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install python-dotenv
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend se chay tai:
- API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

### Ghi chu Google Sheets
Backend tu fallback sang che do mock neu chua cau hinh Google Sheets.
Neu can dung Google Sheets that, tao file `.env` trong `server/` voi noi dung mau:

```env
GOOGLE_SERVICE_ACCOUNT_FILE=credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_DEFAULT_RANGE=A:Z
```

Va dam bao file `server/credentials.json` hop le.

## 2) Chay Web UI

Thu muc frontend: `web_ui/`

### Yeu cau
- Node.js 18+ (khuyen nghi 20+)

### Cac buoc
Mo terminal moi:
```powershell
cd web_ui
npm install
npm run dev
```

Web UI se chay mac dinh tai:
- http://localhost:5173

## 3) Chay dong thoi backend + web_ui

1. Terminal 1: chay backend o cong `8000`
2. Terminal 2: chay web_ui o cong `5173`

Mac dinh web_ui dang goi API den `http://localhost:8000/api/students`.
Vi vay hay giu backend chay dung cong `8000` de khong can sua them.
