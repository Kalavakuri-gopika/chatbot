import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.chat_log import ChatLog
from app.schemas.chat import ChatRequest, ChatResponse, ChatLogResponse, EscalationUpdate
from app.services.llm import conversational_llm_service

router = APIRouter(prefix="/chat", tags=["Chatbot Operations"])

@router.post("/query", response_model=ChatResponse)
def query_chatbot(request: ChatRequest, db: Session = Depends(get_db)):
    """Submit a message to the chatbot. Responses are context-aware and source-cited."""
    session_id = request.session_id
    message_text = request.message.strip()
    
    if not message_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # 1. Save user query in chat logs
    user_log = ChatLog(
        session_id=session_id,
        message=message_text,
        sender="user"
    )
    db.add(user_log)
    db.commit()

    try:
        # 2. Query Conversational Retrieval AI engine (LangChain or local Fallback)
        response_text, intent, sources, is_escalated = conversational_llm_service.generate_response(
            db, session_id, message_text
        )
        
        # 3. Serialize sources list to JSON string for DB
        sources_str = json.dumps(sources) if sources else None
        
        # 4. Save bot response in chat logs
        bot_log = ChatLog(
            session_id=session_id,
            message=response_text,
            sender="bot",
            intent=intent,
            sources=sources_str,
            escalated=is_escalated
        )
        db.add(bot_log)
        
        # If the query led to human escalation, update all previous messages in this session
        if is_escalated:
            db.query(ChatLog).filter(ChatLog.session_id == session_id).update({"escalated": True})
            
        db.commit()

        return ChatResponse(
            response=response_text,
            session_id=session_id,
            intent=intent,
            sources=sources,
            escalated=is_escalated
        )
    except Exception as e:
        db.rollback()
        # Fallback system error logging
        error_msg = f"System Error: Unable to formulate response. Details: {str(e)}"
        error_log = ChatLog(
            session_id=session_id,
            message=error_msg,
            sender="system"
        )
        db.add(error_log)
        db.commit()
        
        return ChatResponse(
            response="I apologize. I encountered an internal error processing your request. Please try again or click Escalate.",
            session_id=session_id,
            intent="error",
            sources=[],
            escalated=False
        )

@router.get("/history/{session_id}", response_model=List[ChatLogResponse])
def get_session_history(session_id: str, db: Session = Depends(get_db)):
    """Fetch chronological chat history for a session."""
    logs = db.query(ChatLog).filter(
        ChatLog.session_id == session_id
    ).order_by(ChatLog.timestamp.asc()).all()
    return logs

@router.post("/escalate", response_model=ChatResponse)
def escalate_session(update: EscalationUpdate, db: Session = Depends(get_db)):
    """Explicitly flag a chat session as escalated to a human agent."""
    session_id = update.session_id
    
    # Check if we already have logs
    exists = db.query(ChatLog).filter(ChatLog.session_id == session_id).first()
    if not exists:
        # Create a placeholder session if empty
        init_log = ChatLog(
            session_id=session_id,
            message="[User launched widget]",
            sender="system"
        )
        db.add(init_log)
        db.commit()

    # Update all logs in this session to escalated
    db.query(ChatLog).filter(ChatLog.session_id == session_id).update(
        {"escalated": update.escalated}
    )
    
    # Save a system escalation log
    system_log = ChatLog(
        session_id=session_id,
        message="System Action: Chat session escalated to Human Service Desk.",
        sender="system",
        intent="human_escalation",
        escalated=update.escalated
    )
    db.add(system_log)
    db.commit()
    
    return ChatResponse(
        response="Your session has been queued for human assistance. A support officer will connect soon.",
        session_id=session_id,
        intent="human_escalation",
        sources=[],
        escalated=update.escalated
    )


# ──────────────────────────────────────────────────────────────────────────
# Grievance API Integration
# ──────────────────────────────────────────────────────────────────────────

import requests
from pydantic import BaseModel

class GrievanceSubmitRequest(BaseModel):
    category: str
    description: str
    session_id: str

@router.post("/grievance/submit")
def submit_grievance(req: GrievanceSubmitRequest):
    """
    Submits a grievance to the NTSPL external API.
    """
    url = "https://demo9.ntspl.co.in/api/TempGrievance/AddGrievance"
    combined_desc = f"[Grievance Type: {req.category}]\n{req.description}"
    
    try:
        # Submit as multipart/form-data
        files = {
            'Description': (None, combined_desc)
        }
        headers = {
            'accept': '*/*'
        }
        response = requests.post(url, files=files, headers=headers, timeout=15)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to submit grievance to NTSPL API: {str(e)}"
        )

@router.get("/grievance/track")
def track_grievance(grievance_number: str):
    """
    Tracks grievance details by ID/Number from the NTSPL external API.
    """
    url = "https://demo9.ntspl.co.in/api/TempGrievance/Get_Grievance_Details_By_Id"
    params = {
        "GrievanceNumber": grievance_number
    }
    headers = {
        'accept': '*/*'
    }
    try:
        response = requests.get(url, params=params, headers=headers, timeout=15)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to track grievance from NTSPL API: {str(e)}"
        )

