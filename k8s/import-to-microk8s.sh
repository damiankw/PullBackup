#!/bin/bash
set -e

echo "======================================"
echo "PullBackup - MicroK8s Import Script"
echo "======================================"
echo ""

# Configuration
NFS_SERVER="172.20.0.25"
NFS_PATH="/backup"
IMAGE_TAG="latest"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1/5: Building images with Podman${NC}"
echo "Building backend..."
podman build -t pullbackup-backend:${IMAGE_TAG} -f Dockerfile.backend .

echo "Building frontend..."
podman build -t pullbackup-frontend:${IMAGE_TAG} -f Dockerfile.frontend .

echo ""
echo -e "${YELLOW}Step 2/5: Saving images to tar files${NC}"
podman save pullbackup-backend:${IMAGE_TAG} -o /tmp/pullbackup-backend.tar
podman save pullbackup-frontend:${IMAGE_TAG} -o /tmp/pullbackup-frontend.tar

echo ""
echo -e "${YELLOW}Step 3/5: Importing images to MicroK8s${NC}"
microk8s ctr image import /tmp/pullbackup-backend.tar
microk8s ctr image import /tmp/pullbackup-frontend.tar

echo ""
echo -e "${YELLOW}Step 4/5: Cleaning up tar files${NC}"
rm /tmp/pullbackup-backend.tar /tmp/pullbackup-frontend.tar

echo ""
echo -e "${YELLOW}Step 5/5: Deploying to MicroK8s${NC}"
microk8s kubectl apply -f k8s/deployment-nfs.yaml

echo ""
echo -e "${GREEN}✓ Import complete!${NC}"
echo ""
echo "Waiting for deployments to be ready..."
microk8s kubectl wait --for=condition=available --timeout=300s \
    deployment/pullbackup-backend \
    deployment/pullbackup-frontend \
    -n pullbackup || true

echo ""
echo -e "${GREEN}======================================"
echo "PullBackup deployed successfully!"
echo "======================================"
echo ""
echo "NFS Configuration:"
echo "  Server: ${NFS_SERVER}"
echo "  Path: ${NFS_PATH}"
echo ""
echo "To access the application:"
echo "  microk8s kubectl port-forward -n pullbackup svc/pullbackup-frontend 3000:80"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo "Default credentials:"
echo "  Username: admin"
echo "  Password: admin"
echo ""
echo "Useful commands:"
echo "  View backend logs:  microk8s kubectl logs -f -n pullbackup deployment/pullbackup-backend"
echo "  View frontend logs: microk8s kubectl logs -f -n pullbackup deployment/pullbackup-frontend"
echo "  List pods:          microk8s kubectl get pods -n pullbackup"
echo "  Uninstall:          microk8s kubectl delete namespace pullbackup"
echo -e "${NC}"
