#!/bin/bash
set -e

echo "Deploying PullBackup to Kubernetes..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "Error: kubectl is not installed"
    exit 1
fi

# Apply Kubernetes manifests
echo "Applying Kubernetes manifests..."
kubectl apply -f k8s/deployment.yaml

echo "Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s \
    deployment/pullbackup-backend \
    deployment/pullbackup-frontend \
    -n pullbackup

echo ""
echo "PullBackup deployed successfully!"
echo ""
echo "To access the application:"
echo "  kubectl port-forward -n pullbackup svc/pullbackup-frontend 3000:80"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo "Default credentials:"
echo "  Username: admin"
echo "  Password: admin"
echo ""
echo "To view logs:"
echo "  Backend:  kubectl logs -f -n pullbackup deployment/pullbackup-backend"
echo "  Frontend: kubectl logs -f -n pullbackup deployment/pullbackup-frontend"
echo ""
echo "To uninstall:"
echo "  kubectl delete namespace pullbackup"
