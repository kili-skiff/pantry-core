# pantry-core

A small warehouse management system for tracking kitchen/pantry inventory,
built to run on a Raspberry Pi 5 with a touchscreen.

## What works right now

- Backend API to add, list, and remove inventory items (name, category,
  quantity, unit, expiry date)
- Web UI showing the current inventory as a list, with a form to add items
  and a button to remove them

## Stack

- Backend: FastAPI, SQLAlchemy, SQLite, Alembic
- Frontend: React, TypeScript, Vite
- Target: Raspberry Pi 5, touchscreen in kiosk mode (not deployed yet)

## Running locally

Backend:

```bash
cd backend
python3.12 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/alembic upgrade head
./.venv/bin/uvicorn app.main:app
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend runs on `:8000`, frontend on `:5173`.

## Status

MVP (manual inventory tracking) works end to end. Not yet done: automated
tests, input validation, deployment to the Pi. Planned later: expiry
warnings, barcode scanning, importing items by scanning a supermarket
receipt.
