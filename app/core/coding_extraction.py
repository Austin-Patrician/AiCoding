import json
import re
import asyncio
from typing import List, Dict, Any, Tuple, Optional
from bertopic import BERTopic
from sentence_transformers import SentenceTransformer
import numpy as np

from app.services.aigc_service import get_aigc_service

async def extract_codes_with_llm(texts: List[str], max_codes: int = 10, sample_size: int = 500) -> List[Dict[str, str]]:
    """
    使用 LLM 从文本中提取编码主题
    采用两阶段工作流：1) 初步提取 2) 精炼验证
    """
    # 随机采样
    if len(texts) > sample_size:
        import random
        sample_texts = random.sample(texts, sample_size)
    else:
        sample_texts = texts
        
    text_block = "\n".join([f"{i+1}. {t[:100]}..." if len(t) > 100 else f"{i+1}. {t}" 
                            for i, t in enumerate(sample_texts[:50])])
    
    try:
        aigc = get_aigc_service()
        
        # 阶段1：初步提取主题
        prompt_stage1 = f"""你是一位专业的定性数据分析专家。请仔细分析以下问卷开放题回答，提取出{max_codes}个主要的主题编码。

数据样本（共{len(sample_texts)}条）：
{text_block}

要求：
1. 提取{max_codes}个最具代表性的主题编码
2. 每个编码需要简洁明了，通常2-6个字
3. 编码应该互斥且完整覆盖主要主题
4. 避免过于宽泛或过于具体

请按以下JSON格式输出：
{{
    "codes": [
        {{"code": "主题名称", "description": "简要说明该主题包含的内容", "keywords": ["关键词1", "关键词2"]}},
        ...
    ]
}}

只输出JSON，不要其他内容。"""

        parsed = await aigc.chat_completion_json(
            messages=[
                {"role": "system", "content": "你是一个专业的定性数据分析助手，擅长从开放题回答中提取主题编码。请只输出JSON格式结果。"},
                {"role": "user", "content": prompt_stage1}
            ],
            temperature=0.3
        )
        
        initial_codes = parsed.get('codes', [])
        
        # 阶段2：验证和精炼
        if len(initial_codes) > 0:
            codes_summary = "\n".join([f"- {c['code']}: {c['description']}" for c in initial_codes])
            
            prompt_stage2 = f"""请审查以下提取的编码体系，确保：
1. 编码之间互斥（没有重叠）
2. 编码名称简洁专业
3. 覆盖主要主题

当前编码体系：
{codes_summary}

如果需要调整，请返回改进后的编码；如果已经很好，直接返回原编码。
请以JSON格式输出：{{"codes": [...]}}"""

            parsed2 = await aigc.chat_completion_json(
                messages=[
                    {"role": "system", "content": "你是编码体系质量审查专家。请只输出JSON格式结果。"},
                    {"role": "user", "content": prompt_stage2}
                ],
                temperature=0.2
            )
            
            final_codes = parsed2.get('codes', initial_codes)
            
            return final_codes[:max_codes]
        
        return initial_codes[:max_codes]
             
    except Exception as e:
        print(f"Error in LLM extraction: {e}")
        raise e


