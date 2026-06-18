from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_admin_user
from app.models.models import User, Server, AuditAction
from app.schemas.schemas import (
    ServerCreate, ServerUpdate, Server as ServerSchema, ServerWithJobs
)
from app.services.rsync_service import rsync_service
from app.services.audit_service import audit_service
from datetime import datetime

router = APIRouter()


@router.get("/", response_model=List[ServerSchema])
def list_servers(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all servers for current user."""
    query = db.query(Server)
    
    # Admin can see all servers, regular users see only their own
    if current_user.role.value != 'admin':
        query = query.filter(Server.owner_id == current_user.id)
    
    servers = query.offset(skip).limit(limit).all()
    return servers


@router.post("/", response_model=ServerSchema, status_code=status.HTTP_201_CREATED)
def create_server(
    server_data: ServerCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new server."""
    # Verify SSH key belongs to user if specified
    if server_data.ssh_key_id:
        from app.models.models import SSHKey
        ssh_key = db.query(SSHKey).filter(SSHKey.id == server_data.ssh_key_id).first()
        if not ssh_key or ssh_key.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="SSH key not found"
            )
    
    server = Server(**server_data.dict(), owner_id=current_user.id)
    db.add(server)
    db.commit()
    db.refresh(server)
    
    # Log audit event
    audit_service.log_from_request(
        db=db,
        request=request,
        action=AuditAction.CREATE,
        user=current_user,
        resource_type="server",
        resource_id=server.id,
        resource_name=server.name,
        description=f"Created server '{server.name}' ({server.hostname})"
    )
    
    return server


@router.get("/{server_id}", response_model=ServerWithJobs)
def get_server(
    server_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get server by ID."""
    server = db.query(Server).filter(Server.id == server_id).first()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    # Check ownership
    if server.owner_id != current_user.id and current_user.role.value != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this server"
        )
    
    return server


@router.put("/{server_id}", response_model=ServerSchema)
def update_server(
    server_id: int,
    server_data: ServerUpdate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update server."""
    server = db.query(Server).filter(Server.id == server_id).first()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    # Check ownership
    if server.owner_id != current_user.id and current_user.role.value != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this server"
        )
    
    # Verify SSH key if being updated
    if server_data.ssh_key_id is not None:
        from app.models.models import SSHKey
        ssh_key = db.query(SSHKey).filter(SSHKey.id == server_data.ssh_key_id).first()
        if not ssh_key or ssh_key.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="SSH key not found"
            )
    
    # Track what changed for audit log
    changes = []
    for field, value in server_data.dict(exclude_unset=True).items():
        old_value = getattr(server, field)
        if old_value != value:
            changes.append(f"{field}: {old_value} -> {value}")
    
    # Update fields
    for field, value in server_data.dict(exclude_unset=True).items():
        setattr(server, field, value)
    
    db.commit()
    db.refresh(server)
    
    # Log audit event
    if changes:
        audit_service.log_from_request(
            db=db,
            request=request,
            action=AuditAction.UPDATE,
            user=current_user,
            resource_type="server",
            resource_id=server.id,
            resource_name=server.name,
            description=f"Updated server '{server.name}': {', '.join(changes)}"
        )
    
    return server


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_server(
    server_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete server."""
    server = db.query(Server).filter(Server.id == server_id).first()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    # Check ownership
    if server.owner_id != current_user.id and current_user.role.value != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this server"
        )
    
    # Store server info before deletion
    server_name = server.name
    server_hostname = server.hostname
    
    db.delete(server)
    db.commit()
    
    # Log audit event
    audit_service.log_from_request(
        db=db,
        request=request,
        action=AuditAction.DELETE,
        user=current_user,
        resource_type="server",
        resource_id=server_id,
        resource_name=server_name,
        description=f"Deleted server '{server_name}' ({server_hostname})"
    )
    
    return None


@router.post("/{server_id}/test-connection")
def test_server_connection(
    server_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Test SSH connection to server."""
    server = db.query(Server).filter(Server.id == server_id).first()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    # Check ownership
    if server.owner_id != current_user.id and current_user.role.value != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to test this server"
        )
    
    # Get SSH key path
    ssh_key_path = server.ssh_key.key_file_path if server.ssh_key else None
    
    # Test connection
    success, message = rsync_service.test_connection(
        hostname=server.hostname,
        port=server.port,
        username=server.username,
        ssh_key_path=ssh_key_path,
        host_key=server.host_key,
    )
    
    # Update server record
    server.last_connection_test = datetime.now()
    server.connection_test_success = success
    db.commit()

    if not success:
        raise HTTPException(status_code=400, detail=message)

    return {
        "success": success,
        "message": message,
        "tested_at": server.last_connection_test
    }


@router.post("/{server_id}/scan-host-key")
def scan_server_host_key(
    server_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Scan and store the server SSH host key (trust-on-first-use)."""
    import subprocess

    server = db.query(Server).filter(Server.id == server_id).first()

    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")

    if server.owner_id != current_user.id and current_user.role.value != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    try:
        cmd = ["ssh-keyscan", "-p", str(server.port), "-T", "10", server.hostname]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)

        key_lines = [l for l in result.stdout.splitlines() if l.strip() and not l.startswith('#')]

        if not key_lines:
            detail = result.stderr.strip() or "No host key returned"
            raise HTTPException(status_code=502, detail=f"ssh-keyscan failed: {detail}")

        server.host_key = "\n".join(key_lines)
        db.commit()

        return {
            "success": True,
            "message": f"Host key scanned and stored ({len(key_lines)} key type(s))",
            "key_types": len(key_lines),
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="ssh-keyscan timed out")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan host key: {str(e)}")
