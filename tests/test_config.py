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
