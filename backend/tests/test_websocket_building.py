"""Tests for building-level WebSocket connection management."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from starlette.websockets import WebSocketState

from app.api.websocket import ConnectionManager


class TestBuildingConnections:
    @pytest.mark.asyncio
    async def test_connect_building_registers_connection(self) -> None:
        mgr = ConnectionManager()
        ws = AsyncMock()
        ws.client_state = MagicMock()
        await mgr.connect_building(ws)
        assert ws in mgr.building_connections

    @pytest.mark.asyncio
    async def test_disconnect_building_removes_connection(self) -> None:
        mgr = ConnectionManager()
        ws = AsyncMock()
        ws.client_state = MagicMock()
        await mgr.connect_building(ws)
        await mgr.disconnect_building(ws)
        assert ws not in mgr.building_connections

    @pytest.mark.asyncio
    async def test_broadcast_building_sends_to_connections(self) -> None:
        mgr = ConnectionManager()
        ws = AsyncMock()
        ws.client_state = WebSocketState.CONNECTED
        await mgr.connect_building(ws)
        await mgr.broadcast_building({"type": "building_state"})
        ws.send_json.assert_called_once_with({"type": "building_state"})

    @pytest.mark.asyncio
    async def test_broadcast_building_noop_when_no_connections(self) -> None:
        mgr = ConnectionManager()
        await mgr.broadcast_building({"type": "building_state"})  # must not raise
