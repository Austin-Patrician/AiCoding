import os
import uuid
import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.task import Task
from app.models.result import AnalysisResult
from app.models.code_library import CodeLibrary
from app.models.project import Project
from app.core.coding_extraction import (
    extract_codes_with_llm, 
    extract_codes_with_bertopic, 
    classify_with_mode,
    classify_column_batch
)

UPLOAD_DIR = "uploads"

class TaskStatus:
    DRAFT = "draft"
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

async def process_analysis_task(task_id: str, db: Session):
    """Background task to process classification with per-column independent configuration"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        print(f"Task {task_id} not found in background job")
        return

    try:
        task.status = TaskStatus.PROCESSING
        task.progress = 0
        db.commit()
        
        # Load Excel file
        file_path = os.path.join(UPLOAD_DIR, f"{task.file_id}.xlsx")
        if not os.path.exists(file_path):
            file_path = os.path.join(UPLOAD_DIR, f"{task.file_id}.xls")
        
        df = pd.read_excel(file_path)
        total_rows = len(df)
        task.total_rows = total_rows
        
        # Parse column_configs from JSON
        column_configs = task.column_configs
        columns_to_process = list(column_configs.keys())
        
        # Determine ID column
        id_column = task.question_column
        
        # Get project name for code library naming
        project = db.query(Project).filter(Project.id == task.project_id).first()
        project_name = project.name if project else f"Project_{task.project_id}"
        
        # --- Phase 1: Code Extraction (for Open Coding columns) ---
        # 开放编码：生成编码后自动创建编码库记录
        for col_idx, col_name in enumerate(columns_to_process):
            col_config = column_configs[col_name]
            if col_config.get("mode") == "open":
                task.current_message = f"正在为列 '{col_name}' 提取编码 (引擎: {col_config.get('engine')})..."
                db.commit()
                
                sample_texts = df[col_name].dropna().astype(str).tolist()
                
                if col_config.get("engine") == "bertopic":
                    codes = await extract_codes_with_bertopic(sample_texts, col_config.get("max_codes") or 10)
                else:  # llm
                    codes = await extract_codes_with_llm(sample_texts, col_config.get("max_codes") or 10)
                
                # Update config with generated codes
                col_config['codes'] = codes
                
                # ============ 自动创建编码库记录（用于追踪） ============
                unique_id = str(uuid.uuid4())[:8]
                code_library_name = f"{project_name}_{col_name}_{unique_id}"
                
                # 提取编码名称列表
                code_names = [c['code'] for c in codes]
                
                # 创建编码库记录
                new_library = CodeLibrary(
                    name=code_library_name,
                    description=f"AI生成编码库 - 项目: {project_name}, 列: {col_name}, 任务ID: {task_id}",
                    codes=code_names
                )
                db.add(new_library)
                db.commit()
                
                # 记录编码库ID到配置中，方便后续追踪
                col_config['generated_library_id'] = new_library.id
                col_config['generated_library_name'] = code_library_name
                
                print(f"[Open Coding] Created code library: {code_library_name} with {len(code_names)} codes")
                
                column_configs[col_name] = col_config
                task.column_configs = dict(column_configs)
                db.commit()

        # --- Phase 2: Classification & Storage (优化版：按列批量处理) ---
        task.current_message = "正在进行分类分析..."
        db.commit()
        
        # Prepare ID list
        if id_column and id_column in df.columns:
            ids = df[id_column].astype(str).tolist()
        else:
            ids = [str(i) for i in range(len(df))]
            
        # Initialize stats counters
        all_statistics = {col: {} for col in columns_to_process}
        
        # ============ 按列批量分类（优化） ============
        column_results = {}  # {col_name: [result1, result2, ...]}
        
        for col_idx, col_name in enumerate(columns_to_process):
            col_config = column_configs[col_name]
            classification_mode = col_config.get("classification_mode", "ai_only")
            
            task.current_message = f"正在分类列 '{col_name}' ({col_idx + 1}/{len(columns_to_process)})..."
            task.progress = 10 + int((col_idx / len(columns_to_process)) * 80)
            db.commit()
            
            # 提取该列所有文本
            col_texts = []
            for i, row in enumerate(df.to_dict('records')):
                val = row.get(col_name)
                text = str(val) if pd.notna(val) else ""
                if pd.isna(val) or text.lower() == 'nan' or text.strip() == '':
                    text = ""
                col_texts.append(text)
            
            # 使用批量分类函数，传入 row_ids 用于横向分析
            print(f"[Analysis] Column '{col_name}' - Mode: {classification_mode}, Total: {len(col_texts)}")
            
            col_classification_results = await classify_column_batch(
                texts=col_texts,
                codes=col_config.get("codes", []),
                classification_mode=classification_mode,
                mapping_dict=col_config.get("mapping_dict", {}),
                default_code=col_config.get("default_code", ""),
                row_ids=ids,  # 传入唯一ID列表（题目/ID列的值）
                batch_size=50,
                max_concurrent=3
            )
            
            column_results[col_name] = col_classification_results
            
            # 统计该列结果
            for result in col_classification_results:
                code = result["code"]
                if code not in all_statistics[col_name]:
                    all_statistics[col_name][code] = 0
                all_statistics[col_name][code] += 1
        
        # ============ 组装并存储结果 ============
        task.current_message = "正在存储分析结果..."
        task.progress = 90
        db.commit()
        
        batch_size = 100
        results_buffer = []
        records = df.to_dict('records')
        
        for i, row in enumerate(records):
            row_id = ids[i]
            row_data_map = {}
            
            for col_name in columns_to_process:
                val = row.get(col_name)
                text = str(val) if pd.notna(val) else ""
                classification = column_results[col_name][i]
                
                row_data_map[col_name] = {
                    "row_id": row_id,  # 每条分类结果都携带唯一ID
                    "code": classification["code"],
                    "confidence": classification.get("confidence"),
                    "method": classification.get("method"),
                    "original_text": text
                }
            
            db_obj = AnalysisResult(
                task_id=task_id,
                row_id=row_id,
                data=row_data_map
            )
            results_buffer.append(db_obj)
            
            if len(results_buffer) >= batch_size:
                db.bulk_save_objects(results_buffer)
                results_buffer = []
                db.commit()
                
        # Final flush
        if results_buffer:
            db.bulk_save_objects(results_buffer)
            db.commit()
        
        # Mark as completed
        task.status = TaskStatus.COMPLETED
        task.progress = 100
        task.statistics = all_statistics
        task.completed_at = datetime.now()
        task.current_message = "分析完成"
        db.commit()
        
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"Error in task {task_id}: {error_detail}")
        task.status = TaskStatus.FAILED
        task.error = str(e)
        db.commit()
