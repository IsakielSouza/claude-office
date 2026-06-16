import pytest
from sqlalchemy import select

from app.db.models import OpsDestination


@pytest.mark.asyncio
async def test_ops_destination_model_roundtrip(db_session):
    dest = OpsDestination(
        id="teste", label="Teste", ssh_alias="flt", remote_base="/root/project",
        compose_file="docker-compose.alocalizai.yml",
        front_api_url="https://core.alocalizai.com.br/v1/",
        registry="ghcr.io/isakielsouza", image_tag="alocalizai", enabled=True,
    )
    db_session.add(dest)
    await db_session.commit()
    row = (await db_session.execute(select(OpsDestination).where(OpsDestination.id == "teste"))).scalar_one()
    assert row.ssh_alias == "flt"
    assert row.enabled is True
