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
        local_path: str,
        ssh_key_path: Optional[str] = None,
        rsync_options: Optional[str] = None,
        callback=None
    ) -> Tuple[bool, str, dict]:
        """
        Execute incremental rsync backup from remote server to local path.
        Creates dated snapshots with hardlinks to previous backup for space efficiency.
        
        Args:
            hostname: Remote server hostname
            port: SSH port
            username: SSH username
            remote_path: Path on remote server
            local_path: Local destination path (base directory for snapshots)
            ssh_key_path: Path to SSH private key
            rsync_options: Custom rsync options
            callback: Optional callback function for progress updates
        
        Returns:
            Tuple of (success, log_output, stats)
        """
        try:
            # Create base backup directory for this job
            base_backup_dir = self.backup_root / local_path.lstrip('/')
            base_backup_dir.mkdir(parents=True, exist_ok=True)
            
            # Create dated snapshot directory
            snapshot_name = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
            snapshot_dir = base_backup_dir / snapshot_name
            snapshot_dir.mkdir(parents=True, exist_ok=True)
            
            # Find previous snapshot for hardlinking
            previous_snapshot = self._find_latest_snapshot(base_backup_dir)
            
            # Build rsync command
            options = rsync_options or self.rsync_options
            cmd = ["rsync"]
            
            # Add base options (remove --delete if present)
            option_parts = options.split()
            filtered_options = [opt for opt in option_parts if opt != '--delete']
            cmd.extend(filtered_options)
            
            # Add --stats for detailed statistics
            if '--stats' not in filtered_options:
                cmd.append('--stats')
            
            # Add --link-dest if we have a previous snapshot
            if previous_snapshot:
                # --link-dest path must be relative to destination or absolute
                cmd.append(f"--link-dest={previous_snapshot}")
            
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
                log_output += f"\n\n=== Snapshot Info ==="
                log_output += f"\nSnapshot created: {snapshot_name}"
                log_output += f"\nFull path: {snapshot_dir}"
                if previous_snapshot:
                    log_output += f"\nLinked to previous: {previous_snapshot.name}"
                    log_output += f"\nNote: Unchanged files are hardlinked to save space"
                else:
                    log_output += f"\nNote: First snapshot (full backup)"
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
            return False, error_msg, {'bytes_transferred': 0, 'files_transferred': 0}
    
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
                # This is the actual uncompressed size of files transferred
                if 'total transferred file size:' in line.lower():
                    parts = line.split(':')
                    if len(parts) >= 2:
                        try:
                            # Extract number from "X bytes" or "X,XXX bytes"
                            byte_part = parts[1].strip().split()[0]
                            stats['bytes_transferred'] = int(byte_part.replace(',', ''))
                        except (ValueError, IndexError):
                            pass
                
                # Look for "Number of regular files transferred: X"
                elif 'number of regular files transferred:' in line.lower():
                    parts = line.split(':')
                    if len(parts) >= 2:
                        try:
                            stats['files_transferred'] = int(parts[1].strip().replace(',', ''))
                        except (ValueError, IndexError):
                            pass
                
                # Fallback: Look for "total size is X" at the end
                elif stats['bytes_transferred'] == 0 and 'total size is' in line.lower():
                    parts = line.split()
                    for i, part in enumerate(parts):
                        if part == 'is' and i + 1 < len(parts):
                            try:
                                stats['bytes_transferred'] = int(parts[i + 1].replace(',', ''))
                                break
                            except (ValueError, IndexError):
                                pass
                    
        except Exception:
            pass
        
        return stats
    
    def save_ssh_key(self, key_name: str, private_key_content: str, owner_id: int) -> str:
        """
        Save SSH private key to disk.
        
        Returns:
            Path to saved key file
        """
        # Create user-specific directory
        user_keys_dir = self.ssh_keys_dir / f"user_{owner_id}"
        user_keys_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate safe filename
        safe_name = "".join(c for c in key_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        key_file = user_keys_dir / f"{safe_name}.pem"
        
        # Write key file
        key_file.write_text(private_key_content)
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
    
    def list_snapshots(self, local_path: str) -> list:
        """
        List all snapshots for a given backup job.
        
        Args:
            local_path: Base backup path
            
        Returns:
            List of snapshot info dictionaries
        """
        base_backup_dir = self.backup_root / local_path.lstrip('/')
        if not base_backup_dir.exists():
            return []
        
        snapshots = []
        for item in base_backup_dir.iterdir():
            if item.is_dir():
                try:
                    # Try to parse directory name as date
                    snapshot_date = datetime.strptime(item.name[:19], '%Y-%m-%d_%H-%M-%S')
                    
                    # Get size info (rough estimate)
                    snapshot_info = {
                        'name': item.name,
                        'date': snapshot_date.isoformat(),
                        'path': str(item),
                    }
                    snapshots.append(snapshot_info)
                except (ValueError, IndexError):
                    continue
        
        # Sort by date, newest first
        snapshots.sort(key=lambda x: x['date'], reverse=True)
        return snapshots
    
    def delete_snapshot(self, local_path: str, snapshot_name: str) -> Tuple[bool, str]:
        """
        Delete a specific snapshot.
        
        Args:
            local_path: Base backup path
            snapshot_name: Name of snapshot directory to delete
            
        Returns:
            Tuple of (success, message)
        """
        try:
            import shutil
            base_backup_dir = self.backup_root / local_path.lstrip('/')
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


# Singleton instance
rsync_service = RsyncService()
