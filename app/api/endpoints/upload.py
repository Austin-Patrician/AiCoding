import os
import shutil
import uuid
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd
from pydantic import BaseModel

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class UploadResponse(BaseModel):
    file_id: str
    filename: str
    columns: List[str]
    preview: List[dict]

class FileInfoResponse(BaseModel):
    file_id: str
    columns: List[str]
    row_count: int

@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")

    file_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1]
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_extension}")

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Read Excel file to get columns and preview
        df = pd.read_excel(file_path, nrows=5)
        columns = df.columns.tolist()
        preview = df.to_dict(orient="records")
        
        # Handle NaN values for JSON serialization
        preview = [{k: (v if pd.notna(v) else None) for k, v in record.items()} for record in preview]

        return {
            "file_id": file_id,
            "filename": file.filename,
            "columns": columns,
            "preview": preview
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def get_file_path(file_id: str) -> str:
    """Get file path, trying both .xlsx and .xls extensions"""
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.xlsx")
    if not os.path.exists(file_path):
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}.xls")
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="文件未找到")
    return file_path


@router.get("/{file_id}/info", response_model=FileInfoResponse)
async def get_file_info(file_id: str):
    """Get file information including columns"""
    file_path = get_file_path(file_id)
    
    try:
        df = pd.read_excel(file_path)
        columns = df.columns.tolist()
        row_count = len(df)
        
        return {
            "file_id": file_id,
            "columns": columns,
            "row_count": row_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
