from fastapi.testclient import TestClient
from unittest.mock import patch


def _client():
    from attacker.main import app
    return TestClient(app)


def test_create_campaign():
    resp = _client().post("/campaigns", json={
        "name": "Test", "target_url": "http://localhost:8001",
        "attack_types": ["prompt_injection"], "max_rounds": 2, "max_retries": 1,
    })
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test" and resp.json()["status"] == "pending"


def test_list_campaigns():
    assert isinstance(_client().get("/campaigns").json(), list)


def test_get_campaign_not_found():
    assert _client().get("/campaigns/99999").status_code == 404


def test_start_campaign():
    client = _client()
    cid = client.post("/campaigns", json={
        "name": "BG", "target_url": "http://localhost:8001",
        "attack_types": ["data_exfiltration"], "max_rounds": 1, "max_retries": 1,
    }).json()["id"]
    with patch("attacker.main.run_campaign"):
        resp = client.post(f"/campaigns/{cid}/start")
        assert resp.json()["status"] == "started"


def test_stop_campaign():
    client = _client()
    cid = client.post("/campaigns", json={
        "name": "Stop", "target_url": "http://localhost:8001",
        "attack_types": ["prompt_injection"], "max_rounds": 1, "max_retries": 1,
    }).json()["id"]
    assert client.post(f"/campaigns/{cid}/stop").json()["status"] == "stopped"
