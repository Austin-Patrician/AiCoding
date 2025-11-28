import os
import json
import random
import re
import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
import pandas as pd
from bertopic import BERTopic
from sentence_transformers import SentenceTransformer

from app.core.database import get_db
from app.core.config import settings
from app.services.aigc_service import get_aigc_service
from app.models.test_result import TestResult
from app.services.redis_service import get_redis

router = APIRouter()

UPLOAD_DIR = "uploads"

# 缓存键前缀
CACHE_PREFIX_CLASSIFIED = "classified_data:"  # 按 test_id 存储
CACHE_PREFIX_TEMP = "classified_temp:"  # 临时缓存（用于新标签页）


# ============ Pydantic Schemas ============

class ClusterTestRequest(BaseModel):
    file_id: str
    file_name: Optional[str] = None
    column_name: str
    engine: str  # "llm" or "bertopic"
    sample_size: int = 50
    max_codes: int = 10


class CodeResult(BaseModel):
    code: str
    description: str
    keywords: Optional[List[str]] = None
    count: Optional[int] = None


class ClusterTestResponse(BaseModel):
    id: int
    file_id: str
    file_name: Optional[str] = None
    column_name: str
    engine: str
    sample_size: int
    max_codes: int
    results: List[CodeResult]
    classified_data: Optional[dict] = None  # 分类详情: { "主题名": ["文本1", "文本2", ...] }
    created_at: datetime

    class Config:
        from_attributes = True


class TestResultListItem(BaseModel):
    id: int
    file_id: str
    file_name: Optional[str] = None
    column_name: str
    engine: str
    sample_size: int
    max_codes: int
    result_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Helper Functions ============

def get_file_path(file_id: str) -> str:
    """Get file path, trying both .xlsx and .xls extensions"""
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.xlsx")
    if not os.path.exists(file_path):
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}.xls")
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="文件未找到")
    return file_path


