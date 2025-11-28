from sqlalchemy.orm import Session
from app.models.code_library import CodeLibrary
from app.schemas.code_library import CodeLibraryCreate, CodeLibraryUpdate

def get_code_library(db: Session, library_id: int):
    return db.query(CodeLibrary).filter(CodeLibrary.id == library_id).first()

def get_code_libraries(db: Session, skip: int = 0, limit: int = 100):
    return db.query(CodeLibrary).offset(skip).limit(limit).all()

def create_code_library(db: Session, library: CodeLibraryCreate):
    db_library = CodeLibrary(**library.model_dump())
    db.add(db_library)
    db.commit()
    db.refresh(db_library)
    return db_library

def update_code_library(db: Session, library_id: int, library: CodeLibraryUpdate):
    db_library = get_code_library(db, library_id)
    if db_library:
        update_data = library.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_library, key, value)
        db.commit()
        db.refresh(db_library)
    return db_library

def delete_code_library(db: Session, library_id: int):
    db_library = get_code_library(db, library_id)
    if db_library:
        db.delete(db_library)
        db.commit()
    return db_library
