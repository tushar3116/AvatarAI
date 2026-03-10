"""
Configuration management using Pydantic Settings.
Loads all API keys and paths from environment variables.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # OpenAI
    OPENAI_API_KEY: str = ""

    # ElevenLabs
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = "21m00Tcm4TlvDq8ikWAM"  # Default: Rachel

    # Simli
    SIMLI_API_KEY: str = ""
    SIMLI_FACE_ID: str = ""

    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./data/chroma_db"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
