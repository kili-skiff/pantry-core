#!/bin/sh
# One-time kiosk setup, run on the Pi itself (not part of deploy.sh, which
# only ships app code). Idempotent: safe to re-run after a re-flash.
set -eu

# Disable the desktop's default panel/file-manager/xdg-autostart - labwc
# runs the system autostart *and* ~/.config/labwc/autostart, not one or the
# other, so without this you get a duplicate panel.
sudo sed -i \
  -e '/pcmanfm-pi/s/^/#/' \
  -e '/\/usr\/bin\/wf-panel-pi &/s/^/#/' \
  -e '/lxsession-xdg-autostart/s/^/#/' \
  /etc/xdg/labwc/autostart

# Window rule: maximize + undecorate every window instead of relying on
# chromium's own --kiosk fullscreen, which hides the on-screen keyboard on
# labwc (see the comment in labwc-autostart for why). Wildcard identifier
# because chromium's --app mode doesn't reliably set app_id="chromium".
# Fine here since this Pi only ever runs the one kiosk window.
RC=~/.config/labwc/rc.xml
if ! grep -q 'windowRule identifier' "$RC"; then
  sed -i 's#</openbox_config>#\t<windowRules>\n\t\t<windowRule identifier="*" serverDecoration="no">\n\t\t\t<action name="Maximize" />\n\t\t</windowRule>\n\t</windowRules>\n</openbox_config>#' "$RC"
fi

echo "Done. Reboot to apply: sudo reboot"
