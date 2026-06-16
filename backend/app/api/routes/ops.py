"""API routes for Ops > Servidores (build + deploy de servidores HMTrack)."""

import re
from pathlib import Path as _Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.coordination import enforce_write_rate_limit
from app.config import get_settings
from app.db.database import get_db
from app.db.models import OpsDestination
from app.services.ops_runner import ops_runner

router = APIRouter(prefix="/ops", tags=["ops"])

_RUN_ID_RE = re.compile(r"^\d{8}T\d{6}Z$")


class DestinationBody(BaseModel):
    id: str
    label: str
    ssh_alias: str
    remote_base: str = "/root/project"
    compose_file: str = "docker-compose.alocalizai.yml"
    front_api_url: str
    registry: str
    image_tag: str
    enabled: bool = True

    @field_validator("id", "image_tag")
    @classmethod
    def _validate_slug(cls, v: str) -> str:
        if not re.match(r"^[A-Za-z0-9._-]+$", v):
            raise ValueError("apenas A-Za-z0-9._- são permitidos")
        return v

    @field_validator("ssh_alias")
    @classmethod
    def _validate_ssh_alias(cls, v: str) -> str:
        if not re.match(r"^[A-Za-z0-9._@-]+$", v):
            raise ValueError("ssh_alias inválido (sem espaços/metacaracteres)")
        return v

    @field_validator("remote_base")
    @classmethod
    def _validate_remote_base(cls, v: str) -> str:
        if not re.match(r"^/[A-Za-z0-9._/-]+$", v):
            raise ValueError("remote_base deve ser caminho absoluto com chars seguros")
        return v

    @field_validator("compose_file")
    @classmethod
    def _validate_compose_file(cls, v: str) -> str:
        if not re.match(r"^[A-Za-z0-9._-]+\.ya?ml$", v):
            raise ValueError("compose_file deve ser um arquivo .yml/.yaml")
        return v

    @field_validator("registry")
    @classmethod
    def _validate_registry(cls, v: str) -> str:
        if not re.match(r"^[A-Za-z0-9._:/-]+$", v):
            raise ValueError("registry inválido")
        return v

    @field_validator("front_api_url")
    @classmethod
    def _validate_front_api_url(cls, v: str) -> str:
        if not (v.startswith("https://") or v.startswith("http://")):
            raise ValueError("front_api_url deve começar com http:// ou https://")
        return v

    @field_validator("label")
    @classmethod
    def _validate_label(cls, v: str) -> str:
        if not re.match(r"^[^\x00-\x1f`$;|&<>]+$", v):
            raise ValueError("label contém caracteres não permitidos")
        return v


def _to_dict(d: OpsDestination) -> dict[str, Any]:
    return {
        "id": d.id,
        "label": d.label,
        "ssh_alias": d.ssh_alias,
        "remote_base": d.remote_base,
        "compose_file": d.compose_file,
        "front_api_url": d.front_api_url,
        "registry": d.image_registry,
        "image_tag": d.image_tag,
        "enabled": d.enabled,
    }


@router.get("/destinations")
async def list_destinations(db: Annotated[AsyncSession, Depends(get_db)]) -> list[dict[str, Any]]:
    rows = (await db.execute(select(OpsDestination))).scalars().all()
    return [_to_dict(d) for d in rows]


@router.post("/destinations", dependencies=[Depends(enforce_write_rate_limit)])
async def create_destination(
    body: DestinationBody, db: Annotated[AsyncSession, Depends(get_db)]
) -> dict[str, Any]:
    if (await db.get(OpsDestination, body.id)) is not None:
        raise HTTPException(status_code=409, detail={"error": "id já existe"})
    data = body.model_dump()
    data["image_registry"] = data.pop("registry")
    dest = OpsDestination(**data)
    db.add(dest)
    await db.commit()
    return _to_dict(dest)


@router.put("/destinations/{dest_id}", dependencies=[Depends(enforce_write_rate_limit)])
async def update_destination(
    dest_id: str, body: DestinationBody, db: Annotated[AsyncSession, Depends(get_db)]
) -> dict[str, Any]:
    dest = await db.get(OpsDestination, dest_id)
    if dest is None:
        raise HTTPException(status_code=404, detail={"error": "destino não encontrado"})
    for k, v in body.model_dump().items():
        if k == "id":
            continue
        setattr(dest, "image_registry" if k == "registry" else k, v)
    await db.commit()
    return _to_dict(dest)


@router.delete("/destinations/{dest_id}", dependencies=[Depends(enforce_write_rate_limit)])
async def delete_destination(
    dest_id: str, db: Annotated[AsyncSession, Depends(get_db)]
) -> dict[str, str]:
    # Guard de concorrência: bloqueia remover o destino em execução.
    if ops_runner.is_running() and ops_runner.current_dest_id() == dest_id:
        raise HTTPException(status_code=409, detail={"error": "destino em execução"})
    await db.execute(delete(OpsDestination).where(OpsDestination.id == dest_id))
    await db.commit()
    return {"deleted": dest_id}


class RunBody(BaseModel):
    dry_run: bool = False


@router.get("/status")
async def ops_status() -> dict[str, Any]:
    return ops_runner.status()


@router.get("/logs/{run_id}")
async def ops_logs(run_id: str) -> dict[str, str]:
    if not _RUN_ID_RE.match(run_id):
        raise HTTPException(status_code=400, detail={"error": "run_id inválido"})
    path = _Path(get_settings().OPS_LOG_DIR) / f"{run_id}.log"
    if not path.exists():
        raise HTTPException(status_code=404, detail={"error": "log não encontrado"})
    return {"run_id": run_id, "log": path.read_text(encoding="utf-8", errors="replace")}


@router.post("/{dest_id}/run", status_code=202, dependencies=[Depends(enforce_write_rate_limit)])
async def run_deploy(
    dest_id: str, body: RunBody, db: Annotated[AsyncSession, Depends(get_db)]
) -> dict[str, Any]:
    dest = await db.get(OpsDestination, dest_id)
    if dest is None:
        raise HTTPException(status_code=404, detail={"error": "destino não encontrado"})
    if not dest.enabled:
        raise HTTPException(status_code=422, detail={"error": "destino desabilitado"})
    try:
        run_id = await ops_runner.run(dest, body.dry_run)
    except RuntimeError:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "já em execução",
                "run_id": ops_runner.status()["run_id"],
                "dest_id": ops_runner.current_dest_id(),
            },
        ) from None
    return {
        "run_id": run_id,
        "dest_id": dest_id,
        "dry_run": body.dry_run,
        "started_at": ops_runner.status()["started_at"],
    }
