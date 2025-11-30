from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class CheatingResultBase(BaseModel):
    user1_id: str
    user2_id: str
    question_id: str
    similarity: float
    content1: str
    content2: str

class CheatingResult(CheatingResultBase):
    id: int
    task_id: int

    class Config:
        from_attributes = True

class CheatingTaskBase(BaseModel):
    name: str

class CheatingTaskCreate(CheatingTaskBase):
    pass

class CheatingTask(CheatingTaskBase):
    id: int
    status: str
    created_at: datetime
    # results: List[CheatingResult] = [] # Avoid loading all results by default

    class Config:
        from_attributes = True
