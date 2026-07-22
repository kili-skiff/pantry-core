# pantry-core

A small warehouse management system for tracking kitchen/pantry inventory,
built to run on a Raspberry Pi 5 with a touchscreen.

## What works right now

- Backend API to add, list, update, and remove inventory items (name,
  category, quantity, unit, expiry date, low-stock threshold), with input
  validation
- Web UI: a dashboard (all items, low on stock, expiring soon), a
  searchable all-items view, and a product catalog view - plus per-item
  editing (quantity stepper, expiry date, low-stock threshold) and a
  recent-activity feed with undo
- Barcode scanning: camera-based scan (webcam, via ZXing) or manual entry
  looks up the product locally or via Open Food Facts, pre-fills the add
  form; name autocomplete does the same for items without a barcode
- Light/dark theme toggle

## Stack

- Backend: FastAPI, SQLAlchemy, SQLite, Alembic
- Frontend: React, TypeScript, Vite
- Runs on a Raspberry Pi 5, touchscreen in kiosk mode (Chromium + labwc)

Reasoning behind these choices is in `docs/decisions/`.

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

Backend tests:

```bash
cd backend
./.venv/bin/pip install -r requirements-dev.txt
./.venv/bin/pytest
```

Frontend tests:

```bash
cd frontend
npm run test
```

## VS Code

`.vscode/` has tasks and debug configs set up:

- "Terminal → Run Task" → "Start all (backend + frontend)" runs both dev
  servers.
- "Run and Debug" panel has configs to debug the backend (breakpoints in
  FastAPI routes) and to run pytest with breakpoints.
- The Testing panel (beaker icon) discovers and runs the backend tests
  individually or all at once.
- Recommended extensions (Black Formatter, Ruff) give format-on-save and
  lint fixes for the backend. "Run Task" also has "Backend: format
  (black)" and "Backend: lint (ruff)" for running them manually.

## Deployment

Deployed to a Raspberry Pi 5, backend as a systemd service serving the
frontend's build via FastAPI's `StaticFiles`, Chromium in kiosk mode on
the touchscreen. Setup/redeploy steps are in `deploy/README.md`,
trade-offs behind them in `docs/decisions/0002-pi-deployment.md`.

## Status

MVP (manual inventory tracking) works end to end, backend and frontend
both covered by tests (pytest / Vitest), deployed to the Pi and running
in kiosk mode. Barcode scanning, autocomplete, and the product catalog
are in place too. Planned: estimating expiry dates from category,
notifications on upcoming expiry, importing items by scanning a
supermarket receipt.
