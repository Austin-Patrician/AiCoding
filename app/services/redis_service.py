"""
Redis Service - 全局 Redis 缓存服务

用于存储临时数据，如分类详情等需要在页面间传递的大数据
"""

import json
import redis
from typing import Optional, Any
from datetime import timedelta

from app.core.config import settings


class RedisService:
    """Redis 缓存服务"""
    
    _instance: Optional['RedisService'] = None
    _client: Optional[redis.Redis] = None
    
    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._client is None:
            self._connect()
    
    def _connect(self):
        """建立 Redis 连接"""
        try:
            self._client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD or None,
                username=settings.REDIS_USERNAME or None,
                db=settings.REDIS_DB,
                decode_responses=True,  # 自动解码为字符串
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # 测试连接
            self._client.ping()
            print(f"✅ Redis connected: {settings.REDIS_HOST}:{settings.REDIS_PORT}")
        except redis.ConnectionError as e:
            print(f"⚠️ Redis connection failed: {e}")
            print("   Falling back to in-memory cache")
            self._client = None
    
    @property
    def is_connected(self) -> bool:
        """检查 Redis 是否连接"""
        if self._client is None:
            return False
        try:
            self._client.ping()
            return True
        except:
            return False
    
    def set(self, key: str, value: Any, expire: int = 3600) -> bool:
        """
        设置缓存值
        
        Args:
            key: 缓存键
            value: 缓存值（自动 JSON 序列化）
            expire: 过期时间（秒），默认 1 小时
        
        Returns:
            是否成功
        """
        if not self.is_connected:
            return False
        
        try:
            json_value = json.dumps(value, ensure_ascii=False)
            self._client.setex(key, expire, json_value)
            return True
        except Exception as e:
            print(f"Redis set error: {e}")
            return False
    
    def get(self, key: str) -> Optional[Any]:
        """
        获取缓存值
        
        Args:
            key: 缓存键
        
        Returns:
            缓存值（自动 JSON 反序列化），不存在返回 None
        """
        if not self.is_connected:
            return None
        
        try:
            value = self._client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            print(f"Redis get error: {e}")
            return None
    
    def delete(self, key: str) -> bool:
        """删除缓存"""
        if not self.is_connected:
            return False
        
        try:
            self._client.delete(key)
            return True
        except Exception as e:
            print(f"Redis delete error: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """检查键是否存在"""
        if not self.is_connected:
            return False
        
        try:
            return self._client.exists(key) > 0
        except:
            return False
    
    def set_hash(self, name: str, mapping: dict, expire: int = 3600) -> bool:
        """设置 Hash 类型数据"""
        if not self.is_connected:
            return False
        
        try:
            # 将值转为 JSON 字符串
            json_mapping = {k: json.dumps(v, ensure_ascii=False) for k, v in mapping.items()}
            self._client.hset(name, mapping=json_mapping)
            if expire:
                self._client.expire(name, expire)
            return True
        except Exception as e:
            print(f"Redis hset error: {e}")
            return False
    
    def get_hash(self, name: str) -> Optional[dict]:
        """获取 Hash 类型数据"""
        if not self.is_connected:
            return None
        
        try:
            data = self._client.hgetall(name)
            if data:
                return {k: json.loads(v) for k, v in data.items()}
            return None
        except Exception as e:
            print(f"Redis hget error: {e}")
            return None


# 全局 Redis 服务实例
redis_service = RedisService()


# 便捷函数
def get_redis() -> RedisService:
    """获取 Redis 服务实例"""
    return redis_service
