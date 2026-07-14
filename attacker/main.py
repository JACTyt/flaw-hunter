import json
import asyncio
import os
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, SQLModel, create_engine, select
from pydantic import BaseModel
from attacker.models import Campaign, Attack, Result, CampaignStatus, Report
from attacker.loop import run_campaign
from common.llm_client import get_llm_client

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./flaw_hunter.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

_campaign_events: dict[int, list[dict]] = {}
_stop_flags: dict[int, bool] = {}
_batch_analysis: dict[int, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    yield


app = FastAPI(title="Flaw Hunter", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def campaign_to_dict(c: Campaign) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "target_url": c.target_url,
        "attack_types": json.loads(c.attack_types),
        "status": c.status,
        "max_rounds": c.max_rounds,
        "max_retries": c.max_retries,
        "created_at": c.created_at,
        "completed_at": c.completed_at,
    }


class CreateCampaignRequest(BaseModel):
    name: str
    target_url: str = "http://localhost:8001"
    attack_types: list[str]
    max_rounds: int = 5
    max_retries: int = 3


class UpdateCampaignRequest(BaseModel):
    name: Optional[str] = None
    target_url: Optional[str] = None
    attack_types: Optional[list[str]] = None
    max_rounds: Optional[int] = None
    max_retries: Optional[int] = None


@app.post("/campaigns")
def create_campaign(req: CreateCampaignRequest):
    with Session(engine) as session:
        campaign = Campaign(name=req.name, target_url=req.target_url,
                            attack_types=json.dumps(req.attack_types),
                            max_rounds=req.max_rounds, max_retries=req.max_retries)
        session.add(campaign)
        session.commit()
        session.refresh(campaign)
        return campaign_to_dict(campaign)


@app.get("/campaigns")
def list_campaigns():
    with Session(engine) as session:
        campaigns = session.execute(select(Campaign).order_by(Campaign.created_at.desc())).scalars().all()
        return [campaign_to_dict(c) for c in campaigns]


@app.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: int):
    with Session(engine) as session:
        campaign = session.get(Campaign, campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return campaign_to_dict(campaign)


@app.patch("/campaigns/{campaign_id}")
def update_campaign(campaign_id: int, req: UpdateCampaignRequest):
    with Session(engine) as session:
        campaign = session.get(Campaign, campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        if campaign.status == CampaignStatus.running:
            raise HTTPException(status_code=400, detail="Cannot edit a running campaign")
        if req.name is not None:
            campaign.name = req.name
        if req.target_url is not None:
            campaign.target_url = req.target_url
        if req.attack_types is not None:
            campaign.attack_types = json.dumps(req.attack_types)
        if req.max_rounds is not None:
            campaign.max_rounds = req.max_rounds
        if req.max_retries is not None:
            campaign.max_retries = req.max_retries
        session.add(campaign)
        session.commit()
        session.refresh(campaign)
        return campaign_to_dict(campaign)


@app.delete("/campaigns/{campaign_id}")
def delete_campaign(campaign_id: int):
    with Session(engine) as session:
        campaign = session.get(Campaign, campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        if campaign.status == CampaignStatus.running:
            raise HTTPException(status_code=400, detail="Stop the campaign before deleting")
        attacks = session.execute(select(Attack).where(Attack.campaign_id == campaign_id)).scalars().all()
        for attack in attacks:
            for result in session.execute(select(Result).where(Result.attack_id == attack.id)).scalars().all():
                session.delete(result)
            session.delete(attack)
        for report in session.execute(select(Report).where(Report.campaign_id == campaign_id)).scalars().all():
            session.delete(report)
        session.delete(campaign)
        session.commit()
    _campaign_events.pop(campaign_id, None)
    _stop_flags.pop(campaign_id, None)
    return {"status": "deleted"}


@app.post("/campaigns/{campaign_id}/start")
def start_campaign(campaign_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        campaign = session.get(Campaign, campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        if campaign.status != CampaignStatus.pending:
            raise HTTPException(status_code=400, detail="Only pending campaigns can be started")
        campaign.status = CampaignStatus.running
        session.add(campaign)
        session.commit()
    _stop_flags[campaign_id] = False
    _campaign_events[campaign_id] = []
    background_tasks.add_task(_run_in_thread, campaign_id)
    return {"status": "started"}


@app.post("/campaigns/{campaign_id}/stop")
def stop_campaign(campaign_id: int):
    _stop_flags[campaign_id] = True
    with Session(engine) as session:
        campaign = session.get(Campaign, campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        campaign.status = CampaignStatus.stopped
        session.add(campaign)
        session.commit()
        return {"status": "stopped"}


@app.post("/campaigns/{campaign_id}/restart")
def restart_campaign(campaign_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        campaign = session.get(Campaign, campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        if campaign.status == CampaignStatus.running:
            raise HTTPException(status_code=400, detail="Campaign is already running")
        campaign.status = CampaignStatus.running
        campaign.completed_at = None
        session.add(campaign)
        session.commit()
    _stop_flags[campaign_id] = False
    _campaign_events[campaign_id] = []
    background_tasks.add_task(_run_in_thread, campaign_id)
    return {"status": "restarted"}


def _run_in_thread(campaign_id: int) -> None:
    def emit(event: dict) -> None:
        _campaign_events.setdefault(campaign_id, []).append(event)
    def should_stop() -> bool:
        return _stop_flags.get(campaign_id, False)
    try:
        with Session(engine) as session:
            campaign = session.get(Campaign, campaign_id)
            if campaign:
                run_campaign(campaign, session, emit, should_stop)
    except Exception as exc:
        # Unexpected crash — mark campaign failed so it doesn't stay stuck in 'running'
        emit({"campaign_id": campaign_id, "attack_type": "", "round": 0, "attempt": 0,
              "payload": "", "response": f"{type(exc).__name__}: {exc}",
              "success": False, "evidence": "Campaign crashed unexpectedly",
              "severity": "info", "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
              "error": True})
        with Session(engine) as session:
            campaign = session.get(Campaign, campaign_id)
            if campaign and campaign.status == CampaignStatus.running:
                campaign.status = CampaignStatus.failed
                session.add(campaign)
                session.commit()


def _run_batch_analysis(campaign_id: int) -> None:
    from attacker.analyzer import analyze
    from attacker.executor import RawResult

    state = _batch_analysis[campaign_id]
    llm = get_llm_client()

    try:
        with Session(engine) as session:
            attacks = session.execute(
                select(Attack).where(Attack.campaign_id == campaign_id).order_by(Attack.executed_at)
            ).scalars().all()

            state["total"] = len(attacks)

            for attack in attacks:
                existing = session.execute(
                    select(Result).where(Result.attack_id == attack.id)
                ).scalars().first()

                if not existing:
                    state["completed"] += 1
                    continue

                raw = RawResult(attack_payload=attack.payload, response_text=existing.raw_response,
                                tool_calls=[], latency_ms=0, status_code=200)
                try:
                    analysis = analyze(raw, attack.attack_type, llm)
                    existing.success = analysis.success
                    existing.evidence = analysis.evidence
                    existing.confidence = analysis.confidence
                    existing.severity = analysis.severity
                    session.add(existing)
                    session.commit()
                    state["results"].append({
                        "attack_type": attack.attack_type,
                        "round": attack.round,
                        "attempt": attack.attempt,
                        "success": analysis.success,
                        "severity": analysis.severity,
                        "evidence": analysis.evidence,
                    })
                except Exception as exc:
                    state["results"].append({
                        "attack_type": attack.attack_type,
                        "round": attack.round,
                        "attempt": attack.attempt,
                        "error": str(exc),
                    })

                state["completed"] += 1
    except Exception as exc:
        state["error"] = str(exc)
    finally:
        state["status"] = "done"


@app.post("/campaigns/{campaign_id}/attacks/analyze-all")
def start_batch_analysis(campaign_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        campaign = session.get(Campaign, campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        if campaign.status == CampaignStatus.running:
            raise HTTPException(status_code=400, detail="Campaign is still running")
    if _batch_analysis.get(campaign_id, {}).get("status") == "running":
        raise HTTPException(status_code=400, detail="Batch analysis already in progress")
    _batch_analysis[campaign_id] = {"status": "running", "total": 0, "completed": 0, "results": []}
    background_tasks.add_task(_run_batch_analysis, campaign_id)
    return {"status": "started"}


@app.get("/campaigns/{campaign_id}/attacks/analyze-all")
def get_batch_analysis_status(campaign_id: int):
    return _batch_analysis.get(campaign_id, {"status": "idle", "total": 0, "completed": 0, "results": []})


class AnalyzeAttackRequest(BaseModel):
    payload: str
    response: str
    attack_type: str


@app.post("/attacks/analyze")
def analyze_attack_endpoint(req: AnalyzeAttackRequest):
    from attacker.analyzer import analyze
    from attacker.executor import RawResult  # local to avoid circular import
    llm = get_llm_client()
    raw = RawResult(attack_payload=req.payload, response_text=req.response,
                    tool_calls=[], latency_ms=0, status_code=200)
    try:
        result = analyze(raw, req.attack_type, llm)
        return {
            "success": result.success,
            "evidence": result.evidence,
            "confidence": result.confidence,
            "severity": result.severity,
            "failure_reason": result.failure_reason,
            "vulnerability_type": result.vulnerability_type,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.delete("/campaigns/{campaign_id}/attacks")
def clear_campaign_attacks(campaign_id: int):
    with Session(engine) as session:
        campaign = session.get(Campaign, campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        if campaign.status == CampaignStatus.running:
            raise HTTPException(status_code=400, detail="Cannot clear log while campaign is running")
        attacks = session.execute(select(Attack).where(Attack.campaign_id == campaign_id)).scalars().all()
        for attack in attacks:
            for result in session.execute(select(Result).where(Result.attack_id == attack.id)).scalars().all():
                session.delete(result)
            session.delete(attack)
        session.commit()
    _campaign_events.pop(campaign_id, None)
    return {"cleared": True}


@app.get("/campaigns/{campaign_id}/attacks")
def get_campaign_attacks(campaign_id: int):
    with Session(engine) as session:
        attacks = session.execute(
            select(Attack).where(Attack.campaign_id == campaign_id).order_by(Attack.executed_at)
        ).scalars().all()
        events = []
        for attack in attacks:
            result = session.execute(
                select(Result).where(Result.attack_id == attack.id)
            ).scalars().first()
            events.append({
                "campaign_id": campaign_id,
                "attack_type": attack.attack_type,
                "round": attack.round,
                "attempt": attack.attempt,
                "payload": attack.payload,
                "response": result.raw_response if result else "",
                "success": result.success if result else False,
                "evidence": result.evidence if result else "",
                "severity": result.severity if result else "info",
                "confidence": result.confidence if result else 0.0,
                "timestamp": attack.executed_at.isoformat(),
            })
        return events


@app.get("/campaigns/{campaign_id}/report")
def get_report(campaign_id: int):
    with Session(engine) as session:
        reports = session.execute(
            select(Report).where(Report.campaign_id == campaign_id)
        ).scalars().all()
        if not reports:
            raise HTTPException(status_code=404, detail="Report not found")
        return json.loads(reports[-1].summary_json)


@app.websocket("/ws/campaigns/{campaign_id}")
async def campaign_ws(campaign_id: int, websocket: WebSocket):
    await websocket.accept()
    sent_count = 0
    try:
        while True:
            events = _campaign_events.get(campaign_id, [])
            if len(events) > sent_count:
                for event in events[sent_count:]:
                    await websocket.send_json(event)
                sent_count = len(events)
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        pass
