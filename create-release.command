#!/bin/zsh
# Created: 2026-04-21 America/Denver
# Created by lgtaegi
# Updated:
# - creates an official release folder under releases/
# - copies the runnable app files and release documents
# - writes release-notes.md inside the release folder

cd "$(dirname "$0")" || exit 1

VERSION_VALUE="$(cat VERSION 2>/dev/null | tr -d '[:space:]')"
LABEL=""

if [ -z "$VERSION_VALUE" ]; then
  echo "VERSION file is missing or empty."
  exit 1
fi

if [ "$1" = "--label" ]; then
  shift
  LABEL="$1"
  shift
fi

SLUG_LABEL="$(printf '%s' "$LABEL" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/-\{2,\}/-/g; s/^-//; s/-$//')"
if [ -n "$SLUG_LABEL" ]; then
  TARGET_DIR="releases/v${VERSION_VALUE}_${SLUG_LABEL}"
else
  TARGET_DIR="releases/v${VERSION_VALUE}"
fi

mkdir -p "$TARGET_DIR"

RELEASE_FILES=(
  "index.html"
  "server.js"
  "README.md"
  "INSTALL.md"
  "VERSION"
  "CHANGELOG.md"
  "start.command"
  "check-requirements.command"
  "create-version-backup.command"
  ".gitignore"
)

COPIED_FILES=()

for file in "${RELEASE_FILES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$TARGET_DIR/"
    COPIED_FILES+=("$file")
  fi
done

{
  echo "Created: 2026-04-21 America/Denver"
  echo "Created by lgtaegi"
  echo ""
  echo "Release version: v${VERSION_VALUE}"
  if [ -n "$LABEL" ]; then
    echo "Release label: ${LABEL}"
  fi
  echo ""
  echo "Included files:"
  for file in "${COPIED_FILES[@]}"; do
    echo "- ${file}"
  done
  echo ""
  echo "Release notes:"
  echo "- fill in the release summary here"
} > "${TARGET_DIR}/release-notes.md"

echo "Created release folder: ${TARGET_DIR}"
echo "Included files:"
for file in "${COPIED_FILES[@]}"; do
  echo "- ${file}"
done
echo "Release notes:"
echo "- ${TARGET_DIR}/release-notes.md"
