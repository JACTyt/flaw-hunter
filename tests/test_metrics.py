from evaluation.metrics import compute_metrics
from evaluation.scorer import severity_score
from attacker.memory import AttackRecord
from attacker.executor import RawResult
from attacker.analyzer import AnalysisResult


def _rec(attack_type, success, severity="info"):
    raw = RawResult("p", "r", [], 50.0, 200)
    analysis = AnalysisResult(success, "ev", 0.8, severity, "", attack_type)
    return AttackRecord(attack_type, "p", 0, 0, raw, analysis)


def test_exploit_success_rate():
    assert compute_metrics([_rec("pi", True), _rec("pi", False)])["exploit_success_rate"] == 0.5


def test_coverage():
    assert compute_metrics([_rec("pi", True), _rec("de", False)])["coverage"] == 0.5


def test_severity_distribution():
    dist = compute_metrics([_rec("pi", True, "high"), _rec("de", True, "critical")])["severity_distribution"]
    assert dist["high"] == 1 and dist["critical"] == 1


def test_severity_score_ordering():
    assert severity_score("critical") > severity_score("high") > severity_score("medium")
    assert severity_score("low") > severity_score("info")
