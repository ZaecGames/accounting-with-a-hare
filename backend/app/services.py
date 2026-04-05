from collections import defaultdict
from sqlalchemy.orm import Session

from .models import StockMovement, MovementType


def warehouse_balance_map(db: Session) -> dict[tuple[int, int], float]:
    bal: dict[tuple[int, int], float] = defaultdict(float)
    movements = db.query(StockMovement).order_by(StockMovement.id).all()
    for m in movements:
        if m.movement_type == MovementType.receipt and m.warehouse_to_id:
            bal[(m.nomenclature_id, m.warehouse_to_id)] += m.quantity
        elif m.movement_type == MovementType.issue and m.warehouse_from_id:
            bal[(m.nomenclature_id, m.warehouse_from_id)] -= m.quantity
        elif m.movement_type == MovementType.transfer:
            if m.warehouse_from_id:
                bal[(m.nomenclature_id, m.warehouse_from_id)] -= m.quantity
            if m.warehouse_to_id:
                bal[(m.nomenclature_id, m.warehouse_to_id)] += m.quantity
    return bal


def quantity_on_hand(db: Session, nomenclature_id: int, warehouse_id: int) -> float:
    return warehouse_balance_map(db).get((nomenclature_id, warehouse_id), 0.0)


def normalize_movement_warehouses(
    movement_type: MovementType,
    warehouse_to_id: int | None,
    warehouse_from_id: int | None,
) -> tuple[int | None, int | None]:
    """Оставляет только нужные склады для типа движения (лишнее игнорируется)."""
    if movement_type == MovementType.receipt:
        return warehouse_to_id, None
    if movement_type == MovementType.issue:
        return None, warehouse_from_id
    return warehouse_to_id, warehouse_from_id


def validate_movement(
    db: Session,
    movement_type: MovementType,
    nomenclature_id: int,
    quantity: float,
    warehouse_to_id: int | None,
    warehouse_from_id: int | None,
) -> str | None:
    if movement_type == MovementType.receipt:
        if not warehouse_to_id:
            return "Receipt requires warehouse_to_id"
        if warehouse_from_id:
            return "Receipt must not set warehouse_from_id"
    elif movement_type == MovementType.issue:
        if not warehouse_from_id:
            return "Issue requires warehouse_from_id"
        if warehouse_to_id:
            return "Issue must not set warehouse_to_id"
        if quantity_on_hand(db, nomenclature_id, warehouse_from_id) < quantity:
            return "Insufficient stock on source warehouse"
    elif movement_type == MovementType.transfer:
        if not warehouse_from_id or not warehouse_to_id:
            return "Transfer requires both warehouses"
        if warehouse_from_id == warehouse_to_id:
            return "Warehouses must differ"
        if quantity_on_hand(db, nomenclature_id, warehouse_from_id) < quantity:
            return "Insufficient stock for transfer"
    return None
