#!/bin/zsh
# Created: 2026-04-21 America/Denver
# Created by lgtaegi
# Updated:
# - creates one backup folder per update
# - copies only the updated code files into that folder
# - writes notes.md inside the same version folder

cd "$(dirname "$0")" || exit 1

if [ "$#" -eq 0 ]; then
  echo "Usage:"
  echo "  ./create-version-backup.command index.html server.js"
  exit 1
fi

VERSION_ID="$(date +%Y-%m-%dT%H-%M-%S)"
TARGET_DIR="versions/${VERSION_ID}"

mkdir -p "$TARGET_DIR"

UPDATED_FILES=()

for file in "$@"; do
  if [ ! -f "$file" ]; then
    echo "Skipped missing file: $file"
    continue
  fi

  cp "$file" "$TARGET_DIR/"
  UPDATED_FILES+=("$file")
done

if [ "${#UPDATED_FILES[@]}" -eq 0 ]; then
  rmdir "$TARGET_DIR" 2>/dev/null
  echo "No valid files were copied."
  exit 1
fi

{
  echo "Created: 2026-04-21 America/Denver"
  echo "Created by lgtaegi"
  echo ""
  echo "Version: ${VERSION_ID}"
  echo ""
  echo "Updated files:"
  for file in "${UPDATED_FILES[@]}"; do
    echo "- ${file}"
  done
  echo ""
  echo "Changes:"
  echo "- fill in the summary of this update here"
} > "${TARGET_DIR}/notes.md"

echo "Created backup folder: ${TARGET_DIR}"
echo "Copied files:"
for file in "${UPDATED_FILES[@]}"; do
  echo "- ${file}"
done
echo "Notes file:"
echo "- ${TARGET_DIR}/notes.md"
