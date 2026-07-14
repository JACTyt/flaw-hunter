from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch


def _llm():
    m = MagicMock()
    m.complete.return_value = "I can help."
    return m


def test_chat_endpoint():
    with patch("target_system.agent.get_llm_client", return_value=_llm()):
        from target_system.main import app
        resp = TestClient(app).post("/chat", json={"message": "Hello"})
        assert resp.status_code == 200 and "response" in resp.json()


def test_config_endpoint_leaks_provider():
    with patch("target_system.agent.get_llm_client", return_value=_llm()):
        from target_system.main import app
        resp = TestClient(app).get("/config")
        assert resp.status_code == 200 and "llm_provider" in resp.json()


def test_tools_search_endpoint():
    with patch("target_system.agent.get_llm_client", return_value=_llm()):
        from target_system.main import app
        resp = TestClient(app).post("/tools/search", params={"query": "test"})
        assert resp.status_code == 200 and "result" in resp.json()


def test_tools_email_endpoint(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "logs").mkdir()
    with patch("target_system.agent.get_llm_client", return_value=_llm()):
        from target_system.main import app
        resp = TestClient(app).post("/tools/email",
            params={"to": "a@b.com", "subject": "Hi", "body": "Msg"})
        assert resp.status_code == 200
