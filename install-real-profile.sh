#!/usr/bin/env bash
# Install 梁文谷 into the REAL web profile (~/.dsh/profiles/web).
#
# Notes:
#  - Takes effect only after the running 'dsh web' GUI is restarted
#    (plugin-set changes are read at boot).
#  - Uses pnpm 'link:' so edits in the source dir are live.
#  - Unlike the taskboard install script, this does NOT overwrite an existing
#    cordis.patch.yml; it appends the plugin entry only when absent.
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_DIR="$HOME/.dsh/profiles/web"
ENTRY_ID="梁文谷"

if [ ! -d "$PLUGIN_DIR" ]; then
  echo "plugin source not found: $PLUGIN_DIR" >&2
  exit 1
fi
if [ ! -d "$PROFILE_DIR" ]; then
  echo "DSH web profile not found: $PROFILE_DIR" >&2
  echo "Have you started 'dsh web' at least once?" >&2
  exit 1
fi

cd "$PROFILE_DIR"

echo "==> adding plugin dependency (link:) to $PROFILE_DIR"
corepack pnpm add "link:$PLUGIN_DIR" 2>/dev/null || pnpm add "link:$PLUGIN_DIR"

PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
if [ -f "$PATCH_FILE" ] && grep -q "id: $ENTRY_ID" "$PATCH_FILE"; then
  echo "==> $ENTRY_ID already present in $PATCH_FILE"
else
  echo "==> appending $ENTRY_ID to $PATCH_FILE"
  cat >> "$PATCH_FILE" <<'PATCH'
- insert:
    - id: 梁文谷
      name: 'liangwengu'
PATCH
fi

echo "==> verifying composition"
DSH_BIN="$(npm root -g 2>/dev/null)/../.bin/dsh"
if command -v dsh >/dev/null 2>&1; then DSH_BIN="$(command -v dsh)"; fi
"$DSH_BIN" --profile web --dump-config 2>/dev/null | grep -A1 "id: $ENTRY_ID" || echo "WARNING: $ENTRY_ID not visible in composed config"

echo "==> done. Restart the GUI (stop 'dsh web', run it again) to activate."
