#!/bin/bash
set -e

echo "Building PullBackup Docker Images..."

# Build backend image
echo "Building backend image..."
docker build -f Dockerfile.backend -t pullbackup-backend:latest .

# Build frontend image
echo "Building frontend image..."
docker build -f Dockerfile.frontend -t pullbackup-frontend:latest .

echo "Docker images built successfully!"
echo ""
echo "Images:"
echo "  - pullbackup-backend:latest"
echo "  - pullbackup-frontend:latest"
echo ""
echo "To deploy with Docker Compose:"
echo "  docker-compose up -d"
echo ""
echo "To deploy to Kubernetes:"
echo "  kubectl apply -f k8s/deployment.yaml"
