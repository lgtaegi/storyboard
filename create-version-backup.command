#!/bin/zsh
# Created: 2026-04-21 America/Denver
# Created by lgtaegi
# Updated:
# - creates one backup folder per update
# - copies updated code files plus essential runnable app files into that folder
# - writes notes.md inside the same version folder

cd "$(dirname "$0")" || exit 1

LABEL=""

if [ "$1" = "--label" ]; then
  shift
  LABEL="$1"
  shift
fi

if [ "$#" -eq 0 ]; then
  echo "Usage:"
  echo "  ./create-version-backup.command [--label short-label] index.html server.js"
  exit 1
fi

VERSION_ID="$(date +%Y-%m-%dT%H-%M-%S)"
SLUG_LABEL="$(printf '%s' "$LABEL" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/-\{2,\}/-/g; s/^-//; s/-$//')"
if [ -n "$SLUG_LABEL" ]; then
  TARGET_DIR="versions/${VERSION_ID}_newCodes_${SLUG_LABEL}"
else
  TARGET_DIR="versions/${VERSION_ID}_newCodes"
fi

mkdir -p "$TARGET_DIR"

ESSENTIAL_FILES=(
  "index.html"
  "server.js"
  "README.md"
  "INSTALL.md"
  "start.command"
  "check-requirements.command"
)

UPDATED_FILES=()
COPIED_FILES=()

add_unique_file() {
  local candidate="$1"
  local existing
  for existing in "${COPIED_FILES[@]}"; do
    [ "$existing" = "$candidate" ] && return 0
  done
  COPIED_FILES+=("$candidate")
}

for file in "${ESSENTIAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$TARGET_DIR/"
    add_unique_file "$file"
  fi
done

for file in "$@"; do
  if [ ! -f "$file" ]; then
    echo "Skipped missing file: $file"
    continue
  fi

  cp "$file" "$TARGET_DIR/"
  UPDATED_FILES+=("$file")
  add_unique_file "$file"
done

if [ "${#COPIED_FILES[@]}" -eq 0 ]; then
  rmdir "$TARGET_DIR" 2>/dev/null
  echo "No valid files were copied."
  exit 1
fi

{
  echo "Created: 2026-04-21 America/Denver"
  echo "Created by lgtaegi"
  echo ""
  echo "Version: ${VERSION_ID}"
  if [ -n "$LABEL" ]; then
    echo "Label: ${LABEL}"
  fi
  echo ""
  echo "Essential app files copied:"
  for file in "${ESSENTIAL_FILES[@]}"; do
    if [ -f "$TARGET_DIR/${file:t}" ] 2>/dev/null; then
      echo "- ${file}"
    fi
  done
  echo ""
  echo "Updated files:"
  if [ "${#UPDATED_FILES[@]}" -eq 0 ]; then
    echo "- none listed"
  else
    for file in "${UPDATED_FILES[@]}"; do
      echo "- ${file}"
    done
  fi
  echo ""
  echo "Changes:"
  echo "- fill in the summary of this update here"
} > "${TARGET_DIR}/notes.md"

echo "Created backup folder: ${TARGET_DIR}"
echo "Copied files:"
for file in "${COPIED_FILES[@]}"; do
  echo "- ${file}"
done
echo "Notes file:"
echo "- ${TARGET_DIR}/notes.md"
