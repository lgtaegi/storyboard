# AI Story Builder

Created: 2026-04-21 America/Denver  
Created by lgtaegi
Updated:
- added INSTALL.md and check-requirements.command for easier setup
- clarified that the app runs with Node.js built-in modules and Ollama
- changed version backups to use one folder per update with only updated code files
- changed version backups to include essential runnable app files plus updated files
- simplified backup folder names because each backup is now a runnable app bundle
- clarified which files stay local and do not go to GitHub

## Description

An AI storyboard tool for creating fast-paced short video stories with object-driven ideas, art style control, and YouTube-ready copy.

## What It Does

- Generates short-form story ideas built around one clear object or product hook
- Expands ideas into scene-numbered storyboard text
- Supports custom character, set, genre, mood, timing, and model settings
- Lets you switch between saved art styles and fixed art style slots
- Generates YouTube upload titles, descriptions, and tags
- Saves and reloads stories, art styles, and app settings

## Main Files

- `index.html`: browser UI for building and saving stories
- `server.js`: local Node server and API routes
- `start.command`: launches the local app

## Data Folders

- `data/`: saved stories
- `auto-generated/`: automatically saved story outputs
- `art-styles/`: saved art style presets and fixed style slots
- `app-settings/`: persistent app settings such as save name prefix
- `versions/`: manual backup snapshots and version notes
  - each update can have its own subfolder
  - each backup folder contains essential runnable app files plus the files updated in that change
  - each backup folder also contains `notes.md`

## GitHub Scope

- GitHub is for the app source and core setup files
- local backup folders such as `versions/` do not go to GitHub
- local packaged release folders such as `releases/` do not go to GitHub
- local-only guide files such as `RELEASE-GUIDE.local.md` stay on this computer only

## Run Locally

1. Open `start.command`
2. Wait for the local server to start
3. Open `http://127.0.0.1:5055`

## Easy Setup

- Read `INSTALL.md`
- Run `check-requirements.command`
- Run `start.command`

## Version Backups

- Run `create-version-backup.command` with the updated code files
- A new folder is created inside `versions/`
- Essential runnable app files are always copied into that folder
- The updated files for that change are copied into that folder too
- `README.md` only updates use `_readme`
- document-only updates use `_docs`
- any code file update uses `_codeUpdated`
- A `notes.md` file is created in the same folder

Example:

```bash
./create-version-backup.command --label save-prefix index.html server.js
```

## Notes

- The app is designed for local use with Ollama-compatible models
- Story output is optimized for short-form video workflows
- Version snapshots can be stored in `versions/` together with update notes
