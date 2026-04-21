#!/bin/zsh
# Created: 2026-04-21 America/Denver
# Created by lgtaegi
# Updated:
# - added local environment checks for running the storyboard app

cd "$(dirname "$0")"

MODEL="${OLLAMA_MODEL:-llama3.2:latest}"
HAS_ERROR=0

echo "Checking AI Story Builder requirements..."
echo ""

if command -v node >/dev/null 2>&1; then
  echo "[OK] Node.js: $(node --version)"
else
  echo "[Missing] Node.js 20 or newer is required."
  HAS_ERROR=1
fi

if command -v ollama >/dev/null 2>&1; then
  echo "[OK] Ollama CLI is installed."
else
  echo "[Missing] Ollama is required: https://ollama.com/download"
  HAS_ERROR=1
fi

if command -v ollama >/dev/null 2>&1; then
  if ollama list >/dev/null 2>&1; then
    echo "[OK] Ollama app is running."
    if ollama list | grep -q "^${MODEL%%:*}[[:space:]]"; then
      echo "[OK] Model available: ${MODEL}"
    else
      echo "[Missing] Model not found: ${MODEL}"
      echo "         Run: ollama pull ${MODEL}"
      HAS_ERROR=1
    fi
  else
    echo "[Missing] Ollama app is not running."
    HAS_ERROR=1
  fi
fi

echo ""
if [ "$HAS_ERROR" -eq 0 ]; then
  echo "Everything looks ready."
  echo "Run start.command to open the app."
else
  echo "Some requirements are missing."
  echo "Read INSTALL.md for the setup steps."
fi
