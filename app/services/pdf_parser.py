import os
import logging
from typing import List
from pypdf import PdfReader

logger = logging.getLogger(__name__)

is_render = os.environ.get("RENDER", "false").lower() == "true"
force_fallback = os.environ.get("USE_FALLBACK_VECTOR_DB", "false").lower() == "true"

LANGCHAIN_AVAILABLE = False
Document = None
RecursiveCharacterTextSplitter = None

if not is_render and not force_fallback:
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        from langchain_core.documents import Document
        LANGCHAIN_AVAILABLE = True
        logger.info("langchain successfully imported in pdf_parser.")
    except ImportError:
        logger.warning("langchain not found in pdf_parser. Using lightweight fallbacks.")

if not LANGCHAIN_AVAILABLE:
    # Zero-dependency lightweight Document fallback
    class Document:
        def __init__(self, page_content: str, metadata: dict = None):
            self.page_content = page_content
            self.metadata = metadata or {}
            
        def __repr__(self):
            return f"Document(page_content={self.page_content[:30]}..., metadata={self.metadata})"

    # Zero-dependency lightweight RecursiveCharacterTextSplitter fallback
    class RecursiveCharacterTextSplitter:
        def __init__(self, chunk_size: int = 500, chunk_overlap: int = 100, length_function=len):
            self.chunk_size = chunk_size
            self.chunk_overlap = chunk_overlap
            
        def split_text(self, text: str) -> List[str]:
            chunks = []
            if not text:
                return chunks
            
            start = 0
            text_len = len(text)
            while start < text_len:
                end = min(start + self.chunk_size, text_len)
                if end < text_len:
                    # Look for a good boundary near the end
                    boundary = -1
                    for sep in ["\n\n", "\n", " "]:
                        pos = text.rfind(sep, start, end)
                        if pos > start + (self.chunk_size // 2):
                            boundary = pos + len(sep)
                            break
                    if boundary != -1:
                        end = boundary
                
                chunks.append(text[start:end].strip())
                start = end - self.chunk_overlap
                if start >= text_len or end == text_len:
                    break
            return [c for c in chunks if c]


class PDFParserService:
    @staticmethod
    def extract_text_from_pdf(file_path: str) -> str:
        """Extracts all text from a PDF file."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF file not found at: {file_path}")
            
        reader = PdfReader(file_path)
        full_text = []
        for page_num, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                full_text.append(text)
        return "\n".join(full_text)

    @staticmethod
    def chunk_pdf(file_path: str, filename: str, chunk_size: int = 500, chunk_overlap: int = 100) -> List[Document]:
        """Extracts text and chunks it into LangChain Document objects with source metadata."""
        text = PDFParserService.extract_text_from_pdf(file_path)
        
        # Split text into small chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len
        )
        
        chunks = text_splitter.split_text(text)
        
        # Package chunks into Document models
        documents = []
        for i, chunk in enumerate(chunks):
            doc = Document(
                page_content=chunk,
                metadata={
                    "source": filename,
                    "chunk_id": i,
                    "filepath": file_path
                }
            )
            documents.append(doc)
            
        return documents
