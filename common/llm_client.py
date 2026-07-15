from dataclasses import dataclass
from typing import Protocol, runtime_checkable
import httpx


@dataclass
class Message:
    role: str
    content: str


@runtime_checkable
class LLMClient(Protocol):
    def complete(self, messages: list[Message], system: str = "") -> str: ...


class ClaudeClient:
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6"):
        import anthropic
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def complete(self, messages: list[Message], system: str = "") -> str:
        response = self._client.messages.create(
            model=self._model, max_tokens=2048, system=system,
            messages=[{"role": m.role, "content": m.content} for m in messages],
        )
        return response.content[0].text


class OllamaClient:
    def __init__(self, base_url: str, model: str, read_timeout: float = 300.0,
                 num_predict: int = 256):
        # Short connect timeout so we fail fast if Ollama isn't running.
        # Read timeout prevents indefinite hang when Ollama is unloading/reloading a model.
        self._client = httpx.Client(
            base_url=base_url,
            timeout=httpx.Timeout(connect=10.0, read=read_timeout, write=None, pool=None),
        )
        self._model = model
        # Bound output length: payloads and JSON verdicts are short. Without a cap,
        # reasoning models (e.g. Qwen3) emit long hidden think-traces and can exceed
        # the read timeout on modest hardware.
        self._num_predict = num_predict

    def complete(self, messages: list[Message], system: str = "") -> str:
        payload = {
            "model": self._model,
            "messages": [{"role": "system", "content": system}]
                        + [{"role": m.role, "content": m.content} for m in messages],
            "stream": False,
            "think": False,
            "options": {"num_predict": self._num_predict},
        }
        response = self._client.post("/api/chat", json=payload)
        # Reasoning-capable models accept "think"; older/non-thinking models 400 on it.
        # Retry without the flag so the client works across model families.
        if response.status_code == 400:
            payload.pop("think", None)
            response = self._client.post("/api/chat", json=payload)
        response.raise_for_status()
        return response.json()["message"]["content"]


def get_llm_client() -> LLMClient:
    from common.config import settings
    if settings.llm_provider == "claude":
        return ClaudeClient(api_key=settings.anthropic_api_key)
    return OllamaClient(base_url=settings.ollama_base_url, model=settings.ollama_model,
                        read_timeout=settings.ollama_read_timeout)


def get_target_llm_client() -> LLMClient:
    from common.config import settings
    if settings.target_llm_provider == "claude":
        return ClaudeClient(api_key=settings.anthropic_api_key, model=settings.target_claude_model)
    return OllamaClient(base_url=settings.target_ollama_base_url, model=settings.target_ollama_model,
                        read_timeout=settings.ollama_read_timeout)
