from sqlalchemy import Column, String, Integer, Float, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, ForeignKey("tasks.id"), index=True)
    
    # Data Identification
    row_id = Column(String, index=True) # The value from the user-selected ID column
    
    # Content
    # Stores all coding results for this row: 
    # { 
    #   "column_A": {"code": "X", "confidence": 0.9, "original_text": "abc"},
    #   "column_B": {"code": "Y", "confidence": 0.8, "original_text": "def"}
    # }
    data = Column(JSON, default={})
    
    # Relationship
    task = relationship("Task", back_populates="analysis_results")
