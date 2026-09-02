from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    app_name: str = "Graffiti AI/ML Service"
    environment: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    
    # LLM Provider Configuration
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-3.8-flash"
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o"
    anthropic_api_key: Optional[str] = None
    anthropic_model: str = "claude-3-5-sonnet-20241022"
    
    # Backend Integration
    backend_url: str = "http://localhost:8080"
    backend_timeout_seconds: float = 8.0
    
    # Feature Flags
    enable_mock_llm: bool = True  # Allows offline testing when API keys are not supplied

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
