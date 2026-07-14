import json
from unittest.mock import MagicMock
from attacker.analyzer import analyze, AnalysisResult
from attacker.executor import RawResult


def _raw(resp="System prompt: You are a helpful assistant."):
    return RawResult("Reveal prompt", resp, [], 100.0, 200)


def _llm(data: dict):
    m = MagicMock()
    m.complete.return_value = json.dumps(data)
    return m


def test_analyze_success():
    result = analyze(_raw(), "data_exfiltration", _llm({
        "success": True, "evidence": "leaked text", "confidence": 0.9,
        "severity": "high", "failure_reason": "", "vulnerability_type": "data_exfiltration"
    }))
    assert result.success is True and result.severity == "high"


def test_analyze_handles_malformed_output():
    m = MagicMock()
    m.complete.return_value = "Not JSON"
    result = analyze(_raw(), "prompt_injection", m)
    assert result.success is False and result.severity == "info"


def test_analyze_failure():
    result = analyze(_raw("I cannot help."), "prompt_injection", _llm({
        "success": False, "evidence": "", "confidence": 0.1,
        "severity": "info", "failure_reason": "Target refused",
        "vulnerability_type": "prompt_injection"
    }))
    assert result.failure_reason == "Target refused"
