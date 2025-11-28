import os
import json
import uuid
from typing import List, Optional, Dict, Union, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
import pandas as pd

from app.core.database import get_db
from app.models.task import Task
from app.services.analysis_service import process_analysis_task, TaskStatus

router = APIRouter()

UPLOAD_DIR = "uploads"
EXPORT_DIR = "exports"
os.makedirs(EXPORT_DIR, exist_ok=True)

class Code(BaseModel):
    code: str
    description: Optional[str] = ""

class ColumnConfig(BaseModel):
    mode: str  # "fixed" or "open"
    engine: Optional[str] = "llm"  # "llm" or "bertopic"
    max_codes: Optional[int] = 10
    codes: Optional[List[Dict[str, str]]] = []  # For fixed mode
    mapping_dict: Optional[Dict[str, str]] = {}  # 映射字典
    default_code: Optional[str] = ""  # 默认分类编码
    classification_mode: Optional[str] = "ai_only"  # 分类配置模式

class TaskRequest(BaseModel):
    file_id: str
    project_id: Union[str, int]  # 支持字符串或整数
    question_column: Optional[str] = None
    column_configs: Dict[str, ColumnConfig]  # {columnName: config}
    generate_charts: Optional[bool] = True

from app.models.result import AnalysisResult

class TaskResponse(BaseModel):
    task_id: str
    status: str
    created_at: datetime
    project_id: Union[str, int]  # 支持字符串或整数
    file_id: str
    column_configs: Dict[str, Any] # Add column_configs to response

    class Config:
        from_attributes = True

class ResultItem(BaseModel):
    row_index: Optional[int] = None
    row_id: Optional[str] = None
    original_text: str
    assigned_code: str
    confidence: Optional[float] = None
    method: Optional[str] = None

class ColumnResult(BaseModel):
    codes: List[Union[str, Dict[str, Any]]] = []
    results: List[ResultItem] = []
    config: Dict[str, Any] = {}

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    progress: int
    total: int
    current_message: Optional[str] = None
    results: Dict[str, ColumnResult] = {}
    statistics: Dict[str, Any] = {}
    error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


