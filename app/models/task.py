from sqlalchemy import Column, String, Integer, JSON, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base
import uuid
from sqlalchemy.orm import relationship

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, index=True)
    file_id = Column(String)
    status = Column(String, default="draft")  # draft, pending, processing, completed, failed
    
    # Configuration
    question_column = Column(String, nullable=True)
    column_configs = Column(JSON)
    generate_charts = Column(Integer, default=1) # Boolean stored as 0/1 or use Boolean type if preferred, but JSON serialization is easier with int sometimes. Let's use Boolean if supported or Integer. SQLite supports Boolean as 0/1.
    
    # Execution State
    progress = Column(Integer, default=0)
    total_rows = Column(Integer, default=0)
    current_message = Column(String, nullable=True)
    
    # Results
    statistics = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    analysis_results = relationship("AnalysisResult", back_populates="task", cascade="all, delete-orphan")
