import asyncio
from unittest.mock import MagicMock

import pytest

from app.services.ops_runner import OpsRunner


class _Dest:
    id = "t"
    ssh_alias = "flt"
    remote_base = "/root/project"
    compose_file = "docker-compose.alocalizai.yml"
    front_api_url = "https://core.x/v1/"
    image_registry = "ghcr.io/x"
    image_tag = "t"


@pytest.mark.asyncio
async def test_lock_rejects_second_run(monkeypatch):
    r = OpsRunner()
    started = asyncio.Event()

    async def fake_stream(step, cmd, cwd=None, env=None, timeout=None):
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

    async def fake_stream(step, cmd, cwd=None, env=None, timeout=None):
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

    async def fake_stream(step, cmd, cwd=None, env=None, timeout=None):
        steps.append(step)
        return 1 if step == "build" else 0

    monkeypatch.setattr(r, "_stream", fake_stream)
    await r.run(_Dest(), dry_run=False)
    await asyncio.sleep(0.1)
    assert steps == ["build"]
    assert r.status()["step"] == "failed"


@pytest.mark.asyncio
async def test_stream_raises_timeout_and_kills_proc(tmp_path, monkeypatch):
    """_stream deve levantar TimeoutError e matar o proc quando timeout estourar."""
    from app.config import Settings

    fake_settings = MagicMock(spec=Settings)
    fake_settings.OPS_LOG_DIR = str(tmp_path)
    monkeypatch.setattr("app.services.ops_runner.get_settings", lambda: fake_settings)

    r = OpsRunner()
    r._state["run_id"] = "test-timeout"

    with pytest.raises(TimeoutError):
        await r._stream("build", ["sleep", "5"], timeout=0.1)


@pytest.mark.asyncio
async def test_timeout_releases_lock_and_marks_failed(monkeypatch):
    """Quando _stream estoura timeout, is_running() volta False e step vira 'failed'."""
    r = OpsRunner()

    async def timeout_stream(step, cmd, cwd=None, env=None, timeout=None):
        raise TimeoutError("simulated timeout")

    monkeypatch.setattr(r, "_stream", timeout_stream)
    await r.run(_Dest(), dry_run=True)
    await asyncio.sleep(0.05)
    assert r.is_running() is False
    assert r.status()["step"] == "failed"
