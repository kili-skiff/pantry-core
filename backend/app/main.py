from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app import models, schemas
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
    item = models.InventoryItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/items", response_model=list[schemas.InventoryItemRead])
def list_items(db: Session = Depends(get_db)):
    return db.query(models.InventoryItem).order_by(models.InventoryItem.id).all()


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
