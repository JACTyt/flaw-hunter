import importlib


def test_settings_reads_llm_provider(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    import common.config as cfg
    importlib.reload(cfg)
    assert cfg.settings.llm_provider == "ollama"


def test_settings_defaults():
    import common.config as cfg
    assert cfg.settings.llm_provider in ("claude", "ollama")
    assert cfg.settings.target_url.startswith("http")


def test_settings_expose_canary_and_known_prompt():
    from common.config import Settings
    s = Settings()
    assert s.canary  # non-empty default
    assert "helpful assistant with access to" in s.known_system_prompt.lower()
