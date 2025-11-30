import pandas as pd
import difflib
from sqlalchemy.orm import Session
from app.models.anti_cheating import CheatingTask, CheatingResult

class AntiCheatingService:
    def analyze_file(self, db: Session, task_id: int, file_path: str, threshold: float = 0.8):
        task = db.query(CheatingTask).filter(CheatingTask.id == task_id).first()
        if not task:
            return
        
        try:
            task.status = "processing"
            db.commit()
            
            # Read file
            if file_path.endswith('.csv'):
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)
            
            # Normalize columns (assume user_id, question_id, answer exist)
            # We might need to map columns or assume standard names. 
            # Let's try to find columns that look like them or use fixed names.
            # For MVP, let's assume columns: 'user_id', 'question_id', 'answer'
            
            required_cols = ['user_id', 'question_id', 'answer']
            if not all(col in df.columns for col in required_cols):
                task.status = "failed"
                # In a real app, we'd save the error message
                db.commit()
                return

            results = []
            
            # Group by question
            grouped = df.groupby('question_id')
            
            for question_id, group in grouped:
                records = group.to_dict('records')
                n = len(records)
                
                for i in range(n):
                    for j in range(i + 1, n):
                        rec1 = records[i]
                        rec2 = records[j]
                        
                        ans1 = str(rec1['answer'])
                        ans2 = str(rec2['answer'])
                        
                        # Skip empty answers or very short ones
                        if len(ans1) < 5 or len(ans2) < 5:
                            continue
                            
                        # Calculate similarity
                        similarity = difflib.SequenceMatcher(None, ans1, ans2).ratio()
                        
                        if similarity >= threshold:
                            result = CheatingResult(
                                task_id=task.id,
                                user1_id=str(rec1['user_id']),
                                user2_id=str(rec2['user_id']),   
                                question_id=str(question_id),
                                similarity=similarity,
                                content1=ans1,
                                content2=ans2
                            )
                            results.append(result)
            
            # Bulk save
            if results:
                db.bulk_save_objects(results)
            
            task.status = "completed"
            db.commit()
            
        except Exception as e:
            print(f"Analysis failed: {e}")
            task.status = "failed"
            db.commit()

anti_cheating_service = AntiCheatingService()
