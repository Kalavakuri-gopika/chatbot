import os
import json
import logging
import re
from typing import List, Dict, Any, Tuple
from langchain_core.documents import Document
from app.core.config import settings

logger = logging.getLogger(__name__)

# Try importing Chroma and HuggingFace embeddings
CHROMA_AVAILABLE = False
try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    from langchain_community.embeddings import HuggingFaceEmbeddings
    CHROMA_AVAILABLE = True
    logger.info("ChromaDB and HuggingFaceEmbeddings successfully imported.")
except ImportError as e:
    logger.warning(f"Failed to import ChromaDB or HuggingFaceEmbeddings: {str(e)}. Using fallback JSON database.")

class FallbackVectorStore:
    """A zero-dependency local text search database that mimics a Vector DB using Jaccard Similarity & term frequency."""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.data: List[Dict[str, Any]] = []
        self._load()

    def _load(self):
        if os.path.exists(self.db_path):
            try:
                with open(self.db_path, "r", encoding="utf-8") as f:
                    self.data = json.load(f)
                logger.info(f"Loaded {len(self.data)} chunks from fallback database at {self.db_path}")
            except Exception as e:
                logger.error(f"Error loading fallback database: {e}")
                self.data = []
        else:
            self.data = []

    def _save(self):
        try:
            with open(self.db_path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved {len(self.data)} chunks to fallback database at {self.db_path}")
        except Exception as e:
            logger.error(f"Error saving fallback database: {e}")

    def add_documents(self, documents: List[Document]):
        for doc in documents:
            self.data.append({
                "page_content": doc.page_content,
                "metadata": doc.metadata
            })
        self._save()

    def delete_by_source(self, filename: str):
        self.data = [chunk for chunk in self.data if chunk["metadata"].get("source") != filename]
        self._save()

    def _tokenize(self, text: str) -> List[str]:
        # Simple tokenization: lowercase, remove non-alphanumeric, split by space
        clean = re.sub(r"[^\w\s]", " ", text.lower())
        return [w for w in clean.split() if len(w) > 2]

    def similarity_search(self, query: str, k: int = 4) -> List[Document]:
        query_tokens = self._tokenize(query)
        if not query_tokens or not self.data:
            # If query is empty or no data, return first k documents
            return [Document(page_content=d["page_content"], metadata=d["metadata"]) for d in self.data[:k]]

        scored_docs: List[Tuple[float, Dict[str, Any]]] = []
        for doc in self.data:
            content_tokens = self._tokenize(doc["page_content"])
            if not content_tokens:
                continue
            
            # Count matching tokens and calculate overlap coefficient
            matches = sum(1 for tok in query_tokens if tok in content_tokens)
            # Give higher weight to tokens matching in exact order or frequency
            score = matches / (len(query_tokens) + 1.0)
            
            # Simple TF-IDF matching boost
            for tok in query_tokens:
                if tok in doc["page_content"].lower():
                    score += 0.05
            
            if score > 0:
                scored_docs.append((score, doc))

        # Sort descending by score
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        top_k = scored_docs[:k]
        
        return [
            Document(page_content=item[1]["page_content"], metadata=item[1]["metadata"])
            for item in top_k
        ]


class ChromaDBService:
    def __init__(self):
        self.db_dir = settings.CHROMA_DB_DIR
        self.fallback_db_path = os.path.join(settings.DATA_DIR, "fallback_vector_db.json")
        self.use_fallback = not CHROMA_AVAILABLE
        self.embeddings = None
        self.chroma_client = None
        self.collection = None
        self.fallback_store = None

        if not self.use_fallback:
            try:
                # Try to load HuggingFace Embeddings
                logger.info("Initializing HuggingFace Embeddings (all-MiniLM-L6-v2)...")
                self.embeddings = HuggingFaceEmbeddings(
                    model_name="all-MiniLM-L6-v2",
                    model_kwargs={"device": "cpu"}
                )
                
                # Setup Chroma Client
                logger.info(f"Initializing ChromaDB Client at {self.db_dir}...")
                self.chroma_client = chromadb.PersistentClient(
                    path=self.db_dir,
                    settings=ChromaSettings(anonymized_telemetry=False)
                )
                self.collection = self.chroma_client.get_or_create_collection(
                    name="omc_documents"
                )
                logger.info("ChromaDB Service initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize ChromaDB or HuggingFace: {e}. Falling back to LocalJSONVectorStore.")
                self.use_fallback = True

        if self.use_fallback:
            logger.info("Initializing Fallback LocalJSONVectorStore.")
            self.fallback_store = FallbackVectorStore(self.fallback_db_path)

    def add_documents(self, documents: List[Document]):
        """Indexes documents in Chroma or fallback database."""
        if not documents:
            return
            
        if self.use_fallback:
            self.fallback_store.add_documents(documents)
            return

        # Prepare for Chroma
        ids = [f"{doc.metadata.get('source')}_{doc.metadata.get('chunk_id')}" for doc in documents]
        texts = [doc.page_content for doc in documents]
        metadatas = [doc.metadata for doc in documents]
        
        # Generate embeddings
        try:
            embeddings_list = self.embeddings.embed_documents(texts)
            self.collection.add(
                ids=ids,
                documents=texts,
                embeddings=embeddings_list,
                metadatas=metadatas
            )
            logger.info(f"Successfully added {len(documents)} chunks to ChromaDB collection.")
        except Exception as e:
            logger.error(f"Error adding documents to ChromaDB: {e}. Attempting fallback save.")
            # Sync to fallback if Chroma fails mid-way
            if not self.fallback_store:
                self.fallback_store = FallbackVectorStore(self.fallback_db_path)
            self.fallback_store.add_documents(documents)
            self.use_fallback = True

    def search(self, query: str, limit: int = 4) -> List[Document]:
        """Searches documents matching the query."""
        if self.use_fallback:
            return self.fallback_store.similarity_search(query, k=limit)

        try:
            query_embedding = self.embeddings.embed_query(query)
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=limit
            )
            
            # Parse Chroma results back to LangChain Documents
            documents = []
            if results and results.get("documents") and len(results["documents"]) > 0:
                docs = results["documents"][0]
                metadatas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
                for doc_text, meta in zip(docs, metadatas):
                    documents.append(Document(page_content=doc_text, metadata=meta))
            return documents
        except Exception as e:
            logger.error(f"Error during ChromaDB similarity query: {e}. Switching to fallback database search.")
            if not self.fallback_store:
                self.fallback_store = FallbackVectorStore(self.fallback_db_path)
            return self.fallback_store.similarity_search(query, k=limit)

    def delete_document(self, filename: str):
        """Removes all indexed chunks associated with the filename."""
        if self.use_fallback:
            self.fallback_store.delete_by_source(filename)
            return

        try:
            # Query documents by source metadata to find matching IDs
            # chroma collection.delete supports where metadata matches
            self.collection.delete(
                where={"source": filename}
            )
            logger.info(f"Deleted {filename} from ChromaDB collection.")
        except Exception as e:
            logger.error(f"Error deleting {filename} from ChromaDB: {e}. Trying fallback deletion.")
            if not self.fallback_store:
                self.fallback_store = FallbackVectorStore(self.fallback_db_path)
            self.fallback_store.delete_by_source(filename)

# Singleton Instance
vector_db_service = ChromaDBService()
