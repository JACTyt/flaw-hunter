from dataclasses import dataclass
from attacker.executor import RawResult
from attacker.analyzer import AnalysisResult


@dataclass
class AttackRecord:
    attack_type: str
    payload: str
    round: int
    attempt: int
    result: RawResult
    analysis: AnalysisResult


class CampaignMemory:
    def __init__(self) -> None:
        self._records: list[AttackRecord] = []

    def add(self, record: AttackRecord) -> None:
        self._records.append(record)

    def failed_payloads(self, attack_type: str) -> list[str]:
        return [r.payload for r in self._records
                if r.attack_type == attack_type and not r.analysis.success]

    def successes(self) -> list[AttackRecord]:
        return [r for r in self._records if r.analysis.success]

    def all_records(self) -> list[AttackRecord]:
        return list(self._records)
