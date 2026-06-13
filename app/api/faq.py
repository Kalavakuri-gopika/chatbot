from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.models.faq import FAQ
from app.schemas.faq import FAQCreate, FAQUpdate, FAQResponse
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/faqs", tags=["FAQ Management"])

@router.get("", response_model=List[FAQResponse])
def list_faqs(category: Optional[str] = None, search: Optional[str] = None, db: Session = Depends(get_db)):
    """Retrieve all FAQs, with optional category and keyword searches."""
    query = db.query(FAQ)
    if category:
        query = query.filter(FAQ.category == category)
    if search:
        query = query.filter(
            (FAQ.question.ilike(f"%{search}%")) | 
            (FAQ.answer.ilike(f"%{search}%"))
        )
    return query.order_by(FAQ.id.desc()).all()

@router.get("/{faq_id}", response_model=FAQResponse)
def get_faq(faq_id: int, db: Session = Depends(get_db)):
    """Fetch details of a single FAQ."""
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found.")
    return faq

@router.post("", response_model=FAQResponse, status_code=status.HTTP_201_CREATED)
def create_faq(faq_in: FAQCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Add a new FAQ (Admin only)."""
    faq = FAQ(
        question=faq_in.question,
        answer=faq_in.answer,
        category=faq_in.category
    )
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return faq

@router.put("/{faq_id}", response_model=FAQResponse)
def update_faq(faq_id: int, faq_in: FAQUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update an FAQ (Admin only)."""
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found.")
        
    update_data = faq_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(faq, key, value)
        
    db.commit()
    db.refresh(faq)
    return faq

@router.delete("/{faq_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faq(faq_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Remove an FAQ (Admin only)."""
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found.")
    db.delete(faq)
    db.commit()
    return None
