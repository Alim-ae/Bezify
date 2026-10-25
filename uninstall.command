#!/bin/bash
# Bezify uninstaller for macOS. Removes the panel and backs up your saved presets to the Desktop.

DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/Bezify"

echo ""
echo " Bezify uninstaller"
echo " ------------------"

if pgrep -f "Adobe After Effects" > /dev/null 2>&1; then
  echo ""
  echo " After Effects is running. Quit it completely, then run this again."
  exit 1
fi

if [ ! -d "$DEST" ]; then
  echo ""
  echo " Bezify is not installed (nothing to remove)."
  exit 0
fi

if [ -d "$DEST/presets" ] && [ -n "$(find "$DEST/presets" -name '*.json' 2>/dev/null | head -1)" ]; then
  BACKUP="$HOME/Desktop/Bezify-presets-backup-$(date +%Y%m%d-%H%M)"
  cp -R "$DEST/presets" "$BACKUP"
  echo ""
  echo " Your saved presets were copied to: $BACKUP"
fi

rm -rf "$DEST"
echo ""
echo " Bezify was removed."
echo " Note: PlayerDebugMode was left on, because other panels may need it."
echo ""