async def extract_with_llm(texts: List[str], sample_size: int, max_codes: int) -> tuple[List[dict], dict]:
    """Extract themes using LLM
    
    Returns:
        tuple: (results, classified_data) - 主题列表和分类详情
    """
    # Sample data for theme extraction
    if len(texts) > sample_size:
        sample_texts = random.sample(texts, sample_size)
    else:
        sample_texts = texts
    
    text_block = "\n".join([f"- {t[:200]}" for t in sample_texts])
    
    prompt = f"""你是一位专业的定性数据分析专家。请分析以下问卷开放题回答，提取出{max_codes}个主要的主题编码。

数据样本（共{len(sample_texts)}条）：
{text_block}

要求：
1. 提取{max_codes}个最具代表性的主题编码
2. 每个编码需要简洁明了，通常2-6个字
3. 编码应该互斥且完整覆盖主要主题

请按以下JSON格式输出：
[
    {{"code": "主题名称", "description": "简要说明该主题包含的内容", "keywords": ["关键词1", "关键词2", "关键词3"]}}
]

只输出JSON数组，不要其他内容。"""

    aigc = get_aigc_service()
    content = await aigc.chat_completion(
        messages=[
            {"role": "system", "content": "你是一个专业的定性数据分析助手。请只输出JSON格式结果。"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )
    
    # Parse JSON from response
    match = re.search(r'\[.*\]', content, re.DOTALL)
    if match:
        results = json.loads(match.group(0))
        # 使用关键词匹配进行分类（避免再次调用 LLM）
        classified_data = classify_texts_by_keywords(texts, results)
        return results, classified_data
    else:
        raise HTTPException(status_code=500, detail="LLM返回格式解析失败")


async def extract_with_bertopic(texts: List[str], max_codes: int) -> tuple[List[dict], dict]:
    """Extract themes using BERTopic clustering + LLM naming
    
    Returns:
        tuple: (results, classified_data) - 主题列表和分类详情
    """
    
    if len(texts) < 10:
        raise HTTPException(status_code=400, detail="数据量不足，BERTopic至少需要10条记录")
    
    # Step 1: BERTopic Clustering
    embedding_model = SentenceTransformer("BAAI/bge-small-zh-v1.5")
    
    topic_model = BERTopic(
        embedding_model=embedding_model,
        language="chinese",
        nr_topics=max_codes,
        min_topic_size=max(5, len(texts) // 50),
        verbose=False
    )
    
    topics, probs = topic_model.fit_transform(texts)
    topic_info = topic_model.get_topic_info()
    
    # Step 2: Collect cluster info for LLM naming + 记录每个簇的文本
    clusters_for_naming = []
    cluster_texts = {}  # topic_id -> [texts]
    
    for _, row in topic_info.iterrows():
        if row['Topic'] == -1:  # Skip outliers
            continue
        
        topic_id = row['Topic']
        count = int(row['Count'])
        
        # Get keywords
        topic_words = topic_model.get_topic(topic_id)
        keywords = [word for word, _ in topic_words[:8]] if topic_words else []
        
        # Get ALL docs for this cluster (用于分类详情)
        topic_docs_idx = [i for i, t in enumerate(topics) if t == topic_id]
        cluster_texts[topic_id] = [texts[i] for i in topic_docs_idx]
        
        # Sample docs for naming
        sample_docs = [texts[i][:150] for i in topic_docs_idx[:5]]
        
        clusters_for_naming.append({
            "topic_id": topic_id,
            "keywords": keywords,
            "sample_docs": sample_docs,
            "count": count
        })
        
        if len(clusters_for_naming) >= max_codes:
            break
    
    if not clusters_for_naming:
        return [], {}
    
    # Step 3: Use LLM to name clusters
    results = await name_clusters_with_llm(clusters_for_naming)
    
    # Step 4: 构建 classified_data（直接用聚类结果，无需再次 LLM 分类）
    classified_data = {}
    for i, cluster in enumerate(clusters_for_naming):
        if i < len(results):
            theme_name = results[i]['code']
            classified_data[theme_name] = cluster_texts[cluster['topic_id']]
    
    # 处理离群点（归入"其他"）
    outlier_texts = [texts[i] for i, t in enumerate(topics) if t == -1]
    if outlier_texts:
        classified_data['其他'] = outlier_texts
    
    return results, classified_data


async def name_clusters_with_llm(clusters: List[dict]) -> List[dict]:
    """Use LLM to generate meaningful names for clusters"""
    
    # Build prompt with cluster info
    cluster_descriptions = []
    for i, c in enumerate(clusters):
        sample_text = "\n".join([f"  · {doc}" for doc in c['sample_docs'][:3]])
        desc = f"""簇 {i+1} (共{c['count']}条):
- 关键词: {', '.join(c['keywords'][:6])}
- 代表性回答:
{sample_text}
"""
        cluster_descriptions.append(desc)
    
    prompt = f"""你是一位专业的定性数据分析专家。我使用聚类算法对问卷开放题回答进行了分组，现在需要你为每个聚类簇命名。

以下是 {len(clusters)} 个聚类簇的信息：

{"".join(cluster_descriptions)}

请为每个簇提取一个简洁、准确的主题名称（2-6个字），并给出简要描述。

输出JSON格式：
[
    {{"code": "主题名称", "description": "该主题的简要说明", "keywords": ["关键词1", "关键词2", "关键词3"]}}
]

注意：
1. 主题名称应简洁概括该簇的核心含义
2. 描述应说明该主题包含哪类回答
3. keywords保留3-5个最相关的关键词

只输出JSON数组，不要其他内容。"""

    aigc = get_aigc_service()
    content = await aigc.chat_completion(
        messages=[
            {"role": "system", "content": "你是定性数据分析专家，擅长从聚类结果中提取有意义的主题名称。只输出JSON。"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1
    )
    
    # Parse JSON from response
    match = re.search(r'\[.*\]', content, re.DOTALL)
    if match:
        named_results = json.loads(match.group(0))
        # Merge with count info from clusters
        for i, result in enumerate(named_results):
            if i < len(clusters):
                result['count'] = clusters[i]['count']
                # Keep original keywords if LLM didn't provide enough
                if not result.get('keywords') or len(result['keywords']) < 3:
                    result['keywords'] = clusters[i]['keywords'][:5]
        return named_results
    else:
        # Fallback: return with generic names
        return [
            {
                "code": f"主题{i+1}",
                "description": f"包含关键词: {', '.join(c['keywords'][:5])}",
                "keywords": c['keywords'][:5],
                "count": c['count']
            }
            for i, c in enumerate(clusters)
        ]


def classify_texts_by_keywords(texts: List[str], themes: List[dict]) -> dict:
    """使用关键词匹配将文本分类到各主题（无需 LLM，节省资源）"""
    
    # 初始化分类结果
    classified_data = {t['code']: [] for t in themes}
    classified_data['其他'] = []
    
    for text in texts:
        text_lower = text.lower()
        matched = False
        best_match = None
        best_score = 0
        
        # 遍历每个主题，计算关键词匹配得分
        for theme in themes:
            keywords = theme.get('keywords', [])
            score = 0
            for kw in keywords:
                if kw.lower() in text_lower:
                    score += 1
            
            if score > best_score:
                best_score = score
                best_match = theme['code']
        
        if best_match and best_score > 0:
            classified_data[best_match].append(text)
        else:
            classified_data['其他'].append(text)
    
    # 移除空的"其他"分类
    if not classified_data.get('其他'):
        del classified_data['其他']
    
    # 统计每个主题的数量，更新 count
    for theme in themes:
        theme['count'] = len(classified_data.get(theme['code'], []))
    
    return classified_data


# ============ API Endpoints ============

@router.post("/cluster-test", response_model=ClusterTestResponse)
async def run_cluster_test(request: ClusterTestRequest, db: Session = Depends(get_db)):
    """Run clustering test with specified engine and save results"""
    
    # Load data
    file_path = get_file_path(request.file_id)
    df = pd.read_excel(file_path)
    
    if request.column_name not in df.columns:
        raise HTTPException(status_code=400, detail=f"列 '{request.column_name}' 不存在")
    
    # Get texts
    texts = df[request.column_name].dropna().astype(str).tolist()
    texts = [t for t in texts if t.strip() and t.lower() != 'nan']
    
    if len(texts) < 5:
        raise HTTPException(status_code=400, detail="有效数据不足，至少需要5条非空记录")
    
    # Run extraction (现在直接返回分类结果，无需额外 LLM 调用)
    actual_sample_size = request.sample_size
    if request.engine == "llm":
        results, classified_data = await extract_with_llm(texts, request.sample_size, request.max_codes)
    elif request.engine == "bertopic":
        results, classified_data = await extract_with_bertopic(texts, request.max_codes)
        actual_sample_size = len(texts)  # BERTopic uses all data
    else:
        raise HTTPException(status_code=400, detail="引擎类型无效，请选择 'llm' 或 'bertopic'")
    
    # Save to database
    db_result = TestResult(
        file_id=request.file_id,
        file_name=request.file_name,
        column_name=request.column_name,
        engine=request.engine,
        sample_size=actual_sample_size,
        max_codes=request.max_codes,
        results=results
    )
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    
    # 将 classified_data 存入 Redis（30天过期）
    redis = get_redis()
    cache_key = f"{CACHE_PREFIX_CLASSIFIED}{db_result.id}"
    redis.set(cache_key, classified_data, expire=settings.CACHE_CLASSIFIED_DATA_TTL)
    
    return ClusterTestResponse(
        id=db_result.id,
        file_id=db_result.file_id,
        file_name=db_result.file_name,
        column_name=db_result.column_name,
        engine=db_result.engine,
        sample_size=db_result.sample_size,
        max_codes=db_result.max_codes,
        results=results,
        classified_data=classified_data,  # 直接使用提取时的分类结果
        created_at=db_result.created_at
    )


@router.get("/cluster-test/history", response_model=List[TestResultListItem])
async def get_cluster_test_history(
    file_id: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get cluster test history, optionally filtered by file_id"""
    query = db.query(TestResult)
    
    if file_id:
        query = query.filter(TestResult.file_id == file_id)
    
    results = query.order_by(TestResult.created_at.desc()).limit(limit).all()
    
    return [
        TestResultListItem(
            id=r.id,
            file_id=r.file_id,
            file_name=r.file_name,
            column_name=r.column_name,
            engine=r.engine,
            sample_size=r.sample_size,
            max_codes=r.max_codes,
            result_count=len(r.results) if r.results else 0,
            created_at=r.created_at
        )
        for r in results
    ]


@router.get("/cluster-test/{test_id}", response_model=ClusterTestResponse)
async def get_cluster_test_detail(test_id: int, db: Session = Depends(get_db)):
    """Get details of a specific cluster test (包含 Redis 缓存的分类详情)"""
    result = db.query(TestResult).filter(TestResult.id == test_id).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="测试记录未找到")
    
    # 从 Redis 获取 classified_data
    redis = get_redis()
    cache_key = f"{CACHE_PREFIX_CLASSIFIED}{test_id}"
    classified_data = redis.get(cache_key)
    
    return ClusterTestResponse(
        id=result.id,
        file_id=result.file_id,
        file_name=result.file_name,
        column_name=result.column_name,
        engine=result.engine,
        sample_size=result.sample_size,
        max_codes=result.max_codes,
        results=result.results or [],
        classified_data=classified_data,  # 从 Redis 获取，可能为 None
        created_at=result.created_at
    )


@router.delete("/cluster-test/{test_id}")
async def delete_cluster_test(test_id: int, db: Session = Depends(get_db)):
    """Delete a cluster test result"""
    result = db.query(TestResult).filter(TestResult.id == test_id).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="测试记录未找到")
    
    db.delete(result)
    db.commit()
    
    return {"message": "删除成功", "id": test_id}


# ============ Classified Data Cache Endpoints ============

class ClassifiedDataRequest(BaseModel):
    classified_data: dict
    meta: Optional[dict] = None  # 用于存储额外元信息


class ClassifiedDataResponse(BaseModel):
    cache_id: str


@router.post("/classified-data/cache", response_model=ClassifiedDataResponse)
async def store_classified_data(request: ClassifiedDataRequest):
    """Store classified data for new tab viewing (使用 Redis，30天过期)"""
    redis = get_redis()
    cache_id = str(uuid.uuid4())
    cache_key = f"{CACHE_PREFIX_TEMP}{cache_id}"
    
    data = {
        "classified_data": request.classified_data,
        "meta": request.meta or {}
    }
    
    # 存储到 Redis，30天过期
    success = redis.set(cache_key, data, expire=settings.CACHE_CLASSIFIED_DATA_TTL)
    
    if not success:
        raise HTTPException(status_code=500, detail="缓存服务不可用，请稍后重试")
    
    return ClassifiedDataResponse(cache_id=cache_id)


@router.get("/classified-data/cache/{cache_id}")
async def get_classified_data(cache_id: str):
    """Retrieve cached classified data from Redis"""
    redis = get_redis()
    cache_key = f"{CACHE_PREFIX_TEMP}{cache_id}"
    
    data = redis.get(cache_key)
    
    if data is None:
        raise HTTPException(status_code=404, detail="数据已过期或不存在")
    
    return data
