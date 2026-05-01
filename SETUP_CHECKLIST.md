# ✅ PullBackup First-Time Setup Checklist

Use this checklist to get PullBackup running for the first time.

## Pre-Deployment Checklist

### Required Software
- [ ] Docker installed (version 20.10+)
- [ ] Docker Compose installed (version 2.0+)
- [ ] OR Kubernetes cluster available
- [ ] Git installed (to clone/manage the project)

### Remote Servers
- [ ] SSH access to servers you want to backup
- [ ] SSH private keys ready (in PEM or OpenSSH format)
- [ ] Usernames and hostnames documented
- [ ] SSH port numbers (default: 22)
- [ ] Remote paths to backup identified

### Local Environment
- [ ] Sufficient disk space for backups
- [ ] Network connectivity to remote servers
- [ ] Ports 3000 and 8000 available (or plan alternatives)

## Deployment Steps

### Step 1: Configuration
- [ ] Navigate to `PullBackup` directory
- [ ] Copy `backend/.env.example` to `backend/.env`
- [ ] Edit `backend/.env` and set:
  - [ ] `SECRET_KEY` to a random secure string
  - [ ] `BACKUP_ROOT_DIR` to your desired backup location
  - [ ] `DATABASE_URL` (SQLite default is fine for testing)
  - [ ] Other settings as needed

### Step 2: Start the System

**Docker Compose:**
- [ ] Run `docker-compose up -d`
- [ ] Wait for containers to start (~30 seconds)
- [ ] Check status: `docker-compose ps`
- [ ] Verify both containers show "Up"

**OR Kubernetes:**
- [ ] Run `./build.sh` to build images
- [ ] Run `./k8s/deploy.sh` to deploy
- [ ] Run `kubectl get pods -n pullbackup` to verify
- [ ] All pods should show "Running"

### Step 3: Access the UI
- [ ] Open browser to `http://localhost:3000`
- [ ] Login page should appear
- [ ] Login with default credentials:
  - Username: `admin`
  - Password: `admin`

### Step 4: Initial Security Setup
- [ ] **CRITICAL:** Change admin password immediately!
  - Currently no UI for this - use API or delete admin and re-register
- [ ] Consider creating additional user accounts
- [ ] Review role assignments (admin vs user)

## Configuration Steps

### Step 5: Add SSH Keys
- [ ] Navigate to "SSH Keys" in the sidebar
- [ ] Click "Add SSH Key"
- [ ] Enter a descriptive name
- [ ] Paste your SSH private key
- [ ] Click "Add Key"
- [ ] Verify fingerprint is displayed
- [ ] Repeat for each unique SSH key

### Step 6: Add Servers
- [ ] Navigate to "Servers"
- [ ] Click "Add Server"
- [ ] Fill in server details:
  - [ ] Name (e.g., "Production Web Server")
  - [ ] Hostname (e.g., "prod.example.com")
  - [ ] Port (default: 22)
  - [ ] Username (SSH username)
  - [ ] Select appropriate SSH Key
  - [ ] Optional: Add description
- [ ] Click "Create"
- [ ] Click the connection test icon (✓)
- [ ] Verify "Connection successful" message
- [ ] Repeat for each server

### Step 7: Create Backup Jobs
- [ ] Navigate to "Backup Jobs"
- [ ] Click "Create Backup Job"
- [ ] Fill in job details:
  - [ ] Name (e.g., "Daily Database Backup")
  - [ ] Select Server
  - [ ] Remote Path (e.g., "/var/lib/mysql")
  - [ ] Local Path (e.g., "production/mysql")
  - [ ] Schedule (cron format, or leave empty for manual)
    - Example: `0 2 * * *` for daily at 2 AM
  - [ ] Rsync Options (optional, default is fine)
- [ ] Click "Create"
- [ ] Verify job appears in the list
- [ ] Repeat for each backup job

### Step 8: Test Manual Backup
- [ ] Find your backup job in the list
- [ ] Click the "Play" (▶) button
- [ ] Job status should change to "Running"
- [ ] Navigate to "History"
- [ ] Find the running backup
- [ ] Click the "eye" icon to view logs
- [ ] Wait for backup to complete
- [ ] Verify status is "Success"
- [ ] Check bytes and files transferred
- [ ] Verify backup files exist in local path

### Step 9: Verify Scheduled Backups
- [ ] Check "Next Run" time is displayed for scheduled jobs
- [ ] Wait for scheduled time (or adjust schedule for testing)
- [ ] Check "History" for automatic execution
- [ ] Verify backups run without manual intervention

## Post-Setup Tasks

### Monitoring Setup
- [ ] Bookmark the dashboard URL
- [ ] Set up calendar reminder to check backup history weekly
- [ ] Document your backup schedule
- [ ] Plan disk space monitoring strategy

### Backup the Backup System
- [ ] Document database backup procedure
- [ ] Schedule regular backups of:
  - [ ] `data/` directory (database)
  - [ ] `ssh_keys/` directory
  - [ ] `backend/.env` file
  - [ ] Consider backing up actual backup data to offsite location

### Documentation
- [ ] Document your server configurations
- [ ] Document backup schedules
- [ ] Create runbook for common tasks
- [ ] Document restore procedures

### Optional Enhancements
- [ ] Set up HTTPS with reverse proxy
- [ ] Switch to PostgreSQL for production
- [ ] Configure email notifications (requires code changes)
- [ ] Set up external monitoring
- [ ] Configure automated testing of restores

## Troubleshooting Checklist

If something doesn't work:

### Containers Won't Start
- [ ] Check logs: `docker-compose logs`
- [ ] Verify ports 3000/8000 are free
- [ ] Check `.env` file exists and is valid
- [ ] Ensure sufficient disk space

### Cannot Login
- [ ] Verify backend is running: `docker-compose ps`
- [ ] Check backend logs for errors
- [ ] Try default credentials: admin/admin
- [ ] Clear browser cache and localStorage
- [ ] Check browser console for errors

### SSH Connection Fails
- [ ] Verify SSH key format (must be private key)
- [ ] Check remote server is reachable
- [ ] Verify SSH port is correct
- [ ] Test SSH manually from host
- [ ] Check firewall rules

### Backup Fails
- [ ] Review backup history logs
- [ ] Verify remote path exists
- [ ] Check user has read permissions
- [ ] Verify local disk has space
- [ ] Test rsync command manually

### More Help
- [ ] Check [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- [ ] Review [QUICKSTART.md](QUICKSTART.md)
- [ ] Check logs in detail
- [ ] Verify all prerequisites

## Success Criteria

You know the system is working when:
- ✅ Dashboard shows statistics
- ✅ All servers show "Connected" status
- ✅ At least one manual backup succeeds
- ✅ Backup files appear in expected location
- ✅ Scheduled backups run automatically
- ✅ History shows successful backups

## Next Steps After Setup

Once everything is working:

1. **Week 1:** Monitor daily, verify all scheduled backups run
2. **Week 2:** Test a restore from backup
3. **Week 3:** Add more servers and jobs
4. **Month 1:** Review backup history, adjust schedules
5. **Ongoing:** Monitor disk space, review logs weekly

---

## 🎉 Congratulations!

If you've checked all the boxes above, your backup system is fully operational!

**Need help?** Check the documentation:
- [QUICKSTART.md](QUICKSTART.md) - Quick reference
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Production setup
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Common issues
- [docs/API.md](docs/API.md) - API reference

Happy backing up! 🚀
