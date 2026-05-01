# PullBackup Troubleshooting Guide

## Common Issues and Solutions

### Installation Issues

#### Docker Build Fails

**Problem:** Docker build fails with "no space left on device"

**Solution:**
```bash
# Clean up Docker
docker system prune -a

# Check available space
df -h

# Increase Docker disk space in Docker Desktop settings
```

#### Permission Denied on SSH Keys

**Problem:** SSH connection fails with "permission denied"

**Solution:**
```bash
# Fix SSH key permissions
chmod 700 ssh_keys
chmod 600 ssh_keys/*

# In Docker, rebuild with correct permissions
docker-compose down
docker-compose up -d --build
```

### Authentication Issues

#### Cannot Login - "Could not validate credentials"

**Symptoms:**
- Login fails even with correct credentials
- Token validation errors

**Solutions:**

1. **Check SECRET_KEY is set:**
```bash
# In backend/.env
SECRET_KEY=your-secret-key-here  # Must be set and not empty
```

2. **Clear browser cache and localStorage:**
```javascript
// Open browser console
localStorage.clear()
// Refresh page
```

3. **Restart backend:**
```bash
docker-compose restart backend
```

#### 401 Unauthorized on All API Calls

**Problem:** All API requests return 401 after login

**Solution:**
```javascript
// Check token is stored
console.log(localStorage.getItem('token'))

// If null, login again
// If present, check token format in Network tab
// Should be: Authorization: Bearer <token>
```

### Connection Issues

#### SSH Connection Test Fails

**Symptoms:**
- "Connection timeout"
- "Connection refused"
- "Permission denied"

**Solutions:**

1. **Verify server is reachable:**
```bash
# From the backend container
docker-compose exec backend ping remote-server.com
docker-compose exec backend nc -zv remote-server.com 22
```

2. **Check SSH key format:**
- Must be a private key (not public key)
- Must include header/footer (e.g., `-----BEGIN RSA PRIVATE KEY-----`)
- No extra whitespace or line breaks

3. **Verify SSH key on remote server:**
```bash
# The corresponding public key must be in authorized_keys
ssh user@remote-server "cat ~/.ssh/authorized_keys"
```

4. **Test SSH manually:**
```bash
# From backend container
docker-compose exec backend ssh -i /app/ssh_keys/user_1/key.pem user@hostname
```

5. **Check firewall rules:**
```bash
# On remote server
sudo ufw status
sudo iptables -L
```

### Backup Issues

#### Backup Job Stays in "Pending" Status

**Problem:** Backup job never starts executing

**Solutions:**

1. **Check backend logs:**
```bash
docker-compose logs -f backend
# Look for errors in scheduler
```

2. **Verify scheduler is running:**
```python
# In backend logs, should see:
# "Backup scheduler started"
```

3. **Restart backend:**
```bash
docker-compose restart backend
```

#### Backup Fails with "rsync: command not found"

**Problem:** rsync not installed in container

**Solution:**
```bash
# Check Dockerfile.backend includes:
RUN apt-get update && apt-get install -y rsync openssh-client

# Rebuild
docker-compose up -d --build
```

#### Backup Fails with "Permission denied" on Remote Path

**Problem:** SSH user doesn't have read access

**Solutions:**

1. **Check remote path permissions:**
```bash
ssh user@remote ls -la /path/to/backup
```

2. **Grant read access:**
```bash
# On remote server
sudo chmod +r /path/to/backup/*
# Or add user to appropriate group
sudo usermod -aG datagroup backupuser
```

3. **Use sudo (if configured):**
```bash
# rsync_options in backup job
--rsync-path="sudo rsync"
```

#### Backup Succeeds but No Data Transferred

**Problem:** Backup completes successfully but bytes_transferred = 0

**Causes:**
- Remote path is empty
- Files haven't changed since last backup
- Remote path doesn't exist

**Solution:**
```bash
# Verify remote path exists and has data
ssh user@remote ls -lh /path/to/backup

# Check backup logs for details
# Navigate to Backup History and view log output
```

#### Backup Fails with "No space left on device"

**Problem:** Local backup storage is full

**Solutions:**

1. **Check disk space:**
```bash
df -h /backups
```

2. **Clean up old backups:**
```bash
# List large directories
du -sh /backups/* | sort -h

# Remove old backups
rm -rf /backups/old-backup-folder
```

3. **Increase volume size:**
```yaml
# In docker-compose.yml, no direct size limit
# Check Docker Desktop settings for disk size

# For Kubernetes
# Edit PVC to request more storage
spec:
  resources:
    requests:
      storage: 500Gi  # Increase as needed
```

### Scheduled Backup Issues

#### Scheduled Backups Not Running

**Problem:** Manual backups work, but scheduled backups never execute

**Solutions:**

1. **Verify cron expression:**
```python
# Must be valid cron format: minute hour day month weekday
# Examples:
"0 2 * * *"    # 2 AM daily
"*/30 * * * *" # Every 30 minutes
```

2. **Check next_run time:**
```bash
# In database or via API
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/backup-jobs/1
# Check "next_run" field
```

3. **Check scheduler logs:**
```bash
docker-compose logs backend | grep -i scheduler
# Should see "Added scheduled job for backup X"
```

4. **Verify job is active:**
```bash
# Backup job must have is_active = true
# Check in UI or database
```

### Database Issues

#### Database Locked Error

**Problem:** "database is locked" errors with SQLite

**Solutions:**

