import importlib
from unittest.mock import MagicMock, patch
import httpx
import respx


def test_message_dataclass():
    from common.llm_client import Message
    msg = Message(role="user", content="hello")
    assert msg.role == "user" and msg.content == "hello"


@respx.mock
def test_ollama_client_complete():
    from common.llm_client import OllamaClient, Message
    respx.post("http://localhost:11434/api/chat").mock(
        return_value=httpx.Response(200, json={"message": {"content": "Hello back"}})
    )
    client = OllamaClient(base_url="http://localhost:11434", model="llama3.2")
    result = client.complete([Message(role="user", content="Hi")], system="Be helpful.")
    assert result == "Hello back"


def test_claude_client_complete():
    from common.llm_client import ClaudeClient, Message
    with patch("anthropic.Anthropic") as MockAnthropic:
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Claude says hi")]
        MockAnthropic.return_value.messages.create.return_value = mock_response
        client = ClaudeClient(api_key="fake-key")
        result = client.complete([Message(role="user", content="Hi")], system="Be helpful.")
        assert result == "Claude says hi"


def test_get_llm_client_returns_ollama(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    import common.config as cfg
    importlib.reload(cfg)
    import common.llm_client as lc
    importlib.reload(lc)
    client = lc.get_llm_client()
    assert isinstance(client, lc.OllamaClient)
