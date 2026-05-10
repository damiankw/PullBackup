import os
import subprocess
import tempfile
from typing import Optional, Tuple
from datetime import datetime
from pathlib import Path
from app.core.config import settings


class RsyncService:
    """Service for executing rsync backups via SSH."""
    
    def __init__(self):
        self.backup_root = Path(settings.BACKUP_ROOT_DIR)
        self.ssh_keys_dir = Path(settings.SSH_KEYS_DIR)
        self.rsync_options = settings.RSYNC_OPTIONS
        
        # Ensure directories exist
        self.backup_root.mkdir(parents=True, exist_ok=True)
        self.ssh_keys_dir.mkdir(parents=True, exist_ok=True)
    
    def test_connection(
        self,
        hostname: str,
        port: int,
        username: str,
        ssh_key_path: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Test SSH connection to a remote server.
        
        Returns:
            Tuple of (success, message)
        """
        try:
            cmd = [
                "ssh",
                "-o", "StrictHostKeyChecking=no",
                "-o", "ConnectTimeout=10",
                "-o", "BatchMode=yes",
                "-p", str(port),
            ]
            
            if ssh_key_path:
                # Set proper permissions on key file
                os.chmod(ssh_key_path, 0o600)
                cmd.extend(["-i", ssh_key_path])
            
            cmd.append(f"{username}@{hostname}")
            cmd.append("echo 'Connection successful'")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=15
            )
            
            if result.returncode == 0:
                return True, "Connection successful"
            else:
                return False, f"Connection failed: {result.stderr}"
                
        except subprocess.TimeoutExpired:
            return False, "Connection timeout"
        except Exception as e:
            return False, f"Connection error: {str(e)}"
    
    def _find_latest_snapshot(self, base_path: Path) -> Optional[Path]:
        """
        Find the most recent snapshot directory for use with --link-dest.
        
        Args:
            base_path: Base backup path to search for snapshots
            
        Returns:
            Path to latest snapshot or None
        """
        if not base_path.exists():
            return None
        
        # Find all snapshot directories (formatted as YYYY-MM-DD_HH-MM-SS)
        snapshots = []
        for item in base_path.iterdir():
            if item.is_dir() and len(item.name) >= 10:
                # Check if it looks like a date directory
                try:
                    # Try to parse the directory name as a date
                    datetime.strptime(item.name[:10], '%Y-%m-%d')
                    snapshots.append(item)
                except ValueError:
                    continue
        
        if not snapshots:
            return None
        
        # Sort by name (which sorts by date due to format) and return latest
        snapshots.sort()
        return snapshots[-1]
    
    def execute_backup(
        self,
        hostname: str,
        port: int,
        username: str,
        remote_path: str,
        ssh_key_path: Optional[str] = None,
        rsync_options: Optional[str] = None,
        callback=None,
        backup_uuid: Optional[str] = None,
        job_name: Optional[str] = None,
        server_name: Optional[str] = None,
        schedule: Optional[str] = None
    ) -> Tuple[bool, str, dict]:
        """
        Execute incremental rsync backup from remote server to local path.
        Creates dated snapshots with hardlinks to previous backup for space efficiency.
        
        Args:
            hostname: Remote server hostname
            port: SSH port
            username: SSH username
            remote_path: Path on remote server
            ssh_key_path: Path to SSH private key
            rsync_options: Custom rsync options
            callback: Optional callback function for progress updates
            backup_uuid: Backup job UUID
            job_name: Job name for README
            server_name: Server name for README
            schedule: Backup schedule (cron format) for README
        
        Returns:
            Tuple of (success, log_output, stats)
        """
        try:
            # Create base backup directory for this job using UUID
            if not backup_uuid:
                raise ValueError("backup_uuid is required")
            
            base_backup_dir = self.backup_root / backup_uuid
            base_backup_dir.mkdir(parents=True, exist_ok=True)
            
            # Find previous snapshot for hardlinking BEFORE creating new snapshot
            previous_snapshot = self._find_latest_snapshot(base_backup_dir)
            
            # Create dated snapshot directory
            snapshot_name = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
            snapshot_dir = base_backup_dir / snapshot_name
            snapshot_dir.mkdir(parents=True, exist_ok=True)
            
            # Build rsync command
            options = rsync_options or self.rsync_options
            # Use system PATH to find rsync (prefers Homebrew/GNU version if available)
            # On macOS: finds Homebrew rsync if installed, otherwise falls back to openrsync
            # On Linux: finds GNU rsync (the default)
            import shutil
            rsync_bin = shutil.which('rsync') or 'rsync'
            cmd = [rsync_bin]
            
            # Add base options (remove --delete if present)
            option_parts = options.split()
            filtered_options = [opt for opt in option_parts if opt != '--delete']
            cmd.extend(filtered_options)
            
            # Add --stats for detailed statistics
            if '--stats' not in filtered_options:
                cmd.append('--stats')
            
            # Add --link-dest if we have a previous snapshot
            if previous_snapshot:
                # --link-dest path must be relative to destination directory
                # Use ../snapshot_name format so rsync can find it relative to new snapshot
                relative_link_path = f"../{previous_snapshot.name}"
                cmd.append(f"--link-dest={relative_link_path}")
            
            # Add SSH options
            ssh_cmd = f"ssh -p {port} -o StrictHostKeyChecking=no"
            if ssh_key_path:
                os.chmod(ssh_key_path, 0o600)
                ssh_cmd += f" -i {ssh_key_path}"
            
            cmd.extend(["-e", ssh_cmd])
            
            # Add source and destination
            # Ensure remote_path ends with / to sync contents
            if not remote_path.endswith('/'):
                remote_path += '/'
            
            cmd.append(f"{username}@{hostname}:{remote_path}")
            cmd.append(str(snapshot_dir) + '/')
            
            # Execute rsync
            log_lines = []
            start_time = datetime.now()
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            # Read output line by line
            for line in process.stdout:
                log_lines.append(line.rstrip())
                if callback:
                    callback(line.rstrip())
            
            process.wait()
            end_time = datetime.now()
            
            log_output = '\n'.join(log_lines)
            
            # Parse rsync statistics
            stats = self._parse_rsync_stats(log_output)
            stats['duration'] = (end_time - start_time).total_seconds()
            stats['snapshot_path'] = str(snapshot_dir)
            stats['previous_snapshot'] = str(previous_snapshot) if previous_snapshot else None
            
            success = process.returncode == 0
            
            if success:
                # Calculate actual snapshot size and space saved
                size_stats = self._calculate_snapshot_size(snapshot_dir)
                stats.update(size_stats)
                
                log_output += f"\n\n=== Snapshot Info ==="
                log_output += f"\nSnapshot created: {snapshot_name}"
                log_output += f"\nFull path: {snapshot_dir}"
                if previous_snapshot:
                    log_output += f"\nLinked to previous: {previous_snapshot.name}"
                    log_output += f"\nNote: Unchanged files are hardlinked to save space"
                else:
                    log_output += f"\nNote: First snapshot (full backup)"
                
                # Add size information
                log_output += f"\n\n=== Storage Stats ==="
                log_output += f"\nActual disk usage (new data): {self._format_bytes(size_stats['snapshot_size_bytes'])}"
                log_output += f"\nLogical size (all files): {self._format_bytes(size_stats['snapshot_total_size_bytes'])}"
                if size_stats['space_saved_bytes'] > 0:
                    log_output += f"\nSpace saved by hardlinks: {self._format_bytes(size_stats['space_saved_bytes'])}"
                    efficiency = (size_stats['space_saved_bytes'] / size_stats['snapshot_total_size_bytes'] * 100) if size_stats['snapshot_total_size_bytes'] > 0 else 0
                    log_output += f"\nSpace efficiency: {efficiency:.1f}%"
                
                # Generate/update README.md in backup root directory
                if job_name and server_name and backup_uuid:
                    try:
                        self.generate_readme(
                            backup_uuid=backup_uuid,
                            job_name=job_name,
                            server_name=server_name,
                            hostname=hostname,
                            port=port,
                            username=username,
                            remote_path=remote_path,
                            schedule=schedule,
                            rsync_options=rsync_options
                        )
                    except Exception as readme_error:
                        log_output += f"\nWarning: Failed to generate README.md: {readme_error}"
            else:
                log_output += f"\n\nRsync failed with exit code {process.returncode}"
                # Clean up failed snapshot directory
                try:
                    if snapshot_dir.exists():
                        import shutil
                        shutil.rmtree(snapshot_dir)
                        log_output += f"\nCleaned up incomplete snapshot"
                except Exception as cleanup_error:
                    log_output += f"\nWarning: Could not clean up failed snapshot: {cleanup_error}"
            
            return success, log_output, stats
            
        except Exception as e:
            error_msg = f"Backup execution error: {str(e)}"
            return False, error_msg, {
                'bytes_transferred': 0,
                'files_transferred': 0,
                'snapshot_size_bytes': 0,
                'snapshot_total_size_bytes': 0,
                'space_saved_bytes': 0
            }
    
    def _format_bytes(self, bytes_val: int) -> str:
        """Format bytes into human-readable string."""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes_val < 1024.0:
                return f"{bytes_val:.2f} {unit}"
            bytes_val /= 1024.0
        return f"{bytes_val:.2f} PB"
    
    def _parse_rsync_stats(self, output: str) -> dict:
        """Parse rsync output for statistics."""
        stats = {
            'bytes_transferred': 0,
            'files_transferred': 0
        }
        
        try:
            lines = output.split('\n')
            for line in lines:
                line = line.strip()
                
                # Look for "Total transferred file size: X bytes"
                # This is the actual size of files that were transferred (0 when using hardlinks)
                if 'total transferred file size:' in line.lower():
                    parts = line.split(':')
                    if len(parts) >= 2:
                        try:
                            # Extract number from "X bytes" or "X,XXX bytes"
                            byte_part = parts[1].strip().split()[0]
                            stats['bytes_transferred'] = int(byte_part.replace(',', ''))
                        except (ValueError, IndexError):
                            pass
                
                # Look for "Number of files transferred: X" (rsync 3.x format)
                elif 'number of files transferred:' in line.lower():
                    parts = line.split(':')
                    if len(parts) >= 2:
                        try:
                            stats['files_transferred'] = int(parts[1].strip().replace(',', ''))
                        except (ValueError, IndexError):
                            pass
                
                # Also look for "Number of regular files transferred: X" (older format)
                elif 'number of regular files transferred:' in line.lower():
                    parts = line.split(':')
                    if len(parts) >= 2:
                        try:
                            stats['files_transferred'] = int(parts[1].strip().replace(',', ''))
                        except (ValueError, IndexError):
                            pass
                    
        except Exception:
            pass
        
        return stats
    
    def _calculate_snapshot_size(self, snapshot_dir: Path) -> dict:
        """
        Calculate actual disk usage and logical size of a snapshot.
        
        Returns dict with:
            - snapshot_size_bytes: Actual disk space used (new data)
            - snapshot_total_size_bytes: Logical size of all files
            - space_saved_bytes: Space saved by hardlinks
        """
        try:
            import platform
            is_macos = platform.system() == 'Darwin'
            
            # Get actual disk usage (space used on disk, respects hardlinks)
            result_actual = subprocess.run(
                ['du', '-sk', str(snapshot_dir)],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # Get apparent size (logical size of all files, ignores hardlinks)
            # macOS uses -A flag, Linux uses --apparent-size
            if is_macos:
                result_apparent = subprocess.run(
                    ['du', '-Ak', str(snapshot_dir)],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
            else:
                result_apparent = subprocess.run(
                    ['du', '-sk', '--apparent-size', str(snapshot_dir)],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
            
            actual_kb = 0
            apparent_kb = 0
            
            if result_actual.returncode == 0:
                # Parse output: "12345\t/path/to/snapshot"
                actual_kb = int(result_actual.stdout.split()[0])
            
            if result_apparent.returncode == 0:
                apparent_kb = int(result_apparent.stdout.split()[0])
            
            # Convert KB to bytes
            actual_bytes = actual_kb * 1024
            apparent_bytes = apparent_kb * 1024
            
            space_saved = apparent_bytes - actual_bytes if apparent_bytes > actual_bytes else 0
            
            return {
                'snapshot_size_bytes': actual_bytes,
                'snapshot_total_size_bytes': apparent_bytes,
                'space_saved_bytes': space_saved
            }
            
        except Exception as e:
            print(f"Warning: Could not calculate snapshot size: {e}")
            return {
                'snapshot_size_bytes': 0,
                'snapshot_total_size_bytes': 0,
                'space_saved_bytes': 0
            }
    
    def save_ssh_key(self, key_name: str, private_key_content: str, owner_id: int) -> str:
        """
        Save SSH private key to disk.
        Supports RSA, OpenSSH, EC, and DSA key formats.
        
        Returns:
            Path to saved key file
        
        Raises:
            ValueError: If the key format is not recognized
        """
        # Validate key format by checking for supported headers
        supported_formats = [
            '-----BEGIN RSA PRIVATE KEY-----',
            '-----BEGIN OPENSSH PRIVATE KEY-----',
            '-----BEGIN EC PRIVATE KEY-----',
            '-----BEGIN DSA PRIVATE KEY-----',
            '-----BEGIN PRIVATE KEY-----',  # PKCS#8 format
        ]
        
        key_content_stripped = private_key_content.strip()
        is_valid = any(header in key_content_stripped for header in supported_formats)
        
        if not is_valid:
            raise ValueError(
                "Invalid SSH key format. Supported formats: RSA, OpenSSH, EC, DSA, and PKCS#8. "
                "Key must start with a valid PEM header like '-----BEGIN RSA PRIVATE KEY-----' "
                "or '-----BEGIN OPENSSH PRIVATE KEY-----'"
            )
        
        # Create user-specific directory
        user_keys_dir = self.ssh_keys_dir / f"user_{owner_id}"
        user_keys_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate safe filename
        safe_name = "".join(c for c in key_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        key_file = user_keys_dir / f"{safe_name}.pem"
        
        # Write key file with proper line endings
        key_file.write_text(key_content_stripped + '\n')
        os.chmod(key_file, 0o600)
        
        return str(key_file)
    
    def delete_ssh_key(self, key_file_path: str) -> bool:
        """Delete SSH key file."""
        try:
            Path(key_file_path).unlink(missing_ok=True)
            return True
        except Exception:
            return False
    
    def get_ssh_key_fingerprint(self, key_file_path: str) -> Optional[str]:
        """Get SSH key fingerprint."""
        try:
            result = subprocess.run(
                ["ssh-keygen", "-lf", key_file_path],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                # Output format: "2048 SHA256:xxxxx comment (RSA)"
                parts = result.stdout.split()
                if len(parts) >= 2:
                    return parts[1]
            return None
        except Exception:
            return None
    
    def list_snapshots(self, backup_uuid: str) -> list:
        """
        List all snapshots for a given backup job.
        
        Args:
            backup_uuid: Backup job UUID
            
        Returns:
            List of snapshot info dictionaries
        """
        if not backup_uuid:
            raise ValueError("backup_uuid is required")
        
        base_backup_dir = self.backup_root / backup_uuid
        
        if not base_backup_dir.exists():
            return []
        
        snapshots = []
        total_actual_size = 0
        total_logical_size = 0
        
        for item in base_backup_dir.iterdir():
            if item.is_dir():
                try:
                    # Try to parse directory name as date
                    snapshot_date = datetime.strptime(item.name[:19], '%Y-%m-%d_%H-%M-%S')
                    
                    # Calculate size for this snapshot
                    size_info = self._calculate_snapshot_size(item)
                    total_actual_size += size_info['snapshot_size_bytes']
                    total_logical_size += size_info['snapshot_total_size_bytes']
                    
                    snapshot_info = {
                        'name': item.name,
                        'date': snapshot_date.isoformat(),
                        'path': str(item),
                        'size_bytes': size_info['snapshot_size_bytes'],
                        'logical_size_bytes': size_info['snapshot_total_size_bytes'],
                    }
                    snapshots.append(snapshot_info)
                except (ValueError, IndexError) as e:
                    continue
        
        # Sort by date, newest first
        snapshots.sort(key=lambda x: x['date'], reverse=True)
        
        # Add total size information to the result
        return {
            'snapshots': snapshots,
            'total_actual_size_bytes': total_actual_size,
            'total_logical_size_bytes': total_logical_size,
            'total_space_saved_bytes': total_logical_size - total_actual_size if total_logical_size > total_actual_size else 0,
        }
    
    def delete_snapshot(self, snapshot_name: str, backup_uuid: str) -> Tuple[bool, str]:
        """
        Delete a specific snapshot.
        
        Args:
            snapshot_name: Name of snapshot directory to delete
            backup_uuid: Backup job UUID
            
        Returns:
            Tuple of (success, message)
        """
        try:
            import shutil
            
            if not backup_uuid:
                raise ValueError("backup_uuid is required")
            
            base_backup_dir = self.backup_root / backup_uuid
            snapshot_dir = base_backup_dir / snapshot_name
            
            if not snapshot_dir.exists():
                return False, "Snapshot not found"
            
            # Verify it's a snapshot directory (has date format)
            try:
                datetime.strptime(snapshot_name[:19], '%Y-%m-%d_%H-%M-%S')
            except ValueError:
                return False, "Invalid snapshot name format"
            
            shutil.rmtree(snapshot_dir)
            return True, f"Snapshot {snapshot_name} deleted successfully"
            
        except Exception as e:
            return False, f"Failed to delete snapshot: {str(e)}"
    
    def generate_readme(
        self,
        backup_uuid: str,
        job_name: str,
        server_name: str,
        hostname: str,
        port: int,
        username: str,
        remote_path: str,
        schedule: str = None,
        rsync_options: str = None
    ) -> None:
        """
        Generate a README.md file in the backup directory with job metadata.
        This helps with manual recovery if the system is unavailable.
        
        Args:
            backup_uuid: Backup job UUID
            job_name: Name of the backup job
            server_name: Name of the server
            hostname: Server hostname
            port: SSH port
            username: SSH username
            remote_path: Path on remote server
            schedule: Backup schedule (cron format)
            rsync_options: rsync options used
        """
        try:
            base_backup_dir = self.backup_root / backup_uuid
            base_backup_dir.mkdir(parents=True, exist_ok=True)
            
            readme_path = base_backup_dir / "README.md"
            
            # List snapshots
            snapshots = self.list_snapshots(backup_uuid=backup_uuid)
            snapshot_list = "\n".join([f"- `{s['name']}` - {s['date']}" for s in snapshots])
            if not snapshot_list:
                snapshot_list = "No snapshots yet"
            
            readme_content = f"""# Backup Job: {job_name}

## Job Information

- **Job UUID**: `{backup_uuid}`
- **Job Name**: {job_name}
- **Status**: Active
- **Created**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Source Server

- **Server Name**: {server_name}
- **Hostname**: {hostname}
- **Port**: {port}
- **Username**: {username}
- **Remote Path**: `{remote_path}`

## Backup Configuration

- **Schedule**: {schedule or 'Manual only'}
- **rsync Options**: `{rsync_options or 'Default (-avz --no-owner --no-group)'}`
- **Backup Strategy**: Incremental snapshots with hardlinks

## Available Snapshots

{snapshot_list}

## Manual Recovery

Each snapshot directory contains a complete point-in-time backup. Files that haven't changed between snapshots are hardlinked to save space.

To manually browse backups:
```bash
cd {base_backup_dir}
ls -la  # List all snapshots
cd YYYY-MM-DD_HH-MM-SS  # Enter a snapshot directory
```

To restore files manually:
```bash
rsync -av {base_backup_dir}/YYYY-MM-DD_HH-MM-SS/ /path/to/restore/
```

---
*This file is automatically generated by PullBackup*
*Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
            
            with open(readme_path, 'w') as f:
                f.write(readme_content)
            
            print(f"[README] Generated README.md for job {job_name}")
            
        except Exception as e:
            print(f"[README] Failed to generate README: {e}")


# Singleton instance
rsync_service = RsyncService()
