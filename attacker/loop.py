import json
import threading
from dataclasses import dataclass, asdict, field
from datetime import datetime, UTC
from typing import Callable, TypeVar
from sqlmodel import Session

from attacker.attack_generator import generate, refine
from attacker.executor import execute
from attacker.analyzer import analyze, generate_campaign_analysis
from attacker.memory import CampaignMemory, AttackRecord
from attacker.recon import recon
from attacker.target_adapter import build_adapter
from attacker.models import Campaign, Attack as DBAttack, Result, Report, CampaignStatus
from common.llm_client import get_llm_client
from common.config import settings as cfg
from evaluation.metrics import compute_metrics

T = TypeVar("T")


class _StopRequested(Exception):
    pass


def _call(fn: Callable[[], T], should_stop: Callable[[], bool], poll: float = 0.5) -> T:
    """Run fn() in a daemon thread; raise _StopRequested within `poll` seconds of stop flag."""
    if should_stop():
        raise _StopRequested()

    result_box: list = [None]
    exc_box: list = [None]
    done = threading.Event()

    def worker() -> None:
        try:
            result_box[0] = fn()
        except Exception as e:
            exc_box[0] = e
        finally:
            done.set()

    t = threading.Thread(target=worker, daemon=True)
    t.start()

    while not done.wait(timeout=poll):
        if should_stop():
            raise _StopRequested()

    if exc_box[0] is not None:
        raise exc_box[0]
    return result_box[0]


@dataclass
class CampaignEvent:
    campaign_id: int
    attack_type: str
    round: int
    attempt: int
    payload: str
    response: str
    success: bool
    evidence: str
    severity: str
    timestamp: str
    error: bool = field(default=False)


_RECS = {
    "prompt_injection": "Add system-level guardrails rejecting instruction-override attempts.",
    "goal_hijacking": "Enforce goal immutability; validate agent intent before each action.",
    "tool_misuse": "Implement tool call allowlists and parameter validation.",
    "data_exfiltration": "Filter outputs for system prompt content; add redaction middleware.",
}


def _error_event(campaign_id: int, attack_type: str, round_num: int, attempt: int, exc: Exception) -> dict:
    return asdict(CampaignEvent(
        campaign_id=campaign_id, attack_type=attack_type,
        round=round_num, attempt=attempt, payload="",
        response=f"{type(exc).__name__}: {exc}",
        success=False, evidence="Attack failed due to LLM/network error",
        severity="info", timestamp=datetime.now(UTC).isoformat(), error=True,
    ))


def run_campaign(
    campaign: Campaign,
    session: Session,
    emit: Callable[[dict], None],
    should_stop: Callable[[], bool] = lambda: False,
) -> None:
    llm = get_llm_client()
    attack_types: list[str] = json.loads(campaign.attack_types)
    adapter = build_adapter(campaign)
    memory = CampaignMemory()
    surface = recon(adapter)

    stopped = False
    for round_num in range(campaign.max_rounds):
        if should_stop():
            stopped = True
            break
        for attack_type in attack_types:
            if should_stop():
                stopped = True
                break

            try:
                attack = _call(lambda: generate(attack_type, surface, llm, round_num), should_stop)
            except _StopRequested:
                stopped = True
                break
            except Exception as exc:
                emit(_error_event(campaign.id, attack_type, round_num, 0, exc))
                continue

            for attempt in range(campaign.max_retries):
                if should_stop():
                    stopped = True
                    break

                try:
                    raw = _call(lambda: execute(attack.payload, adapter), should_stop)
                    analysis = _call(lambda: analyze(raw, attack_type, llm,
                                                     canary=cfg.canary,
                                                     known_prompt=cfg.known_system_prompt,
                                                     verbosity=campaign.explanation_verbosity),
                                     should_stop)
                except _StopRequested:
                    stopped = True
                    break
                except Exception as exc:
                    emit(_error_event(campaign.id, attack_type, round_num, attempt, exc))
                    break

                db_attack = DBAttack(campaign_id=campaign.id, attack_type=attack_type,
                                     payload=attack.payload, round=round_num, attempt=attempt)
                session.add(db_attack)
                session.commit()
                session.refresh(db_attack)

                session.add(Result(attack_id=db_attack.id, success=analysis.success,
                                   evidence=analysis.evidence, confidence=analysis.confidence,
                                   severity=analysis.severity, raw_response=raw.response_text))
                session.commit()

                memory.add(AttackRecord(attack_type, attack.payload, round_num, attempt, raw, analysis))
                emit(asdict(CampaignEvent(
                    campaign_id=campaign.id, attack_type=attack_type,
                    round=round_num, attempt=attempt, payload=attack.payload,
                    response=raw.response_text, success=analysis.success,
                    evidence=analysis.evidence, severity=analysis.severity,
                    timestamp=datetime.now(UTC).isoformat(),
                )))

                if analysis.success:
                    break
                if attempt < campaign.max_retries - 1:
                    try:
                        attack = _call(lambda: refine(attack, analysis.failure_reason, llm), should_stop)
                    except _StopRequested:
                        stopped = True
                        break
                    except Exception:
                        pass
            if stopped:
                break

    metrics = compute_metrics(memory.all_records())
    vulns = [{
        "type": r.analysis.vulnerability_type,
        "severity": r.analysis.severity,
        "evidence": r.analysis.evidence,
        "payload": r.payload,
        "recommendation": _RECS.get(r.analysis.vulnerability_type, "Review and harden the component."),
    } for r in memory.successes()]

    summary = {
        "total_attacks": metrics["total_attacks"],
        "successful": metrics["successful_attacks"],
        "exploit_success_rate": metrics["exploit_success_rate"],
        "coverage": metrics["coverage"],
        "severity_distribution": metrics["severity_distribution"],
    }

    # Commit completion status first so the UI unblocks immediately
    campaign.status = CampaignStatus.stopped if stopped else CampaignStatus.completed
    campaign.completed_at = datetime.now(UTC)
    session.add(campaign)
    session.commit()

    # LLM analysis runs after status is committed (slow/failing here won't block the UI)
    try:
        llm_analysis = _call(lambda: generate_campaign_analysis(vulns, metrics, llm), should_stop)
    except Exception:
        llm_analysis = {
            "breached": len(vulns) > 0,
            "overall_risk": "info",
            "opinion": "LLM analysis unavailable.",
            "key_findings": [],
            "recommendations": [],
        }

    session.add(Report(campaign_id=campaign.id, summary_json=json.dumps({
        "campaign_id": campaign.id,
        "target_url": campaign.target_url,
        "summary": summary,
        "vulnerabilities": vulns,
        "llm_analysis": llm_analysis,
    })))
    session.commit()
