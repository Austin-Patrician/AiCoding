# 认证系统使用说明

## 功能概述

本系统实现了完整的用户认证和权限控制功能：

### 1. 用户认证
- JWT Token 认证机制
- 密码安全加密（bcrypt）
- Token 有效期：24小时
- 自动登录状态保持

### 2. 权限控制
- **路由权限**：根据用户权限动态显示菜单项
- **数据权限**：用户只能访问被授权的项目数据
- **超级管理员**：拥有所有权限，可访问所有数据

### 3. 用户角色

#### 超级管理员 (admin)
- 用户名：`admin`
- 密码：`admin123`
- 权限：所有功能和所有项目

#### 普通用户 (testuser)
- 用户名：`testuser`
- 密码：`test123`
- 权限：
  - 项目管理 (/projects)
  - 编码分析 (/coding)
  - 编码库 (/code-library)
- 项目访问：仅能看到被授权的项目

## 启动系统

### 1. 初始化数据库用户
```bash
/Users/aa123456/code/net/AiCoding/.venv/bin/python scripts/init_users.py
```

### 2. 启动后端服务
```bash
# 使用启动脚本（推荐）
./start.sh

# 或手动启动
cd /Users/aa123456/code/net/AiCoding
/Users/aa123456/code/net/AiCoding/.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 启动前端服务
```bash
cd web
npm run dev
```

## 使用流程

1. **登录**
   - 访问 `http://localhost:5173/login`
   - 输入用户名和密码
   - 登录成功后自动跳转到项目管理页面

2. **访问控制**
   - 左侧菜单根据用户权限动态显示
   - 未授权的菜单项不会显示
   - 尝试访问无权限页面会被拦截

3. **数据访问**
   - 超级管理员：可以看到所有项目
   - 普通用户：只能看到被授权的项目
   - 项目列表API自动根据用户权限过滤

4. **退出登录**
   - 点击右上角用户头像
   - 选择"退出登录"
   - 自动清除登录状态并跳转到登录页面

## API 端点

### 认证相关
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/logout` - 退出登录

### 受保护的API
所有业务API都需要在请求头中携带 Token：
```
Authorization: Bearer <token>
```

前端已自动配置请求拦截器，无需手动处理。

## 数据库结构

### users 表
- id: 主键
- username: 用户名（唯一）
- hashed_password: 加密后的密码
- is_superuser: 是否超级管理员
- is_active: 账号是否激活

### user_permissions 表
- id: 主键
- user_id: 用户ID
- route: 路由路径（如 /projects）

### user_projects 表
- user_id: 用户ID
- project_id: 项目ID
- 多对多关系表

## 添加新用户

```python
from app.core.database import SessionLocal
from app.models.user import User, UserPermission
from app.core.security import get_password_hash

db = SessionLocal()

# 创建新用户
new_user = User(
    username="newuser",
    hashed_password=get_password_hash("password123"),
    is_superuser=False,
    is_active=True
)
db.add(new_user)
db.commit()
db.refresh(new_user)

# 添加权限
permissions = [
    UserPermission(user_id=new_user.id, route="/projects"),
    UserPermission(user_id=new_user.id, route="/coding"),
]
db.add_all(permissions)
db.commit()
```

## 安全建议

1. **修改默认密码**：首次部署后立即修改 admin 和 testuser 的密码
2. **更换 SECRET_KEY**：修改 `app/core/security.py` 中的 SECRET_KEY
3. **Token 过期时间**：根据安全需求调整 `ACCESS_TOKEN_EXPIRE_HOURS`
4. **HTTPS**：生产环境建议使用 HTTPS
5. **密码策略**：实施更强的密码复杂度要求

## 故障排查

### 登录失败
- 检查用户名和密码是否正确
- 确认用户 `is_active` 为 True
- 查看后端日志错误信息

### Token 过期
- Token 默认 24 小时过期
- 过期后会自动跳转到登录页面
- 重新登录即可

### 权限不足
- 检查用户的 `user_permissions` 表中是否有对应路由权限
- 超级管理员无需配置权限即可访问所有功能

### 看不到项目数据
- 普通用户需要在 `user_projects` 表中关联项目
- 超级管理员可以看到所有项目
