"""
AIGC 配置管理端点

提供 AI 服务配置的查看接口
"""
from fastapi import APIRouter
from app.services.aigc_service import get_aigc_service

router = APIRouter()


@router.get("/config")
async def get_aigc_config():
    """
    获取当前 AIGC 配置信息
    
    Returns:
        配置信息（敏感信息已脱敏）
    """
    aigc = get_aigc_service()
    return aigc.get_config_info()


@router.get("/health")
async def health_check():
    """
    检查 AIGC 服务健康状态
    
    Returns:
        健康状态信息
    """
    aigc = get_aigc_service()
    config = aigc.get_config_info()
    
    return {
        "status": "healthy" if config["api_key_set"] else "warning",
        "message": "AIGC service is ready" if config["api_key_set"] else "API key not configured",
        "model": config["default_model"],
        "rate_limit": config["rate_limit_per_minute"]
    }
