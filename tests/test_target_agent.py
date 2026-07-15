import json
from unittest.mock import MagicMock, patch


def _make_llm(responses):
    m = MagicMock()
    m.complete.side_effect = responses
    return m


def test_agent_returns_text_response():
    with patch("target_system.agent.get_target_llm_client", return_value=_make_llm(["Hello!"])):
        from target_system.agent import run_agent
        result = run_agent("Hi there")
        assert "response" in result and "tool_calls" in result


def test_agent_runs_tool_call():
    tool_json = json.dumps({"tool": "search", "args": {"query": "test"}})
    import target_system.agent as m
    with patch("target_system.agent.get_target_llm_client", return_value=_make_llm([tool_json, "Results."])):
        result = m.run_agent("Search for test")
        assert len(result["tool_calls"]) == 1
        assert result["tool_calls"][0]["tool"] == "search"


def test_system_prompt_contains_canary():
    from target_system import agent
    from common.config import settings
    assert settings.canary in agent.SYSTEM_PROMPT
