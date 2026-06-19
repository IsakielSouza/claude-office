# Multi-Destination Deployment Strategy

## Overview

This document describes the Docker image tagging and deployment strategy for multi-destination deployments across different clients (e.g., hmtrack, alocalizai).

**Status:** ✅ Decided (agents-ia#896 — CEO decision 2026-06-19)

## Decision: Backend Shared `:latest`, Frontend Per-Destination

### Architecture

| Component | Tag Strategy | Rationale |
|-----------|--------------|-----------|
| **Backend Services** (API, Alert, Trackers) | `:latest` (shared) | Identical across all destinations; configuration via `.env` only |
| **Frontend** (Client UI) | Per-destination (e.g., `:alocalizai`) | Client-specific API URLs baked into build; each destination needs separate image |

### Why This Model

1. **Reduced Complexity:** Backend services are configuration-agnostic. No per-destination rebuild needed.
2. **Deployment Simplicity:** Each server pulls identical backend images; frontend is the only per-client variation.
3. **Scaling:** Adding a new client only requires a new frontend build with that client's API URL. No backend re-tagging.
4. **Configuration Isolation:** All client-specific configuration lives in `.env` (database URLs, API keys, etc.), mounted at runtime.

## Build Process

### Backend (All Services)

```bash
# Build and push backend services with :latest tag
docker build -f Dockerfile.api -t ghcr.io/isakielsouza/hmtrack-api2-principal:latest .
docker build -f Dockerfile -t ghcr.io/isakielsouza/hmtrack-alert-worker:latest .
docker build -f Dockerfile.tracker-worker -t ghcr.io/isakielsouza/hmtrack-global-tracker-worker:latest .
# ... (all other tracker Dockerfiles)
```

**Tag:** Always `latest` regardless of destination. Same image used by hmtrack, alocalizai, and any future clients.

### Frontend

```bash
# Build frontend with destination-specific tag
# Destination: alocalizai
FRONT_TAG=alocalizai docker build -f dockerfile -t ghcr.io/isakielsouza/hmtrack-front-v2:alocalizai .

# Example: future destination "clientB"
FRONT_TAG=clientB docker build -f dockerfile -t ghcr.io/isakielsouza/hmtrack-front-v2:clientB .
```

**Tag:** Per-destination (e.g., `:alocalizai`, `:clientB`). Before building, the script replaces the API URL in `environment.prod.ts`:

```typescript
// environment.prod.ts (example for alocalizai)
export const environment = {
  apiUrl: 'https://core.alocalizai.com.br/v1/',
  // ... other config
};
```

URL substitution is done **on the build machine** (via `sed`) — the server never sees source code.

## Docker Compose Per-Destination

Each destination has a `docker-compose.<destination>.yml` file listing only **image references** (no `build:` section):

```yaml
# docker-compose.alocalizai.yml
services:
  hmtrack-api:
    image: ghcr.io/isakielsouza/hmtrack-api2-principal:latest
    environment:
      DATABASE_URL: postgresql://user@alocalizai-db/hmtrack
  
  hmtrack-front:
    image: ghcr.io/isakielsouza/hmtrack-front-v2:alocalizai
    environment:
      PORT: 3000

  hmtrack-trackers:
    image: ghcr.io/isakielsouza/hmtrack-global-tracker-worker:latest
    environment:
      REDIS_HOST: redis
```

**Key:** Backend images are `:latest` (identical for all clients); frontend is `:alocalizai` (client-specific).

## Deployment Flow

### On Build Machine (e.g., Your Local Machine)

```bash
# 1. Login to private registry
echo $GHCR_PAT | docker login ghcr.io -u <username> --password-stdin

# 2. Build and push all images
./build-push-alocalizai.sh
# Builds 14 images:
# - 13 backend services with :latest tag
# - 1 frontend with :alocalizai tag (after sed-replacing API URL)

# 3. Push to GHCR (GitHub Container Registry)
docker push ghcr.io/isakielsouza/hmtrack-*:latest
docker push ghcr.io/isakielsouza/hmtrack-front-v2:alocalizai
```

### On Server (e.g., alocalizai)

```bash
# 1. Login with read-only PAT
echo $GHCR_READ_PAT | docker login ghcr.io -u <username> --password-stdin

# 2. Pull and start containers
docker compose -f docker-compose.alocalizai.yml pull
docker compose -f docker-compose.alocalizai.yml up -d

# 3. Validate health
curl http://localhost:8000/health  # Backend API
curl http://localhost:3000         # Frontend
```

**No git checkout, no build-on-server, no source code visibility** — only images and configuration.

## Multi-Client Scaling Example

### Adding a New Destination ("clientB")

1. **On build machine:**
   ```bash
   FRONT_TAG=clientB \
   FRONT_NEW_API_URL=https://api.clientb.example.com/v1/ \
   ./build-push-alocalizai.sh front
   ```
   - Builds frontend with clientB's API URL
   - Pushes as `ghcr.io/isakielsouza/hmtrack-front-v2:clientB`
   - Backend images (`:latest`) are unchanged

2. **On clientB server:**
   ```bash
   # Create docker-compose.clientb.yml (same backend, different frontend tag + .env)
   docker compose -f docker-compose.clientb.yml pull
   docker compose -f docker-compose.clientb.yml up -d
   ```

3. **No backend changes needed** — both alocalizai and clientB use identical `:latest` backend services.

## Version Management

This strategy assumes **no explicit version pinning** for backend services. Future alternatives:

| Strategy | Pros | Cons |
|----------|------|------|
| **:latest (current)** | Simplicity; one tag to manage | Implicit version; harder to track changes |
| **:N.N.N semantic** | Explicit versioning; easier rollback | Must tag all backends per release; more overhead |
| **:destination-N** | Per-destination pinning | Defeats purpose; complexity returns |

If versioning becomes critical (multiple stable client versions), migrate to semantic tags (`:1.2.3`) for backend too.

## Security Considerations

- **Registry Access:** Only the build machine has write access (via `GHCR_PAT`). Servers have read-only access (`GHCR_READ_PAT`).
- **Source Code Isolation:** Servers never hold source code — only config and composed containers.
- **Rollback:** Delete problematic image from GHCR; redeploy old tag or rebuild and push new.

## Related Documentation

- [MIGRATION_ALOCALIZAI_DOCKER.md](/MIGRACAO_ALOCALIZAI_DOCKER.md) — Original migration guide with detailed pre-requisites
- [build-push-alocalizai.sh](/build-push-alocalizai.sh) — Build and push script
- [docker-compose.alocalizai.yml](/hmtrack-trackers/docker-compose.alocalizai.yml) — Example per-destination compose file
- [Deployment Guide (Local)](./deployment.md) — Local Claude Office Visualizer deployment
