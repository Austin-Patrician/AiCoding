from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.core.auth import get_current_active_user
from app.models.user import User, UserPermission

router = APIRouter()

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

class UserInfoResponse(BaseModel):
    id: int
    username: str
    email: str | None
    full_name: str | None
    is_superuser: bool
    permissions: List[str]
    accessible_project_ids: List[int]

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """用户登录"""
    user = db.query(User).filter(User.username == request.username).first()
    
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用",
        )
    
    # 创建访问令牌（sub必须是字符串）
    access_token = create_access_token(data={"sub": str(user.id)})
    
    # 获取用户权限
    permissions = [p.route_path for p in user.permissions]
    accessible_project_ids = [p.id for p in user.accessible_projects]
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_superuser": user.is_superuser,
            "permissions": permissions,
            "accessible_project_ids": accessible_project_ids
        }
    }

@router.get("/me", response_model=UserInfoResponse)
async def get_user_info(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """获取当前用户信息"""
    permissions = [p.route_path for p in current_user.permissions]
    accessible_project_ids = [p.id for p in current_user.accessible_projects]
    
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_superuser": current_user.is_superuser,
        "permissions": permissions,
        "accessible_project_ids": accessible_project_ids
    }

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_active_user)):
    """用户登出（前端清除token）"""
    return {"message": "已退出登录"}
