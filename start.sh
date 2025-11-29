#!/bin/bash

# 初始化数据库(如果需要)
echo "正在初始化数据库用户..."
/Users/aa123456/code/net/AiCoding/.venv/bin/python scripts/init_users.py

# 启动后端服务
echo "正在启动后端服务..."
cd /Users/aa123456/code/net/AiCoding
/Users/aa123456/code/net/AiCoding/.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
