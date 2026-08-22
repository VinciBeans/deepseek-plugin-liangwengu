#!/usr/bin/env bash
# Install 梁文谷 into the REAL web profile (~/.dsh/profiles/web).
#
# Works on:
#   - Linux / macOS (any bash)
#   - Windows: Git Bash, MSYS2, Cygwin, or WSL
#
# Notes:
#   - Takes effect only after the running 'dsh web' GUI is restarted
#     (plugin-set changes are read at boot).
#   - Uses pnpm 'link:' so edits in the source dir are live.
#   - Unlike the taskboard install script, this does NOT overwrite an existing
#     cordis.patch.yml; it appends the plugin entry only when absent.
set -euo pipefail

# ---------------------------------------------------------------------------
# Windows bootstrap
# ---------------------------------------------------------------------------

# CRLF guard: with git core.autocrlf=true a Windows checkout stores this file
# with CRLF line endings, which a plain (non-MSYS) bash rejects. Re-exec a
# LF-only copy of ourselves so the script also runs from WSL or Linux.
if [ "${LWGU_SELF_FIXED:-0}" != "1" ] && LC_ALL=C grep -q "$(printf '\r')" "$0" 2>/dev/null; then
  LWGU_SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
  _self_lf="$(mktemp "${TMPDIR:-/tmp}/liangwengu-install.XXXXXX")"
  LC_ALL=C tr -d '\r' < "$0" > "$_self_lf"
  LWGU_SELF_FIXED=1 LWGU_SRC_DIR="$LWGU_SRC_DIR" exec bash "$_self_lf" "$@"
fi

# Are we on Windows (Git Bash / MSYS2 / Cygwin)? WSL is NOT detected here:
# it is a normal POSIX environment and uses the plain $HOME logic below.
is_windows() {
  [ -n "${USERPROFILE:-}" ] && [ -n "${WINDIR:-}" ]
}

# Convert a path to Windows mixed style (C:/foo/bar). Native Windows tools
# (pnpm, node, dsh) cannot resolve MSYS-style paths like /e/Works/...;
# Windows would misread them as drive-relative (C:\e\Works\...).
win_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  else
    printf '%s' "$1" | sed -e 's|^/\([A-Za-z]\)/|\1:/|' -e 's|\\|/|g'
  fi
}

# Plugin source dir. When the CRLF guard re-execs us, "$0" is a temp copy,
# so LWGU_SRC_DIR carries the real location.
if [ -n "${LWGU_SRC_DIR:-}" ]; then
  PLUGIN_DIR="$LWGU_SRC_DIR"
else
  PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

# DSH home: $DSH_HOME wins, then the platform home dir. On Windows,
# $USERPROFILE is exactly what Node's os.homedir() returns.
if [ -n "${DSH_HOME:-}" ]; then
  DSH_HOME_DIR="$DSH_HOME"
elif is_windows; then
  DSH_HOME_DIR="$USERPROFILE/.dsh"
else
  DSH_HOME_DIR="$HOME/.dsh"
fi
PROFILE_DIR="$DSH_HOME_DIR/profiles/web"

# Normalize to Windows mixed style when on Windows; MSYS tools (cd, grep,
# cat) accept C:/... just fine, and native tools (pnpm, dsh) require it.
if is_windows; then
  PLUGIN_DIR="$(win_path "$PLUGIN_DIR")"
  PROFILE_DIR="$(win_path "$PROFILE_DIR")"
fi

ENTRY_ID="梁文谷"

if [ ! -d "$PLUGIN_DIR" ] || [ ! -f "$PLUGIN_DIR/package.json" ]; then
  echo "plugin source not found: $PLUGIN_DIR" >&2
  exit 1
fi
if [ ! -d "$PROFILE_DIR" ]; then
  echo "DSH web profile not found: $PROFILE_DIR" >&2
  echo "Have you started 'dsh web' at least once?" >&2
  exit 1
fi

cd "$PROFILE_DIR"

# Prefer the real pnpm on PATH; fall back to corepack's managed pnpm.
run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  elif command -v corepack >/dev/null 2>&1; then
    corepack pnpm "$@"
  else
    echo "error: neither 'pnpm' nor 'corepack' found on PATH" >&2
    exit 1
  fi
}

echo "==> adding plugin dependency (link:) to $PROFILE_DIR"
run_pnpm add "link:$PLUGIN_DIR"

# Sanity check: the recorded spec must be a Windows-resolvable path, not an
# MSYS-style one (link:/x/...) that native pnpm/Node would misread.
if grep -Eq '"liangwengu"[[:space:]]*:[[:space:]]*"link:/[a-z]/' "$PROFILE_DIR/package.json"; then
  echo "WARNING: package.json still records an MSYS-style path (link:/x/...);" >&2
  echo "         Windows tools cannot resolve it. Make sure cygpath is available." >&2
fi

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

# Locate the dsh CLI. On Windows it is usually NOT on PATH in a plain
# terminal: `npx dsh web` keeps it in the npx cache, so search there too.
find_dsh() {
  # 1) PATH (Git Bash can run the .cmd shims too)
  if command -v dsh >/dev/null 2>&1; then
    command -v dsh
    return 0
  fi
  if command -v dsh.cmd >/dev/null 2>&1; then
    command -v dsh.cmd
    return 0
  fi
  # 2) npm global prefix (layout differs between Windows and POSIX)
  if command -v npm >/dev/null 2>&1; then
    NPM_PREFIX="$(npm prefix -g 2>/dev/null || true)"
    if [ -n "$NPM_PREFIX" ]; then
      if is_windows; then
        if [ -f "$NPM_PREFIX/dsh.cmd" ]; then
          printf '%s\n' "$NPM_PREFIX/dsh.cmd"
          return 0
        fi
      elif [ -f "$NPM_PREFIX/bin/dsh" ]; then
        printf '%s\n' "$NPM_PREFIX/bin/dsh"
        return 0
      fi
    fi
  fi
  # 3) npx cache (where `npx dsh web` installs the CLI on Windows)
  if is_windows; then
    for _npx_root in "${LOCALAPPDATA:-}/npm-cache/_npx" "$HOME/.npm/_npx" "$HOME/.npx"; do
      [ -n "$_npx_root" ] || continue
      _npx_root="$(win_path "$_npx_root")"
      for _d in "$_npx_root"/*/node_modules/.bin/dsh; do
        if [ -f "$_d" ]; then
          printf '%s\n' "$_d"
          return 0
        fi
      done
    done
  fi
  return 1
}

echo "==> verifying composition"
DSH_BIN="$(find_dsh || true)"
if [ -n "$DSH_BIN" ]; then
  echo "    using dsh at: $DSH_BIN"
  if "$DSH_BIN" --profile web --dump-config 2>/dev/null | grep -A1 "id: $ENTRY_ID"; then
    :
  else
    echo "WARNING: $ENTRY_ID not visible in composed config" >&2
  fi
else
  echo "WARNING: 'dsh' not found; checking the plugin link directly." >&2
  if command -v node >/dev/null 2>&1 && node -e "require.resolve('liangwengu/package.json', { paths: [process.cwd()] })" >/dev/null 2>&1; then
    echo "OK: profile can resolve liangwengu (link is live)." >&2
  else
    echo "WARNING: profile cannot resolve 'liangwengu' from $PROFILE_DIR" >&2
  fi
fi

echo "==> done. Restart the GUI (stop 'dsh web', run it again) to activate."
