from collections import Counter
from attacker.memory import AttackRecord


def compute_metrics(records: list[AttackRecord]) -> dict:
    if not records:
        return {"exploit_success_rate": 0.0, "coverage": 0.0,
                "total_attacks": 0, "successful_attacks": 0, "severity_distribution": {}}
    total = len(records)
    successful = [r for r in records if r.analysis.success]
    all_types = {r.attack_type for r in records}
    return {
        "total_attacks": total,
        "successful_attacks": len(successful),
        "exploit_success_rate": len(successful) / total,
        "coverage": len({r.attack_type for r in successful}) / len(all_types) if all_types else 0.0,
        "severity_distribution": dict(Counter(r.analysis.severity for r in successful)),
    }
