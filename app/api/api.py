from fastapi import APIRouter
from app.api.endpoints import example, upload, analysis, projects, tasks, code_libraries, workshop, aigc

api_router = APIRouter()
api_router.include_router(example.router, prefix="/example", tags=["example"])
api_router.include_router(upload.router, prefix="/files", tags=["files"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(tasks.router, prefix="/analysis", tags=["tasks"])
api_router.include_router(code_libraries.router, prefix="/code-libraries", tags=["code-libraries"])
api_router.include_router(workshop.router, prefix="/workshop", tags=["workshop"])
api_router.include_router(aigc.router, prefix="/aigc", tags=["aigc"])
