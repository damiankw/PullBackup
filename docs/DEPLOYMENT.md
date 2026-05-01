# PullBackup Deployment Guide

## Production Deployment Checklist

### Pre-Deployment

- [ ] Review and update all configuration files
- [ ] Generate strong SECRET_KEY
- [ ] Plan backup storage capacity
- [ ] Prepare SSH keys for remote servers
- [ ] Configure firewall rules
- [ ] Plan backup schedules to avoid peak hours
- [ ] Set up monitoring and alerting
- [ ] Document disaster recovery procedures

### Security Hardening

#### 1. Change Default Credentials
```bash
# After first login, immediately change admin password
# Navigate to user settings in the UI
```

#### 2. Generate Strong SECRET_KEY
```bash
# Generate a secure random key
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Add to backend/.env
SECRET_KEY=<generated-key>
```

#### 3. Use HTTPS in Production

**Option A: Nginx Reverse Proxy**
```nginx
server {
    listen 443 ssl http2;
    server_name pullbackup.example.com;

    ssl_certificate /etc/ssl/certs/pullbackup.crt;
    ssl_certificate_key /etc/ssl/private/pullbackup.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Option B: Kubernetes Ingress with cert-manager**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: pullbackup-ingress
  namespace: pullbackup
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - pullbackup.example.com
    secretName: pullbackup-tls
  rules:
  - host: pullbackup.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: pullbackup-frontend
            port:
              number: 80
```

#### 4. Configure CORS Properly

Edit `backend/app/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://pullbackup.example.com"],  # Specific domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 5. Use PostgreSQL Instead of SQLite

Update `backend/.env`:
```env
DATABASE_URL=postgresql://pullbackup:secure_password@postgres:5432/pullbackup
```

Add PostgreSQL to `docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: pullbackup
      POSTGRES_USER: pullbackup
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - pullbackup-network

volumes:
  postgres_data:
```

### Deployment Options

## Option 1: Docker Compose

**Best for:** Single server deployments, development, small teams

### Steps:

1. **Clone the repository:**
```bash
git clone <repository-url>
cd PullBackup
```

2. **Configure environment:**
```bash
cp backend/.env.example backend/.env
nano backend/.env  # Edit configuration
```

3. **Build and start:**
```bash
docker-compose up -d
```

4. **Verify deployment:**
```bash
docker-compose ps
docker-compose logs -f
```

5. **Access application:**
```
http://localhost:3000
```

### Backup and Restore

**Backup:**
```bash
# Stop the application
docker-compose down

# Backup data directories
tar -czf pullbackup-backup-$(date +%Y%m%d).tar.gz data/ backups/ ssh_keys/

# Restart
docker-compose up -d
```

**Restore:**
```bash
# Stop the application
docker-compose down

# Restore data
tar -xzf pullbackup-backup-YYYYMMDD.tar.gz

# Start
docker-compose up -d
```

## Option 2: Kubernetes

**Best for:** Multi-server deployments, high availability, auto-scaling

### Prerequisites:

1. **Kubernetes cluster** (k8s, MicroK8s, GKE, EKS, AKS)
2. **kubectl** configured
3. **Persistent storage** provisioner
4. **Load balancer** (MetalLB for bare metal)

### Steps:

1. **Build Docker images:**
```bash
chmod +x build.sh
./build.sh
```

2. **Tag and push to registry (if using remote cluster):**
```bash
docker tag pullbackup-backend:latest your-registry/pullbackup-backend:latest
docker tag pullbackup-frontend:latest your-registry/pullbackup-frontend:latest

docker push your-registry/pullbackup-backend:latest
docker push your-registry/pullbackup-frontend:latest
```

3. **Update image references in k8s/deployment.yaml:**
```yaml
spec:
  containers:
  - name: backend
    image: your-registry/pullbackup-backend:latest
```

4. **Create namespace and secrets:**
```bash
kubectl create namespace pullbackup

# Generate strong secret key
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

kubectl create secret generic pullbackup-secrets \
  --from-literal=SECRET_KEY=$SECRET_KEY \
  --from-literal=DATABASE_URL=sqlite:///./data/pullbackup.db \
  -n pullbackup
```

5. **Deploy:**
```bash
kubectl apply -f k8s/deployment.yaml
```

6. **Verify deployment:**
```bash
kubectl get pods -n pullbackup
kubectl get svc -n pullbackup
```

7. **Access application:**

**Option A: Port Forward (testing):**
```bash
kubectl port-forward -n pullbackup svc/pullbackup-frontend 3000:80
```

**Option B: LoadBalancer (production):**
```bash
kubectl get svc -n pullbackup pullbackup-frontend
# Note the EXTERNAL-IP
```

### High Availability Setup

**1. Increase replicas:**
```yaml
spec:
  replicas: 3  # Multiple frontend instances
