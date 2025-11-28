from sqlalchemy import Column, Integer, String, JSON, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class TestResult(Base):
    __tablename__ = "test_results"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(String, index=True)
    file_name = Column(String, nullable=True)
    column_name = Column(String)
    engine = Column(String)  # "llm" or "bertopic"
    sample_size = Column(Integer)
    max_codes = Column(Integer, default=10)
    results = Column(JSON)  # List of {code, description, keywords?}
    created_at = Column(DateTime(timezone=True), server_default=func.now())