1. **Use PostgreSQL for production:**
```env
DATABASE_URL=postgresql://user:pass@postgres:5432/pullbackup
```

2. **Increase SQLite timeout:**
```python
# In app/core/database.py
engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False,
        "timeout": 30  # Increase timeout
    }
)
```

3. **Reduce concurrent operations:**
```env
MAX_PARALLEL_BACKUPS=1  # Reduce from 3
```

#### Database Migration Fails

**Problem:** Database schema changes not applied

**Solution:**
```bash
# Recreate database (CAUTION: destroys data)
docker-compose down
rm -f data/pullbackup.db
docker-compose up -d

# Or use Alembic for migrations (advanced)
```

### Performance Issues

#### Web UI is Slow

**Solutions:**

1. **Check network latency:**
```bash
# From browser developer tools
# Network tab - check API response times
```

2. **Check database size:**
```bash
ls -lh data/pullbackup.db

# If very large, clean old history
DELETE FROM backup_history WHERE created_at < date('now', '-90 days');
```

3. **Add pagination limits:**
```javascript
// In frontend API calls
api.get('/backup-history/?limit=50')
```

#### Backup is Very Slow

**Solutions:**

1. **Check network bandwidth:**
```bash
# Use --bwlimit if needed
rsync_options: "-avz --bwlimit=10000"  # 10 MB/s
```

2. **Disable compression on fast networks:**
```bash
rsync_options: "-av --no-compress"
```

3. **Use incremental backups:**
```bash
rsync_options: "-avz --delete --partial"
```

4. **Check remote server load:**
```bash
ssh user@remote top
```

### Container Issues

#### Container Exits Immediately

**Problem:** Backend container keeps restarting

**Solutions:**

1. **Check logs:**
```bash
docker-compose logs backend
```

2. **Common causes:**
- Database connection failure
- Missing environment variables
- Port already in use
- Syntax error in Python code

3. **Run container interactively:**
```bash
docker-compose run --rm backend bash
# Try starting manually:
python init_db.py
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### Cannot Access Frontend

**Problem:** http://localhost:3000 doesn't load

**Solutions:**

1. **Check container is running:**
```bash
docker-compose ps
```

2. **Check port mapping:**
```bash
docker-compose ps frontend
# Should show 0.0.0.0:3000->80/tcp
```

3. **Check if port is in use:**
```bash
lsof -i :3000
# Kill process using port or change port in docker-compose.yml
```

4. **Check browser console for errors:**
```
F12 -> Console tab
```

### Kubernetes Issues

#### Pods in CrashLoopBackOff

**Problem:** Kubernetes pods keep restarting

**Solutions:**

1. **Check pod logs:**
```bash
kubectl logs -n pullbackup deployment/pullbackup-backend
```

2. **Describe pod for events:**
```bash
kubectl describe pod -n pullbackup <pod-name>
```

3. **Check resource limits:**
```bash
# Increase if OOMKilled
kubectl describe pod -n pullbackup <pod-name> | grep -i oom
```

#### PersistentVolumeClaim Pending

**Problem:** PVC stuck in Pending state

**Solutions:**

1. **Check storage class:**
```bash
kubectl get storageclass
```

2. **Check if provisioner is running:**
```bash
# For default provisioner
kubectl get pods -n kube-system | grep provisioner
```

3. **Manually create PV (if using local storage):**
```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pullbackup-data-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  hostPath:
    path: /mnt/data/pullbackup
```

### Logging and Debugging

#### Enable Debug Logging

**Backend:**
```env
# In backend/.env
DEBUG=True
```

**Docker Compose:**
```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend

# Tail last 100 lines
docker-compose logs --tail=100 backend
```

**Kubernetes:**
```bash
# Stream logs
kubectl logs -f -n pullbackup deployment/pullbackup-backend

# Last 100 lines
kubectl logs --tail=100 -n pullbackup deployment/pullbackup-backend

# Previous crashed container
kubectl logs -p -n pullbackup <pod-name>
```

#### Access Backend Shell

**Docker Compose:**
```bash
docker-compose exec backend bash

# Test database
python3
>>> from app.core.database import SessionLocal
>>> db = SessionLocal()
>>> from app.models.models import User
>>> db.query(User).all()
```

**Kubernetes:**
```bash
kubectl exec -it -n pullbackup deployment/pullbackup-backend -- bash
```

### API Debugging

#### Test API Endpoints

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Get token from response, then:
TOKEN="<your-token>"

# List servers
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/servers/

# Health check
curl http://localhost:8000/health
```

#### Enable CORS for API Testing

```python
# Temporarily in app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (DEV ONLY)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Getting Help

If you're still experiencing issues:

1. **Check the logs** thoroughly
2. **Search GitHub issues** (if open source)
3. **Check API documentation** at http://localhost:8000/docs
4. **Review architecture** in [ARCHITECTURE.md](ARCHITECTURE.md)
5. **Verify configuration** against [DEPLOYMENT.md](DEPLOYMENT.md)

## Reporting Bugs

When reporting issues, include:

1. **Environment:**
   - Deployment method (Docker Compose / Kubernetes)
   - OS and version
   - Docker / Kubernetes version

2. **Steps to reproduce**

3. **Logs:**
   ```bash
   docker-compose logs > logs.txt
   # Or
   kubectl logs -n pullbackup deployment/pullbackup-backend > logs.txt
   ```

4. **Configuration** (remove sensitive data):
   - docker-compose.yml
   - backend/.env (redact secrets)
   - k8s manifests

5. **Expected vs actual behavior**
