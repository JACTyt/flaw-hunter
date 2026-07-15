import httpx
import respx
from attacker.target_adapter import LocalChatAdapter, TargetResponse

BASE = "http://localhost:8001"


@respx.mock
def test_chat_returns_target_response():
    respx.post(f"{BASE}/chat").mock(return_value=httpx.Response(
        200, json={"response": "Hello attacker", "tool_calls": []}
    ))
    result = LocalChatAdapter(base_url=BASE).chat("Hello")
    assert isinstance(result, TargetResponse) and result.text == "Hello attacker"


@respx.mock
def test_get_surface_hints_returns_dict():
    respx.get(f"{BASE}/config").mock(return_value=httpx.Response(
        200, json={"llm_provider": "claude"}
    ))
    assert LocalChatAdapter(base_url=BASE).get_surface_hints()["llm_provider"] == "claude"


@respx.mock
def test_get_surface_hints_handles_failure():
    respx.get(f"{BASE}/config").mock(side_effect=httpx.ConnectError("refused"))
    assert LocalChatAdapter(base_url=BASE).get_surface_hints() == {}


from attacker.target_adapter import resolve_env, substitute_message, get_path


def test_resolve_env_substitutes(monkeypatch):
    monkeypatch.setenv("TARGET_API_KEY", "secret123")
    assert resolve_env("Bearer ${TARGET_API_KEY}") == "Bearer secret123"


def test_resolve_env_missing_becomes_empty(monkeypatch):
    monkeypatch.delenv("NOPE", raising=False)
    assert resolve_env("x${NOPE}y") == "xy"


def test_substitute_message_replaces_placeholder():
    tmpl = {"model": "x", "messages": [{"role": "user", "content": "{message}"}]}
    out = substitute_message(tmpl, 'he said "hi" }{')
    assert out["messages"][0]["content"] == 'he said "hi" }{'
    # original template is not mutated
    assert tmpl["messages"][0]["content"] == "{message}"


def test_get_path_hits_nested_and_index():
    obj = {"choices": [{"message": {"content": "reply!"}}]}
    assert get_path(obj, "choices.0.message.content") == "reply!"


def test_get_path_missing_returns_empty():
    assert get_path({"a": 1}, "a.b.c") == ""
    assert get_path({"choices": []}, "choices.0.message") == ""


from attacker.target_adapter import TargetProfile, GenericHTTPAdapter

OPENAI = TargetProfile(
    url="https://api.x/v1/chat/completions",
    headers={"Authorization": "Bearer ${K}"},
    body_template={"model": "m", "messages": [{"role": "user", "content": "{message}"}]},
    response_path="choices.0.message.content",
)


@respx.mock
def test_generic_extracts_openai_reply(monkeypatch):
    monkeypatch.setenv("K", "tok")
    route = respx.post("https://api.x/v1/chat/completions").mock(return_value=httpx.Response(
        200, json={"choices": [{"message": {"content": "Hi there"}}]}))
    r = GenericHTTPAdapter(OPENAI).chat("hello")
    assert r.text == "Hi there" and r.status_code == 200 and r.tool_calls == []
    assert route.calls.last.request.headers["authorization"] == "Bearer tok"


@respx.mock
def test_generic_extracts_custom_path():
    p = TargetProfile(url="https://api.y/chat",
                      body_template={"q": "{message}"}, response_path="data.reply")
    respx.post("https://api.y/chat").mock(return_value=httpx.Response(
        200, json={"data": {"reply": "custom!"}}))
    assert GenericHTTPAdapter(p).chat("x").text == "custom!"


@respx.mock
def test_generic_probe_reports_raw_and_extracted():
    respx.post("https://api.y/chat").mock(return_value=httpx.Response(
        200, json={"data": {"reply": "R"}}))
    p = TargetProfile(url="https://api.y/chat",
                      body_template={"q": "{message}"}, response_path="data.reply")
    out = GenericHTTPAdapter(p).probe("x")
    assert out["status_code"] == 200 and out["extracted_reply"] == "R"
    assert '"reply"' in out["raw_response"]


@respx.mock
def test_generic_connection_error_is_status_zero():
    respx.post("https://api.y/chat").mock(side_effect=httpx.ConnectError("refused"))
    p = TargetProfile(url="https://api.y/chat",
                      body_template={"q": "{message}"}, response_path="data.reply")
    r = GenericHTTPAdapter(p).chat("x")
    assert r.status_code == 0 and r.text.startswith("ConnectError")


from attacker.target_adapter import build_adapter


class _Camp:
    def __init__(self, target_url="http://localhost:8001", target_profile=None):
        self.target_url = target_url
        self.target_profile = target_profile


def test_build_adapter_local_when_no_profile():
    assert isinstance(build_adapter(_Camp()), LocalChatAdapter)


def test_build_adapter_generic_when_profile():
    prof = json_dumps = __import__("json").dumps(
        {"url": "http://x/c", "body_template": {"q": "{message}"}, "response_path": "reply"})
    assert isinstance(build_adapter(_Camp(target_profile=prof)), GenericHTTPAdapter)
