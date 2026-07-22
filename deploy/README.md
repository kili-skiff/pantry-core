# Deployment

One-time setup, in order, replace `<user>@<pi-ip>` with the actual values
(also copy `.env.example` to `.env` here first, so `deploy.sh` picks them
up):

1. Flash the SD card with Raspberry Pi Imager (Raspberry Pi OS 64-bit,
   with desktop). In Advanced Options: set hostname, username, enable
   SSH, configure Wi-Fi. This step stays manual - nothing here scripts it.
2. Copy the deploy key onto the Pi:
   ```
   ssh-copy-id -i ~/.ssh/pantry_pi_deploy.pub <user>@<pi-ip>
   ```
3. Firewall + SSH hardening:
   ```
   scp deploy/setup-firewall.sh <user>@<pi-ip>:/tmp/
   ssh <user>@<pi-ip> "/tmp/setup-firewall.sh <your-lan-subnet-cidr>"
   ```
4. Kiosk mode:
   ```
   scp deploy/labwc-autostart <user>@<pi-ip>:~/.config/labwc/autostart
   scp deploy/setup-kiosk.sh <user>@<pi-ip>:/tmp/
   ssh <user>@<pi-ip> "chmod +x ~/.config/labwc/autostart /tmp/setup-kiosk.sh && /tmp/setup-kiosk.sh"
   ```
5. systemd service: replace `<user>` in `deploy/pantry-core.service` with
   the actual username first (it's a static file, not templated).
   ```
   scp deploy/pantry-core.service <user>@<pi-ip>:/tmp/
   ssh <user>@<pi-ip> "sudo cp /tmp/pantry-core.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now pantry-core"
   ```
6. First app deploy: `./deploy/deploy.sh` (see below).

## Regular deploys

After the one-time setup, shipping code changes is just:

```
./deploy/deploy.sh
```

Builds the frontend, rsyncs backend + build to the Pi, installs
dependencies, runs Alembic migrations, restarts the service.

**Not covered by `deploy.sh`:** changes to `deploy/pantry-core.service`
itself. Re-run step 5 above manually after editing it.
