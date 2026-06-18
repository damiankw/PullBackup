# PullBackup

Self-hosted, pull-based backup system with a web UI. Connects to your remote servers over SSH and pulls files via rsync into local snapshots.

## Features

- Browser-based UI — manage servers, jobs, and schedules without touching config files
- rsync over SSH with incremental snapshots and hardlinks
- Cron scheduling or on-demand runs
- Browse and diff any snapshot directly in the UI
- SSH key management (generate or import)
- Email notifications on failure or success
- Single container — backend and frontend served on port 8000
- Role-based access (admin / user)
- Audit log

## Quick Start

```bash
docker compose -f deploy/docker-compose.yml up -d
```

Open `http://localhost:8000` — the setup wizard will run on first launch to create your admin account and configure backup storage.

## Setup

See [SETUP.md](SETUP.md) for local development, Docker, and Kubernetes deployment instructions.

## API

Interactive API docs are available at `http://localhost:8000/docs` once the app is running.

## License

MIT — see [LICENSE](LICENSE).
