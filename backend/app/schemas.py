from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict, field_validator

from .models import MovementType, UserRole


class NomenclatureBase(BaseModel):
    sku: str = Field(..., max_length=64)
    name: str = Field(..., max_length=256)
    unit: str = Field(default="pcs", max_length=32)


class NomenclatureCreate(NomenclatureBase):
    pass


class NomenclatureRead(NomenclatureBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class WarehouseBase(BaseModel):
    code: str = Field(..., max_length=32)
    name: str = Field(..., max_length=256)


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseRead(WarehouseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class StockMovementCreate(BaseModel):
    doc_number: str = Field(..., max_length=64)
    movement_type: MovementType
    nomenclature_id: int
    quantity: float = Field(..., gt=0)
    warehouse_to_id: Optional[int] = None
    warehouse_from_id: Optional[int] = None
    note: Optional[str] = Field(None, max_length=512)


class StockMovementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    doc_number: str
    movement_type: MovementType
    nomenclature_id: int
    quantity: float
    warehouse_to_id: Optional[int]
    warehouse_from_id: Optional[int]
    note: Optional[str]
    created_at: datetime


class BalanceRow(BaseModel):
    nomenclature_id: int
    sku: str
    name: str
    unit: str
    warehouse_id: int
    warehouse_code: str
    warehouse_name: str
    quantity: float


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)
    full_name: Optional[str] = Field(None, max_length=128)

    @field_validator("username")
    @classmethod
    def username_norm(cls, v: str) -> str:
        s = v.strip().lower()
        if len(s) < 3:
            raise ValueError("Логин не короче 3 символов")
        if any(c.isspace() for c in s):
            raise ValueError("Логин без пробелов")
        return s


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    username: str
    full_name: Optional[str] = None


class UserMe(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    full_name: Optional[str]
    role: UserRole


class UserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    full_name: Optional[str]
    role: UserRole
    is_active: bool
    created_at: datetime


class AdminUserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)
    full_name: Optional[str] = Field(None, max_length=128)
    role: UserRole = UserRole.user

    @field_validator("username")
    @classmethod
    def username_norm(cls, v: str) -> str:
        s = v.strip().lower()
        if len(s) < 3 or any(c.isspace() for c in s):
            raise ValueError("Некорректный логин")
        return s
