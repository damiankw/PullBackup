# PullBackup Setup

PullBackup is a self-hosted pull-based backup system. The backend and frontend are served as a single unified application on port 8000. Choose the deployment method that suits your environment.

---

## Local Run

Best for development or trying the app out without Docker.

**Prerequisites**
- Python 3.11+
- Node.js 18+
- rsync and openssh-client installed on the host

**Setup**

```bash
# Create and activate a Python virtual environment
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..

# Build the React frontend
./deploy/build.sh local
```

`build.sh local` compiles the frontend and copies it into `backend/frontend_build/`, where the backend serves it statically.

**Start**

```bash
./deploy/run.sh
# or: ./deploy/run.sh local
```

The app is available at `http://localhost:8000`.

**Active frontend development**

If you're working on the frontend, run Vite's dev server alongside the backend for hot reload:

```bash
# Terminal 1 — backend
cd backend && source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — frontend
cd frontend && npm install && npm run start
```

The Vite dev server runs on `http://localhost:3000` and proxies `/api` requests to port 8000.

**Configuration**

Copy `backend/.env.example` to `backend/.env` and adjust as needed. The defaults work for local use — the main things you might want to change are `BACKUP_ROOT_DIR` and `SSH_KEYS_DIR` to point at real directories on your machine.

---

## Docker

The recommended way to run PullBackup in production.

**Prerequisites**
- Docker 20.10+
- Docker Compose v2

**Start**

```bash
docker compose -f deploy/docker-compose.yml up -d
```

The app is available at `http://localhost:8000`.

**Configuration**

`deploy/docker-compose.yml` sets sensible defaults. Before deploying to anything beyond a local test, set a real `SECRET_KEY`:

```bash
# In your shell, or in a .env file at the repo root
export SECRET_KEY=$(openssl rand -hex 32)
docker compose -f deploy/docker-compose.yml up -d
```

To persist backups to a NAS or external disk, update the volume mount in `deploy/docker-compose.yml`:

```yaml
volumes:
  - /your/nas/backup:/app/data/backups
```

SMTP notifications are disabled by default. Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD` to the environment block if you want them.

**Logs**

```bash
docker compose -f deploy/docker-compose.yml logs -f
```

---

## Kubernetes

For running PullBackup in a Kubernetes cluster.

**Prerequisites**
- A running cluster (tested with MicroK8s)
- `kubectl` configured

**Build and deploy**

```bash
# Build the Docker image
./deploy/build.sh docker

# Import into MicroK8s (if not using a registry)
./deploy/k8s/import-to-microk8s.sh

# Deploy
./deploy/k8s/deploy.sh
```

Check the deployment:

```bash
kubectl get pods -n pullbackup
```

**Configuration**

Set `SECRET_KEY` and other environment variables via a Kubernetes Secret or ConfigMap and reference them in the deployment manifest. See `deploy/k8s/deployment.yaml` for the expected environment variable names. For NFS-backed backup storage, see `deploy/k8s/deployment-nfs.yaml`.

---

## First Run

Regardless of deployment method, when you first open the app in a browser you will be greeted by the setup wizard. This wizard runs once — when no users exist in the database.

1. Create your admin account with a username and strong password
2. The app generates and stores a secure `SECRET_KEY` automatically

There is no default username or password.

---

## Adding SSH Keys

Navigate to **SSH Keys** in the sidebar.

- **Generate Key** — creates a new key pair on the server (Ed25519 recommended). Copy the displayed public key to `~/.ssh/authorized_keys` on your remote server.
- **Add / Import Key** — upload an existing private key from your machine.

---

## Adding Servers

Navigate to **Servers** and click **Add Server**. Fill in the hostname, port, username, and select an SSH key.

After creating a server, two steps are worth doing immediately:

- **Test Connection** — confirms SSH access works
- **Scan Host Key** (shield icon) — records the server's host key fingerprint so all future connections use strict host key verification

---

## Creating Backup Jobs

Navigate to **Backup Jobs** and click **Create Backup Job**.

- **Remote Path** — the path on the remote server to back up (e.g. `/var/www/html`)
- **Schedule** — a cron expression for automatic runs (e.g. `0 2 * * *` for 2 AM daily), or leave blank for manual-only
- **rsync Options** — the default `-avz --no-owner --no-group` is appropriate for most cases

When a job is created, its backup directory is created immediately and a `README.md` is written inside it with the job's details — useful for manual recovery if the app is unavailable.

---

## Troubleshooting

**Container won't start** — check `docker compose -f deploy/docker-compose.yml logs`. Verify port 8000 is free and the data volume mount path exists.

**Setup wizard doesn't appear** — check the backend logs for errors during startup. Clear browser localStorage and reload.

**SSH connection fails** — test the connection manually from the host: `ssh -i <key> -p <port> <user>@<host>`. Confirm the public key is in the remote server's `authorized_keys`.

**Backup fails** — open the log in Backup History. Common causes: remote path doesn't exist, SSH user lacks read permission, or the backup volume is full.

