import pathlib
from contextlib import asynccontextmanager
from datetime import datetime
from xml.dom import minidom
from xml.etree import ElementTree as ET

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from .database import SessionLocal, engine, get_db, Base
from . import models, schemas
from .auth_core import (
    create_access_token,
    get_user_by_username,
    hash_password,
    verify_password,
)
from .config import INITIAL_ADMIN_PASSWORD, INITIAL_ADMIN_USERNAME
from .deps import get_current_user, require_admin
from .models import MovementType, UserRole
from .services import (
    warehouse_balance_map,
    validate_movement,
    normalize_movement_warehouses,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(models.User).count() == 0:
            admin = models.User(
                username=INITIAL_ADMIN_USERNAME.strip().lower(),
                full_name="Администратор",
                hashed_password=hash_password(INITIAL_ADMIN_PASSWORD),
                role=UserRole.admin,
                is_active=True,
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()
    yield


STATIC_DIR = pathlib.Path(__file__).resolve().parent / "static"

app = FastAPI(
    title="Material resources accounting",
    description="Учёт ТМЦ с ролями admin/user и JWT",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def serve_web_ui():
    index = STATIC_DIR / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=500, detail="Web UI missing (static/index.html)")
    return FileResponse(index, media_type="text/html; charset=utf-8")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/register", response_model=schemas.TokenResponse)
def register(body: schemas.UserRegister, db: Session = Depends(get_db)):
    if get_user_by_username(db, body.username):
        raise HTTPException(status_code=400, detail="Такой логин уже занят")
    row = models.User(
        username=body.username,
        full_name=body.full_name.strip() if body.full_name else None,
        hashed_password=hash_password(body.password),
        role=UserRole.user,
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    token = create_access_token(row.username, row.role.value)
    return schemas.TokenResponse(
        access_token=token,
        role=row.role,
        username=row.username,
        full_name=row.full_name,
    )


@app.post("/api/auth/login", response_model=schemas.TokenResponse)
def login(body: schemas.UserLogin, db: Session = Depends(get_db)):
    uname = body.username.strip().lower()
    user = get_user_by_username(db, uname)
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Учётная запись отключена")
    token = create_access_token(user.username, user.role.value)
    return schemas.TokenResponse(
        access_token=token,
        role=user.role,
        username=user.username,
        full_name=user.full_name,
    )


@app.get("/api/auth/me", response_model=schemas.UserMe)
def me(user: models.User = Depends(get_current_user)):
    return user


@app.get("/api/admin/users", response_model=list[schemas.UserListItem])
def admin_list_users(
    _: models.User = Depends(require_admin), db: Session = Depends(get_db)
):
    return db.query(models.User).order_by(models.User.id).all()


@app.post("/api/admin/users", response_model=schemas.UserMe)
def admin_create_user(
    body: schemas.AdminUserCreate,
    _: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if get_user_by_username(db, body.username):
        raise HTTPException(status_code=400, detail="Логин уже занят")
    row = models.User(
        username=body.username,
        full_name=body.full_name.strip() if body.full_name else None,
        hashed_password=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.post("/api/nomenclature", response_model=schemas.NomenclatureRead)
def create_nomenclature(
    body: schemas.NomenclatureCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    if db.query(models.Nomenclature).filter(models.Nomenclature.sku == body.sku).first():
        raise HTTPException(status_code=400, detail="SKU already exists")
    row = models.Nomenclature(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.get("/api/nomenclature", response_model=list[schemas.NomenclatureRead])
def list_nomenclature(
    db: Session = Depends(get_db), _: models.User = Depends(get_current_user)
):
    return db.query(models.Nomenclature).order_by(models.Nomenclature.id).all()


@app.delete("/api/nomenclature/{item_id}")
def delete_nomenclature(
    item_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    row = db.get(models.Nomenclature, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    if db.query(models.StockMovement).filter_by(nomenclature_id=item_id).first():
        raise HTTPException(status_code=400, detail="Nomenclature has movements")
    db.delete(row)
    db.commit()
    return {"ok": True}


@app.post("/api/warehouses", response_model=schemas.WarehouseRead)
def create_warehouse(
    body: schemas.WarehouseCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    if db.query(models.Warehouse).filter(models.Warehouse.code == body.code).first():
        raise HTTPException(status_code=400, detail="Code already exists")
    row = models.Warehouse(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.get("/api/warehouses", response_model=list[schemas.WarehouseRead])
def list_warehouses(
    db: Session = Depends(get_db), _: models.User = Depends(get_current_user)
):
    return db.query(models.Warehouse).order_by(models.Warehouse.id).all()


@app.delete("/api/warehouses/{wh_id}")
def delete_warehouse(
    wh_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    row = db.get(models.Warehouse, wh_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    if (
        db.query(models.StockMovement)
        .filter(
            (models.StockMovement.warehouse_to_id == wh_id)
            | (models.StockMovement.warehouse_from_id == wh_id)
        )
        .first()
    ):
        raise HTTPException(status_code=400, detail="Warehouse has movements")
    db.delete(row)
    db.commit()
    return {"ok": True}


@app.post("/api/movements", response_model=schemas.StockMovementRead)
def create_movement(
    body: schemas.StockMovementCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    if not db.get(models.Nomenclature, body.nomenclature_id):
        raise HTTPException(status_code=400, detail="Unknown nomenclature")
    w_to, w_from = normalize_movement_warehouses(
        body.movement_type,
        body.warehouse_to_id,
        body.warehouse_from_id,
    )
    err = validate_movement(
        db,
        body.movement_type,
        body.nomenclature_id,
        body.quantity,
        w_to,
        w_from,
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    payload = body.model_dump()
    payload["warehouse_to_id"] = w_to
    payload["warehouse_from_id"] = w_from
    row = models.StockMovement(**payload)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.get("/api/movements", response_model=list[schemas.StockMovementRead])
def list_movements(
    db: Session = Depends(get_db), _: models.User = Depends(get_current_user)
):
    return db.query(models.StockMovement).order_by(models.StockMovement.id.desc()).all()


@app.get("/api/balances", response_model=list[schemas.BalanceRow])
def balances(
    db: Session = Depends(get_db), _: models.User = Depends(get_current_user)
):
    bal_map = warehouse_balance_map(db)
    nom = {n.id: n for n in db.query(models.Nomenclature).all()}
    wh = {w.id: w for w in db.query(models.Warehouse).all()}
    out: list[schemas.BalanceRow] = []
    for (nid, wid), qty in sorted(bal_map.items()):
        if qty == 0:
            continue
        n = nom.get(nid)
        w = wh.get(wid)
        if not n or not w:
            continue
        out.append(
            schemas.BalanceRow(
                nomenclature_id=nid,
                sku=n.sku,
                name=n.name,
                unit=n.unit,
                warehouse_id=wid,
                warehouse_code=w.code,
                warehouse_name=w.name,
                quantity=round(qty, 6),
            )
        )
    return out


def _build_exchange_xml(db: Session) -> str:
    root = ET.Element(
        "CommerceML",
        {
            "Version": "2.0",
            "Date": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
    )
    cat = ET.SubElement(root, "Catalog")
    for n in db.query(models.Nomenclature).order_by(models.Nomenclature.id):
        item = ET.SubElement(cat, "Item")
        ET.SubElement(item, "Id").text = str(n.id)
        ET.SubElement(item, "SKU").text = n.sku
        ET.SubElement(item, "Name").text = n.name
        ET.SubElement(item, "Unit").text = n.unit

    wh_el = ET.SubElement(root, "Warehouses")
    for w in db.query(models.Warehouse).order_by(models.Warehouse.id):
        wn = ET.SubElement(wh_el, "Warehouse")
        ET.SubElement(wn, "Id").text = str(w.id)
        ET.SubElement(wn, "Code").text = w.code
        ET.SubElement(wn, "Name").text = w.name

    st = ET.SubElement(root, "StockBalances")
    bal_map = warehouse_balance_map(db)
    nom = {n.id: n for n in db.query(models.Nomenclature).all()}
    whm = {w.id: w for w in db.query(models.Warehouse).all()}
    for (nid, wid), qty in sorted(bal_map.items()):
        if qty == 0:
            continue
        n, w = nom.get(nid), whm.get(wid)
        if not n or not w:
            continue
        row = ET.SubElement(st, "Balance")
        ET.SubElement(row, "NomenclatureId").text = str(nid)
        ET.SubElement(row, "WarehouseId").text = str(wid)
        ET.SubElement(row, "Quantity").text = f"{qty:.6f}".rstrip("0").rstrip(".")

    rough = ET.tostring(root, encoding="unicode")
    parsed = minidom.parseString(rough)
    return parsed.toprettyxml(indent="  ", encoding="UTF-8").decode("utf-8")


@app.get("/api/export/1c-commerceml")
def export_commerceml(
    db: Session = Depends(get_db), _: models.User = Depends(get_current_user)
):
    xml_body = _build_exchange_xml(db)
    return Response(
        content=xml_body,
        media_type="application/xml; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="material_balances_commerceml.xml"'
        },
    )
