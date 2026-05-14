from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import timedelta

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.models.models import User, AuditAction
from app.schemas.schemas import Token, LoginRequest, UserCreate, User as UserSchema
from app.core.config import settings
from app.services.audit_service import audit_service

router = APIRouter()


@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate user and return JWT token."""
    # Try to find user by email first, then by username
    user = db.query(User).filter(User.email == login_data.username).first()
    if not user:
        user = db.query(User).filter(User.username == login_data.username).first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        # Log failed login attempt
        audit_service.log_from_request(
            db=db,
            request=request,
            action=AuditAction.LOGIN,
            username=login_data.username,
            description="Failed login attempt - invalid credentials"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password"
        )
    
    if not user.is_active:
        # Log failed login attempt for inactive user
        audit_service.log_from_request(
            db=db,
            request=request,
            action=AuditAction.LOGIN,
            user=user,
            description="Failed login attempt - inactive account"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account"
        )
    
    # Log successful login
    audit_service.log_from_request(
        db=db,
        request=request,
        action=AuditAction.LOGIN,
        user=user,
        description="Successful login"
    )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.
    Note: First user created is automatically an admin.
    """
    # Check if username exists
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if this is the first user (make them admin)
    user_count = db.query(User).count()
    role = user_data.role
    if user_count == 0:
        from app.models.models import UserRole
        role = UserRole.ADMIN
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        role=role
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user
