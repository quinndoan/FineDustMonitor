"""Debug: so sánh Google Sheet vs PostgreSQL"""
import os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from dotenv import load_dotenv
load_dotenv()

from database import engine
from sqlalchemy import text
from sheet_service import create_sheet_service

svc, mode = create_sheet_service()
print(f"Mode: {mode}")

# 1. List all tabs
all_tabs = svc.list_sheet_names()
print(f"\n=== ALL TABS ({len(all_tabs)}) ===")
for t in all_tabs:
    print(f"  - {t}")

sv_tabs = [t for t in all_tabs if t.startswith("SV_")]
lich_tabs = [t for t in all_tabs if t.startswith("LichThi_")]
print(f"\nSV_ tabs: {sv_tabs}")
print(f"LichThi_ tabs: {lich_tabs}")

# 2. Read each SV_ tab
for tab in sv_tabs:
    rows = svc.read_rows(tab)
    print(f"\n=== {tab} ({len(rows)-1 if rows else 0} data rows) ===")
    if rows:
        print(f"  Header ({len(rows[0])} cols): {rows[0]}")
        for i, row in enumerate(rows[1:4]):
            print(f"  Row {i+1} ({len(row)} cols): {row}")

# 3. DB data
with engine.connect() as conn:
    result = conn.execute(text("SELECT mssv, full_name, faculty, class_name FROM students LIMIT 5"))
    print(f"\n=== DB students (first 5) ===")
    for r in result:
        print(f"  {dict(r._mapping)}")
