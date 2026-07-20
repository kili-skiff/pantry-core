#!/bin/sh
# One-time firewall + SSH hardening, run on the Pi itself (not part of
# deploy.sh, which only ships app code). Idempotent: safe to re-run after
# a re-flash.
#
# Usage: setup-firewall.sh <lan-subnet-cidr>   e.g. setup-firewall.sh 192.168.1.0/24
set -eu

LAN="${1:?Usage: $0 <lan-subnet-cidr>, e.g. 192.168.1.0/24}"

sudo apt-get update -qq
sudo apt-get install -y -qq ufw

# Default deny both directions. Inbound: only SSH + the app, only from the
# LAN. Outbound: only what updates/time-sync need - not full isolation,
# since losing security patches is a worse trade than a narrow allowlist.
sudo ufw default deny incoming
sudo ufw default deny outgoing
sudo ufw allow from "$LAN" to any port 22 proto tcp
sudo ufw allow from "$LAN" to any port 8000 proto tcp
sudo ufw allow out 53
sudo ufw allow out 123/udp
sudo ufw allow out 67,68/udp
sudo ufw allow out 80/tcp
sudo ufw allow out 443/tcp
sudo ufw --force enable

# Key-only SSH. The cloud-init drop-in is included before sshd_config and
# otherwise silently re-enables password auth after this edit.
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
if [ -f /etc/ssh/sshd_config.d/50-cloud-init.conf ]; then
  sudo sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config.d/50-cloud-init.conf
fi
sudo sshd -t
sudo systemctl reload ssh

echo "Done."
sudo ufw status verbose
