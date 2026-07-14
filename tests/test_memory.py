from attacker.memory import CampaignMemory, AttackRecord
from attacker.executor import RawResult
from attacker.analyzer import AnalysisResult


def _record(attack_type="prompt_injection", success=False):
    raw = RawResult("payload", "response", [], 100.0, 200)
    analysis = AnalysisResult(success, "ev", 0.8, "high", "", attack_type)
    return AttackRecord(attack_type, "payload", 0, 0, raw, analysis)


def test_stores_records():
    mem = CampaignMemory()
    mem.add(_record())
    assert len(mem.all_records()) == 1


def test_tracks_failed_payloads():
    mem = CampaignMemory()
    mem.add(_record(success=False))
    mem.add(_record(success=True))
    assert len(mem.failed_payloads("prompt_injection")) == 1


def test_returns_successes():
    mem = CampaignMemory()
    mem.add(_record("prompt_injection", False))
    mem.add(_record("data_exfiltration", True))
    assert len(mem.successes()) == 1 and mem.successes()[0].attack_type == "data_exfiltration"
