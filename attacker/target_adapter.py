from dataclasses import dataclass
import httpx


@dataclass
class TargetResponse:
    text: str
    tool_calls: list[dict]
    status_code: int


class TargetAdapter:
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
