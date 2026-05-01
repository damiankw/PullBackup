# PullBackup API Reference

## Authentication

All API endpoints (except `/auth/login` and `/auth/register`) require authentication using JWT tokens.

Include the token in the `Authorization` header:
```
Authorization: Bearer <your-token>
```

## Endpoints

### Authentication

#### POST /api/auth/login
Login and obtain JWT token.

**Request:**
```json
{
  "username": "admin",
  "password": "admin"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

#### POST /api/auth/register
Register a new user.

**Request:**
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "securepassword",
  "role": "user"
}
```

### Servers

#### GET /api/servers/
List all servers for the current user.

#### POST /api/servers/
Create a new server.

**Request:**
```json
{
  "name": "Production Server",
  "hostname": "prod.example.com",
  "port": 22,
  "username": "backup",
  "ssh_key_id": 1,
  "description": "Main production server"
}
```

#### GET /api/servers/{server_id}
Get server details including backup jobs.

#### PUT /api/servers/{server_id}
Update server configuration.

#### DELETE /api/servers/{server_id}
Delete a server.

#### POST /api/servers/{server_id}/test-connection
Test SSH connection to server.

**Response:**
```json
{
  "success": true,
  "message": "Connection successful",
  "tested_at": "2026-05-01T12:00:00"
}
```

### SSH Keys

#### GET /api/ssh-keys/
List all SSH keys for the current user.

#### POST /api/ssh-keys/
Upload a new SSH key.

**Request:**
```json
{
  "name": "Production Key",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
}
```

#### GET /api/ssh-keys/{key_id}
Get SSH key details.

#### DELETE /api/ssh-keys/{key_id}
Delete an SSH key.

### Backup Jobs

#### GET /api/backup-jobs/
List all backup jobs for the current user.

#### POST /api/backup-jobs/
Create a new backup job.

**Request:**
```json
{
  "name": "Daily Database Backup",
  "server_id": 1,
  "remote_path": "/var/lib/mysql",
  "local_path": "production/mysql",
  "schedule": "0 2 * * *",
  "rsync_options": "-avz --delete"
}
```

#### GET /api/backup-jobs/{job_id}
Get backup job details including history.

#### PUT /api/backup-jobs/{job_id}
Update backup job.

#### DELETE /api/backup-jobs/{job_id}
Delete backup job.

#### POST /api/backup-jobs/{job_id}/run
Manually trigger a backup job.

**Response:**
```json
{
  "message": "Backup started",
  "history_id": 123
}
```

### Backup History

#### GET /api/backup-history/
List backup history with optional filtering.

**Query Parameters:**
- `backup_job_id` (optional): Filter by specific backup job
- `skip`: Number of records to skip (pagination)
- `limit`: Maximum number of records to return

#### GET /api/backup-history/{history_id}
Get detailed backup history entry.

**Response:**
```json
{
  "id": 123,
  "backup_job_id": 1,
  "status": "success",
  "started_at": "2026-05-01T02:00:00",
  "completed_at": "2026-05-01T02:15:30",
  "bytes_transferred": 1048576000,
  "files_transferred": 1234,
  "triggered_by": "schedule",
  "log_output": "sending incremental file list\n..."
}
```

#### DELETE /api/backup-history/{history_id}
Delete backup history entry.

### Dashboard

#### GET /api/dashboard/stats
Get dashboard statistics.

**Response:**
```json
{
  "total_servers": 5,
  "total_backup_jobs": 10,
  "total_backups": 150,
  "successful_backups": 145,
  "failed_backups": 5,
  "running_backups": 2
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "detail": "Invalid request parameters"
}
```

### 401 Unauthorized
```json
{
  "detail": "Could not validate credentials"
}
```

### 403 Forbidden
```json
{
  "detail": "Not authorized to access this resource"
}
```

### 404 Not Found
```json
{
  "detail": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}
```

## Cron Schedule Format

Backup job schedules use the standard cron format:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday is 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Examples:**
- `0 2 * * *` - Every day at 2:00 AM
- `*/30 * * * *` - Every 30 minutes
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Every Sunday at midnight
- `30 3 * * 1-5` - Weekdays at 3:30 AM

## Interactive Documentation

For interactive API documentation with try-it-out functionality:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
