#!/bin/bash
# build-push-by-destination.sh
# Build and push Docker images with per-destination tags to GHCR
#
# Decision #896: Tags per-destination for multi-tenant isolation
# Each client (alocalizai, hmtrack, future clients) gets its own image tags,
# ensuring independent version control and safe rollbacks.
#
# Usage:
#   DESTINATION=alocalizai ./build-push-by-destination.sh
#   DESTINATION=hmtrack ./build-push-by-destination.sh

set -euo pipefail

# Configuration
REGISTRY="ghcr.io/isakielsouza"
DESTINATION="${DESTINATION:-alocalizai}"
COMMIT_SHA="$(git rev-parse --short HEAD)"
TAG="${DESTINATION}-${COMMIT_SHA}"

# Image names
FRONTEND_IMAGE="${REGISTRY}/claude-office-frontend:${TAG}"
BACKEND_IMAGE="${REGISTRY}/claude-office-backend:${TAG}"

echo "=========================================="
echo "Building and pushing images for: $DESTINATION"
echo "=========================================="
echo ""
echo "Frontend: $FRONTEND_IMAGE"
echo "Backend:  $BACKEND_IMAGE"
echo ""

# Build multi-stage Docker image
echo "🔨 Building Docker image..."
if ! docker build \
  --tag "$FRONTEND_IMAGE" \
  --tag "$BACKEND_IMAGE" \
  .; then
  echo "❌ Docker build failed" >&2
  exit 1
fi

# Push to GHCR (requires: echo $GITHUB_TOKEN | docker login -u USERNAME --password-stdin ghcr.io)
echo "📤 Pushing to GHCR..."
if ! docker push "$FRONTEND_IMAGE"; then
  echo "❌ Failed to push frontend image: $FRONTEND_IMAGE" >&2
  exit 1
fi

if ! docker push "$BACKEND_IMAGE"; then
  echo "❌ Failed to push backend image: $BACKEND_IMAGE" >&2
  exit 1
fi

echo ""
echo "✅ Done!"
echo ""
echo "Images tagged and pushed:"
echo "  Frontend: $FRONTEND_IMAGE"
echo "  Backend:  $BACKEND_IMAGE"
echo ""
echo "To use in docker-compose.${DESTINATION}.yml:"
echo "  services:"
echo "    claude-office:"
echo "      image: $BACKEND_IMAGE"
