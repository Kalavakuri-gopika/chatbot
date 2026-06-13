import random
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.models.support_ticket import SupportTicket
from app.models.chat_log import ChatLog
from app.schemas.support_ticket import SupportTicketCreate, SupportTicketUpdate, SupportTicketResponse
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/tickets", tags=["Support Tickets & Escalation Panel"])

def generate_unique_ticket_id(db: Session) -> str:
    """Generates a unique ticket ID following the format: OMC-YYYY-XXXX."""
    year = datetime.now().year
    while True:
        num = random.randint(1000, 9999)
        ticket_id = f"OMC-{year}-{num}"
        # Check uniqueness
        exists = db.query(SupportTicket).filter(SupportTicket.ticket_id == ticket_id).first()
        if not exists:
            return ticket_id

@router.post("", response_model=SupportTicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(ticket_in: SupportTicketCreate, db: Session = Depends(get_db)):
    """
    Submits a support ticket. Automatically links chat session, flags
    escalation, and appends a system log.
    """
    ticket_id = generate_unique_ticket_id(db)
    
    ticket = SupportTicket(
        ticket_id=ticket_id,
        user_name=ticket_in.user_name,
        mobile_number=ticket_in.mobile_number,
        email=ticket_in.email,
        category=ticket_in.category,
        description=ticket_in.description,
        session_id=ticket_in.session_id,
        status="Pending",
        priority="Medium"
    )
    db.add(ticket)
    
    # If a chat session is provided, flag all messages in that session as escalated
    if ticket_in.session_id:
        db.query(ChatLog).filter(ChatLog.session_id == ticket_in.session_id).update(
            {"escalated": True}
        )
        # Log system alert in chat history
        system_log = ChatLog(
            session_id=ticket_in.session_id,
            message=f"System Action: Support Ticket {ticket_id} registered for {ticket_in.user_name} under category '{ticket_in.category}'.",
            sender="system",
            intent="human_escalation",
            escalated=True
        )
        db.add(system_log)
        
    db.commit()
    db.refresh(ticket)
    return ticket

@router.get("", response_model=List[SupportTicketResponse])
def list_tickets(
    category: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all tickets with optional categorization and search filters (Admin only)."""
    query = db.query(SupportTicket)
    if category:
        query = query.filter(SupportTicket.category == category)
    if status:
        query = query.filter(SupportTicket.status == status)
    if priority:
        query = query.filter(SupportTicket.priority == priority)
    if search:
        query = query.filter(
            (SupportTicket.user_name.ilike(f"%{search}%")) |
            (SupportTicket.ticket_id.ilike(f"%{search}%")) |
            (SupportTicket.description.ilike(f"%{search}%"))
        )
    return query.order_by(SupportTicket.created_at.desc()).all()

@router.get("/{ticket_id}", response_model=SupportTicketResponse)
def get_ticket_status(ticket_id: str, db: Session = Depends(get_db)):
    """Fetch status of a ticket by its Ticket ID (Public / Citizen lookup)."""
    # Normalize ID format (OMC-2026-1045 or raw number)
    clean_id = ticket_id.upper().strip()
    if not clean_id.startswith("OMC-"):
        # If user typed raw number e.g. 1045, format it with current year
        year = datetime.now().year
        clean_id = f"OMC-{year}-{clean_id}"

    ticket = db.query(SupportTicket).filter(SupportTicket.ticket_id == clean_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Support ticket ID '{ticket_id}' was not found in the OMC register."
        )
    return ticket

@router.put("/{ticket_id}", response_model=SupportTicketResponse)
def update_ticket(
    ticket_id: str,
    ticket_up: SupportTicketUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update ticket priority, status, and assign support officers (Admin only)."""
    ticket = db.query(SupportTicket).filter(SupportTicket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
        
    update_data = ticket_up.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ticket, key, value)
        
    # If ticket status is resolved or closed, log a notice in the linked chat session
    if ticket.session_id and "status" in update_data:
        system_log = ChatLog(
            session_id=ticket.session_id,
            message=f"System Action: Ticket {ticket_id} status updated to '{ticket.status}' by Officer {ticket.assigned_officer or 'Admin'}.",
            sender="system",
            intent="general",
            escalated=(ticket.status != "Resolved" and ticket.status != "Closed")
        )
        db.add(system_log)
        
        # If resolved, clear the escalation flag for that session
        if ticket.status in ["Resolved", "Closed"]:
            db.query(ChatLog).filter(ChatLog.session_id == ticket.session_id).update(
                {"escalated": False}
            )

    db.commit()
    db.refresh(ticket)
    return ticket

@router.post("/{ticket_id}/notify")
def dispatch_notifications(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sends mock email and SMS dispatch alerts for ticket registration (Admin only)."""
    ticket = db.query(SupportTicket).filter(SupportTicket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
        
    return {
        "status": "dispatched",
        "email_alert": f"Mock SMTP: Support confirmation email successfully sent to {ticket.email}",
        "sms_alert": f"Mock SMS Gateway: Alert successfully pushed to mobile {ticket.mobile_number}",
        "timestamp": datetime.utcnow()
    }
