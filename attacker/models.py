from __future__ import annotations
from datetime import datetime, UTC
from typing import Optional
from enum import Enum
from sqlmodel import Field, SQLModel


class CampaignStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    stopped = "stopped"
    failed = "failed"


class Campaign(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    target_url: str
    attack_types: str   # JSON list[str]
    status: CampaignStatus = CampaignStatus.pending
    max_rounds: int = 5
    max_retries: int = 3
    explanation_verbosity: str = "concise"
    target_profile: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: Optional[datetime] = None


class Attack(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    campaign_id: int = Field(foreign_key="campaign.id")
    attack_type: str
    payload: str
    round: int
    attempt: int
    executed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Result(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    attack_id: int = Field(foreign_key="attack.id")
    success: bool = False
    evidence: str = ""
    confidence: float = 0.0
    severity: str = "info"
    raw_response: str = ""
    analyzed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Report(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    campaign_id: int = Field(foreign_key="campaign.id")
    summary_json: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
