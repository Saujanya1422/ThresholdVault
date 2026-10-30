import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ThresholdVault"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # In production this would be loaded from secure HSM/Secret Manager
    SECRET_KEY: str = os.getenv("TV_SECRET_KEY", "threshold-vault-demo-jwt-secret-key-super-secure-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    
    # SQLite local DB for development prototype
    DATABASE_URL: str = os.getenv("TV_DATABASE_URL", "sqlite:///./threshold_vault.db")
    
    # Key used exclusively for AES-GCM encryption-at-rest of stored shares (simulating HSM custody)
    STORAGE_MASTER_KEY: str = os.getenv("TV_STORAGE_MASTER_KEY", "TV_HSM_MKEY_6fa8b931c841df2a8740e6")
    
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    model_config = {"extra": "ignore"}

settings = Settings()
