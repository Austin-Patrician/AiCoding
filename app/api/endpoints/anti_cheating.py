from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Form
from sqlalchemy.orm import Session
from typing import List
import shutil
import os
from datetime import datetime

from app.core.database import get_db
from app.core.auth import get_current_active_user
from app.models.user import User
from app.models.anti_cheating import CheatingTask, CheatingResult
from app.schemas.anti_cheating import CheatingTask as CheatingTaskSchema, CheatingResult as CheatingResultSchema
from app.services.anti_cheating_service import anti_cheating_service

router = APIRouter()

UPLOAD_DIR = "uploads/anti_cheating"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload", response_model=CheatingTaskSchema)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = Form(...),
    threshold: float = Form(0.8),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Save file
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Create task
    task = CheatingTask(
        name=name,
        file_path=file_path,
        status="pending"
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # Trigger analysis
    background_tasks.add_task(
        anti_cheating_service.analyze_file, 
        db, 
        task.id, 
        file_path, 
        threshold
    )
    
    return task

@router.get("/tasks", response_model=List[CheatingTaskSchema])
async def get_tasks(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    tasks = db.query(CheatingTask).order_by(CheatingTask.created_at.desc()).offset(skip).limit(limit).all()
    return tasks

@router.get("/results/{task_id}", response_model=List[CheatingResultSchema])
async def get_results(
    task_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    results = db.query(CheatingResult).filter(CheatingResult.task_id == task_id).order_by(CheatingResult.similarity.desc()).all()
    return results

@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    task = db.query(CheatingTask).filter(CheatingTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Delete file
    if task.file_path and os.path.exists(task.file_path):
        try:
            os.remove(task.file_path)
        except:
            pass
            
    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}
