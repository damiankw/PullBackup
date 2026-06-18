# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in PullBackup, please report it responsibly.

- **Preferred**: Open a private security advisory on GitHub (if the repository is public, use the "Report a vulnerability" button under the Security tab).
- **Email**: If GitHub advisories are not available, contact the maintainer directly.
- Please include as much detail as possible: steps to reproduce, affected versions, and potential impact.
- Do not open public issues for security vulnerabilities.

We aim to respond within 48 hours for confirmed high-severity reports.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | Active development |

Only the latest code on the `main` branch is actively maintained for security issues.

## Security Model

PullBackup is a **privileged backup tool**. It stores SSH private keys and complete filesystem snapshots of remote servers. A compromise of PullBackup (application, container, or host) can lead to full access to every system it is configured to back up.

Treat the security of this application with the same rigor as any system that holds production SSH keys.

## Known Security Considerations and Risks

The following issues are listed individually as requested.

**1. Previously committed SSH private key in git history**

A private SSH key was accidentally committed to the repository in the past. It was later removed from the working tree via a cleanup commit, but the object remains reachable in the git history.

**Impact**: Anyone with access to the full git history (including after a public GitHub push) may be able to recover the private key.

**Recommended mitigation**: Before publishing the repository publicly, rewrite git history using `git-filter-repo` or BFG Repo-Cleaner to permanently remove the key blob and any other sensitive objects, then force-push.

> **RESOLVED**: The key has been removed from the working tree and `data/ssh_keys/` added to `.gitignore`. Git history has been rewritten using `git filter-repo` to permanently remove the key blob, and the rewritten history force-pushed to the remote. The affected key should be considered compromised and rotated.

**2. Weak default `SECRET_KEY` in source code**

`backend/app/core/config.py` contains a hardcoded default:

```python
SECRET_KEY: str = "your-super-secret-key-change-this-in-production"
```

**Impact**: If no `SECRET_KEY` is provided via environment, the application uses this weak value. All JWT tokens would be trivially forgeable.

**Recommended mitigation**: Remove the default or make the setting mandatory with no fallback. Always provide a strong secret via `.env` or environment variables in production.

> **RESOLVED**: The first-run setup wizard now generates a cryptographically secure `SECRET_KEY` via `secrets.token_hex(32)` and persists it to the `system_settings` database table. It is loaded at startup and overrides the config default for all new deployments. The hardcoded default in `config.py` remains as a last-resort fallback only; it will never be used on any instance that has completed the setup wizard.

**3. Automatic creation of default `admin` / `admin` account**

When the database has zero users, `backend/init_db.py` creates an account with username `admin` and password `admin`. The Dockerfile CMD runs this script on every container start.

**Impact**: Fresh deployments or deleted-user scenarios start with a well-known credential.

**Recommended mitigation**: Remove automatic admin creation in production images, or require an explicit environment variable / first-run flag to enable it. Document that the default must be changed immediately.

> **RESOLVED**: The `create_admin_user()` call has been removed from `init_db.py`. Fresh deployments with no users are redirected to a first-run setup wizard that requires the operator to explicitly choose a username and password before the application becomes usable.

**4. Container runs as root user**

The Dockerfile has no `USER` directive. The container process runs as root inside the image.

**Impact**: Container escape or application vulnerability grants root on the host (when using host-mounted volumes or misconfigured Docker).

**Recommended mitigation**: Add a non-root user in the final image stage and run the application as that user. Adjust file ownership for `/app/data`, `/app/ssh_keys`, and `/backups` accordingly.

> **RESOLVED**: A dedicated `pullbackup` user and group (uid/gid 1000) are created in the Dockerfile. Ownership of `/app` and `/backups` is set to that user before the `USER pullbackup` directive, so the application process never runs as root.

**5. `StrictHostKeyChecking=no` used for all SSH connections**

Multiple locations (rsync_service.py, terminal.py) invoke `ssh` with:

```
-o StrictHostKeyChecking=no
-o UserKnownHostsFile=/dev/null
```

**Impact**: The application is vulnerable to man-in-the-middle attacks when connecting to remote servers.

**Recommended mitigation**: Implement proper host key verification. Store known host keys or require explicit opt-in with strong warnings.

