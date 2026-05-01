# PullBackup Architecture

## Overview

PullBackup is a containerized backup system that uses rsync over SSH to pull data from remote servers to a central backup location. It consists of a FastAPI backend, React frontend, and supports deployment on Docker and Kubernetes.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Web Browser                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ HTTPS
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    React Frontend                            │
│                  (nginx, port 80/443)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ REST API
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   FastAPI Backend                            │
│                    (port 8000)                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  API Endpoints (auth, servers, jobs, history)         │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Business Logic (rsync service, scheduler)            │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Database (SQLite/PostgreSQL)                         │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ SSH/rsync
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Remote Servers                            │
│         (servers to be backed up via SSH)                    │
└──────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (React + Material-UI)

**Technology Stack:**
- React 18
- Material-UI (MUI) 5
- React Router for navigation
- Axios for API communication
- JWT for authentication

**Key Features:**
- Responsive design
- Dashboard with statistics
- Server management UI
- SSH key management
- Backup job creation and scheduling
- Real-time backup history monitoring
- Log viewer

**Files:**
```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   └── Layout.js          # Main layout with navigation
│   ├── pages/
│   │   ├── Login.js           # Login page
│   │   ├── Dashboard.js       # Dashboard with stats
│   │   ├── Servers.js         # Server management
│   │   ├── SSHKeys.js         # SSH key management
│   │   ├── BackupJobs.js      # Backup job management
│   │   └── BackupHistory.js   # Backup history viewer
│   ├── App.js                 # Main app component
│   ├── AuthContext.js         # Authentication context
│   ├── api.js                 # API client
│   └── index.js               # Entry point
├── package.json
└── nginx.conf                 # Nginx configuration
```

### Backend (FastAPI + SQLAlchemy)

**Technology Stack:**
- FastAPI (Python web framework)
- SQLAlchemy (ORM)
- Pydantic (data validation)
- APScheduler (job scheduling)
- JWT for authentication
- bcrypt for password hashing
- rsync for backup execution

**Key Components:**

#### 1. API Layer (`app/api/`)
- `auth.py` - Authentication endpoints (login, register)
- `servers.py` - Server CRUD and connection testing
- `ssh_keys.py` - SSH key management
- `backup_jobs.py` - Backup job CRUD and manual execution
- `backup_history.py` - Backup history queries
- `dashboard.py` - Dashboard statistics

#### 2. Database Models (`app/models/`)
- `User` - User accounts with roles (admin/user)
- `Server` - Remote servers to backup
- `SSHKey` - SSH private keys for authentication
- `BackupJob` - Backup job configurations
- `BackupHistory` - Backup execution logs

#### 3. Services (`app/services/`)
- `rsync_service.py` - rsync execution and SSH management
- `scheduler.py` - APScheduler integration for scheduled backups

#### 4. Core (`app/core/`)
- `config.py` - Configuration management
- `database.py` - Database connection
- `security.py` - JWT and password hashing

**File Structure:**
```
backend/
├── app/
│   ├── api/
│   │   ├── auth.py
│   │   ├── servers.py
│   │   ├── ssh_keys.py
│   │   ├── backup_jobs.py
│   │   ├── backup_history.py
│   │   ├── dashboard.py
│   │   └── deps.py            # Dependency injection
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   └── security.py
│   ├── models/
│   │   └── models.py
│   ├── schemas/
│   │   └── schemas.py
│   ├── services/
│   │   ├── rsync_service.py
│   │   └── scheduler.py
│   └── main.py                # FastAPI app
├── init_db.py                 # Database initialization
└── requirements.txt
```

## Data Flow

### Authentication Flow

1. User submits credentials to `/api/auth/login`
2. Backend validates credentials against database
3. Backend generates JWT token
4. Frontend stores token in localStorage
5. Frontend includes token in all subsequent requests
6. Backend validates token on each request

### Backup Execution Flow

