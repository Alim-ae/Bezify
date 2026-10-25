#!/bin/bash
# Bezify installer for macOS (After Effects CEP panel).
# Run from the folder that contains this script and the "Bezify" folder.

cd "$(dirname "$0")" || exit 1
SOURCE="$(pwd)/Bezify"
EXT_ROOT="$HOME/Library/Application Support/Adobe/CEP/extensions"
DEST="$EXT_ROOT/Bezify"
LEGACY="$EXT_ROOT/MotionCraft"
BACKUP="$(mktemp -d)"

echo ""
echo " Bezify installer"
echo " ----------------"

if [ ! -f "$SOURCE/CSXS/manifest.xml" ]; then
  echo ""
  echo " Could not find the Bezify folder next to this script."
  echo " Extract the whole zip first, then run this script from the extracted folder."
  exit 1
fi

if pgrep -f "Adobe After Effects" > /dev/null 2>&1; then
  echo ""
  echo " After Effects is running. Quit it completely, then run this installer again."
  exit 1
fi

set -e

# 1. Allow unsigned panels (PlayerDebugMode) for CEP 9 to 13
for version in 9 10 11 12 13; do
  defaults write "com.adobe.CSXS.$version" PlayerDebugMode 1
done
killall cfprefsd > /dev/null 2>&1 || true

# 2. Keep presets from an existing Bezify install
if [ -d "$DEST/presets" ]; then
  cp -R "$DEST/presets/." "$BACKUP/" 2>/dev/null || true
fi

# 3. Fresh copy of the panel
mkdir -p "$EXT_ROOT"
rm -rf "$DEST"
cp -R "$SOURCE" "$DEST"
mkdir -p "$DEST/presets"
xattr -dr com.apple.quarantine "$DEST" > /dev/null 2>&1 || true

# 4. Restore Bezify presets, then migrate old MotionCraft presets (never overwrite)
cp -R "$BACKUP/." "$DEST/presets/" 2>/dev/null || true
MIGRATED=0
if [ -d "$LEGACY/presets" ]; then
  for file in "$LEGACY/presets/"*.json; do
    [ -e "$file" ] || continue
    if [ ! -e "$DEST/presets/$(basename "$file")" ]; then
      cp "$file" "$DEST/presets/"
      MIGRATED=$((MIGRATED + 1))
    fi
  done
  rm -rf "$LEGACY"
fi
rm -rf "$BACKUP"

echo ""
echo " Bezify installed successfully."
echo " Location: $DEST"
if [ "$MIGRATED" -gt 0 ]; then
  echo " Migrated $MIGRATED saved preset file(s) from MotionCraft."
fi
echo " Next: start After Effects, then open Window > Extensions (Legacy) > Bezify."
echo ""
