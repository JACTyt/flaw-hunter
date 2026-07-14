import pytest
from sqlmodel import create_engine, SQLModel
import attacker.models  # noqa: F401 — ensures tables registered


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch, tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False}
    )
    SQLModel.metadata.create_all(engine)
    import attacker.main as main_module
    monkeypatch.setattr(main_module, "engine", engine)
    main_module._campaign_events.clear()
