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
        Execute rsync backup from remote server to local path.
        
        Args:
            hostname: Remote server hostname
            port: SSH port
            username: SSH username
            remote_path: Path on remote server
            local_path: Local destination path
            ssh_key_path: Path to SSH private key
            rsync_options: Custom rsync options
            callback: Optional callback function for progress updates
        
        Returns:
            Tuple of (success, log_output, stats)
        """
        try:
            # Prepare local destination
            local_dest = self.backup_root / local_path.lstrip('/')
            local_dest.mkdir(parents=True, exist_ok=True)
            
            # Build rsync command
            options = rsync_options or self.rsync_options
            cmd = ["rsync"]
            cmd.extend(options.split())
            
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
            cmd.append(str(local_dest) + '/')
            
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
            
            success = process.returncode == 0
            
            if not success:
                log_output += f"\n\nRsync failed with exit code {process.returncode}"
            
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
                # Look for "sent X bytes  received Y bytes"
                if 'bytes' in line.lower() and 'sent' in line.lower():
                    parts = line.split()
                    if len(parts) >= 2:
                        try:
                            # Extract received bytes (usually the meaningful number)
                            for i, part in enumerate(parts):
                                if part == 'received' and i + 1 < len(parts):
                                    stats['bytes_transferred'] = int(parts[i + 1].replace(',', ''))
                                    break
                        except (ValueError, IndexError):
                            pass
                
                # Count transferred files (basic heuristic)
                # Each file transfer typically shows a line with the filename
                if line and not line.startswith(' ') and '/' in line:
                    stats['files_transferred'] += 1
                    
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


# Singleton instance
rsync_service = RsyncService()