```

**2. Add pod anti-affinity:**
```yaml
spec:
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
            - key: app
              operator: In
              values:
              - pullbackup
          topologyKey: kubernetes.io/hostname
```

**3. Configure resource limits:**
```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

## Option 3: MicroK8s

**Best for:** Edge deployments, IoT, local development

```bash
# Install MicroK8s
sudo snap install microk8s --classic

# Enable required addons
microk8s enable dns storage metallb ingress

# Build images
./build.sh

# Import images to MicroK8s
docker save pullbackup-backend:latest | microk8s ctr image import -
docker save pullbackup-frontend:latest | microk8s ctr image import -

# Deploy
microk8s kubectl apply -f k8s/deployment.yaml

# Access
microk8s kubectl port-forward -n pullbackup svc/pullbackup-frontend 3000:80
```

## Monitoring and Logging

### Application Logs

**Docker Compose:**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Kubernetes:**
```bash
kubectl logs -f -n pullbackup deployment/pullbackup-backend
kubectl logs -f -n pullbackup deployment/pullbackup-frontend
```

### Health Checks

**Backend health endpoint:**
```bash
curl http://localhost:8000/health
```

**Expected response:**
```json
{"status": "healthy"}
```

### Prometheus Monitoring (Optional)

Add metrics endpoint to backend:
```python
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app)
```

## Backup Strategies

### 1. Database Backup

**SQLite:**
```bash
# Backup
sqlite3 data/pullbackup.db ".backup 'pullbackup-db-backup.db'"

# Restore
cp pullbackup-db-backup.db data/pullbackup.db
```

**PostgreSQL:**
```bash
# Backup
pg_dump -h postgres -U pullbackup pullbackup > pullbackup-db-backup.sql

# Restore
psql -h postgres -U pullbackup pullbackup < pullbackup-db-backup.sql
```

### 2. Backup Data Replication

**rsync to secondary location:**
```bash
rsync -avz /path/to/backups/ user@backup-server:/secondary/backups/
```

**S3 sync (AWS, MinIO, etc.):**
```bash
aws s3 sync /path/to/backups/ s3://backup-bucket/pullbackup/
```

### 3. Automated Backup Script

```bash
#!/bin/bash
# backup-pullbackup.sh

DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/backups/pullbackup-system"

mkdir -p $BACKUP_DIR

# Backup database
sqlite3 data/pullbackup.db ".backup '$BACKUP_DIR/db-$DATE.db'"

# Backup configuration
tar -czf $BACKUP_DIR/config-$DATE.tar.gz backend/.env

# Backup SSH keys
tar -czf $BACKUP_DIR/ssh-keys-$DATE.tar.gz ssh_keys/

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

### 4. Schedule with cron

```bash
# Edit crontab
crontab -e

# Add daily backup at 3 AM
0 3 * * * /path/to/backup-pullbackup.sh >> /var/log/pullbackup-backup.log 2>&1
```

## Performance Tuning

### 1. Optimize rsync

```bash
# Use compression for slow connections
rsync_options: "-avz"

# Skip compression for fast local networks
rsync_options: "-av --no-compress"

# Limit bandwidth (KB/s)
rsync_options: "-avz --bwlimit=10000"

# Use delta transfer algorithm
rsync_options: "-avz --partial --inplace"
```

### 2. Database Optimization

**SQLite:**
```python
# Add to database.py
engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False,
        "timeout": 30
    },
    pool_pre_ping=True,
    echo=False
)
```

**PostgreSQL:**
```python
engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True
)
```

### 3. Increase Worker Processes

```bash
# Update Dockerfile.backend
CMD ["sh", "-c", "python init_db.py && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4"]
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.

## Updating

### Docker Compose:
```bash
docker-compose pull
docker-compose up -d
```

### Kubernetes:
```bash
./build.sh
kubectl rollout restart deployment/pullbackup-backend -n pullbackup
kubectl rollout restart deployment/pullbackup-frontend -n pullbackup
```

## Uninstall

### Docker Compose:
```bash
docker-compose down -v
rm -rf data/ backups/ ssh_keys/
```

### Kubernetes:
```bash
kubectl delete namespace pullbackup
```
