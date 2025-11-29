"""
AIGC Service - 统一管理 AI 生成服务

集中管理 OpenAI 及其他 AI 提供商的配置和调用
"""
import json
import asyncio
import logging
from typing import List, Dict, Any, Optional
from functools import lru_cache
from aiolimiter import AsyncLimiter

import openai
from openai import OpenAI, AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIGCService:
    """
    AI 生成内容服务
    
    功能：
    - 统一管理 AI 配置（API Key、Base URL、模型）
    - 提供同步和异步客户端
    - 内置限流控制
    - 统一的错误处理和重试机制
    """
    
    _instance: Optional["AIGCService"] = None
    _sync_client: Optional[OpenAI] = None
    _async_client: Optional[AsyncOpenAI] = None
    
    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """初始化配置（只执行一次）"""
        if hasattr(self, '_initialized'):
            return
            
        self._initialized = True
        
        # 从配置读取
        self.api_key = settings.OPENAI_API_KEY
        self.base_url = settings.OPENAI_BASE_URL
        self.default_model = settings.OPENAI_DEFAULT_MODEL
        
        # 输出配置信息（调试用）
        logger.info("=" * 60)
        logger.info("AIGC Service 配置信息:")
        logger.info(f"  API Key: {self.api_key[:10]}...{self.api_key[-8:] if self.api_key else 'None'}")
        logger.info(f"  Base URL: {self.base_url or 'None (使用默认 api.openai.com)'}")
        logger.info(f"  Default Model: {self.default_model}")
        logger.info(f"  Rate Limit: {settings.OPENAI_RATE_LIMIT_PER_MINUTE}/min")
        logger.info("=" * 60)
        
        # 限流器：每分钟最大请求数
        self.rate_limiter = AsyncLimiter(
            settings.OPENAI_RATE_LIMIT_PER_MINUTE, 
            60
        )
        
        # 默认参数
        self.default_temperature = 0.3
        self.default_max_tokens = 4096
    
    @property
    def sync_client(self) -> OpenAI:
        """获取同步客户端（惰性初始化）"""
        if self._sync_client is None:
            client_kwargs = {"api_key": self.api_key}
            if self.base_url:
                client_kwargs["base_url"] = self.base_url
            self._sync_client = OpenAI(**client_kwargs)
        return self._sync_client
    
    @property
    def async_client(self) -> AsyncOpenAI:
        """获取异步客户端（惰性初始化）"""
        if self._async_client is None:
            client_kwargs = {"api_key": self.api_key}
            if self.base_url:
                client_kwargs["base_url"] = self.base_url
            logger.info(f"初始化 AsyncOpenAI 客户端: base_url={client_kwargs.get('base_url', 'default')}")
            self._async_client = AsyncOpenAI(**client_kwargs)
        return self._async_client
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        response_format: Optional[Dict[str, str]] = None,
        use_rate_limit: bool = True
    ) -> str:
        """
        异步聊天补全
        
        Args:
            messages: 消息列表 [{"role": "user/system/assistant", "content": "..."}]
            model: 模型名称，默认使用配置的默认模型
            temperature: 温度参数
            max_tokens: 最大token数
            response_format: 响应格式，如 {"type": "json_object"}
            use_rate_limit: 是否使用限流
            
        Returns:
            AI 响应文本
        """
        if use_rate_limit:
            async with self.rate_limiter:
                return await self._do_chat_completion(
                    messages, model, temperature, max_tokens, response_format
                )
        else:
            return await self._do_chat_completion(
                messages, model, temperature, max_tokens, response_format
            )
    
    async def _do_chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str],
        temperature: Optional[float],
        max_tokens: Optional[int],
        response_format: Optional[Dict[str, str]]
    ) -> str:
        """执行聊天补全请求"""
        kwargs = {
            "model": model or self.default_model,
            "messages": messages,
            "temperature": temperature if temperature is not None else self.default_temperature,
        }
        
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
            
        if response_format:
            kwargs["response_format"] = response_format
        
        response = await self.async_client.chat.completions.create(**kwargs)
        return response.choices[0].message.content
    
    def chat_completion_sync(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        response_format: Optional[Dict[str, str]] = None
    ) -> str:
        """
        同步聊天补全（用于非异步上下文）
        
        注意：同步调用不使用限流器
        """
        kwargs = {
            "model": model or self.default_model,
            "messages": messages,
            "temperature": temperature if temperature is not None else self.default_temperature,
        }
        
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
            
        if response_format:
            kwargs["response_format"] = response_format
        
        response = self.sync_client.chat.completions.create(**kwargs)
        return response.choices[0].message.content
    
    async def chat_completion_json(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        use_rate_limit: bool = True
    ) -> Dict[str, Any]:
        """
        异步聊天补全，返回 JSON 对象
        
        自动设置 response_format 为 json_object，并解析返回内容
        """
        content = await self.chat_completion(
            messages=messages,
            model=model,
            temperature=temperature,
            response_format={"type": "json_object"},
            use_rate_limit=use_rate_limit
        )
        return json.loads(content)
    
    async def batch_chat_completion(
        self,
        messages_list: List[List[Dict[str, str]]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_concurrent: int = 5,
        response_format: Optional[Dict[str, str]] = None
    ) -> List[str]:
        """
        批量异步聊天补全
        
        Args:
            messages_list: 多组消息列表
            model: 模型名称
            temperature: 温度参数
            max_concurrent: 最大并发数
            response_format: 响应格式
            
        Returns:
            响应列表，顺序与输入一致
        """
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def process_single(idx: int, messages: List[Dict[str, str]]):
            async with semaphore:
                try:
                    result = await self.chat_completion(
                        messages=messages,
                        model=model,
                        temperature=temperature,
                        response_format=response_format
                    )
                    return (idx, result, None)
                except Exception as e:
                    return (idx, None, str(e))
        
        tasks = [process_single(i, msgs) for i, msgs in enumerate(messages_list)]
        results = await asyncio.gather(*tasks)
        
        # 按原始顺序排列结果
        sorted_results = sorted(results, key=lambda x: x[0])
        return [r[1] for r in sorted_results]
    
    def get_config_info(self) -> Dict[str, Any]:
        """获取当前配置信息（隐藏敏感信息）"""
        return {
            "api_key_set": bool(self.api_key),
            "api_key_preview": f"{self.api_key[:8]}...{self.api_key[-4:]}" if self.api_key else None,
            "base_url": self.base_url or "default (api.openai.com)",
            "default_model": self.default_model,
            "rate_limit_per_minute": settings.OPENAI_RATE_LIMIT_PER_MINUTE,
        }


# 全局单例实例
_aigc_service: Optional[AIGCService] = None


def get_aigc_service() -> AIGCService:
    """
    获取 AIGC 服务单例
    
    使用方式：
        from app.services.aigc_service import get_aigc_service
        
        aigc = get_aigc_service()
        response = await aigc.chat_completion([...])
    """
    global _aigc_service
    if _aigc_service is None:
        _aigc_service = AIGCService()
    return _aigc_service


# 便捷函数：直接获取限流器（向后兼容）
def get_rate_limiter() -> AsyncLimiter:
    """获取 API 限流器"""
    return get_aigc_service().rate_limiter
