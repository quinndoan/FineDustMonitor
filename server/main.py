import os
from dotenv import load_dotenv

load_dotenv(override=True)
from datetime import datetime
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager

from auth_router import router as auth_router
from student_router import router as student_router
from exam_room_router import router as exam_room_router
from device_router import router as device_router
from dashboard_router import router as dashboard_router
from database import engine
import models

from mqtt_service import start_mqtt, stop_mqtt
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup if they don't exist
    models.Base.metadata.create_all(bind=engine)
    loop = asyncio.get_running_loop()
    start_mqtt(loop)
    yield
    # Shutdown logic
    stop_mqtt()

app = FastAPI(
	title="Monitor Student Backend",
	version="0.2.0",
	description="FastAPI backend with PostgreSQL, JWT auth, and real-time attendance.",
	lifespan=lifespan,
)

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(student_router)
app.include_router(exam_room_router)
app.include_router(device_router)
app.include_router(dashboard_router)


@app.get("/")
def root() -> dict[str, Any]:
	return {
		"message": "Monitor Student API is running",
		"docs": "/docs",
		"timestamp": datetime.utcnow().isoformat(),
	}


@app.get("/api/health")
def health_check() -> dict[str, str]:
	"""Health check endpoint. Verifies DB connection."""
	from sqlalchemy import text
	from database import engine
	try:
		with engine.connect() as conn:
			conn.execute(text("SELECT 1"))
		return {"status": "ok", "database": "postgresql"}
	except Exception as exc:
		return {"status": "error", "database": str(exc)}


if __name__ == "__main__":
	import uvicorn

	uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
