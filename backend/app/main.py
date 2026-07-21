from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app import models, open_food_facts, schemas
from app.database import get_db

app = FastAPI(title="pantry-core")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/items", response_model=schemas.InventoryItemRead, status_code=201)
def create_item(payload: schemas.InventoryItemCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data["product_id"] is not None:
        if db.get(models.Product, data["product_id"]) is None:
            raise HTTPException(status_code=404, detail="Product not found")
        data["source"] = models.Source.scanned
    else:
        # No product picked via scan/autocomplete - link (or start) a
        # barcode-less product by name so this name feeds autocomplete next
        # time, same as scanned products already do.
        product = (
            db.query(models.Product)
            .filter(models.Product.name.ilike(data["name"]))
            .first()
        )
        if product is None:
            product = models.Product(
                name=data["name"], category=data["category"], default_unit=data["unit"]
            )
            db.add(product)
            db.flush()
        data["product_id"] = product.id
    item = models.InventoryItem(**data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/items", response_model=list[schemas.InventoryItemRead])
def list_items(db: Session = Depends(get_db)):
    return db.query(models.InventoryItem).order_by(models.InventoryItem.id).all()


@app.get("/products", response_model=list[schemas.ProductRead])
def search_products(q: str = "", db: Session = Depends(get_db)):
    query = q.strip()
    products = db.query(models.Product).order_by(models.Product.name)
    if not query:
        # No search term - list the whole catalog (for the product
        # management view), not capped like the autocomplete results below.
        return products.all()
    return products.filter(models.Product.name.ilike(f"%{query}%")).limit(10).all()


@app.patch("/products/{product_id}", response_model=schemas.ProductRead)
def update_product(
    product_id: int, payload: schemas.ProductUpdate, db: Session = Depends(get_db)
):
    product = db.get(models.Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    product.name = payload.name
    product.category = payload.category
    product.default_unit = payload.default_unit
    db.commit()
    db.refresh(product)
    return product


@app.get("/products/{barcode}", response_model=schemas.ProductRead)
def get_product(barcode: str, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter_by(barcode=barcode).first()
    if product is not None:
        return product

    result = open_food_facts.lookup(barcode)
    if result is None:
        raise HTTPException(status_code=404, detail="Product not found")

    product = models.Product(
        barcode=barcode, name=result.name, category=result.category
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@app.patch("/items/{item_id}", response_model=schemas.InventoryItemRead)
def update_item(
    item_id: int, payload: schemas.InventoryItemUpdate, db: Session = Depends(get_db)
):
    item = db.get(models.InventoryItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    item.quantity = payload.quantity
    item.expiry_date = payload.expiry_date
    item.min_quantity = payload.min_quantity
    db.commit()
    db.refresh(item)
    return item


@app.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.InventoryItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()


# Muss nach den API-Routen stehen, sonst fängt der Mount auch /items etc. ab.
# Existiert nur nach `npm run build` (lokal im Dev-Betrieb i.d.R. nicht vorhanden).
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
