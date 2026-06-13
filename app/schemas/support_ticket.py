from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class SupportTicketCreate(BaseModel):
    user_name: str = Field(..., min_length=2, max_length=100)
    mobile_number: str = Field(..., min_length=10, max_length=15)
    email: EmailStr
    category: str
    description: str = Field(..., min_length=5)
    session_id: Optional[str] = None

class SupportTicketUpdate(BaseModel):
    priority: Optional[str] = None # Low, Medium, High, Critical
    status: Optional[str] = None # Pending, In Progress, Resolved, Closed
    assigned_officer: Optional[str] = None

class SupportTicketResponse(BaseModel):
    id: int
    ticket_id: str
    user_name: str
    mobile_number: str
    email: str
    category: str
    description: str
    priority: str
    status: str
    created_at: datetime
    assigned_officer: Optional[str] = None
    session_id: Optional[str] = None

    class Config:
        from_attributes = True
