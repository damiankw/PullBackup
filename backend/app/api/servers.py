from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_admin_user
from app.models.models import User, Server
from app.schemas.schemas import (
    ServerCreate, ServerUpdate, Server as ServerSchema, ServerWithJobs
)
from app.services.rsync_service import rsync_service
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
    
    # Update fields
    for field, value in server_data.dict(exclude_unset=True).items():
        setattr(server, field, value)
    
    db.commit()
    db.refresh(server)
    
    return server


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_server(
    server_id: int,
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
    
    db.delete(server)
    db.commit()
    
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
        ssh_key_path=ssh_key_path
    )
    
    # Update server record
    server.last_connection_test = datetime.now()
    server.connection_test_success = success
    db.commit()
    
    return {
        "success": success,
        "message": message,
        "tested_at": server.last_connection_test
    }