#### Manual Backup
1. User clicks "Run Now" on a backup job
2. Frontend sends POST to `/api/backup-jobs/{id}/run`
3. Backend creates BackupHistory entry with status=PENDING
4. Backend queues backup as background task
5. BackupHistory status changes to RUNNING
6. rsync_service executes rsync over SSH
7. Output is logged to BackupHistory
8. Status changes to SUCCESS or FAILED
9. Frontend polls history for updates

#### Scheduled Backup
1. APScheduler triggers backup at scheduled time
2. Scheduler service creates BackupHistory entry
3. rsync_service executes backup
4. Results saved to database
5. Next run time calculated and saved

## Database Schema

```
┌─────────────┐
│    users    │
├─────────────┤
│ id          │←──┐
│ username    │   │
│ email       │   │
│ password    │   │
│ role        │   │
│ is_active   │   │
└─────────────┘   │
                  │
┌─────────────┐   │
│  ssh_keys   │   │
├─────────────┤   │
│ id          │←──┤───┐
│ name        │   │   │
│ fingerprint │   │   │
│ key_path    │   │   │
│ owner_id    │───┘   │
└─────────────┘       │
                      │
┌─────────────┐       │
│  servers    │       │
├─────────────┤       │
│ id          │←──┐   │
│ name        │   │   │
│ hostname    │   │   │
│ port        │   │   │
│ username    │   │   │
│ ssh_key_id  │───┘   │
│ owner_id    │───────┘
└─────────────┘
       │
       │
┌──────▼──────┐
│ backup_jobs │
├─────────────┤
│ id          │←──┐
│ name        │   │
│ server_id   │───┘
│ remote_path │
│ local_path  │
│ schedule    │
│ owner_id    │
└─────────────┘
       │
       │
┌──────▼──────────┐
│ backup_history  │
├─────────────────┤
│ id              │
│ backup_job_id   │
│ status          │
│ started_at      │
│ completed_at    │
│ bytes_xfer      │
│ files_xfer      │
│ log_output      │
│ error_message   │
└─────────────────┘
```

## Security

### Authentication
- JWT tokens with configurable expiration
- bcrypt password hashing
- Role-based access control (admin/user)

### SSH Key Management
- Private keys stored on disk with 600 permissions
- Keys isolated per user
- Fingerprint validation
- Automatic key cleanup on deletion

### API Security
- All endpoints require authentication (except login/register)
- Users can only access their own resources
- Admins can access all resources
- Input validation with Pydantic

## Deployment

### Docker Compose
- Single-node deployment
- SQLite database
- Persistent volumes for data, backups, SSH keys
- Automatic restart

### Kubernetes
- Multi-node capable
- PersistentVolumeClaims for data persistence
- ConfigMaps and Secrets for configuration
- Health checks and readiness probes
- Horizontal scaling (frontend)
- LoadBalancer or Ingress for access

## Scaling Considerations

**Current Limitations:**
- Single backend instance (APScheduler in-memory state)
- SQLite not suitable for multi-writer scenarios
- No distributed locking

**To Scale:**
1. Switch to PostgreSQL
2. Use external scheduler (Kubernetes CronJobs)
3. Add message queue (RabbitMQ, Redis) for backup tasks
4. Implement distributed locking
5. Multiple backend replicas
6. Shared storage for backups (NFS, S3)

## Monitoring

**Metrics to Monitor:**
- Backup success/failure rates
- Backup duration
- Data transfer rates
- Disk space usage
- API response times
- Database query performance

**Logs:**
- Application logs (FastAPI)
- Backup execution logs (rsync output)
- Scheduler logs (APScheduler)
- Web server logs (nginx)

## Backup Strategy

**3-2-1 Rule:**
- 3 copies of data (original + 2 backups)
- 2 different media types
- 1 offsite copy

**Recommendations:**
- Backup the PullBackup database itself
- Store backups on separate physical storage
- Replicate critical backups offsite
- Test restore procedures regularly
- Monitor backup trends and failures
