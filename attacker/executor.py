import time
from dataclasses import dataclass
from attacker.target_adapter import TargetAdapter


@dataclass
class RawResult:
    attack_payload: str
    response_text: str
    tool_calls: list[dict]
    latency_ms: float
    status_code: int


def execute(payload: str, adapter: TargetAdapter) -> RawResult:
    start = time.monotonic()
    response = adapter.chat(payload)
    return RawResult(
        attack_payload=payload,
        response_text=response.text,
        tool_calls=response.tool_calls,
        latency_ms=(time.monotonic() - start) * 1000,
        status_code=response.status_code,
    )
