from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from app.core.database import Base

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(String, unique=True, index=True, nullable=False) # e.g. OMC-2026-1045
    user_name = Column(String, nullable=False)
    mobile_number = Column(String, nullable=False)
    email = Column(String, nullable=False)
    category = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String, default="Medium") # Low, Medium, High, Critical
    status = Column(String, default="Pending") # Pending, In Progress, Resolved, Closed
    created_at = Column(DateTime, default=datetime.utcnow)
    assigned_officer = Column(String, nullable=True) # Name of officer
    session_id = Column(String, nullable=True) # Linked chat session
