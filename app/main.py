from fastapi import FastAPI
from app.core.config import settings
from app.api.api import api_router
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app import models
import logging


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app = FastAPI(title=settings.PROJECT_NAME)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    logger.info("GET / called")
    return {"message": "Backend is running", "api_prefix": settings.API_V1_STR}

# Initialize database tables on startup
Base.metadata.create_all(bind=engine)
