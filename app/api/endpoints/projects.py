from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.schemas.project import Project, ProjectCreate, ProjectUpdate
from app.services import project_service

router = APIRouter()

class ColumnMapping(BaseModel):
    question_column: str
    answer_column: str
    additional_columns: Optional[List[str]] = []

class ColumnMappingResponse(BaseModel):
    project_id: int
    mapping: Optional[ColumnMapping] = None

@router.post("/", response_model=Project)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    return project_service.create_project(db=db, project=project)

@router.get("/", response_model=List[Project])
def read_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return project_service.get_projects(db, skip=skip, limit=limit)

@router.get("/{project_id}", response_model=Project)
def read_project(project_id: int, db: Session = Depends(get_db)):
    db_project = project_service.get_project(db, project_id=project_id)
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project

@router.put("/{project_id}", response_model=Project)
def update_project(project_id: int, project: ProjectUpdate, db: Session = Depends(get_db)):
    db_project = project_service.update_project(db, project_id=project_id, project=project)
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project

@router.delete("/{project_id}", response_model=Project)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    db_project = project_service.delete_project(db, project_id=project_id)
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project

@router.get("/{project_id}/mapping", response_model=ColumnMappingResponse)
def get_project_mapping(project_id: int, db: Session = Depends(get_db)):
    db_project = project_service.get_project(db, project_id=project_id)
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    mapping = None
    if db_project.column_mapping:
        mapping = ColumnMapping(**db_project.column_mapping)
    
    return {"project_id": project_id, "mapping": mapping}

@router.post("/{project_id}/mapping", response_model=ColumnMappingResponse)
def save_project_mapping(project_id: int, mapping: ColumnMapping, db: Session = Depends(get_db)):
    db_project = project_service.get_project(db, project_id=project_id)
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Update the project with the new mapping
    project_update = ProjectUpdate(
        name=db_project.name,
        description=db_project.description,
        column_mapping=mapping.model_dump()
    )
    project_service.update_project(db, project_id=project_id, project=project_update)
    
    return {"project_id": project_id, "mapping": mapping}
