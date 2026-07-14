import json
from target_system.tools import search, send_email, TOOLS


def test_search_returns_string():
    result = search("security testing")
    assert isinstance(result, str) and "security testing" in result


def test_send_email_logs_to_file(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "logs").mkdir()
    result = send_email("test@example.com", "Subject", "Body")
    assert "test@example.com" in result
    entry = json.loads((tmp_path / "logs" / "emails.jsonl").read_text().strip())
    assert entry["to"] == "test@example.com"


def test_tools_dict_keys():
    assert "search" in TOOLS and "send_email" in TOOLS