@router.post("/tasks", response_model=TaskResponse)
async def create_task(
    request: TaskRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Create a new analysis task"""
    # Verify file exists
    file_path = os.path.join(UPLOAD_DIR, f"{request.file_id}.xlsx")
    if not os.path.exists(file_path):
        file_path = os.path.join(UPLOAD_DIR, f"{request.file_id}.xls")
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
    
    # Create task
    task_id = str(uuid.uuid4())
    
    # Convert column_configs to dict for storage
    column_configs_dict = {
        col: config.model_dump() for col, config in request.column_configs.items()
    }
    
    # 确保 project_id 是字符串（数据库存储为 String）
    project_id_str = str(request.project_id)
    
    task = Task(
        id=task_id,
        project_id=project_id_str,
        file_id=request.file_id,
        question_column=request.question_column,
        column_configs=column_configs_dict,
        status=TaskStatus.PENDING,
        progress=0,
        total_rows=0,
        created_at=datetime.now()
    )
    
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # Start background processing
    background_tasks.add_task(process_analysis_task, task_id, db)
    
    return TaskResponse(
        task_id=task.id,
        status=task.status,
        created_at=task.created_at,
        project_id=task.project_id,
        file_id=task.file_id,
        column_configs=task.column_configs
    )


@router.get("/tasks", response_model=List[TaskResponse])
async def list_tasks(
    project_id: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    """List all tasks, optionally filtered by project"""
    query = db.query(Task)
    if project_id:
        query = query.filter(Task.project_id == project_id)
    
    tasks = query.order_by(Task.created_at.desc()).all()
    
    return [
        TaskResponse(
            task_id=t.id,
            status=t.status,
            created_at=t.created_at,
            project_id=t.project_id,
            file_id=t.file_id,
            column_configs=t.column_configs
        ) for t in tasks
    ]

@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str, db: Session = Depends(get_db)):
    """Get task status and results"""
    task = db.query(Task).filter(Task.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Fetch results from DB
    db_results = db.query(AnalysisResult).filter(AnalysisResult.task_id == task_id).all()
    
    # Group by column
    results_dict = {}
    
    # Initialize structure for all columns
    if task.column_configs:
        for col_name in task.column_configs.keys():
            results_dict[col_name] = {
                "codes": task.column_configs[col_name].get("codes", []),
                "results": [],
                "config": task.column_configs[col_name]
            }
            
    # Iterate through row-based results and distribute to columns
    for r in db_results:
        row_data = r.data or {} # {"col_A": {"code": "X", ...}, "col_B": ...}
        for col_name, val in row_data.items():
            if col_name in results_dict:
                results_dict[col_name]["results"].append({
                    "row_id": r.row_id,
                    "original_text": val.get("original_text"),
                    "assigned_code": val.get("code"),
                    "confidence": val.get("confidence"),
                    "method": "ai"
                })
            
    return TaskStatusResponse(
        task_id=task.id,
        status=task.status,
        progress=task.progress,
        total=task.total_rows,
        current_message=task.current_message,
        results=results_dict,
        statistics=task.statistics,
        error=task.error,
        created_at=task.created_at,
        completed_at=task.completed_at
    )

@router.get("/tasks/{task_id}/export")
async def export_results(task_id: str, db: Session = Depends(get_db)):
    """Export analysis results as Excel file"""
    task = db.query(Task).filter(Task.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Task not completed yet")
    
    # Load original file
    file_path = os.path.join(UPLOAD_DIR, f"{task.file_id}.xlsx")
    if not os.path.exists(file_path):
        file_path = os.path.join(UPLOAD_DIR, f"{task.file_id}.xls")
    
    df = pd.read_excel(file_path)
    
    # Fetch results from DB
    db_results = db.query(AnalysisResult).filter(AnalysisResult.task_id == task_id).all()
    
    # Map: row_id -> data
    result_map = {str(r.row_id): r.data for r in db_results}
    
    # Determine ID column
    id_col = task.question_column
    
    # Create a list of IDs from the DF to match row_id
    if id_col and id_col in df.columns:
        ids = df[id_col].astype(str).tolist()
    else:
        ids = [str(i) for i in range(len(df))]
        
    # Add columns to DF
    column_configs = task.column_configs
    for col_name in column_configs.keys():
        new_col_name = f"{col_name}_AI分类"
        # Use list comprehension with map lookup
        df[new_col_name] = [result_map.get(r_id, {}).get(col_name, {}).get("code", "") for r_id in ids]

    # Save to export directory
    export_path = os.path.join(EXPORT_DIR, f"results_{task_id}.xlsx")
    df.to_excel(export_path, index=False, engine='openpyxl')
    
    return FileResponse(
        export_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"analysis_results_{task_id}.xlsx"
    )


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, db: Session = Depends(get_db)):
    """删除任务及其所有结果"""
    task = db.query(Task).filter(Task.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # 删除关联的分析结果
    db.query(AnalysisResult).filter(AnalysisResult.task_id == task_id).delete()
    
    # 删除任务
    db.delete(task)
    db.commit()
    
    return {"message": "任务已删除", "task_id": task_id}


@router.post("/tasks/{task_id}/rerun")
async def rerun_task(
    task_id: str, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """重新运行任务（清除旧结果并重新执行）"""
    task = db.query(Task).filter(Task.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # 检查任务是否正在运行
    if task.status == TaskStatus.PROCESSING:
        raise HTTPException(status_code=400, detail="任务正在执行中，无法重新运行")
    
    # 清除旧的分析结果
    db.query(AnalysisResult).filter(AnalysisResult.task_id == task_id).delete()
    
    # 重置任务状态
    task.status = TaskStatus.PENDING
    task.progress = 0
    task.total_rows = 0
    task.current_message = "等待重新执行..."
    task.statistics = None
    task.error = None
    task.completed_at = None
    
    db.commit()
    
    # 启动后台任务
    background_tasks.add_task(process_analysis_task, task_id, db)
    
    return {
        "message": "任务已重新启动",
        "task_id": task_id,
        "status": task.status
    }
