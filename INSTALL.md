# AI Story Builder Install Guide

Created: 2026-04-21 America/Denver  
Created by lgtaegi
Updated:
- refreshed setup steps to match the current app
- documented reference-script tools, upload-story storage, and current save-name behavior
- documented advanced model tools, recommendation loading, and custom model install
- added notes about large-model warnings and memory behavior on smaller Macs
- clarified local backup and local release helper files

## Requirements

- macOS
- Node.js 20 or newer
- Ollama
- At least one Ollama model
- Recommended default model: `llama3.2:latest`

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

6. Double-click:

```text
start.command
```

7. Open:

```text
http://127.0.0.1:5055
```

## Included Helper Files

- `start.command`  
  Starts the app and opens the browser

- `check-requirements.command`  
  Checks whether Node.js, Ollama, and the default model are ready

- `create-version-backup.command`  
  Creates a local backup folder containing essential runnable app files plus the updated files for that change

- `create-release.command`  
  Creates a local packaged release folder using the current `VERSION`

## AI Model Setup Notes

- The main `AI model` selector uses installed Ollama models
- Uninstalled models stay gray in the main list
- `Show advanced model tools` opens:
  - installed model manager
  - recommendations from `recommended-models.json`
  - custom model tag install
- Very large models can show warning messages
- On a 16GB Mac, `llama3.3` may be too slow for practical storyboard work

## Reference And Story Controls

- `Show reference script` opens:
  - reference script input
  - `Reference strength` slider from `0` to `100`
  - `Always keep my settings first`
- `Revert Story` restores the previous in-session story snapshot
- `Send to Upload` stores a second copy in `upload-stories/`
- `Load Upload` brings an upload-ready copy back into the main editor
- if `Object keyword` is empty, the app chooses a truly random object first and lets the selected mood shape the idea around it
- automatic `Save name` generation now prefers:
  1. object keyword
  2. story idea
  3. storyboard text
  and then checks the result against YouTube upload content

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

You can also install models from inside the app using advanced model tools.

## Optional: Use Another Default Model

Run the app from Terminal like this:

```bash
cd /path/to/00_storyboard
OLLAMA_MODEL=qwen3:latest ./start.command
```

## Memory Notes

- Ollama may keep a model loaded in memory for a short time after generation
- The app server now asks Ollama to release models faster with a shorter keep-alive setting
- If your Mac still feels heavy after testing a very large model, smaller models are the better default

## Main Project Files

- `index.html`
- `server.js`
- `recommended-models.json`
- `README.md`
- `INSTALL.md`
- `start.command`
- `check-requirements.command`

## Notes

- This app does not need `npm install`
- It uses Node.js built-in modules only
- Story data, upload-ready story copies, art styles, and app settings are stored locally in this folder
- Version backups are stored as per-update folders inside `versions/`
- Local release packages are stored inside `releases/`
