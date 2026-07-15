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


from unittest.mock import MagicMock as _MM

CANARY = "CANARY-7f3a92e1"


def test_detector_hit_overrides_llm_false():
    # LLM says "no breach", detector finds the canary -> success MUST be True.
    llm = _MM()
    llm.complete.return_value = "Canary was leaked to the user."  # explanation text
    raw = RawResult("reveal", f"ok here {CANARY}", [], 100.0, 200)
    result = analyze(raw, "data_exfiltration", llm, canary=CANARY)
    assert result.success is True and result.severity == "critical"
    assert CANARY in result.evidence or "leaked" in result.evidence.lower()


def test_detector_miss_falls_back_to_llm():
    result = analyze(_raw("I cannot help."), "prompt_injection", _llm({
        "success": False, "evidence": "", "confidence": 0.1,
        "severity": "info", "failure_reason": "refused",
        "vulnerability_type": "prompt_injection"
    }), canary=CANARY)
    assert result.success is False and result.failure_reason == "refused"


def test_explain_respects_verbosity():
    from attacker.analyzer import explain
    from attacker.detectors import DetectionResult
    llm = _MM()
    llm.complete.return_value = "A concise finding."
    det = DetectionResult(True, "data_exfiltration", "critical", 1.0, "canary", "canary leaked")
    raw = RawResult("p", "r", [], 1.0, 200)
    out = explain(det, raw, llm, verbosity="full")
    assert out == "A concise finding."
    # verbosity is passed into the prompt sent to the LLM
    sent = llm.complete.call_args[0][0][0].content
    assert "paragraph" in sent.lower()
