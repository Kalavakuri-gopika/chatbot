from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from datetime import datetime, timedelta, timezone
from app.core.database import Base

def get_ist_time():
    # Indian timezone is UTC + 5:30. Storing naive datetime representing local IST time.
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).replace(tzinfo=None)

class ChatLog(Base):
    __tablename__ = "chat_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    message = Column(Text, nullable=False)
    sender = Column(String, nullable=False)  # 'user' or 'bot' or 'system'
    timestamp = Column(DateTime, default=get_ist_time)
    intent = Column(String, nullable=True)  # 'general', 'faq', 'pdf_rag', 'crm_tenders', 'crm_vendor', etc.
    sources = Column(Text, nullable=True)  # JSON-string or comma-separated list of references
    escalated = Column(Boolean, default=False)  # True if user clicked escalate to human
