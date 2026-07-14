import httpx
import respx
from attacker.target_adapter import TargetAdapter, TargetResponse

BASE = "http://localhost:8001"


@respx.mock
def test_chat_returns_target_response():
    respx.post(f"{BASE}/chat").mock(return_value=httpx.Response(
        200, json={"response": "Hello attacker", "tool_calls": []}
    ))
    result = TargetAdapter(base_url=BASE).chat("Hello")
    assert isinstance(result, TargetResponse) and result.text == "Hello attacker"


@respx.mock
def test_get_surface_hints_returns_dict():
    respx.get(f"{BASE}/config").mock(return_value=httpx.Response(
        200, json={"llm_provider": "claude"}
    ))
    assert TargetAdapter(base_url=BASE).get_surface_hints()["llm_provider"] == "claude"


@respx.mock
def test_get_surface_hints_handles_failure():
    respx.get(f"{BASE}/config").mock(side_effect=httpx.ConnectError("refused"))
    assert TargetAdapter(base_url=BASE).get_surface_hints() == {}
