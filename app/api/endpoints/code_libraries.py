from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.code_library import CodeLibrary, CodeLibraryCreate, CodeLibraryUpdate
from app.services import code_library_service

router = APIRouter()

@router.post("/", response_model=CodeLibrary)
def create_code_library(library: CodeLibraryCreate, db: Session = Depends(get_db)):
    return code_library_service.create_code_library(db=db, library=library)

@router.get("/", response_model=List[CodeLibrary])
def read_code_libraries(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return code_library_service.get_code_libraries(db, skip=skip, limit=limit)

@router.get("/{library_id}", response_model=CodeLibrary)
def read_code_library(library_id: int, db: Session = Depends(get_db)):
    db_library = code_library_service.get_code_library(db, library_id=library_id)
    if db_library is None:
        raise HTTPException(status_code=404, detail="Code library not found")
    return db_library

@router.put("/{library_id}", response_model=CodeLibrary)
def update_code_library(library_id: int, library: CodeLibraryUpdate, db: Session = Depends(get_db)):
    db_library = code_library_service.update_code_library(db, library_id=library_id, library=library)
    if db_library is None:
        raise HTTPException(status_code=404, detail="Code library not found")
    return db_library

@router.delete("/{library_id}", response_model=CodeLibrary)
def delete_code_library(library_id: int, db: Session = Depends(get_db)):
    db_library = code_library_service.delete_code_library(db, library_id=library_id)
    if db_library is None:
        raise HTTPException(status_code=404, detail="Code library not found")
    return db_library
