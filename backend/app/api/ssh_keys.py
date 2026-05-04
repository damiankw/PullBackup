from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.models import User, SSHKey
from app.schemas.schemas import SSHKeyCreate, SSHKeyUpdate, SSHKey as SSHKeySchema
from app.services.rsync_service import rsync_service

router = APIRouter()


@router.get("/", response_model=List[SSHKeySchema])
def list_ssh_keys(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List SSH keys visible to current user (owned keys + public keys)."""
    from sqlalchemy import or_
    
    keys = db.query(SSHKey).filter(
        or_(
            SSHKey.owner_id == current_user.id,  # User's own keys
            SSHKey.is_public == True  # Public keys from any user
        )
    ).all()
    return keys


@router.post("/", response_model=SSHKeySchema, status_code=status.HTTP_201_CREATED)
def create_ssh_key(
    key_data: SSHKeyCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload and save SSH private key."""
    try:
        # Save key to disk
        key_file_path = rsync_service.save_ssh_key(
            key_name=key_data.name,
            private_key_content=key_data.private_key,
            owner_id=current_user.id
        )
        
        # Get fingerprint
        fingerprint = rsync_service.get_ssh_key_fingerprint(key_file_path)
        
        # Create database record
        ssh_key = SSHKey(
            name=key_data.name,
            fingerprint=fingerprint,
            key_file_path=key_file_path,
            is_public=key_data.is_public,
            owner_id=current_user.id
        )
        
        db.add(ssh_key)
        db.commit()
        db.refresh(ssh_key)
        
        return ssh_key
        
    except ValueError as e:
        # Validation errors (e.g., invalid key format)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Other errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save SSH key: {str(e)}"
        )


@router.get("/{key_id}", response_model=SSHKeySchema)
def get_ssh_key(
    key_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get SSH key by ID (if owned by user or is public)."""
    from sqlalchemy import or_
    
    key = db.query(SSHKey).filter(
        SSHKey.id == key_id,
        or_(
            SSHKey.owner_id == current_user.id,
            SSHKey.is_public == True
        )
    ).first()
    
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSH key not found"
        )
    
    return key


@router.patch("/{key_id}", response_model=SSHKeySchema)
def update_ssh_key(
    key_id: int,
    key_update: SSHKeyUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update SSH key visibility (public/private)."""
    key = db.query(SSHKey).filter(
        SSHKey.id == key_id,
        SSHKey.owner_id == current_user.id
    ).first()
    
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSH key not found or you don't have permission to modify it"
        )
    
    # Update the is_public field
    key.is_public = key_update.is_public
    db.commit()
    db.refresh(key)
    
    return key


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ssh_key(
    key_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete SSH key."""
    key = db.query(SSHKey).filter(
        SSHKey.id == key_id,
        SSHKey.owner_id == current_user.id
    ).first()
    
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSH key not found"
        )
    
    # Check if key is in use
    from app.models.models import Server
    servers_using_key = db.query(Server).filter(Server.ssh_key_id == key_id).count()
    
    if servers_using_key > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete key: {servers_using_key} server(s) are using it"
        )
    
    # Delete key file
    rsync_service.delete_ssh_key(key.key_file_path)
    
    # Delete database record
    db.delete(key)
    db.commit()
    
    return None
