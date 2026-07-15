import json
import os
import re
from dataclasses import dataclass
from typing import Any, Optional, Protocol, runtime_checkable
import httpx
from pydantic import BaseModel

_ENV_RE = re.compile(r"\$\{([^}]+)\}")


def resolve_env(value: str) -> str:
    return _ENV_RE.sub(lambda m: os.environ.get(m.group(1), ""), value)


def substitute_message(template: Any, message: str) -> Any:
    if isinstance(template, dict):
        return {k: substitute_message(v, message) for k, v in template.items()}
    if isinstance(template, list):
        return [substitute_message(v, message) for v in template]
    if template == "{message}":
        return message
    return template


def get_path(obj: Any, path: str) -> Any:
    cur = obj
    for seg in path.split("."):
        if isinstance(cur, dict):
            if seg not in cur:
                return ""
            cur = cur[seg]
        elif isinstance(cur, list):
            try:
                cur = cur[int(seg)]
            except (ValueError, IndexError):
                return ""
        else:
            return ""
    return cur


@dataclass
class TargetResponse:
    text: str
    tool_calls: list[dict]
    status_code: int


@runtime_checkable
class TargetAdapter(Protocol):
    def chat(self, message: str) -> "TargetResponse": ...
    def get_surface_hints(self) -> dict: ...


class LocalChatAdapter:
    def __init__(self, base_url: str, timeout: float = 300.0):
        self._client = httpx.Client(base_url=base_url, timeout=timeout)

    def chat(self, message: str) -> TargetResponse:
        response = self._client.post("/chat", json={"message": message})
        data = response.json()
        return TargetResponse(
            text=data.get("response", ""),
            tool_calls=data.get("tool_calls", []),
            status_code=response.status_code,
        )

    def get_surface_hints(self) -> dict:
        try:
            return self._client.get("/config").json()
        except Exception:
            return {}


class TargetProfile(BaseModel):
    method: str = "POST"
    url: str
    headers: dict[str, str] = {}
    body_template: dict
    response_path: str
    tool_calls_path: Optional[str] = None
    timeout: float = 60.0


class GenericHTTPAdapter:
    def __init__(self, profile: TargetProfile):
        self._p = profile

    def _fetch(self, message: str):
        headers = {k: resolve_env(v) for k, v in self._p.headers.items()}
        body = substitute_message(self._p.body_template, message)
        try:
            resp = httpx.request(self._p.method, self._p.url, json=body,
                                 headers=headers, timeout=self._p.timeout)
        except httpx.HTTPError as e:
            return 0, f"{type(e).__name__}: {e}", None
        try:
            return resp.status_code, resp.text, resp.json()
        except (json.JSONDecodeError, ValueError):
            return resp.status_code, resp.text, None

    def chat(self, message: str) -> TargetResponse:
        status, raw, data = self._fetch(message)
        if data is None:
            return TargetResponse(text=raw, tool_calls=[], status_code=status)
        text = str(get_path(data, self._p.response_path))
        tools = get_path(data, self._p.tool_calls_path) if self._p.tool_calls_path else []
        return TargetResponse(text=text, tool_calls=tools if isinstance(tools, list) else [],
                              status_code=status)

    def probe(self, message: str) -> dict:
        status, raw, data = self._fetch(message)
        extracted = raw if data is None else str(get_path(data, self._p.response_path))
        return {"status_code": status, "raw_response": raw, "extracted_reply": extracted}

    def get_surface_hints(self) -> dict:
        return {}


def build_adapter(campaign) -> TargetAdapter:
    profile_json = getattr(campaign, "target_profile", None)
    if profile_json:
        return GenericHTTPAdapter(TargetProfile(**json.loads(profile_json)))
    return LocalChatAdapter(base_url=campaign.target_url)
