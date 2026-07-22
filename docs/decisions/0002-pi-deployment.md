# 2. Pi deployment

Date: 2026-07-19
Status: accepted

## Context

The MVP is running end to end in dev; this records how it actually got
deployed to the Raspberry Pi 5 (Raspberry Pi OS 64-bit with desktop,
Debian 13/trixie, labwc as the Wayland compositor) and why.

## Decision

**systemd service over Docker.** Backend runs as a plain `uvicorn`
process under systemd (`deploy/pantry-core.service`), venv on the Pi
directly — one Python process on a single-purpose device, no other
services to isolate from. FastAPI serves the frontend's `dist/` build
itself via `StaticFiles` (mounted after the API routes), so it's one
process instead of adding nginx.

**ufw firewall, LAN-only inbound, restricted outbound.** Default deny
both directions. Inbound: SSH (22) and the app (8000) only from the home
LAN (`192.168.178.0/24`). Outbound: DNS, NTP, DHCP, HTTP/HTTPS only —
covers `apt` updates without leaving the Pi fully open. Full internet
isolation was rejected: no security patches is a worse trade than a
narrow allowlist. SSH password auth is disabled (key-only) in both
`sshd_config` and Raspberry Pi Imager's cloud-init drop-in
(`/etc/ssh/sshd_config.d/50-cloud-init.conf`), which is included first
and otherwise silently re-enables it.

**Plain rsync deploy script over CI/CD.** `deploy/deploy.sh` builds the
frontend locally, rsyncs backend + build to the Pi, installs deps,
migrates, and restarts the service over SSH. A cloud-hosted CI runner
can't reach the Pi at all given the inbound firewall rule above — a
self-hosted runner would be real infra for a one-device home project.

**Chromium kiosk display: `--app` + labwc window rule, not `--kiosk`.**
`--kiosk` requests true Wayland fullscreen, which on labwc renders above
the panel layer and hides squeekboard (the on-screen keyboard) entirely
([labwc/labwc#2926](https://github.com/labwc/labwc/issues/2926)).
Instead, Chromium launches with `--app=<url>` (no tabs/address bar,
regular window) and a labwc `windowRule` in `rc.xml` maximizes it and
turns off server-side decoration. squeekboard runs standalone and
auto-shows on text field focus (confirmed working on the Pi) — no panel
or manual toggle button needed. The desktop's default autostart runs
*in addition to* the user one, not instead of it, so
`deploy/setup-kiosk.sh` disables those entries explicitly.

## Consequences

- `deploy/deploy.sh` covers app code. The systemd unit and kiosk setup
  don't redeploy automatically — `pantry-core.service` needs a manual
  `scp` + `daemon-reload`, `setup-kiosk.sh` only needs re-running after a
  re-flash.
- No automatic deploy on git push; would need a self-hosted runner on
  the LAN for that.
- ufw's outbound allowlist is port-based, not domain-based: any
  HTTP/HTTPS destination is allowed, not just Debian's mirrors.
  Narrower than open outbound, not a hard guarantee.
