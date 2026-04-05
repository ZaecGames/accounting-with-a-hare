from datetime import datetime
from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from .database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    full_name = Column(String(128), nullable=True)
    hashed_password = Column(String(256), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.user)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class MovementType(str, enum.Enum):
    receipt = "receipt"
    issue = "issue"
    transfer = "transfer"


class Nomenclature(Base):
    __tablename__ = "nomenclature"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(256), nullable=False)
    unit = Column(String(32), nullable=False, default="pcs")
    created_at = Column(DateTime, default=datetime.utcnow)

    movements = relationship("StockMovement", back_populates="nomenclature")


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String(256), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    movements_from = relationship(
        "StockMovement",
        foreign_keys="StockMovement.warehouse_from_id",
        back_populates="warehouse_from",
    )
    movements_to = relationship(
        "StockMovement",
        foreign_keys="StockMovement.warehouse_to_id",
        back_populates="warehouse_to",
    )


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    doc_number = Column(String(64), index=True, nullable=False)
    movement_type = Column(SQLEnum(MovementType), nullable=False)
    nomenclature_id = Column(Integer, ForeignKey("nomenclature.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    warehouse_to_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    warehouse_from_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    note = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    nomenclature = relationship("Nomenclature", back_populates="movements")
    warehouse_to = relationship(
        "Warehouse", foreign_keys=[warehouse_to_id], back_populates="movements_to"
    )
    warehouse_from = relationship(
        "Warehouse", foreign_keys=[warehouse_from_id], back_populates="movements_from"
    )
