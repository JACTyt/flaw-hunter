from unittest.mock import MagicMock
from attacker.executor import execute, RawResult
from attacker.target_adapter import TargetResponse


def test_execute_returns_raw_result():
    adapter = MagicMock()
    adapter.chat.return_value = TargetResponse("Response", [], 200)
    result = execute("Attack payload", adapter)
    assert isinstance(result, RawResult) and result.latency_ms >= 0


def test_execute_captures_tool_calls():
    adapter = MagicMock()
    adapter.chat.return_value = TargetResponse(
        "Sending...", [{"tool": "send_email", "args": {"to": "x@y.com"}}], 200)
    result = execute("Send email", adapter)
    assert result.tool_calls[0]["tool"] == "send_email"
