import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List

from app.core.config import settings
from app.core.database import get_db
from app.models.document import Document
from app.schemas.document import DocumentResponse
from app.services.pdf_parser import PDFParserService
from app.services.vector_db import vector_db_service
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/documents", tags=["Document Intelligence Management"])

@router.get("", response_model=List[DocumentResponse])
def list_documents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all uploaded PDF documents (Admin only)."""
    return db.query(Document).order_by(Document.id.desc()).all()

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a PDF document, chunk it, embed it, and index it in the Chroma Vector DB (Admin only)."""
    # 1. Validate file extension
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF documents are supported."
        )

    # 2. Check if a document with the same filename already exists
    filename = file.filename
    existing = db.query(Document).filter(Document.filename == filename).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A document named '{filename}' already exists. Please delete it first or rename your file."
        )

    # 3. Save file to disk
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    try:
        contents = await file.read()
        file_size = len(contents)
        with open(file_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write file to disk: {str(e)}"
        )

    # 4. Create database record
    doc_record = Document(
        filename=filename,
        filepath=file_path,
        file_size=file_size,
        chunk_count=0
    )
    db.add(doc_record)
    db.commit()

    try:
        # 5. Extract and Chunk PDF text
        chunks = PDFParserService.chunk_pdf(file_path, filename)
        
        # 6. Index chunks in Vector Database
        vector_db_service.add_documents(chunks)
        
        # 7. Update database chunk count
        doc_record.chunk_count = len(chunks)
        db.commit()
        db.refresh(doc_record)
        
        return doc_record
    except Exception as e:
        db.rollback()
        # Clean up files on error
        if os.path.exists(file_path):
            os.remove(file_path)
            
        # Clean up db record on error
        db.delete(doc_record)
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error parsing and indexing PDF: {str(e)}"
        )

@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an indexed PDF from the system (Admin only). It removes the file, DB record, and Chroma vector index."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document record not found.")

    # 1. Delete from vector store
    try:
        vector_db_service.delete_document(doc.filename)
    except Exception as e:
        # Log error but proceed to clean up files and DB
        print(f"Error deleting vector store index: {e}")

    # 2. Delete file from disk
    if os.path.exists(doc.filepath):
        try:
            os.remove(doc.filepath)
        except Exception as e:
            print(f"Error removing file from disk: {e}")

    # 3. Delete from DB
    db.delete(doc)
    db.commit()
    
    return None