async def extract_codes_with_bertopic(texts: List[str], max_codes: int = 10) -> List[Dict[str, str]]:
    """
    使用 BERTopic + BGE 模型进行主题聚类提取编码
    """
    try:
        # 使用 BGE 中文小模型
        embedding_model = SentenceTransformer("BAAI/bge-small-zh-v1.5")
        
        # 配置 BERTopic
        topic_model = BERTopic(
            embedding_model=embedding_model,
            language="chinese",
            nr_topics=max_codes,
            min_topic_size=max(5, len(texts) // 50),
            verbose=False
        )
        
        # 过滤空文本
        valid_texts = [t for t in texts if t and len(t.strip()) > 0]
        
        if len(valid_texts) < 10:
            raise ValueError("有效文本数量太少，无法进行聚类分析")
        
        # 训练模型
        topics, probs = topic_model.fit_transform(valid_texts)
        
        # 获取主题信息
        topic_info = topic_model.get_topic_info()
        
        # 转换为标准格式
        codes = []
        for idx, row in topic_info.iterrows():
            if row['Topic'] == -1:  # 跳过离群主题
                continue
            
            # 获取该主题的top关键词
            topic_words = topic_model.get_topic(row['Topic'])
            if topic_words:
                # 取前3个关键词作为主题名
                top_words = [word for word, _ in topic_words[:3]]
                code_name = "-".join(top_words)
                
                # 取前10个关键词作为描述
                keywords = [word for word, _ in topic_words[:10]]
                description = f"包含关键词: {', '.join(keywords)}"
                
                codes.append({
                    "code": code_name,
                    "description": description,
                    "keywords": keywords,
                    "count": int(row['Count'])
                })
            
            if len(codes) >= max_codes:
                break
        
        return codes
        
    except Exception as e:
        print(f"Error in BERTopic extraction: {e}")
        raise e


async def classify_text_with_codes(text: str, codes: List[Dict[str, str]], use_keywords: bool = False) -> Dict[str, Any]:
    """
    将单条文本分类到指定编码
    """
    try:
        # 先尝试关键词匹配
        if use_keywords:
            for code_info in codes:
                if 'keywords' in code_info:
                    for keyword in code_info.get('keywords', []):
                        if keyword.lower() in text.lower():
                            return {
                                "code": code_info['code'],
                                "confidence": 0.9
                            }
        
        # 使用 AIGC 服务进行分类
        aigc = get_aigc_service()
        
        codebook_text = "\n".join([
            f"- {c['code']}: {c.get('description', c['code'])}" 
            for c in codes
        ])
        
        prompt = f"""请将以下文本分类到最合适的类别中。

类别：
{codebook_text}

文本："{text}"

只输出类别名称，不要其他内容。"""

        assigned_code = await aigc.chat_completion(
            messages=[
                {"role": "system", "content": "你是文本分类专家。"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=50
        )
        
        assigned_code = assigned_code.strip()
        
        # 验证返回的编码是否在编码表中
        valid_codes = [c['code'] for c in codes]
        if assigned_code not in valid_codes:
            for valid_code in valid_codes:
                if valid_code in assigned_code or assigned_code in valid_code:
                    assigned_code = valid_code
                    break
            else:
                assigned_code = valid_codes[0] if valid_codes else "未分类"
        
        return {
            "code": assigned_code,
            "confidence": None
        }
        
    except Exception as e:
        print(f"Error in classification: {e}")
        return {
            "code": codes[0]['code'] if codes else "错误",
            "confidence": 0.0
        }


# ============================================================
# 固定编码模式的核心函数
# ============================================================

def try_deterministic_match(
    text: str,
    codes: List[Dict[str, str]],
    mapping_dict: Dict[str, str]
) -> Optional[Dict[str, Any]]:
    """
    尝试确定性匹配（固定编码 + 映射字典）
    返回 None 表示未匹配成功
    
    匹配优先级：
    1. 映射字典精确匹配
    2. 映射字典部分匹配（包含关系）
    3. 固定编码名称匹配
    4. 固定编码关键词匹配
    """
    # 1. 映射字典精确匹配
    if text in mapping_dict:
        return {
            "code": mapping_dict[text],
            "confidence": 1.0,
            "method": "exact_mapping"
        }
    
    
    # 2. 映射字典部分匹配（包含关系）
    for key, value in mapping_dict.items():
        if key in text or text in key:
            return {
                "code": value,
                "confidence": 0.9,
                "method": "partial_mapping"
            }
    
    # 3. 固定编码名称匹配
    for code_info in codes:
        code = code_info['code']
        if code in text:
            return {
                "code": code,
                "confidence": 0.8,
                "method": "fixed_code_match"
            }
    
    # 4. 固定编码关键词匹配
    for code_info in codes:
        code = code_info['code']
        if 'keywords' in code_info:
            for keyword in code_info.get('keywords', []):
                if keyword and keyword.lower() in text.lower():
                    return {
                        "code": code,
                        "confidence": 0.7,
                        "method": "keyword_match"
                    }
    
    # 未匹配
    return None


async def batch_classify_with_ai(
    texts: List[str],
    codes: List[Dict[str, str]],
    batch_size: int = 50,
    max_concurrent: int = 5
) -> List[Dict[str, Any]]:
    """
    批量 AI 分类（多线程并发）
    
    Args:
        texts: 待分类的文本列表
        codes: 编码列表
        batch_size: 每批处理的文本数量（默认50）
        max_concurrent: 最大并发数（默认5）
    
    Returns:
        分类结果列表，顺序与输入 texts 一致
    """
    if not texts:
        return []
    
    # 创建信号量控制并发
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def classify_single(text: str, index: int) -> Tuple[int, Dict[str, Any]]:
        """分类单条文本，返回 (索引, 结果)"""
        async with semaphore:
            try:
                result = await classify_text_with_codes(text, codes, use_keywords=False)
                result["method"] = "ai_classification"
                return (index, result)
            except Exception as e:
                print(f"Error classifying text at index {index}: {e}")
                return (index, {
                    "code": codes[0]['code'] if codes else "错误",
                    "confidence": 0.0,
                    "method": "ai_error"
                })
    
    # 分批处理，每批内部并发
    all_results = [None] * len(texts)
    
    for batch_start in range(0, len(texts), batch_size):
        batch_end = min(batch_start + batch_size, len(texts))
        batch_texts = texts[batch_start:batch_end]
        
        # 创建当前批次的任务
        tasks = [
            classify_single(text, batch_start + i) 
            for i, text in enumerate(batch_texts)
        ]
        
        # 并发执行当前批次
        batch_results = await asyncio.gather(*tasks)
        
        # 将结果放入正确位置
        for index, result in batch_results:
            all_results[index] = result
    
    return all_results


async def batch_classify_with_ai_bulk_prompt(
    texts: List[str],
    codes: List[Dict[str, str]],
    row_ids: List[str] = None,
    batch_size: int = 50,
    max_concurrent: int = 3
) -> List[Dict[str, Any]]:
    """
    批量 AI 分类（单次请求处理多条文本，更高效）
    使用 AIGCService 统一管理限流
    
    Args:
        texts: 待分类的文本列表
        codes: 编码列表
        row_ids: 每条文本对应的唯一ID列表（用于横向分析）
        batch_size: 每个 API 请求处理的文本数量（默认50）
        max_concurrent: 最大并发请求数（默认3）
    
    Returns:
        分类结果列表，顺序与输入 texts 一致，每个结果包含 row_id
    """
    if not texts:
        return []
    
    # 如果没有提供 row_ids，使用索引作为 ID
    if row_ids is None:
        row_ids = [str(i) for i in range(len(texts))]
    
    aigc = get_aigc_service()
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def classify_batch(batch_texts: List[str], batch_row_ids: List[str], start_index: int) -> List[Tuple[int, Dict[str, Any]]]:
        """一次 API 请求分类多条文本"""
        async with semaphore:
            try:
                codebook_text = "\n".join([
                    f"- {c['code']}: {c.get('description', c['code'])}" 
                    for c in codes
                ])
                
                # 构建批量分类的 prompt
                texts_block = "\n".join([
                    f"{i+1}. {t[:200]}" for i, t in enumerate(batch_texts)
                ])
                
                prompt = f"""请将以下 {len(batch_texts)} 条文本分别分类到最合适的类别中。

可选类别：
{codebook_text}

待分类文本：
{texts_block}

请按以下 JSON 格式输出，每条文本对应一个分类结果：
{{
    "results": [
        {{"index": 1, "code": "类别名称"}},
        {{"index": 2, "code": "类别名称"}},
        ...
    ]
}}

只输出 JSON，不要其他内容。"""

                # 使用 AIGCService，自带限流
                parsed = await aigc.chat_completion_json(
                    messages=[
                        {"role": "system", "content": "你是文本分类专家，擅长批量处理文本分类任务。请只输出JSON格式结果。"},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.1
                )
                
                results_list = parsed.get('results', [])
                
                # 验证并构建结果
                valid_codes = [c['code'] for c in codes]
                output = []
                
                for i, text in enumerate(batch_texts):
                    # 找到对应的结果
                    result_item = next(
                        (r for r in results_list if r.get('index') == i + 1), 
                        None
                    )
                    
                    if result_item:
                        assigned_code = result_item.get('code', '')
                        # 验证编码有效性
                        if assigned_code not in valid_codes:
                            for valid_code in valid_codes:
                                if valid_code in assigned_code or assigned_code in valid_code:
                                    assigned_code = valid_code
                                    break
                            else:
                                assigned_code = valid_codes[0] if valid_codes else "未分类"
                    else:
                        assigned_code = valid_codes[0] if valid_codes else "未分类"
                    
                    output.append((start_index + i, {
                        "row_id": batch_row_ids[i],
                        "code": assigned_code,
                        "confidence": None,
                        "method": "ai_batch_classification"
                    }))
                
                return output
                
            except Exception as e:
                print(f"Error in batch classification: {e}")
                # 返回默认结果
                return [
                    (start_index + i, {
                        "row_id": batch_row_ids[i],
                        "code": codes[0]['code'] if codes else "错误",
                        "confidence": 0.0,
                        "method": "ai_error"
                    })
                    for i in range(len(batch_texts))
                ]
    
    # 分批处理
    all_results = [None] * len(texts)
    tasks = []
    
    for batch_start in range(0, len(texts), batch_size):
        batch_end = min(batch_start + batch_size, len(texts))
        batch_texts = texts[batch_start:batch_end]
        batch_row_ids = row_ids[batch_start:batch_end]
        tasks.append(classify_batch(batch_texts, batch_row_ids, batch_start))
    
    # 并发执行所有批次
    all_batch_results = await asyncio.gather(*tasks)
    
    # 合并结果
    for batch_results in all_batch_results:
        for index, result in batch_results:
            all_results[index] = result
    
    return all_results


async def classify_with_mode(
    text: str,
    codes: List[Dict[str, str]],
    classification_mode: str,
    mapping_dict: Dict[str, str],
    default_code: str
) -> Dict[str, Any]:
    """
    根据分类配置模式对文本进行分类（单条文本版本，向后兼容）
    
    Args:
        text: 待分类的文本
        codes: 编码列表
        classification_mode: 分类模式
        mapping_dict: 映射字典 {原始值: 目标编码}
        default_code: 默认分类编码
    
    Returns:
        分类结果 {code, confidence, method}
    
    固定编码模式（mode=fixed）的两种策略：
    - fixed_then_ai: 先确定性匹配，未匹配的用 AI 分类
    - fixed_then_default: 先确定性匹配，未匹配的归入默认编码
    
    开放编码模式（mode=open）：
    - ai_only: 全部使用 AI 分类
    """
    
    # ============ 固定编码模式的策略 ============
    if classification_mode == "fixed_then_ai":
        # 策略1：先确定性匹配，未匹配的用 AI
        result = try_deterministic_match(text, codes, mapping_dict)
        if result:
            return result
        # 未匹配，使用 AI
        ai_result = await classify_text_with_codes(text, codes, use_keywords=False)
        ai_result["method"] = "ai_classification"
        return ai_result
    
    elif classification_mode == "fixed_then_default":
        # 策略2：先确定性匹配，未匹配的归入默认编码
        result = try_deterministic_match(text, codes, mapping_dict)
        if result:
            return result
        # 未匹配，归入默认编码
        return {
            "code": default_code or "其他",
            "confidence": 0.5,
            "method": "default_fallback"
        }
    
    # ============ 开放编码模式 ============
    elif classification_mode == "ai_only":
        result = await classify_text_with_codes(text, codes, use_keywords=False)
        result["method"] = "ai_classification"
        return result
    
    # ============ 向后兼容旧模式 ============
    elif classification_mode == "fixed_mapping_only":
        return await _classify_fixed_mapping_only(text, codes, mapping_dict)
    elif classification_mode == "mapping_then_ai":
        return await _classify_mapping_then_ai(text, codes, mapping_dict)
    elif classification_mode == "mapping_then_default":
        return await _classify_mapping_then_default(text, mapping_dict, default_code)
    elif classification_mode == "fixed_mapping_then_default":
        return await _classify_fixed_mapping_then_default(text, codes, mapping_dict, default_code)
    elif classification_mode == "fixed_mapping_then_ai":
        return await _classify_fixed_mapping_then_ai(text, codes, mapping_dict)
    else:
        # 默认使用 ai_only
        result = await classify_text_with_codes(text, codes, use_keywords=False)
        result["method"] = "ai_classification"
        return result


async def classify_column_batch(
    texts: List[str],
    codes: List[Dict[str, str]],
    classification_mode: str,
    mapping_dict: Dict[str, str],
    default_code: str,
    row_ids: List[str] = None,
    batch_size: int = 50,
    max_concurrent: int = 3
) -> List[Dict[str, Any]]:
    """
    批量分类整列数据（统一处理开放编码和固定编码）
    支持限流：每分钟最多100次 API 调用
    
    统一工作流程：
    1. 先对所有文本执行确定性匹配（编码库 + 映射字典）
    2. 收集未匹配的文本
    3. 根据策略处理未匹配文本：
       - *_then_default: 未匹配归入默认编码
       - *_then_ai: 未匹配用 AI 批量分类
    4. 合并结果
    
    Args:
        texts: 待分类的文本列表
        codes: 编码列表（固定编码或 AI 生成的编码）
        classification_mode: 分类策略
            - open_then_default: 开放编码 → 未匹配归入默认
            - open_then_ai: 开放编码 → 未匹配用 AI 分类
            - fixed_then_default: 固定编码 → 未匹配归入默认
            - fixed_then_ai: 固定编码 → 未匹配用 AI 分类
        mapping_dict: 映射字典
        default_code: 默认编码
        row_ids: 每条文本对应的唯一ID列表（题目/ID列的值，用于横向分析）
        batch_size: AI 批量处理的文本数量
        max_concurrent: AI 最大并发数
    
    Returns:
        分类结果列表，顺序与输入一致，每个结果包含 row_id
    """
    # 如果没有提供 row_ids，使用索引作为 ID
    if row_ids is None:
        row_ids = [str(i) for i in range(len(texts))]
    
    results = [None] * len(texts)
    unmatched_indices = []
    unmatched_texts = []
    unmatched_row_ids = []
    
    # ============ 第一阶段：确定性匹配（统一流程） ============
    # 无论是开放编码还是固定编码，都先尝试确定性匹配
    for i, text in enumerate(texts):
        row_id = row_ids[i]
        
        if not text or text.strip() == '':
            results[i] = {
                "row_id": row_id,
                "code": "N/A",
                "confidence": 1.0,
                "method": "empty_text"
            }
            continue
        
        # 尝试确定性匹配（编码库关键词 + 映射字典）
        match_result = try_deterministic_match(text, codes, mapping_dict)
        if match_result:
            match_result["row_id"] = row_id
            results[i] = match_result
        else:
            unmatched_indices.append(i)
            unmatched_texts.append(text)
            unmatched_row_ids.append(row_id)
    
    # ============ 第二阶段：处理未匹配文本（统一策略） ============
    if unmatched_texts:
        # 判断是否使用 AI 分类
        use_ai = classification_mode in ("fixed_then_ai", "open_then_ai", "ai_only")
        
        if use_ai:
            # 策略：批量 AI 分类
            print(f"[Batch AI] Processing {len(unmatched_texts)} unmatched texts...")
            ai_results = await batch_classify_with_ai_bulk_prompt(
                unmatched_texts, 
                codes,
                row_ids=unmatched_row_ids,
                batch_size=batch_size,
                max_concurrent=max_concurrent
            )
            for idx, ai_result in zip(unmatched_indices, ai_results):
                results[idx] = ai_result
        else:
            # 策略：全部归入默认编码
            for i, idx in enumerate(unmatched_indices):
                results[idx] = {
                    "row_id": unmatched_row_ids[i],
                    "code": default_code or "其他",
                    "confidence": 0.5,
                    "method": "default_fallback"
                }
    
    return results


async def _classify_fixed_mapping_only(
    text: str,
    codes: List[Dict[str, str]],
    mapping_dict: Dict[str, str]
) -> Dict[str, Any]:
    """
    模式1：仅固定编码+映射字典
    工作流程：映射字典匹配 → 固定编码关键词匹配 → 失败抛出错误
    """
    # 1. 精确匹配映射字典
    if text in mapping_dict:
        return {
            "code": mapping_dict[text],
            "confidence": 1.0,
            "method": "exact_mapping"
        }
    
    # 2. 部分匹配映射字典（包含关系）
    for key, value in mapping_dict.items():
        if key in text or text in key:
            return {
                "code": value,
                "confidence": 0.9,
                "method": "partial_mapping"
            }
    
    # 3. 固定编码关键词匹配
    for code_info in codes:
        code = code_info['code']
        # 检查编码名称
        if code in text:
            return {
                "code": code,
                "confidence": 0.8,
                "method": "fixed_code_match"
            }
        # 检查关键词
        if 'keywords' in code_info:
            for keyword in code_info.get('keywords', []):
                if keyword and keyword.lower() in text.lower():
                    return {
                        "code": code,
                        "confidence": 0.7,
                        "method": "keyword_match"
                    }
    
    # 4. 无匹配，返回错误标记
    return {
        "code": "未匹配",
        "confidence": 0.0,
        "method": "no_match"
    }


async def _classify_mapping_then_ai(
    text: str,
    codes: List[Dict[str, str]],
    mapping_dict: Dict[str, str]
) -> Dict[str, Any]:
    """
    模式3：映射字典 → 剩余AI编码
    工作流程：先映射字典匹配，未匹配的交给AI
    """
    # 1. 精确匹配映射字典
    if text in mapping_dict:
        return {
            "code": mapping_dict[text],
            "confidence": 1.0,
            "method": "exact_mapping"
        }
    
    # 2. 部分匹配映射字典
    for key, value in mapping_dict.items():
        if key in text or text in key:
            return {
                "code": value,
                "confidence": 0.9,
                "method": "partial_mapping"
            }
    
    # 3. 未匹配，使用AI分类
    result = await classify_text_with_codes(text, codes, use_keywords=True)
    result["method"] = "ai_classification"
    return result


async def _classify_mapping_then_default(
    text: str,
    mapping_dict: Dict[str, str],
    default_code: str
) -> Dict[str, Any]:
    """
    模式4：映射字典 → 剩余归入默认编码
    工作流程：先映射字典匹配，未匹配的全部归入默认编码
    """
    # 1. 精确匹配映射字典
    if text in mapping_dict:
        return {
            "code": mapping_dict[text],
            "confidence": 1.0,
            "method": "exact_mapping"
        }
    
    # 2. 部分匹配映射字典
    for key, value in mapping_dict.items():
        if key in text or text in key:
            return {
                "code": value,
                "confidence": 0.9,
                "method": "partial_mapping"
            }
    
    # 3. 未匹配，归入默认编码
    return {
        "code": default_code,
        "confidence": 0.5,
        "method": "default_fallback"
    }


async def _classify_fixed_mapping_then_default(
    text: str,
    codes: List[Dict[str, str]],
    mapping_dict: Dict[str, str],
    default_code: str
) -> Dict[str, Any]:
    """
    模式5：固定编码+映射 → 剩余归入默认
    工作流程：映射字典 → 固定编码关键词匹配 → 默认编码
    """
    # 1. 精确匹配映射字典
    if text in mapping_dict:
        return {
            "code": mapping_dict[text],
            "confidence": 1.0,
            "method": "exact_mapping"
        }
    
    # 2. 部分匹配映射字典
    for key, value in mapping_dict.items():
        if key in text or text in key:
            return {
                "code": value,
                "confidence": 0.9,
                "method": "partial_mapping"
            }
    
    # 3. 固定编码关键词匹配
    for code_info in codes:
        code = code_info['code']
        # 检查编码名称
        if code in text:
            return {
                "code": code,
                "confidence": 0.8,
                "method": "fixed_code_match"
            }
        # 检查关键词
        if 'keywords' in code_info:
            for keyword in code_info.get('keywords', []):
                if keyword and keyword.lower() in text.lower():
                    return {
                        "code": code,
                        "confidence": 0.7,
                        "method": "keyword_match"
                    }
    
    # 4. 未匹配，归入默认编码
    return {
        "code": default_code,
        "confidence": 0.5,
        "method": "default_fallback"
    }


async def _classify_fixed_mapping_then_ai(
    text: str,
    codes: List[Dict[str, str]],
    mapping_dict: Dict[str, str]
) -> Dict[str, Any]:
    """
    模式6：固定编码+映射 → 剩余AI编码
    工作流程：映射字典 → 固定编码关键词匹配 → AI分类
    """
    # 1. 精确匹配映射字典
    if text in mapping_dict:
        return {
            "code": mapping_dict[text],
            "confidence": 1.0,
            "method": "exact_mapping"
        }
    
    # 2. 部分匹配映射字典
    for key, value in mapping_dict.items():
        if key in text or text in key:
            return {
                "code": value,
                "confidence": 0.9,
                "method": "partial_mapping"
            }
    
    # 3. 固定编码关键词匹配
    for code_info in codes:
        code = code_info['code']
        # 检查编码名称
        if code in text:
            return {
                "code": code,
                "confidence": 0.8,
                "method": "fixed_code_match"
            }
        # 检查关键词
        if 'keywords' in code_info:
            for keyword in code_info.get('keywords', []):
                if keyword and keyword.lower() in text.lower():
                    return {
                        "code": code,
                        "confidence": 0.7,
                        "method": "keyword_match"
                    }
    
    # 4. 未匹配，使用AI分类
    result = await classify_text_with_codes(text, codes, use_keywords=True)
    result["method"] = "ai_classification"
    return result
