from unittest.mock import MagicMock
from attacker.attack_generator import generate, refine, Attack
from attacker.recon import AttackSurface


def _llm(response="Creative payload"):
    m = MagicMock()
    m.complete.return_value = response
    return m


def _surface():
    return AttackSurface(tools=["search", "send_email"], context_hints=["claude"])


def test_generate_returns_attack():
    attack = generate("prompt_injection", _surface(), _llm())
    assert isinstance(attack, Attack) and attack.attack_type == "prompt_injection"


def test_generate_uses_llm():
    llm = _llm("LLM payload")
    attack = generate("data_exfiltration", _surface(), llm)
    assert llm.complete.called and attack.payload == "LLM payload"


def test_refine_produces_new_payload():
    original = Attack("goal_hijacking", "Old payload", "tpl")
    refined = refine(original, "Target refused", _llm("Refined payload"))
    assert refined.payload == "Refined payload"


def test_generate_all_attack_types():
    for t in ["prompt_injection", "goal_hijacking", "tool_misuse", "data_exfiltration"]:
        assert generate(t, _surface(), _llm()).attack_type == t
