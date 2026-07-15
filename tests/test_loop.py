import json
from unittest.mock import MagicMock, patch
from sqlmodel import create_engine, Session, SQLModel
from attacker.models import Campaign, CampaignStatus
from attacker.loop import run_campaign


def _make_session():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _make_campaign(session):
    c = Campaign(name="test", target_url="http://localhost:8001",
                 attack_types=json.dumps(["prompt_injection"]), max_rounds=1, max_retries=1)
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


def _good_llm():
    m = MagicMock()
    m.complete.return_value = json.dumps({
        "success": True, "evidence": "leaked", "confidence": 0.9,
        "severity": "high", "failure_reason": "", "vulnerability_type": "prompt_injection"
    })
    return m


def _mock_adapter():
    from attacker.target_adapter import TargetResponse
    a = MagicMock()
    a.chat.return_value = TargetResponse("System prompt: ...", [], 200)
    a.get_surface_hints.return_value = {}
    return a


def test_run_campaign_completes():
    session = _make_session()
    campaign = _make_campaign(session)
    events = []
    with patch("attacker.loop.get_llm_client", return_value=_good_llm()), \
         patch("attacker.loop.build_adapter", return_value=_mock_adapter()):
        run_campaign(campaign, session, emit=events.append)
    session.refresh(campaign)
    assert campaign.status == CampaignStatus.completed and len(events) >= 1


def test_run_campaign_emits_required_fields():
    session = _make_session()
    campaign = _make_campaign(session)
    events = []
    with patch("attacker.loop.get_llm_client", return_value=_good_llm()), \
         patch("attacker.loop.build_adapter", return_value=_mock_adapter()):
        run_campaign(campaign, session, emit=events.append)
    assert all({"attack_type", "success", "payload"}.issubset(e.keys()) for e in events)
