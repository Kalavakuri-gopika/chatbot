from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str
    session_id: str

class ChatResponse(BaseModel):
    response: str
    session_id: str
    intent: str
    sources: Optional[List[str]] = []
    escalated: bool = False

class ChatLogResponse(BaseModel):
    id: int
    session_id: str
    message: str
    sender: str
    timestamp: datetime
    intent: Optional[str] = None
    sources: Optional[str] = None
    escalated: bool

    class Config:
        from_attributes = True

class EscalationUpdate(BaseModel):
    session_id: str
    escalated: bool
