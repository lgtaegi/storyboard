#!/bin/zsh
cd "$(dirname "$0")"
URL="http://127.0.0.1:5055"
echo "Starting AI Story Builder with Ollama llama3.2..."
echo "Opening $URL in your browser."
(sleep 1; open "$URL") &
node server.js
