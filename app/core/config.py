from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Ai Coding"
    API_V1_STR: str = "/api/v1"
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///./sql_app.db"
    
    # Redis Configuration
    REDIS_HOST: str = "103.150.10.188"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = "YourStrongPass123!"
    REDIS_USERNAME: Optional[str] = None  # 留空或 "default"
    REDIS_DB: int = 0
    
    # Cache TTL (seconds)
    CACHE_DEFAULT_TTL: int = 3600  # 1 hour
    CACHE_CLASSIFIED_DATA_TTL: int = 30 * 24 * 3600  # 30 days for classified data
    
    # OpenAI / AIGC Configuration
    OPENAI_API_KEY: str = "sk-RmOJkb4qJKJoizkPZsme77ZxYscEU6PFSdtm5W"
    OPENAI_BASE_URL: Optional[str] = "https://api.token-ai.cn/v1"  # 可选，用于自定义 API 端点（如 Azure、代理）
    OPENAI_DEFAULT_MODEL: str = "gpt-4o-mini"  # 默认模型
    OPENAI_RATE_LIMIT_PER_MINUTE: int = 100  # API 限流：每分钟最大请求数

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
