from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.core.auth import get_current_active_user
from app.models.user import User, UserPermission
from app.models.project import Project
from app.schemas.user import UserCreate, UserUpdate, UserResponse

router = APIRouter()

def check_superuser(current_user: User):
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges"
        )

@router.get("/", response_model=List[UserResponse])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取所有用户列表"""
    check_superuser(current_user)
    users = db.query(User).offset(skip).limit(limit).all()
    
    # 构造响应数据
    result = []
    for user in users:
        permissions = [p.route_path for p in user.permissions]
        accessible_project_ids = [p.id for p in user.accessible_projects]
        
        user_data = UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            is_superuser=user.is_superuser,
            permissions=permissions,
            accessible_project_ids=accessible_project_ids
        )
        result.append(user_data)
    
    return result

@router.post("/", response_model=UserResponse)
async def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """创建新用户"""
    check_superuser(current_user)
    
    user = db.query(User).filter(User.username == user_in.username).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    
    # 创建用户
    db_user = User(
        username=user_in.username,
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        is_active=user_in.is_active,
        is_superuser=user_in.is_superuser,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # 添加权限
    if user_in.permissions:
        for route in user_in.permissions:
            perm = UserPermission(user_id=db_user.id, route_path=route)
            db.add(perm)
    
    # 添加项目关联
    if user_in.project_ids:
        projects = db.query(Project).filter(Project.id.in_(user_in.project_ids)).all()
        db_user.accessible_projects = projects
    
    db.commit()
    db.refresh(db_user)
    
    # 构造响应
    permissions = [p.route_path for p in db_user.permissions]
    accessible_project_ids = [p.id for p in db_user.accessible_projects]
    
    return UserResponse(
        id=db_user.id,
        username=db_user.username,
        email=db_user.email,
        full_name=db_user.full_name,
        is_active=db_user.is_active,
        is_superuser=db_user.is_superuser,
        permissions=permissions,
        accessible_project_ids=accessible_project_ids
    )

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """更新用户"""
    check_superuser(current_user)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    
    # 更新基本信息
    if user_in.username is not None:
        user.username = user_in.username
    if user_in.email is not None:
        user.email = user_in.email
    if user_in.full_name is not None:
        user.full_name = user_in.full_name
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.is_superuser is not None:
        user.is_superuser = user_in.is_superuser
    if user_in.password is not None:
        user.hashed_password = get_password_hash(user_in.password)
        
    # 更新权限
    if user_in.permissions is not None:
        # 删除旧权限
        db.query(UserPermission).filter(UserPermission.user_id == user.id).delete()
        # 添加新权限
        for route in user_in.permissions:
            perm = UserPermission(user_id=user.id, route_path=route)
            db.add(perm)
            
    # 更新项目关联
    if user_in.project_ids is not None:
        projects = db.query(Project).filter(Project.id.in_(user_in.project_ids)).all()
        user.accessible_projects = projects
        
    db.commit()
    db.refresh(user)
    
    # 构造响应
    permissions = [p.route_path for p in user.permissions]
    accessible_project_ids = [p.id for p in user.accessible_projects]
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        permissions=permissions,
        accessible_project_ids=accessible_project_ids
    )

@router.delete("/{user_id}", response_model=UserResponse)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """删除用户"""
    check_superuser(current_user)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    
    # 构造响应数据（在删除前）
    permissions = [p.route_path for p in user.permissions]
    accessible_project_ids = [p.id for p in user.accessible_projects]
    response = UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        permissions=permissions,
        accessible_project_ids=accessible_project_ids
    )
    
    db.delete(user)
    db.commit()
    
    return response

@router.get("/routes", response_model=List[dict])
async def get_available_routes(
    current_user: User = Depends(get_current_active_user)
):
    """获取所有可用路由权限"""
    check_superuser(current_user)
    
    return [
        {"path": "/projects", "name": "项目管理"},
        {"path": "/coding", "name": "编码分析"},
        {"path": "/code-library", "name": "编码库"},
        {"path": "/anti-cheating", "name": "防作弊检测"},
        {"path": "/workshop", "name": "测试工坊"},
        {"path": "/workshop/cluster-test", "name": "聚类测试"},
    ]
