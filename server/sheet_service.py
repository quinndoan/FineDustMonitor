import os
from typing import Any
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

class InMemorySheetService:
	"""
	In-memory fallback service.
	Used when Google credentials are not configured yet.
	"""

	def __init__(self) -> None:
		self._storage: dict[str, list[list[str]]] = {
			"Students": [
				["MSSV", "RFID", "Họ và tên"],
				["12345", "A1B2C3D4", "Nguyễn Văn A"],
			]
		}

	def read_rows(self, sheet_name: str) -> list[list[str]]:
		if sheet_name not in self._storage:
			raise KeyError(f"Sheet '{sheet_name}' not found")
		return self._storage[sheet_name]

	def append_row(self, sheet_name: str, row: list[str]) -> int:
		if sheet_name not in self._storage:
			self._storage[sheet_name] = []

		self._storage[sheet_name].append(row)
		return len(self._storage[sheet_name])

	def find_row_index_by_mssv(self, sheet_name: str, mssv: str) -> int | None:
		if sheet_name not in self._storage:
			return None
		rows = self._storage[sheet_name]
		for i, row in enumerate(rows):
			if row and row[0] == mssv:
				return i + 1
		return None

	def find_row_index_by_rfid(self, sheet_name: str, rfid: str) -> int | None:
		if sheet_name not in self._storage:
			return None
		rows = self._storage[sheet_name]
		for i, row in enumerate(rows):
			if len(row) > 1 and row[1] == rfid:
				return i + 1
		return None

	def update_row(self, sheet_name: str, row_index: int, row_data: list[str]) -> None:
		if sheet_name in self._storage and 1 <= row_index <= len(self._storage[sheet_name]):
			self._storage[sheet_name][row_index - 1] = row_data

	def delete_row(self, sheet_name: str, row_index: int) -> None:
		if sheet_name in self._storage and 1 <= row_index <= len(self._storage[sheet_name]):
			self._storage[sheet_name].pop(row_index - 1)


