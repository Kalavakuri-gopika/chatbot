import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Odisha Mining Corporation Chatbot POC"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 1 day

    # Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR: str = os.path.join(os.path.dirname(BASE_DIR), "data")

    @property
    def DATABASE_URL(self) -> str:
        db_path = os.path.join(self.DATA_DIR, "omc_chatbot.db")
        return f"sqlite:///{db_path}"

    @property
    def UPLOAD_DIR(self) -> str:
        return os.path.join(self.DATA_DIR, "uploads")

    @property
    def CHROMA_DB_DIR(self) -> str:
        return os.path.join(self.DATA_DIR, "chroma_db")

    # HuggingFace Inference API — configure via Admin Dashboard > Model Configuration
    HUGGINGFACE_HUB_TOKEN: str = os.getenv("HUGGINGFACE_HUB_TOKEN", "")
    HUGGINGFACE_MODEL: str = os.getenv("HUGGINGFACE_MODEL", "")

    class Config:
        case_sensitive = True

settings = Settings()

# Ensure data directories exist on startup
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.CHROMA_DB_DIR, exist_ok=True)
