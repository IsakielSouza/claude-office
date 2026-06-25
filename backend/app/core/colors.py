"""Deterministic per-session / per-agent color assignment.

Historically the boss/lead color was a single constant (``#f59e0b``) and
subagent colors were drawn from a palette indexed by a *sequential counter*.
That made distinct sessions/agents collide on the same color: every "main"
was the same orange square, and two agents at position 1 of different state
machines got the same palette entry.

This module derives a stable color from a hash of the identifier (session_id
or agent id). The same id always maps to the same color, across reconnects
and backend restarts, and different ids spread across the palette.
"""

from __future__ import annotations

import hashlib

# Shared palette. Index 0 keeps the historical boss orange so existing
# single-session screenshots/expectations stay visually familiar, but the
# color is now chosen by hash of the id rather than being forced for bosses.
COLOR_PALETTE: list[str] = [
    "#f59e0b",  # amber (legacy boss color)
    "#3b82f6",  # blue
    "#22c55e",  # green
    "#a855f7",  # purple
    "#f97316",  # orange
    "#ec4899",  # pink
    "#14b8a6",  # teal
    "#06b6d4",  # cyan
    "#eab308",  # yellow
    "#ef4444",  # red
    "#8b5cf6",  # violet
    "#10b981",  # emerald
]


def color_for_id(identifier: str | None) -> str:
    """Return a stable palette color derived from ``identifier``.

    Uses a stable hash (md5) so the mapping does not depend on the process
    hash seed and stays identical across reconnects and restarts.

    Args:
        identifier: A session_id, agent id, or any stable string. ``None`` or
            empty falls back to the first palette entry.

    Returns:
        A hex color string from :data:`COLOR_PALETTE`.
    """
    if not identifier:
        return COLOR_PALETTE[0]
    digest = hashlib.md5(identifier.encode("utf-8")).hexdigest()
    index = int(digest[:8], 16) % len(COLOR_PALETTE)
    return COLOR_PALETTE[index]
