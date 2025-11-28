from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class CodeLibraryBase(BaseModel):
    name: str
    description: Optional[str] = None
    codes: List[str]

class CodeLibraryCreate(CodeLibraryBase):
    pass

class CodeLibraryUpdate(CodeLibraryBase):
    pass

class CodeLibrary(CodeLibraryBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
