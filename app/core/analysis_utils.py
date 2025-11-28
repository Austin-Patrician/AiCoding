import json
import re
from typing import List, Dict, Any

from app.services.aigc_service import get_aigc_service

async def extract_codes_with_llm(texts: List[str], sample_size: int = 50) -> List[Dict[str, str]]:
    """
    Extract codes/themes from a list of texts using LLM.
    """
    if len(texts) > sample_size:
        import random
        sample_texts = random.sample(texts, sample_size)
    else:
        sample_texts = texts
        
    text_block = "\n".join([f"- {t}" for t in sample_texts])
    
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
    
    try:
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
            return suggestions_data
        else:
             # Fallback if no JSON found, return empty or raise
             print("Failed to parse JSON from LLM response")
             return []
             
    except Exception as e:
        print(f"Error in LLM extraction: {e}")
        raise e
