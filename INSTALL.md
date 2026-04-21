# AI Story Builder Install Guide

Created: 2026-04-21 America/Denver  
Created by lgtaegi
Updated:
- added note about version backup folders for updated code files only
- backup folders now include essential runnable app files plus updated files

## Requirements

- macOS
- Node.js 20 or newer
- Ollama
- An Ollama model, default: `llama3.2:latest`

## Quick Install

1. Install Node.js  
   Download from [https://nodejs.org](https://nodejs.org)

2. Install Ollama  
   Download from [https://ollama.com/download](https://ollama.com/download)

3. Pull the default model

```bash
ollama pull llama3.2:latest
```

4. Open the Ollama app so the local server is running

5. Double-click:

```text
check-requirements.command
```

6. If everything is ready, double-click:

```text
start.command
```

7. The app opens in your browser at:

```text
http://127.0.0.1:5055
```

## Included Helper Files

- `start.command`  
  Starts the app and opens the browser

- `check-requirements.command`  
  Checks whether Node.js, Ollama, and the default model are ready

- `create-version-backup.command`  
  Creates a version folder containing essential runnable app files plus the updated files for that change

## If Ollama Is Installed But Not Running

Open the Ollama app first, then run:

```text
check-requirements.command
```

## If the Model Is Missing

Run:

```bash
ollama pull llama3.2:latest
```

## Optional: Use Another Model

The app UI lets you switch models.  
If you want a different default at launch, run the app from Terminal like this:

```bash
cd /Users/macmini/Documents/000_AI/00_storyboard
OLLAMA_MODEL=qwen2.5:latest ./start.command
```

## Main Project Files

- `index.html`
- `server.js`
- `README.md`
- `start.command`
- `check-requirements.command`

## Notes

- This app does not need `npm install`
- It uses Node.js built-in modules only
- Story data, art styles, and app settings are stored locally in this folder
- Version backups are stored as per-update folders inside `versions/`
- Backup folder names can include `_newCodes` and an optional short label
