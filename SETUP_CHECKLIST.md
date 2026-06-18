# PullBackup Setup Checklist

Use this checklist to get PullBackup running for the first time.

---

## Pre-Deployment

### Required Software
- [ ] Docker installed (version 20.10+)
- [ ] Docker Compose installed (version 2.0+) — OR a Kubernetes cluster
- [ ] Git installed

### Remote Servers
- [ ] SSH access to the servers you want to back up
- [ ] SSH private keys available (PEM or OpenSSH format)
- [ ] Hostnames, usernames, and SSH ports documented
- [ ] Remote paths to back up identified

### Host Machine
- [ ] Sufficient disk space for backups
- [ ] Network connectivity to remote servers
- [ ] Port 8000 available (the app serves everything from one port)

---

## Deployment

### Step 1: Configuration (Docker Compose)

The app works out of the box with the defaults in `docker-compose.yml`. The only things you should consider changing before starting:

- [ ] Set `SECRET_KEY` in your shell environment or a root-level `.env` file:
  ```
  SECRET_KEY=<your-random-string>
  ```
  > If omitted, docker-compose uses the placeholder value. The app will still work, but you should set a real secret for any non-throwaway deployment.
- [ ] Set `BACKUP_ROOT_DIR` volume mount in `docker-compose.yml` to point at the disk where you want backups stored (default: `./backups`)
- [ ] Set `SMTP_*` environment variables if you want email notifications (optional)

For Kubernetes, configure the same values via ConfigMap/Secret and pass them as environment variables to the container.

### Step 2: Start the Application

**Docker Compose:**
- [ ] Run `docker compose up -d`
- [ ] Check status: `docker compose ps` — container should show `Up`
- [ ] Check logs: `docker compose logs -f` — wait for `Application startup complete`

**Kubernetes:**
- [ ] Run `./build.sh` to build and tag the image
- [ ] Run `./k8s/deploy.sh` to deploy
- [ ] Verify: `kubectl get pods -n pullbackup` — all pods should show `Running`

### Step 3: First-Run Setup Wizard

- [ ] Open browser to `http://localhost:8000` (or your server's address)
- [ ] The setup wizard will appear automatically on first run
- [ ] Create your admin account — choose a strong password
- [ ] The app will generate and store a secure `SECRET_KEY` automatically

> There is no default admin account. The wizard only appears once (when no users exist).

---

## Configuration

### Step 4: Add SSH Keys

- [ ] Navigate to **SSH Keys** in the sidebar
- [ ] Either:
  - Click **Generate Key** to create a new key pair on the server (Ed25519 recommended), then copy the public key to your remote server's `~/.ssh/authorized_keys`
  - Click **Add / Import Key** to upload an existing private key from your machine
- [ ] Repeat for each SSH key needed

### Step 5: Add Servers

- [ ] Navigate to **Servers**
- [ ] Click **Add Server** and fill in:
  - [ ] Name, hostname, port (default: 22), username
  - [ ] Select the appropriate SSH key
- [ ] Click **Test Connection** to verify SSH connectivity
- [ ] Click the **Scan Host Key** button (shield icon) to record the server's host key — this enables strict host key verification for all future connections
- [ ] Repeat for each server

### Step 6: Create Backup Jobs

- [ ] Navigate to **Backup Jobs**
- [ ] Click **Create Backup Job** and fill in:
  - [ ] Name
  - [ ] Server
  - [ ] Remote path to back up (e.g. `/var/www/html`)
  - [ ] Schedule in cron format (e.g. `0 2 * * *` for 2 AM daily), or leave blank for manual-only
  - [ ] Rsync options (the default `-avz --no-owner --no-group` is fine for most cases)
- [ ] Click **Create** — the job's backup directory and a `README.md` are created immediately
- [ ] Repeat for each backup job

### Step 7: Run a Test Backup

- [ ] Find your job in the **Backup Jobs** list
- [ ] Click the **Run** (▶) button
- [ ] Navigate to **Backup History** and watch for the job to complete
- [ ] Click the **eye** icon to review the log output
- [ ] Verify status is **Success** and files/bytes transferred look correct
- [ ] Click **Browse Backup Files** (folder icon) to confirm the snapshot is browsable

---

## Post-Setup

### Verify Scheduled Backups
- [ ] Confirm **Next Run** time is shown for scheduled jobs
- [ ] After the scheduled time passes, check **Backup History** for the automatic run

### Protect the Backup System Itself
- [ ] Back up the `data/` directory (contains the SQLite database)
- [ ] Back up the `ssh_keys/` directory (contains your SSH private keys)
- [ ] Back up `backend/.env` if you created one
- [ ] Consider offsite replication of the backup data volume

### Optional Hardening
- [ ] Put the app behind a reverse proxy with TLS (nginx, Traefik, etc.)
- [ ] Restrict network access so only authorised hosts can reach port 8000
- [ ] Switch to PostgreSQL via `DATABASE_URL` for higher-traffic deployments

---

## Troubleshooting

### Container Won't Start
- [ ] Check logs: `docker compose logs`
- [ ] Verify port 8000 is not already in use
- [ ] Ensure sufficient disk space on the backup volume

### Cannot Log In
- [ ] If the setup wizard never appeared, check the backend logs for errors during `init_db.py`
- [ ] Clear browser localStorage and reload
- [ ] Check browser console for errors

### SSH Connection Fails
- [ ] Verify the correct private key is assigned to the server
- [ ] Test SSH manually from the host: `ssh -i <key> -p <port> <user>@<host>`
- [ ] Check the remote server's `authorized_keys` contains the matching public key
- [ ] Verify firewall rules allow the connection

### Backup Fails
- [ ] Review the log in Backup History
- [ ] Confirm the remote path exists and the SSH user has read access
- [ ] Verify the backup volume has free space
- [ ] Check that the host key has been scanned (missing host key falls back to no verification)

### More Help
- [ ] See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- [ ] See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production hardening

---

## Success Criteria

- Dashboard shows statistics and scheduled next-run times
- All servers show a successful connection test and scanned host key
- At least one manual backup completes with status **Success**
- The snapshot is visible and browsable in **Browse Backups**
- Scheduled jobs run automatically at the expected time
