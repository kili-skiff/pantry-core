#!/usr/bin/env bash
# Builds the frontend locally and syncs backend + frontend build to the Pi,
# then installs dependencies, migrates the DB and restarts the service there.
#
# PI_HOST/PI_USER come from deploy/.env (gitignored, copy .env.example) so
# the real LAN IP doesn't end up in a public repo.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "${SCRIPT_DIR}/deploy/.env" ] && . "${SCRIPT_DIR}/deploy/.env"

PI_HOST="${PI_HOST:-192.168.1.100}"
PI_USER="${PI_USER:-<user>}"
PI_KEY="${HOME}/.ssh/pantry_pi_deploy"
PI_TARGET="${PI_USER}@${PI_HOST}"
REMOTE_DIR="/home/${PI_USER}/pantry-core"

SSH="ssh -i ${PI_KEY}"

echo "==> Building frontend"
(cd "${SCRIPT_DIR}/frontend" && npm run build)

echo "==> Syncing backend"
rsync -avz --delete \
  --exclude '.venv' --exclude '__pycache__' --exclude '*.db' --exclude '.pytest_cache' \
  -e "${SSH}" \
  "${SCRIPT_DIR}/backend/" "${PI_TARGET}:${REMOTE_DIR}/backend/"

echo "==> Syncing frontend build"
rsync -avz --delete \
  -e "${SSH}" \
  "${SCRIPT_DIR}/frontend/dist/" "${PI_TARGET}:${REMOTE_DIR}/frontend/dist/"

echo "==> Installing dependencies + migrating on Pi"
${SSH} "${PI_TARGET}" bash -s <<'REMOTE'
set -euo pipefail
cd ~/pantry-core/backend
python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
.venv/bin/alembic upgrade head
REMOTE

echo "==> Restarting service"
${SSH} "${PI_TARGET}" "sudo systemctl restart pantry-core"
${SSH} "${PI_TARGET}" "sudo systemctl status pantry-core --no-pager | head -5"

echo "==> Restarting kiosk display"
# Chromium stays open across deploys and won't notice new frontend files
# on its own. It's wrapped in lwrespawn (deploy/labwc-autostart), so
# killing it here just makes it relaunch with the fresh build.
${SSH} "${PI_TARGET}" "pkill chromium || true"

echo "==> Done"
