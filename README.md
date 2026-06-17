# PullBackup - Enterprise Backup System

A robust, containerized backup system using rsync over SSH with a modern web interface.

## Features

- 🔐 **Multi-user Authentication** - Secure JWT-based user management
- 🖥️ **Server Management** - Add and configure remote servers via web UI
- 📁 **Flexible Backup Paths** - Select specific directories to backup from each server
- 🔑 **SSH Key Management** - Upload and manage SSH keys for secure server access
- ⏰ **Scheduled Backups** - Cron-based automatic backup scheduling
- ▶️ **Manual Backups** - On-demand backup execution
- 📊 **Backup History** - Track all backup jobs with status and logs
- 🐳 **Container Ready** - Docker, Kubernetes, and MicroK8s compatible
- 📈 **Real-time Logs** - Monitor backup progress in real-time
- 👥 **Role-Based Access** - Admin and user roles with different permissions

## Tech Stack

- **Backend**: FastAPI (Python 3.11+)
- **Database**: SQLite/PostgreSQL (configurable)
- **Frontend**: React with Material-UI
- **Scheduler**: APScheduler
- **Backup Engine**: rsync over SSH
- **Authentication**: JWT tokens
- **Containerization**: Docker & Kubernetes

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone and navigate to the project
cd PullBackup

# Start the application
docker-compose up -d

# Access the web UI
open http://localhost:3000
```

Default admin credentials:
- **Username**: admin
- **Password**: admin (change immediately!)

### Manual Setup

#### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Initialize database
python init_db.py

# Run the backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### Frontend Setup

```bash
cd frontend
npm install
npm start
```

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Database
DATABASE_URL=sqlite:///./pullbackup.db
# For PostgreSQL: postgresql://user:password@localhost/pullbackup

# Security
SECRET_KEY=your-secret-key-change-this
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Backup Settings
BACKUP_ROOT_DIR=/var/backups
SSH_KEYS_DIR=/app/ssh_keys
MAX_PARALLEL_BACKUPS=3

# SMTP Settings (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@pullbackup.com
```

## Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n pullbackup

# Access the service
kubectl port-forward -n pullbackup svc/pullbackup-frontend 3000:80
```

## Usage

### Adding a Server

1. Navigate to **Servers** in the web UI
2. Click **Add Server**
3. Enter server details (hostname, port, username)
4. Upload SSH private key or paste it
5. Test connection
6. Save

### Creating a Backup Job

1. Navigate to **Backup Jobs**
2. Click **Create Backup Job**
3. Select a server
4. Enter remote path to backup
5. Set local destination path
6. Configure schedule (cron expression) or leave empty for manual-only
7. Save

### Running a Manual Backup

1. Navigate to **Backup Jobs**
2. Find the job you want to run
3. Click **Run Now**
4. Monitor progress in **Backup History**

## API Documentation

Once the backend is running, access the interactive API docs at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Security Considerations

1. **Change default admin password** immediately after first login
2. **Use strong SECRET_KEY** in production
3. **Store SSH keys securely** - keys are stored encrypted
4. **Use HTTPS** in production (configure reverse proxy)
5. **Regular backups** of the database
6. **Network isolation** - restrict SSH access to backup server only
7. **Audit logs** - review backup history regularly

## Architecture

```
PullBackup
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── api/      # API endpoints
│   │   ├── core/     # Configuration
│   │   ├── models/   # Database models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── services/ # Business logic
│   │   └── main.py   # Application entry
│   └── requirements.txt
├── frontend/         # React application
│   ├── public/
│   └── src/
├── k8s/             # Kubernetes manifests
├── docker-compose.yml
└── Dockerfile
```

## Troubleshooting

### SSH Connection Failed
- Verify SSH key has correct permissions (600)
- Ensure the public key is in `~/.ssh/authorized_keys` on remote server
- Check firewall rules allow SSH connections
- Verify username and hostname are correct

### Backup Job Not Running
- Check scheduler is enabled in settings
- Verify cron expression is valid
- Review logs in **Backup History**
- Ensure rsync is installed on both systems

### Permission Denied
- Verify backup user has read access to source directories
- Check destination directory is writable
- Review SSH key permissions

## Contributing

Contributions are welcome! Please submit pull requests or open issues.

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [Create an issue]
- Documentation: See `/docs` directory
- API Docs: http://localhost:8000/docs
