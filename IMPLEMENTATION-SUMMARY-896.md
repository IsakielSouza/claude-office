# Issue #896 Implementation Summary

## Status: ✅ COMPLETE (Local Implementation)

**Issue:** agents-ia#896 — "[office] Decisão: tags de imagem por-destino"

**Decision:** ✅ Opção A — Backend shared `:latest` tag, Frontend per-destination tag

---

## What Was Implemented

### 1. Architecture Documentation (This Repo: claude-office)

**File:** `docs/architecture/DEPLOYMENT-STRATEGY.md`

Documents the multi-destination deployment strategy:
- Backend services use `:latest` tag (shared, configuration-only differences via `.env`)
- Frontend uses per-destination tags (e.g., `:alocalizai`) — API URLs baked into build
- Explains build process, docker-compose patterns, and multi-client scaling

**Updated:** `docs/architecture/ARCHITECTURE.md`
- Added reference to DEPLOYMENT-STRATEGY.md in "Related Documentation" section

### 2. Infrastructure Documentation (hmtrack-documentacao)

**File:** `docs/DEPLOYMENT-STRATEGY.md`

Same content as above, placed in the infrastructure documentation repo where the actual deployment scripts live.

---

## Decision Rationale

**Why Backend Shared `:latest` Over Per-Destination Tags?**

1. **Simplicity:** Backend services are configuration-agnostic (only `.env` differences)
2. **Scaling:** Adding new clients only requires new frontend build + docker-compose
3. **Cost:** No need to rebuild/tag all backend services per destination
4. **Consistency:** All clients use identical backend — easier testing and debugging

**Comparison:**
| Strategy | Backend | Frontend | Trade-off |
|----------|---------|----------|-----------|
| **A (Chosen)** | `:latest` (shared) | Per-destination | Simple, scales well |
| B (Rejected) | Per-destination | Per-destination | Redundant; all backends identical anyway |
| C (Rejected) | Per-divergence only | Per-destination | Requires classification logic; overcomplicated |

---

## How It Works

### Build Phase (on build machine)

```bash
# 1. Backend: always :latest
docker build -t ghcr.io/isakielsouza/hmtrack-api2-principal:latest .

# 2. Frontend: per-destination (API URL substituted via sed)
FRONT_TAG=alocalizai ./build-push-alocalizai.sh
  → Builds with: ghcr.io/isakielsouza/hmtrack-front-v2:alocalizai

# 3. Push all
docker push ghcr.io/isakielsouza/hmtrack-*:latest
docker push ghcr.io/isakielsouza/hmtrack-front-v2:alocalizai
```

### Deploy Phase (on server)

```bash
# Per-destination docker-compose file
docker compose -f docker-compose.alocalizai.yml pull
docker compose -f docker-compose.alocalizai.yml up -d

# Config via .env (database URLs, secrets, etc.)
```

### Add New Client (e.g., "clientB")

1. Build frontend with clientB's API URL → `:clientB` tag (backend unchanged)
2. Create `docker-compose.clientb.yml` (reference `:latest` backend, `:clientB` frontend)
3. Deploy — no backend re-tagging needed

---

## Files Affected

### claude-office (This Worktree)

- ✅ `docs/architecture/DEPLOYMENT-STRATEGY.md` (new)
- ✅ `docs/architecture/ARCHITECTURE.md` (updated reference)
- Branch: `feat/896-image-tag-strategy`
- Commit: `9d7cbf4` — "docs: multi-destination deployment strategy..."

### hmtrack-documentacao (Local)

- ✅ `docs/DEPLOYMENT-STRATEGY.md` (new)
- Branch: `main` (local commits, no remote)
- Commit: `dea8e76` — "docs: multi-destination deployment strategy..."

---

## How to Merge This Solution

Since `claude-office` is a public repo (paulrobello/claude-office) and I don't have push access:

**Option 1 (Recommended):**
1. The claude-office PR documentation should be created by paulrobello or a collaborator with push access
2. Reference this implementation summary
3. Content is ready in `docs/architecture/DEPLOYMENT-STRATEGY.md`

**Option 2:**
1. Clone/fork paulrobello/claude-office
2. Cherry-pick branch `feat/896-image-tag-strategy`
3. Open PR to paulrobello/claude-office

**Note:** The infrastructure documentation lives in hmtrack-documentacao (local repo), which is the authoritative source for deployment decisions.

---

## Related Evidence

- **Original Decision:** agents-ia#896 comments (CEO approval 2026-06-19)
- **Migration Guide:** [MIGRACAO_ALOCALIZAI_DOCKER.md](../../../MIGRACAO_ALOCALIZAI_DOCKER.md)
- **Build Script:** [build-push-alocalizai.sh](../../../build-push-alocalizai.sh)
- **Example Compose:** [docker-compose.alocalizai.yml](../../../hmtrack-trackers/docker-compose.alocalizai.yml)

---

## Brechas Mapeadas

### Coverage

✅ **Architecture documented** — Decision formalized and explained  
✅ **Build process documented** — How backend (:latest) and frontend (per-dest) are built  
✅ **Deployment pattern documented** — docker-compose structure and scaling  
✅ **Decision rationale documented** — Why this model was chosen  

### Potential Future Work (Outside Scope)

- [ ] Semantic versioning (`:1.2.3`) if per-client version pinning becomes needed
- [ ] Automated version bumping / changelog generation
- [ ] Multi-region registry mirroring (currently single GHCR)
- [ ] Rollback automation / version pinning strategy for production stability

### No Blockers

This decision enables:
- ✅ Current alocalizai deployment (already using this model)
- ✅ Future multi-client expansion without backend re-tagging
- ✅ Simple operator experience (same backend `:latest` for all clients)
