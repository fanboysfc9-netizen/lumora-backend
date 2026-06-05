from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, Conversation
from auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/users")
def list_users(current_user: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if admin (optional - you can add admin flag to User model)
    users = db.query(User).all()
    return [{"id": u.id, "email": u.email, "name": u.name, "created_at": u.created_at} for u in users]

@router.get("/stats")
def get_stats(current_user: str = Depends(get_current_user), db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    total_conversations = db.query(Conversation).count()
    
    return {
        "total_users": total_users,
        "total_conversations": total_conversations
    }
