from pydantic import BaseModel, Field

class RowItem(BaseModel):
	values: list[str] = Field(
		...,
		description="One row of data, each item is one cell value in that row.",
		min_length=1,
	)

class Student(BaseModel):
	mssv: str
	rfid: str
	name: str

class StudentUpdate(BaseModel):
	rfid: str | None = None
	name: str | None = None

class SheetReadResponse(BaseModel):
	sheet_name: str
	row_count: int
	rows: list[list[str]]

class SheetAppendResponse(BaseModel):
	success: bool
	message: str
	total_rows: int