> **RESOLVED**: A "Scan Host Key" button on the Servers page runs `ssh-keyscan` and stores the result in the database (trust-on-first-use). All SSH connections — rsync backups (both passes), connection tests, and the interactive terminal — now use `StrictHostKeyChecking=yes` with a per-connection temp known_hosts file when a host key is stored. Servers without a scanned key fall back to `StrictHostKeyChecking=no` to preserve backwards compatibility, with the "Not Scanned" status visible in the UI prompting the operator to scan.

**6. Interactive Terminal feature provides full remote shells**

The `/api/terminal/ws/{server_id}` WebSocket endpoint (terminal.py) opens a real pseudo-tty SSH session to any configured server for admin users.

**Impact**: Any compromised admin account or stolen admin JWT immediately grants interactive shell access to every managed remote server.

**Recommended mitigation**: Consider removing this feature, gating it behind additional approval workflows, or making it read-only. At minimum, log every command executed.

> **RESOLVED** (partial): Terminal session open and close events are now written to the audit_logs table, including the user, target server, source IP address (with proxy header support), user agent, and session duration. Full command logging is left to the SSH server on the remote end (e.g. bash history, syslog).

**7. Authentication token passed in WebSocket query parameter**

The terminal WebSocket accepts the JWT via `?token=...` in the URL.

**Impact**: Tokens can leak via web server logs, browser history, proxy logs, Referer headers, or shoulder surfing.

**Recommended mitigation**: Accept the token only via the WebSocket subprotocol, initial message, or HTTP header during the upgrade request.

**8. No rate limiting on authentication endpoints**

There is no rate limiting, account lockout, or progressive delay on `/api/auth/login` or registration.

**Impact**: Attackers can perform unlimited brute-force or credential-stuffing attacks against user accounts.

**Recommended mitigation**: Add rate limiting (e.g. using slowapi, redis, or nginx) on login, register, and password change endpoints. Consider adding failed login attempt tracking.

**9. Permissive CORS configuration**

In `backend/app/main.py`:

```python
CORSMiddleware(
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Impact**: Any website can make authenticated requests to the API if a user visits it while logged in (token in localStorage or header).

**Recommended mitigation**: Restrict `allow_origins` to specific trusted origins in production. Never use `*` with `allow_credentials`.

**10. Subprocess commands built with f-strings**

SSH and rsync commands in `rsync_service.py` and `terminal.py` are assembled using f-strings containing hostnames, usernames, ports, remote paths, and key file paths.

**Impact**: Although most values come from the database (controlled by admins), mistakes in sanitization or future changes can lead to command injection.

**Recommended mitigation**: Use `shlex.quote()` on all externally influenced values, or better, avoid shell interpretation entirely by using argument lists where possible.

**11. SSH key filenames allow spaces**

In `save_ssh_key()`, the sanitization is:

```python
safe_name = "".join(c for c in key_name if c.isalnum() or c in (' ', '-', '_'))
```

Filenames containing spaces are later inserted into ssh command strings.

**Impact**: Spaces in key filenames can break or be abused in unquoted shell command construction.

**Recommended mitigation**: Remove spaces from allowed characters or always properly quote/escape paths when building commands.

**12. SSH private keys stored unencrypted on disk**

Private keys are written to the filesystem (under `SSH_KEYS_DIR`) with mode 0600 but are not encrypted at rest.

**Impact**: Anyone who gains read access to the volume (container escape, host compromise, backup of the data directory, etc.) obtains the keys to all remote servers.

**Recommended mitigation**: Implement at-rest encryption for the SSH keys directory (e.g. using age, gpg, or filesystem-level encryption). Consider using an external secret store (Vault, etc.) for production.

> **DEPLOYMENT RESPONSIBILITY**: Keys are stored with 0600 permissions and the container runs as a non-root user (fix #4). Further protection (encrypted volume, secret store) must be handled at the infrastructure level and is out of scope for the application.

**13. Application serves plain HTTP only**

The FastAPI/uvicorn server listens on HTTP with no TLS support in the application.

**Impact**: All traffic (including JWTs and backup metadata) is transmitted in cleartext unless a reverse proxy terminates TLS.

**Recommended mitigation**: Strongly recommend (or enforce) TLS termination in front of the application in all production documentation and default configurations.

> **DEPLOYMENT RESPONSIBILITY**: TLS termination should be handled by a reverse proxy or ingress controller (nginx, Traefik, k8s Ingress) in front of the application. The unified container serves its own frontend so no cross-origin traffic is exposed in plain HTTP in a typical deployment.

**14. SQLite database contains password hashes on disk**

The database file (`pullbackup.db`) stores bcrypt password hashes and is located in a host-mounted or persistent volume.

**Impact**: Direct filesystem access to the database file allows offline password cracking attempts.

**Recommended mitigation**: Ensure strict filesystem permissions on the database file. Consider using PostgreSQL with proper access controls for higher-security deployments.

> **DEPLOYMENT RESPONSIBILITY**: The application runs as a non-root user (fix #4) so the database file is owned by the `pullbackup` user. Bcrypt is used for password hashing (slow by design). Further hardening via encrypted volumes or PostgreSQL with access controls is an infrastructure decision outside the application's scope.

**15. Frontend dependencies contain known vulnerabilities**

Running `npm audit` in the `frontend/` directory reports 1 critical and 13 high severity vulnerabilities (as of the time of writing).

**Impact**: Supply-chain attacks or exploitation of vulnerable frontend packages.

**Recommended mitigation**: Regularly run `npm audit`, update dependencies, and audit the dependency tree. Consider using `npm audit --audit-level=moderate` in CI.

**16. `init_db.py` runs on every container start**

The Dockerfile CMD is:

```
python init_db.py && uvicorn ...
```

This script can create the default admin user on every restart.

**Impact**: Increases the window during which a default-credential account may exist.

**Recommended mitigation**: Make admin creation a one-time or explicitly opt-in operation. Do not run initialization that can create privileged accounts on every startup.

> **RESOLVED**: `init_db.py` no longer creates any user accounts. It only creates database tables and required directories. Admin account creation is handled exclusively by the first-run setup wizard, which only runs once (when no users exist in the database).

**17. Direct insertion of server configuration into remote paths and commands**

Values from the `servers` and `backup_jobs` tables (hostname, username, `remote_path`) are placed directly into rsync source specifications and SSH commands without additional validation or escaping.

**Impact**: A malicious or compromised admin (or a bug in the UI) could potentially cause the backup process to access unintended paths on remote systems.

**Recommended mitigation**: Add stricter validation and normalization of remote paths. Consider whitelisting allowed characters.

**18. Retention of complete historical filesystem snapshots**

Every backup snapshot is retained indefinitely in the `BACKUP_ROOT_DIR` volume.

**Impact**: A compromise of the backups storage exposes the entire history of the remote systems, often including deleted files, old credentials, and sensitive data.

**Recommended mitigation**: Implement retention policies, encryption of backup storage, and the principle of least privilege for volume access.

**19. JWT tokens lack issuer and audience validation**

Tokens created in `security.py` only set `sub` and `role`. There is no `iss` or `aud` claim, and `decode_access_token` does not verify them.

**Impact**: Tokens issued by other systems using the same `SECRET_KEY` (or in misconfigured multi-environment setups) may be accepted.

**Recommended mitigation**: Add and validate `iss` and `aud` claims. Consider adding a `jti` (JWT ID) for revocation capabilities.

**20. Extremely broad privileges for the admin role**

Administrators can view all data, manage all users, open interactive shells on every server, and download any backed-up file.

**Impact**: Compromise of any single admin account gives near-total control over the backup system and all connected infrastructure.

**Recommended mitigation**: Implement additional controls such as step-up authentication for terminal access, granular permissions, or separate "backup operator" roles.

## Additional Guidance

- Always follow the hardening steps in `docs/DEPLOYMENT.md`.
- Use a strong, randomly generated `SECRET_KEY` (at least 32 bytes).
- Place PullBackup behind a reverse proxy that terminates TLS.
- Restrict network access to the application and the backup storage volumes.
- Regularly review audit logs.
- Keep both the Python backend and frontend Node dependencies updated.

This document is not exhaustive. New issues may be discovered as the project evolves.
