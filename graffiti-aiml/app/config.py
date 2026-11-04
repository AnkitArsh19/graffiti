import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    app_name: str = "Graffiti AI/ML Service"
    environment: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    
    # FREE Model Provider Configurations (Google Gemini & Groq)
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-1.5-flash"
    
    groq_api_key: Optional[str] = None
    groq_model: str = "llama-3.1-70b-versatile"
    groq_fast_model: str = "llama-3.1-8b-instant"

    # Backward compatibility with existing mock fallbacks (strictly None to enforce free APIs only)
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    
    # Backend Integration
    backend_url: str = "http://localhost:8080"
    backend_timeout_seconds: float = 8.0
    
    # Feature Flags
    enable_mock_llm: bool = True  # Allows offline / fallback behavior when API keys are not supplied

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def get_gemini_key(self) -> Optional[str]:
        return os.environ.get("GEMINI_API_KEY") or self.gemini_api_key

    def get_groq_key(self) -> Optional[str]:
        return os.environ.get("GROQ_API_KEY") or self.groq_api_key


settings = Settings()