class GoogleSheetsService:
	"""
	Google Sheets service using Service Account JSON credentials.
	"""

	def __init__(
		self,
		service_account_file: str,
		spreadsheet_id: str,
		default_range: str = "A:Z",
	) -> None:
		scopes = ["https://www.googleapis.com/auth/spreadsheets"]
		credentials = service_account.Credentials.from_service_account_file(
			service_account_file,
			scopes=scopes,
		)
		self._spreadsheet_id = spreadsheet_id
		self._default_range = default_range
		self._service = build("sheets", "v4", credentials=credentials, cache_discovery=False)
		self._init_students_sheet()

	def _init_students_sheet(self) -> None:
		try:
			spreadsheet = self._service.spreadsheets().get(spreadsheetId=self._spreadsheet_id).execute()
			for sheet in spreadsheet.get("sheets", []):
				if sheet.get("properties", {}).get("title") == "Students":
					return
			
			requests = [{"addSheet": {"properties": {"title": "Students"}}}]
			self._service.spreadsheets().batchUpdate(
				spreadsheetId=self._spreadsheet_id,
				body={"requests": requests}
			).execute()
			
			self._service.spreadsheets().values().update(
				spreadsheetId=self._spreadsheet_id,
				range="Students!A1:C1",
				valueInputOption="USER_ENTERED",
				body={"values": [["MSSV", "RFID", "Họ và tên"]]}
			).execute()
			print("✅ Tự động tạo tab 'Students' và Header thành công!")
		except Exception as exc:
			print(f"⚠️ Không thể tự động tạo tab 'Students': {exc}")

	def _sheet_range(self, sheet_name: str) -> str:
		return f"{sheet_name}!{self._default_range}"

	def read_rows(self, sheet_name: str) -> list[list[str]]:
		try:
			result = (
				self._service.spreadsheets()
				.values()
				.get(
					spreadsheetId=self._spreadsheet_id,
					range=self._sheet_range(sheet_name),
					majorDimension="ROWS",
				)
				.execute()
			)
		except HttpError as exc:
			if exc.resp.status == 404:
				raise KeyError(f"Sheet '{sheet_name}' not found") from exc
			raise RuntimeError("Google Sheets read failed") from exc

		return result.get("values", [])

	def append_row(self, sheet_name: str, row: list[str]) -> int:
		try:
			(
				self._service.spreadsheets()
				.values()
				.append(
					spreadsheetId=self._spreadsheet_id,
					range=f"{sheet_name}!A:A",
					valueInputOption="USER_ENTERED",
					insertDataOption="INSERT_ROWS",
					body={"values": [row]},
				)
				.execute()
			)
		except HttpError as exc:
			error_details = exc.error_details if hasattr(exc, "error_details") else str(exc)
			raise RuntimeError(f"Google Sheets append failed: {error_details}") from exc

		return len(self.read_rows(sheet_name))

	def find_row_index_by_mssv(self, sheet_name: str, mssv: str) -> int | None:
		try:
			rows = self.read_rows(sheet_name)
			for i, row in enumerate(rows):
				if row and row[0] == str(mssv):
					return i + 1
			return None
		except Exception as exc:
			print(f"Error in find_row_index: {exc}")
			return None

	def find_row_index_by_rfid(self, sheet_name: str, rfid: str) -> int | None:
		try:
			rows = self.read_rows(sheet_name)
			for i, row in enumerate(rows):
				if len(row) > 1 and row[1] == str(rfid):
					return i + 1
			return None
		except Exception as exc:
			print(f"Error in find_row_index_by_rfid: {exc}")
			return None

	def _get_sheet_id(self, sheet_name: str) -> int:
		try:
			spreadsheet = self._service.spreadsheets().get(spreadsheetId=self._spreadsheet_id).execute()
			for sheet in spreadsheet.get("sheets", []):
				if sheet.get("properties", {}).get("title") == sheet_name:
					return sheet.get("properties", {}).get("sheetId")
			raise KeyError(f"Sheet '{sheet_name}' not found")
		except HttpError as exc:
			raise RuntimeError("Failed to get sheet properties") from exc

	def update_row(self, sheet_name: str, row_index: int, row_data: list[str]) -> None:
		try:
			range_name = f"{sheet_name}!A{row_index}:C{row_index}"
			self._service.spreadsheets().values().update(
				spreadsheetId=self._spreadsheet_id,
				range=range_name,
				valueInputOption="USER_ENTERED",
				body={"values": [row_data]}
			).execute()
		except HttpError as exc:
			raise RuntimeError("Google Sheets update failed") from exc

	def delete_row(self, sheet_name: str, row_index: int) -> None:
		try:
			sheet_id = self._get_sheet_id(sheet_name)
			start_index = row_index - 1
			requests = [{"deleteDimension": {"range": {"sheetId": sheet_id, "dimension": "ROWS", "startIndex": start_index, "endIndex": start_index + 1}}}]
			self._service.spreadsheets().batchUpdate(
				spreadsheetId=self._spreadsheet_id,
				body={"requests": requests}
			).execute()
		except Exception as exc:
			raise RuntimeError("Google Sheets delete failed") from exc


def create_sheet_service() -> tuple[Any, str]:
	service_account_file = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "").strip()
	spreadsheet_id = os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID", "").strip()
	default_range = os.getenv("GOOGLE_SHEETS_DEFAULT_RANGE", "A:Z").strip() or "A:Z"
	base_dir = os.path.dirname(os.path.abspath(__file__))
	service_account_path = (
		service_account_file
		if os.path.isabs(service_account_file)
		else os.path.join(base_dir, service_account_file)
	)

	if not service_account_file or not spreadsheet_id:
		return InMemorySheetService(), "mock"

	if not os.path.isfile(service_account_path):
		return InMemorySheetService(), "mock"

	try:
		service = GoogleSheetsService(
			service_account_file=service_account_path,
			spreadsheet_id=spreadsheet_id,
			default_range=default_range,
		)
		return service, "google_sheets"
	except Exception:
		return InMemorySheetService(), "mock"
