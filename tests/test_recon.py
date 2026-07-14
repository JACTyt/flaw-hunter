from unittest.mock import MagicMock
from attacker.recon import recon, AttackSurface
from attacker.target_adapter import TargetResponse


def _adapter(text="I can help.", tool_calls=None, hints=None):
    a = MagicMock()
    a.chat.return_value = TargetResponse(text, tool_calls or [], 200)
    a.get_surface_hints.return_value = hints or {}
    return a


def test_recon_returns_attack_surface():
    assert isinstance(recon(_adapter()), AttackSurface)


def test_recon_discovers_tools():
    surface = recon(_adapter(tool_calls=[{"tool": "search", "args": {}, "result": "x"}]))
    assert "search" in surface.tools


def test_recon_captures_hints():
    surface = recon(_adapter(hints={"llm_provider": "claude"}))
    assert any("claude" in h for h in surface.context_hints)
