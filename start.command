#!/bin/zsh
# Created: 2026-04-21 America/Denver
# Created by lgtaegi
# Updated:
# - added dependency checks for Node.js and Ollama
# - added clearer startup guidance for first-time users

cd "$(dirname "$0")"

URL="http://127.0.0.1:5055"
MODEL="${OLLAMA_MODEL:-llama3.2:latest}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Install Node.js 20 or newer, then run this file again."
  exit 1
fi

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed."
  echo "Install Ollama from https://ollama.com/download and run this file again."
  exit 1
fi

if ! ollama list >/dev/null 2>&1; then
  echo "Ollama is installed, but the Ollama app is not running."
  echo "Open Ollama first, then run this file again."
  exit 1
fi

if ! ollama list | awk 'NR > 1 {print $1}' | grep -Fxq "$MODEL"; then
  echo "Model ${MODEL} is not installed yet."
  echo "Run: ollama pull ${MODEL}"
  exit 1
fi

echo "Starting AI Story Builder with Ollama ${MODEL}..."
echo "Opening $URL in your browser."
(sleep 1; open "$URL") &
node server.js
