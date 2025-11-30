from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class CheatingTask(Base):
    __tablename__ = "cheating_tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    status = Column(String, default="pending") # pending, processing, completed, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    file_path = Column(String, nullable=True)
    
    results = relationship("CheatingResult", back_populates="task", cascade="all, delete-orphan")

class CheatingResult(Base):
    __tablename__ = "cheating_results"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("cheating_tasks.id"))
    
    user1_id = Column(String)
    user2_id = Column(String)
    
    question_id = Column(String)
    similarity = Column(Float)
    
    content1 = Column(Text)
    content2 = Column(Text)
    
    task = relationship("CheatingTask", back_populates="results")
