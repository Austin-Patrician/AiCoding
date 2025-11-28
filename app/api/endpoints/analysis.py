import os
import json
import re
import pandas as pd
from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from bertopic import BERTopic
from sentence_transformers import SentenceTransformer

from app.services.aigc_service import get_aigc_service

router = APIRouter()

UPLOAD_DIR = "uploads"

class ExtractionRequest(BaseModel):
    file_id: str
    column_name: str
    sample_size: int = 50

class CodeSuggestion(BaseModel):
    code: str
    description: str

class ExtractionResponse(BaseModel):
    suggestions: List[CodeSuggestion]

@router.post("/extract/llm", response_model=ExtractionResponse)
async def extract_codes_llm(request: ExtractionRequest):
    file_path = os.path.join(UPLOAD_DIR, f"{request.file_id}.xlsx") # Assuming xlsx for now
    if not os.path.exists(file_path):
        # Try .xls
        file_path = os.path.join(UPLOAD_DIR, f"{request.file_id}.xls")
        if not os.path.exists(file_path):
             raise HTTPException(status_code=404, detail="File not found")

    try:
        df = pd.read_excel(file_path)
        if request.column_name not in df.columns:
            raise HTTPException(status_code=400, detail="Column not found")
        
        # Sample data
        texts = df[request.column_name].dropna().astype(str).tolist()
        if len(texts) > request.sample_size:
            import random
            sample_texts = random.sample(texts, request.sample_size)
        else:
            sample_texts = texts
            
        text_block = "\n".join([f"- {t}" for t in sample_texts])
        
        # Call LLM
        prompt = f"""
        You are a qualitative data analyst. Analyze the following survey responses and extract 5-10 key themes (codes) that categorize these responses.
        For each theme, provide a short name and a brief description.
        
        Responses:
        {text_block}
        
        Output format (JSON):
        [
            {{"code": "Theme Name", "description": "Brief definition"}}
        ]
        """
        
        # 使用 AIGC 服务
        aigc = get_aigc_service()
        content = await aigc.chat_completion(
            messages=[
                {"role": "system", "content": "You are a helpful assistant that outputs JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5
        )
        
        # Try to find JSON array in the response
        match = re.search(r'\[.*\]', content, re.DOTALL)
        if match:
            json_str = match.group(0)
            suggestions_data = json.loads(json_str)
            return {"suggestions": suggestions_data}
        else:
             raise HTTPException(status_code=500, detail="Failed to parse LLM response")

    except Exception as e:
        print(f"Error in LLM extraction: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/extract/bertopic", response_model=ExtractionResponse)
async def extract_codes_bertopic(request: ExtractionRequest):
    file_path = os.path.join(UPLOAD_DIR, f"{request.file_id}.xlsx")
    if not os.path.exists(file_path):
        file_path = os.path.join(UPLOAD_DIR, f"{request.file_id}.xls")
        if not os.path.exists(file_path):
             raise HTTPException(status_code=404, detail="File not found")

    try:
        df = pd.read_excel(file_path)
        if request.column_name not in df.columns:
            raise HTTPException(status_code=400, detail="Column not found")
        
        # Use all texts for clustering, not just a sample, to get better topics
        # But for speed in this demo, we might limit if it's huge
        texts = df[request.column_name].dropna().astype(str).tolist()
        
        if len(texts) < 10:
             raise HTTPException(status_code=400, detail="Not enough data for clustering (min 10)")

        # Load embedding model
        # Note: In production, load this once globally or use a singleton
        embedding_model = SentenceTransformer("BAAI/bge-small-zh-v1.5")
        
        # Initialize BERTopic
        topic_model = BERTopic(embedding_model=embedding_model, language="chinese", verbose=True)
        
        # Fit model
        topics, probs = topic_model.fit_transform(texts)
        
        # Get topic info
        topic_info = topic_model.get_topic_info()
        
        suggestions = []
        # Iterate over topics (skip -1 which is outliers)
        for index, row in topic_info.iterrows():
            if row['Topic'] == -1:
                continue
            
            # Get top words for the topic
            top_words = [word for word, score in topic_model.get_topic(row['Topic'])[:5]]
            topic_name = "_".join(top_words[:3]) # Construct a name from top 3 words
            description = f"Includes keywords: {', '.join(top_words)}"
            
            suggestions.append(CodeSuggestion(code=topic_name, description=description))
            
            if len(suggestions) >= 10: # Limit to top 10 topics
                break
                
        return {"suggestions": suggestions}

    except Exception as e:
        print(f"Error in BERTopic extraction: {e}")
        raise HTTPException(status_code=500, detail=str(e))
