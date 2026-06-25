"""Tests for deterministic per-id color assignment."""

from app.core.colors import COLOR_PALETTE, color_for_id


def test_color_is_in_palette() -> None:
    assert color_for_id("abc123") in COLOR_PALETTE


def test_color_is_deterministic() -> None:
    # Same id -> same color across calls (stable across reconnects/restarts).
    assert color_for_id("session-xyz") == color_for_id("session-xyz")


def test_distinct_ids_spread_across_palette() -> None:
    # Different ids should not all collapse to a single color.
    ids = [f"session-{i:04x}" for i in range(200)]
    colors = {color_for_id(i) for i in ids}
    assert len(colors) > 1


def test_empty_or_none_falls_back_to_first_palette_entry() -> None:
    assert color_for_id(None) == COLOR_PALETTE[0]
    assert color_for_id("") == COLOR_PALETTE[0]
