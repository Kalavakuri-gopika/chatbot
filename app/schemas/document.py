from datetime import datetime
from pydantic import BaseModel

class DocumentResponse(BaseModel):
    id: int
    filename: str
    filepath: str
    file_size: int
    chunk_count: int
    upload_date: datetime

    class Config:
        from_attributes = True
