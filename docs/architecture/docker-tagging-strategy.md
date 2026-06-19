# Docker Image Tagging Strategy

**Decision Date:** 2026-06-19  
**Status:** Decided  
**Issue:** #896

## Executive Summary

This document outlines the Docker image tagging strategy for Claude Office Visualizer in a multi-tenant/multi-destination environment. The decision balances simplicity, resource efficiency, and per-client customization.

## Decision

- **Backend Images** (`api`, `alert`, `trackers`): `:latest` tag only — shared across all destinations/clients
- **Frontend Image**: `:N.N.N` semantic versioning per destination — isolated per client
- **Rationale**: Reduces image bloat (backend logic is stable/generic), simplifies CD pipeline, allows flexible frontend deployments per client

## Background

### Problem Statement

In a multi-tenant deployment (e.g., multiple clients using the same platform):
- All services are containerized and pushed to a container registry (e.g., GHCR)
- Without a tagging strategy, deploying a second client would pull the same backend images (`:latest`) as the first client
- Frontend can vary per client, but backend services are typically identical

### Options Considered

**Option A** (Selected): Backend `:latest`, Frontend `:N.N.N` per destination
- ✅ Reduces image proliferation (stable backend)
- ✅ Simpler CD pipeline
- ✅ Each client can have customized frontend versions

**Option B**: All images (api, alert, trackers, frontend) use `:N.N.N` semantic versioning
- ✅ Complete tag isolation per destination
- ❌ Image bloat (backend may be identical across clients)
- ❌ More complex build/push logic

**Option C**: Hybrid — only tag services that diverge per client, rest use `:latest`
- ✅ Flexibility
- ❌ Harder to reason about; requires per-service decisions

## Implementation Details

### Image Naming Convention

```
Backend services (shared, :latest):
  ghcr.io/isakielsouza/api:latest
  ghcr.io/isakielsouza/alert:latest
  ghcr.io/isakielsouza/trackers:latest

Frontend (per-destination versioning):
  ghcr.io/isakielsouza/office-frontend:alocalizai-1.0.0
  ghcr.io/isakielsouza/office-frontend:client2-2.1.3
  ghcr.io/isakielsouza/office-frontend:prod-1.5.0
```

### Docker Compose Files

Each destination has its own `docker-compose.<destination>.yml`:

```yaml
# docker-compose.alocalizai.yml
services:
  api:
    image: ghcr.io/isakielsouza/api:latest
  
  alert:
    image: ghcr.io/isakielsouza/alert:latest
  
  trackers:
    image: ghcr.io/isakielsouza/trackers:latest
  
  frontend:
    image: ghcr.io/isakielsouza/office-frontend:alocalizai-1.0.0
```

### Build and Push Pipeline

The CI/CD pipeline (e.g., `build-push.sh` or GitHub Actions) will:

1. **Backend images**: Build once, push with `:latest` tag
   ```bash
   docker build -t ghcr.io/isakielsouza/api:latest ./api
   docker push ghcr.io/isakielsouza/api:latest
   ```

2. **Frontend images**: Build and tag per destination
   ```bash
   VERSION=$(cat frontend/package.json | jq -r .version)
   DESTINATION=${1:-alocalizai}
   
   docker build -t ghcr.io/isakielsouza/office-frontend:${DESTINATION}-${VERSION} ./frontend
   docker push ghcr.io/isakielsouza/office-frontend:${DESTINATION}-${VERSION}
   ```

## Deployment Implications

### Single-Destination Deployment

For a single client (e.g., alocalizai):
- No change from current state
- Backend images use `:latest`
- Frontend image tagged with `alocalizai-<version>`

### Multi-Destination Deployment

When adding a second client:
1. Create `docker-compose.<newclient>.yml` with appropriate tag for frontend
2. Backend images remain `:latest` (no duplication)
3. Each destination's compose file references its own frontend version
4. Deploy independently: `docker-compose -f docker-compose.<dest>.yml up`

## Migration Path

1. **Phase 1**: Document strategy (this file) — ✅ Done
2. **Phase 2**: Update build scripts to enforce tagging rules
3. **Phase 3**: Update `docker-compose.yml` files per destination
4. **Phase 4**: Verify multi-destination deployment works correctly
5. **Phase 5**: Update CI/CD pipelines (GitHub Actions, etc.)

## Monitoring and Maintenance

- **Image Cleanup**: Periodically review and clean old frontend image tags
- **Version Synchronization**: Ensure `docker-compose.*.yml` files reference valid image tags
- **Documentation**: Keep this strategy aligned with actual build/deployment practices

## Considerations

### Potential Issues

1. **Backend Divergence**: If backends need per-client customization, this strategy becomes limiting
   - Mitigation: Use environment variables or configuration management (not image tags)
   
2. **Image Size**: Multiple frontend images with slight differences
   - Acceptable: Frontend is typically smaller than backends; duplicating frontend is reasonable

3. **Tag Confusion**: `:latest` can be ambiguous over time
   - Mitigation: Use Git commit SHAs or explicit version numbers for critical deployments
   - Future: Consider moving to explicit versioning for all images

### Future Evolution

If multi-tenant requirements grow:
- Consider moving to full semantic versioning (Option C)
- Implement build matrix to automatically version all images
- Use GitOps (ArgoCD) for declarative deployment per destination

## References

- **GitHub Issue**: #896
- **Related**: Multi-destination deployment planning
- **Deploy Guide**: See [deployment.md](./deployment.md)
