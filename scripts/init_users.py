"""初始化用户数据"""
import sys
sys.path.append('.')

from sqlalchemy.orm import Session
from app.core.database import engine, SessionLocal, Base
from app.models.user import User, UserPermission
from app.models.project import Project
from app.core.security import get_password_hash

def init_db():
    # 创建所有表
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # 创建超级管理员
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                email="admin@example.com",
                hashed_password=get_password_hash("admin123"),
                full_name="系统管理员",
                is_active=True,
                is_superuser=True
            )
            db.add(admin)
            db.commit()
            print("✓ 创建超级管理员: admin / admin123")
        
        # 创建普通测试用户
        test_user = db.query(User).filter(User.username == "testuser").first()
        if not test_user:
            test_user = User(
                username="testuser",
                email="test@example.com",
                hashed_password=get_password_hash("test123"),
                full_name="测试用户",
                is_active=True,
                is_superuser=False
            )
            db.add(test_user)
            db.flush()
            
            # 为测试用户分配权限
            permissions = [
                UserPermission(user_id=test_user.id, route_path="/projects"),
                UserPermission(user_id=test_user.id, route_path="/coding"),
                UserPermission(user_id=test_user.id, route_path="/code-library"),
            ]
            db.add_all(permissions)
            db.commit()
            print("✓ 创建测试用户: testuser / test123")
        
        print("\n用户初始化完成！")
        print("=" * 50)
        print("管理员账号: admin / admin123")
        print("测试账号: testuser / test123")
        print("=" * 50)
        
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
