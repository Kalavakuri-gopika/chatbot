import os
from typing import List
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

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
