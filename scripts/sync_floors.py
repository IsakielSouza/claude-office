"""Sync backend/floors.toml → user_preferences.building_config via API.

Usage:
    cd backend
    uv run python ../scripts/sync_floors.py [path-to-toml] [api-base-url]

Defaults:
    path-to-toml = backend/floors.toml (relative to repo root)
    api-base-url = http://localhost:8000

This is a local helper that doesn't ship with upstream — we use it because
the backend reads building_config only from the SQLite preferences table,
not from floors.toml directly (floors.toml is upstream's dev fallback).
"""

import json
import sys
import urllib.request
from pathlib import Path

from app.core.floor_config import load_building_config_from_toml


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    toml_path = Path(sys.argv[1]) if len(sys.argv) > 1 else repo_root / "backend" / "floors.toml"
    api_base = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"

    if not toml_path.exists():
        print(f"FATAL — floors.toml not found at {toml_path}", file=sys.stderr)
        return 2

    print(f"Loading {toml_path}...")
    config = load_building_config_from_toml(toml_path=toml_path)
    if not config.floors:
        print("WARN — toml parsed but has zero floors", file=sys.stderr)
        return 1

    json_payload = config.model_dump_json(by_alias=True)
    print(f"Parsed {len(config.floors)} floor(s):")
    for f in config.floors:
        rooms = ", ".join(r.repo_name for r in f.rooms)
        print(f"  [{f.floor_number}] {f.icon} {f.name} — rooms: {rooms}")

    url = f"{api_base}/api/v1/preferences/building_config"
    body = json.dumps({"value": json_payload}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="PUT",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        result = resp.read().decode()
    print(f"\nPUT {url} → {result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
