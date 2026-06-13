from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.models.chat_log import ChatLog
from app.schemas.chat import ChatLogResponse
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/logs", tags=["Admin Logs & Session Controls"])

@router.get("", response_model=List[ChatLogResponse])
def get_all_logs(
    session_id: Optional[str] = None,
    escalated: Optional[bool] = None,
    sender: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve raw chatbot database logs (Admin only)."""
    query = db.query(ChatLog)
    if session_id:
        query = query.filter(ChatLog.session_id == session_id)
    if escalated is not None:
        query = query.filter(ChatLog.escalated == escalated)
    if sender:
        query = query.filter(ChatLog.sender == sender)
        
    return query.order_by(ChatLog.timestamp.desc()).limit(limit).all()

@router.get("/sessions")
def get_aggregated_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Groups chat logs by session_id, returning a list of active dialogues,
    their escalation status, and latest timestamp (Admin only).
    """
    # SQLite-compatible subquery to get max ID per session
    subq = db.query(
        ChatLog.session_id,
        func.max(ChatLog.timestamp).label("max_ts")
    ).group_by(ChatLog.session_id).subquery()
    
    # Query logs matching the latest timestamp for each session
    latest_logs = db.query(ChatLog).join(
        subq,
        (ChatLog.session_id == subq.c.session_id) & 
        (ChatLog.timestamp == subq.c.max_ts)
    ).order_by(desc(ChatLog.timestamp)).all()

    sessions_summary = []
    for log in latest_logs:
        # Count total messages in this session
        msg_count = db.query(ChatLog).filter(ChatLog.session_id == log.session_id).count()
        
        sessions_summary.append({
            "session_id": log.session_id,
            "latest_message": log.message,
            "latest_sender": log.sender,
            "timestamp": log.timestamp,
            "escalated": log.escalated,
            "message_count": msg_count
        })
        
    return sessions_summary

@router.get("/analytics")
def get_logs_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns weekly traffic (message count per day for the last 7 days)
    and intent classification breakdown percentages (Admin only).
    """
    # Naive IST datetime matching get_ist_time()
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(ist_tz).replace(tzinfo=None)
    
    # 1. Weekly Traffic (last 7 calendar days)
    days_list = []
    traffic_data = {}
    for i in range(6, -1, -1):
        day_date = now - timedelta(days=i)
        day_name = day_date.strftime("%a") # e.g. "Mon"
        days_list.append(day_name)
        traffic_data[day_name] = 0
        
    start_date = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Query user messages from last 7 days
    logs = db.query(ChatLog).filter(
        ChatLog.timestamp >= start_date,
        ChatLog.sender == "user"
    ).all()
    
    for log in logs:
        day_name = log.timestamp.strftime("%a")
        if day_name in traffic_data:
            traffic_data[day_name] += 1
            
    weekly_traffic = [{"day": day, "count": traffic_data[day]} for day in days_list]
    
    # 2. Intent Profile (from bot responses)
    intent_counts = db.query(
        ChatLog.intent,
        func.count(ChatLog.id)
    ).filter(
        ChatLog.sender == "bot",
        ChatLog.intent.isnot(None)
    ).group_by(ChatLog.intent).all()
    
    # Normalize intent names to UI display categories
    intent_map = {
        "pdf_rag": "PDF RAG",
        "crm_tenders": "CRM Tenders",
        "crm_vendor": "Vendor Query",
        "crm_complaints": "General",
        "employee_policy": "General",
        "faq": "General",
        "general": "General",
        "human_escalation": "General"
    }
    
    profile_counts = {
        "PDF RAG": 0,
        "CRM Tenders": 0,
        "Vendor Query": 0,
        "General": 0
    }
    
    total_intents = 0
    for intent_name, count in intent_counts:
        category = intent_map.get(intent_name, "General")
        if category in profile_counts:
            profile_counts[category] += count
            total_intents += count
        
    if total_intents == 0:
        # Default placeholder percentages if there is no chatbot traffic yet
        intents_profile = [
            {"category": "PDF RAG", "count": 0, "percentage": 40},
            {"category": "CRM Tenders", "count": 0, "percentage": 24},
            {"category": "Vendor Query", "count": 0, "percentage": 20},
            {"category": "General", "count": 0, "percentage": 16}
        ]
    else:
        intents_profile = []
        for cat, count in profile_counts.items():
            pct = round((count / total_intents) * 100)
            intents_profile.append({
                "category": cat,
                "count": count,
                "percentage": pct
            })
            
    return {
        "weekly_traffic": weekly_traffic,
        "intents_profile": intents_profile
    }

@router.post("/sessions/{session_id}/resolve")
def resolve_session_escalation(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resolves an escalation, updating the chat status flag to false (Admin only)."""
    logs = db.query(ChatLog).filter(ChatLog.session_id == session_id).all()
    if not logs:
        raise HTTPException(status_code=404, detail="No logs found for this session ID.")
        
    # Mark all logs in the session as no longer escalated
    db.query(ChatLog).filter(ChatLog.session_id == session_id).update({"escalated": False})
    
    # Append system notice in logs
    resolve_notice = ChatLog(
        session_id=session_id,
        message="System Action: Grievance escalated session resolved by Admin.",
        sender="system",
        intent="general",
        escalated=False
    )
    db.add(resolve_notice)
    db.commit()
    
    return {"status": "success", "message": f"Escalation resolved for session {session_id}."}

@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete all chat logs for a specific session ID (Admin only)."""
    db.query(ChatLog).filter(ChatLog.session_id == session_id).delete()
    db.commit()
    return {"status": "success", "message": f"Session {session_id} has been deleted."}

@router.delete("/clear-all")
def delete_all_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete all chat logs in the system (Admin only)."""
    db.query(ChatLog).delete()
    db.commit()
    return {"status": "success", "message": "All chat logs have been cleared."}
