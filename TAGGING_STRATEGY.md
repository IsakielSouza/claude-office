# Docker Image Tagging Strategy (#896)

**Decision:** Tags per-destination (multi-tenant isolation model)

## Rationale

When deploying claude-office to multiple clients (alocalizai, hmtrack, future clients), we need **independent version control** for each deployment to:

1. **Prevent coupled releases** — Client A's API update shouldn't force Client B to redeploy if they're not ready
2. **Enable independent rollbacks** — If Client A's deployment fails, Client B stays unaffected
3. **Support safe canaries** — Deploy v1.2 to Client A, keep Client B on v1.0 for testing
4. **Isolate configuration** — Each client's environment, database, secrets stay separate

### Alternative Rejected: Backend Shared (`:latest`)

❌ **Single `:latest` tag for all clients**
- Both clients pull the same backend images
- Deploy to Client A → Client B immediately gets the update
- One client's bug cascades to all others
- Rollback only works for the last deploying client

## Implementation

### Tagging Scheme

```
Image Tag Format: <destination>-<commit-sha>

Examples:
  ghcr.io/isakielsouza/claude-office-backend:alocalizai-a1b2c3d
  ghcr.io/isakielsouza/claude-office-backend:hmtrack-x9y8z7w
  ghcr.io/isakielsouza/claude-office-frontend:alocalizai-a1b2c3d
```

### Build Process

**Per-destination build script:** `./build-push-by-destination.sh`

```bash
# Build for alocalizai
DESTINATION=alocalizai ./build-push-by-destination.sh

# Build for hmtrack
DESTINATION=hmtrack ./build-push-by-destination.sh
```

This script:
1. Reads current `git rev-parse --short HEAD` (commit SHA)
2. Tags images as `<destination>-<sha>`
3. Pushes to GHCR with destination-specific tags

### Deployment

**Per-destination compose file:** `docker-compose.<destination>.yml`

```yaml
services:
  claude-office:
    image: ghcr.io/isakielsouza/claude-office-backend:alocalizai-a1b2c3d
    # ... destination-specific config
```

Deploy independently:
```bash
# Deploy alocalizai
docker compose -f docker-compose.alocalizai.yml pull
docker compose -f docker-compose.alocalizai.yml up -d

# Deploy hmtrack (uses its own tagged images)
docker compose -f docker-compose.hmtrack.yml pull
docker compose -f docker-compose.hmtrack.yml up -d
```

## Migration Path

1. **Backward compatibility:** Keep `:latest` as "current stable" tag, but don't rely on it for multi-client deployments
2. **Per-client compose:** Create `docker-compose.<destination>.yml` for each client
3. **Build automation:** Wire `build-push-by-destination.sh` into CI/CD (GitHub Actions)
4. **Gradual rollout:** Test with alocalizai, then hmtrack, then new clients

## Image Storage

GHCR registry will contain tags like:

```
ghcr.io/isakielsouza/claude-office-backend:
  ├─ alocalizai-a1b2c3d
  ├─ alocalizai-x9y8z7w
  ├─ hmtrack-m5n6o7p
  ├─ hmtrack-latest
  └─ ... (future clients)
```

Each tag is immutable — if alocalizai redeploys the same commit, it pulls the cached image.

### ⚠️ Important: No `:latest` tag for multi-client deployments

**Do NOT use `:latest` for any client in production.** While the tag may exist in GHCR as a convenience for development, production deployments **MUST** use explicit per-destination tags (e.g., `alocalizai-a1b2c3d`).

Using `:latest` breaks isolation:
- Both clients could pull the same `:latest` version
- Defeats independent version control
- Makes rollbacks unreliable

**Enforced by `docker-compose.<destination>.yml`:** These files require the `CLAUDE_OFFICE_IMAGE` environment variable to be set explicitly. Deployment will fail if not provided, preventing accidental `:latest` usage.

## Benefits Summary

| Scenario | Shared (`:latest`) | Per-Destination |
|---|---|---|
| Client A deploys v1.2 | ✅ OK | ✅ OK (only A affected) |
| Client B still on v1.0 | ❌ Forced to v1.2 | ✅ Stays on v1.0 |
| Rollback Client A | ❌ Rolls back A+B | ✅ Only rolls back A |
| 2 clients, 2 versions | ❌ Impossible | ✅ Simple |

## Files Added

- `build-push-by-destination.sh` — Build and push script
- `docker-compose.alocalizai.yml` — alocalizai deployment config
- `TAGGING_STRATEGY.md` — This document
