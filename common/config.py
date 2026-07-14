from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    llm_provider: Literal["claude", "ollama"] = "claude"
    anthropic_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    target_llm_provider: Literal["claude", "ollama"] = "ollama"
    target_claude_model: str = "claude-opus-4-7"
    target_ollama_base_url: str = "http://localhost:11434"
    target_ollama_model: str = "llama3.2"
    target_url: str = "http://localhost:8001"
    ollama_read_timeout: float = 300.0   # seconds; increase for large/slow models

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
