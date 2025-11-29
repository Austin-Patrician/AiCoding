from typing import Optional, List
from pydantic import BaseModel, EmailStr

class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False

class UserCreate(UserBase):
    password: str
    permissions: List[str] = []  # List of route paths
    project_ids: List[int] = []

class UserUpdate(UserBase):
    password: Optional[str] = None
    permissions: Optional[List[str]] = None
    project_ids: Optional[List[int]] = None

class UserResponse(UserBase):
    id: int
    permissions: List[str] = []
    accessible_project_ids: List[int] = []

    class Config:
        from_attributes = True
