# 1. Tech stack

Date: 2026-07-19
Status: accepted

## Context

pantry-core runs on a single Raspberry Pi 5 with one attached touchscreen,
in kiosk mode, used by one person at a time on the local network at most.
There's no multi-tenant or concurrent-write scenario to design around, and
no internet-facing traffic. The MVP (CRUD over a single `InventoryItem`
table) is built and running end to end; this record captures the
reasoning behind the stack now that it's actually been used.

Planned follow-up features (expiry warnings, barcode scanning, receipt
import) will extend the data model rather than replace it, so schema
migrations need to stay easy, and the backend has to run comfortably on
Pi-class hardware shared with the browser rendering the kiosk UI.

## Decision

- Backend: FastAPI + SQLAlchemy + SQLite + Alembic
- Frontend: React + TypeScript + Vite

### Backend

**FastAPI over Flask/Django.** Request/response validation comes from
Pydantic models (`schemas.py`) that map directly onto the SQLAlchemy
`InventoryItem` model, so validation stays declarative instead of
hand-rolled. Django's batteries — admin panel, auth, multi-app structure —
solve problems this project doesn't have: one user, one table, no admin UI
beyond the touchscreen itself.

**SQLite over Postgres/MySQL.** A single-writer, file-based database
matches how the app is actually used: one Pi, one screen, no concurrent
access. It means no separate DB server process, no network config, no
extra systemd unit to keep alive on the Pi. This trade-off is deliberate:
if pantry-core ever needs multiple devices writing at once (e.g. a phone
app next to the kiosk), that forces a real migration to a client-server
database, not a config change.

**Alembic from the start.** Schema changes are certain — expiry warnings
and receipt import both imply new columns or tables — so migration
tooling is worth the setup cost now rather than hand-editing `pantry.db`
once real data is in it.

### Frontend

**React + TypeScript + Vite over plain JS or a meta-framework
(Next.js etc.).** The touchscreen UI is a single page with no routing, no
server-side rendering, no SEO concerns — a meta-framework would add build
complexity without solving a problem this app has. TypeScript catches
shape mismatches against the backend's Pydantic schemas at compile time
rather than at runtime on a Pi that's inconvenient to debug interactively.
Vite keeps dev server and build times fast as the UI grows past the
current list-and-form.

## Consequences

- No built-in path to multiple concurrent writers. Adding one later means
  replacing SQLite with a client-server database and adding session
  handling FastAPI currently doesn't need.
- No admin UI or auth layer exists. Acceptable now — physical access to
  the Pi is the access control — but would need to be added explicitly if
  pantry-core were ever exposed beyond the local network.
- Schema changes (barcode scan, receipt import) go through Alembic
  migrations rather than ad-hoc edits, at the cost of a bit of ceremony
  for small changes.
