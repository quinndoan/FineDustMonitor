import os
from dotenv import load_dotenv

load_dotenv()
from datetime import datetime
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schemas import RowItem, Student, StudentUpdate, SheetReadResponse, SheetAppendResponse
from sheet_service import create_sheet_service

app = FastAPI(
	title="FineDustMonitor Backend",
	version="0.1.0",
	description="Simple FastAPI starter for web + Google Sheets management.",
)

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

sheet_service, sheet_service_mode = create_sheet_service()


@app.get("/")
def root() -> dict[str, Any]:
	return {
		"message": "FineDustMonitor API is running",
		"docs": "/docs",
		"timestamp": datetime.utcnow().isoformat(),
	}


@app.get("/api/health")
def health_check() -> dict[str, str]:
	return {"status": "ok", "sheet_service_mode": sheet_service_mode}


@app.get("/api/sheets/{sheet_name}", response_model=SheetReadResponse)
def get_sheet_rows(sheet_name: str) -> SheetReadResponse:
	try:
		rows = sheet_service.read_rows(sheet_name)
	except KeyError as exc:
		raise HTTPException(status_code=404, detail=str(exc)) from exc
	except RuntimeError as exc:
		raise HTTPException(status_code=502, detail=str(exc)) from exc

	return SheetReadResponse(sheet_name=sheet_name, row_count=len(rows), rows=rows)


@app.post("/api/sheets/{sheet_name}/rows", response_model=SheetAppendResponse)
def append_sheet_row(sheet_name: str, payload: RowItem) -> SheetAppendResponse:
	try:
		total_rows = sheet_service.append_row(sheet_name, payload.values)
	except RuntimeError as exc:
		raise HTTPException(status_code=502, detail=str(exc)) from exc
	return SheetAppendResponse(
		success=True,
		message="Row appended successfully",
		total_rows=total_rows,
	)


@app.get("/api/students", response_model=list[Student])
def get_students() -> list[Student]:
	try:
		rows = sheet_service.read_rows("Students")
		students = []
		for i, row in enumerate(rows):
			if i == 0 and row and row[0] == "MSSV":
				continue
			row.extend([""] * (3 - len(row)))
			students.append(Student(mssv=row[0], rfid=row[1], name=row[2]))
		return students
	except KeyError:
		return [] # Nếu chưa có sheet Students
	except Exception as exc:
		raise HTTPException(status_code=500, detail=str(exc))

@app.post("/api/students")
def add_student(student: Student) -> dict[str, Any]:
	idx = sheet_service.find_row_index_by_mssv("Students", student.mssv)
	if idx is not None:
		raise HTTPException(status_code=400, detail="Sinh viên với MSSV này đã tồn tại.")
	try:
		sheet_service.append_row("Students", [student.mssv, student.rfid, student.name])
		return {"success": True, "message": "Thêm sinh viên thành công"}
	except Exception as exc:
		raise HTTPException(status_code=500, detail=str(exc))

@app.put("/api/students/{mssv}")
def update_student(mssv: str, data: StudentUpdate) -> dict[str, Any]:
	idx = sheet_service.find_row_index_by_mssv("Students", mssv)
	if idx is None:
		raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên.")
	try:
		rows = sheet_service.read_rows("Students")
		existing_row = rows[idx - 1]
		existing_row.extend([""] * (3 - len(existing_row)))
		new_rfid = data.rfid if data.rfid is not None else existing_row[1]
		new_name = data.name if data.name is not None else existing_row[2]
		sheet_service.update_row("Students", idx, [mssv, new_rfid, new_name])
		return {"success": True, "message": "Cập nhật sinh viên thành công"}
	except Exception as exc:
		raise HTTPException(status_code=500, detail=str(exc))

@app.delete("/api/students/{mssv}")
def delete_student(mssv: str) -> dict[str, Any]:
	idx = sheet_service.find_row_index_by_mssv("Students", mssv)
	if idx is None:
		raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên.")
	try:
		sheet_service.delete_row("Students", idx)
		return {"success": True, "message": "Xóa sinh viên thành công"}
	except Exception as exc:
		raise HTTPException(status_code=500, detail=str(exc))


if __name__ == "__main__":
	import uvicorn

	uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
