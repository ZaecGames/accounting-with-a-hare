from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from . import models
from .auth_core import decode_token, get_user_by_username

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> models.User:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="Требуется вход в систему")
    data = decode_token(creds.credentials)
    if not data or "sub" not in data:
        raise HTTPException(status_code=401, detail="Сессия недействительна")
    user = get_user_by_username(db, data["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Нужны права администратора")
    return user
