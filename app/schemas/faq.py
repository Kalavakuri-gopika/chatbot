from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class FAQBase(BaseModel):
    question: str
    answer: str
    category: Optional[str] = "General"

class FAQCreate(FAQBase):
    pass

class FAQUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    category: Optional[str] = None

class FAQResponse(FAQBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
