# PullBackup Quick Start Guide

## Prerequisites

- Docker and Docker Compose
- OR Kubernetes cluster (k8s, MicroK8s, etc.)
- SSH access to remote servers you want to backup

## Quick Start with Docker Compose

1. **Clone and navigate to the project:**
   ```bash
   cd PullBackup
   ```

2. **Start the application:**
   ```bash
   docker-compose up -d
   ```

3. **Access the web UI:**
   Open http://localhost:3000 in your browser

4. **Login with default credentials:**
   - Username: `admin`
   - Password: `admin`
   - ⚠️ **Change this password immediately!**

## Quick Start with Kubernetes

1. **Build Docker images:**
   ```bash
   chmod +x build.sh
   ./build.sh
   ```

2. **Deploy to Kubernetes:**
   ```bash
   chmod +x k8s/deploy.sh
   ./k8s/deploy.sh
   ```

3. **Access the application:**
   ```bash
   kubectl port-forward -n pullbackup svc/pullbackup-frontend 3000:80
   ```
   
   Then open http://localhost:3000

## First Steps

### 1. Add an SSH Key

1. Navigate to **SSH Keys**
2. Click **Add SSH Key**
3. Paste your SSH private key
4. Give it a name (e.g., "Production Server Key")

### 2. Add a Server

1. Navigate to **Servers**
2. Click **Add Server**
3. Fill in the details:
   - Name: e.g., "Production Server"
   - Hostname: e.g., "prod.example.com"
   - Port: 22 (default SSH port)
   - Username: SSH username
   - SSH Key: Select the key you added
4. Click **Test Connection** to verify
5. Save

### 3. Create a Backup Job

1. Navigate to **Backup Jobs**
2. Click **Create Backup Job**
3. Fill in the details:
   - Name: e.g., "Production DB Backup"
   - Server: Select your server
   - Remote Path: e.g., "/var/lib/mysql"
   - Local Path: e.g., "production/mysql"
   - Schedule: e.g., "0 2 * * *" (daily at 2am)
4. Save

### 4. Run a Manual Backup

1. Find your backup job in the list
2. Click the **Play** button
3. Navigate to **History** to monitor progress

## Cron Schedule Format

Schedule format: `minute hour day month weekday`

Examples:
- `0 2 * * *` - Daily at 2:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday at midnight
- `30 3 * * 1-5` - Weekdays at 3:30 AM

Leave empty for manual-only backups.

## Environment Variables

Edit `.env` file in the backend directory:

```env
# Database
DATABASE_URL=sqlite:///./data/pullbackup.db

# Security
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Backup Settings
BACKUP_ROOT_DIR=/backups
SSH_KEYS_DIR=/app/ssh_keys
MAX_PARALLEL_BACKUPS=3
```

## Troubleshooting

### SSH Connection Failed
- Verify the SSH key has correct permissions (600)
- Ensure the public key is in `~/.ssh/authorized_keys` on the remote server
- Check firewall allows SSH connections
- Verify username and hostname

### Backup Job Not Running
- Check the cron schedule is valid
- Review logs in Backup History
- Verify the remote path exists and is readable
- Ensure rsync is installed on both systems

### View Logs

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

## Data Persistence

Your data is stored in:
- **Database:** `data/pullbackup.db`
- **Backups:** `backups/` directory
- **SSH Keys:** `ssh_keys/` directory

Make sure to backup these directories regularly!

## Security Best Practices

1. **Change default admin password** immediately
2. **Use strong SECRET_KEY** in production
3. **Enable HTTPS** with a reverse proxy (nginx, traefik)
4. **Restrict network access** to the application
5. **Regularly rotate SSH keys**
6. **Monitor backup logs** for failures
7. **Backup the database** regularly

## API Documentation

Once running, access interactive API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Support

For issues and questions:
- Check the logs
- Review the README.md
- Check API documentation

## Uninstall

**Docker Compose:**
```bash
docker-compose down -v
```

**Kubernetes:**
```bash
kubectl delete namespace pullbackup
```
