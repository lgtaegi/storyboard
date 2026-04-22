# AI Story Builder

Created: 2026-04-21 America/Denver  
Created by lgtaegi
Updated:
- refreshed the guide to match the current single-page app UI
- documented reference-script controls, upload-story storage, and current save-name rules
- documented advanced model tools, random object idea generation, and large-model warnings
- removed the temporary separate storyboard-page description
- clarified local backup, release, and local-only guide behavior

## Description

A local AI storyboard builder for fast short-form video ideas, scene-based story generation, art style control, model switching, upload-ready story storage, and YouTube-ready copy.

## What The App Does

- Generates short object-driven story ideas for AI video workflows
- Builds numbered storyboard scenes with timing and visual scene prompts
- Lets one clear object drive the whole story for future product-link use
- Supports character, object keyword, set, art style, genre, mood, scene count, and duration controls
- Saves and reloads stories, art styles, and app settings
- Keeps a separate `Upload Storys` list for stories you want to prepare for publishing
- Generates YouTube upload content and lets you copy it together with storyboard text
- Converts storyboard language between English and Korean
- Lets you revert to the previous story state inside the current session

## Main UI Sections

- `Character`
  - main protagonist prompt
  - object keyword input
  - set input

- `Art Style`
  - fixed slots for `2D Animation`, `Live-Action`, and `Custom`
  - saved art style list
  - title + content save and reload support

- `Reference script`
  - hidden by default behind `Show reference script`
  - includes a `0–100%` reference strength slider
  - includes `Always keep my settings first`
  - at `100%`, the app tries to replay the reference structure as literally as possible

- `AI model`
  - main model selector for currently installed models
  - uninstalled models stay gray in the main list
  - large models can show warnings when they are likely too slow on smaller Macs

- `Advanced model tools`
  - installed model manager for update or removal
  - recommendation list loaded from `recommended-models.json`
  - refresh recommendations button
  - custom model tag install field

## Story And Idea Behavior

- `Generate Idea`
  - creates one short hook sentence
  - keeps one clear object at the center
  - if `Object keyword` is empty, the object is chosen first as a truly random item
  - the selected mood then shapes how that random object behaves in the story
  - allows absurd, impossible, or childlike object use for stronger visual hooks

- `Create AI Story`
  - expands the idea into scene-numbered storyboard text
  - preserves set, art style, character identity, and core object
  - keeps the pacing tuned for fast short-form videos
  - can borrow shot structure and camera language from a reference script

- `Save name`
  - uses this priority:
    1. `Object keyword`
    2. generated `Story idea`
    3. generated storyboard text
  - then checks whether the title object still matches the YouTube upload content
  - if needed, it retries matching before choosing the strongest story object it can find

- `Convert Script`
  - switches between English and Korean modes
  - keeps labels like `Title:` and `Scene 1 - 0s:` in place

- `Revert Story`
  - restores the previous story snapshot from the current browser session

- `Upload Storys`
  - `Send to Upload` saves a second copy into the upload queue
  - `Load Upload` lets you bring that copy back into the main editor

## AI Model Notes

- The app uses local Ollama models
- Installed models are read from Ollama dynamically
- Recommendations are read from `recommended-models.json`
- New model names can be installed with `Custom model tag`
- Very large models such as `llama3.3` may be too slow on 16GB Macs
- The server now uses a shorter Ollama keep-alive time so models release memory faster after generation

## Main Files

- `index.html`: browser UI
- `server.js`: local Node server and API routes
- `recommended-models.json`: recommendation list used by advanced model tools
- `start.command`: starts the local app
- `check-requirements.command`: checks Node, Ollama, and default model readiness

## Data Folders

- `data/`: saved stories
- `upload-stories/`: stories marked for later upload workflow
- `auto-generated/`: automatically saved story outputs
- `art-styles/`: saved art style presets and fixed slots
- `app-settings/`: persistent app settings such as save-name prefix
- `versions/`: local per-update backups
- `releases/`: local packaged release folders

## Run Locally

1. Open the Ollama app
2. Run `check-requirements.command`
3. Run `start.command`
4. Open `http://127.0.0.1:5055`

## Install Summary

- Read `INSTALL.md`
- Read `STORYBOARD-USER-GUIDE.md` for the full step-by-step usage guide
- Read `STORYBOARD-USER-GUIDE.ko.md` for the Korean user guide
- Default model: `llama3.2:latest`
- No `npm install` required
- The app uses Node.js built-in modules only

## Version Backups

- Run `create-version-backup.command` with the files changed in that update
- Each backup folder includes the essential runnable app files
- The specific updated files for that change are also copied in
- `notes.md` is created inside the same version folder

Folder name rules:

- `..._readme` for `README.md` only updates
- `..._docs` for document-only updates
- `..._codeUpdated` when any code file changed

Example:

```bash
./create-version-backup.command --label idea-variety server.js
```

## GitHub Scope

- GitHub stores the app source and core setup files
- `versions/` stays local
- `releases/` stays local
- `RELEASE-GUIDE.local.md` stays local

## Notes

- The app is designed for local use on macOS with Ollama
- Smaller models are more practical for interactive idea generation
- Recommendation data can be updated without changing the main UI code
- `llama3.3`-class large models are usually not practical on 16GB Macs for interactive story work
