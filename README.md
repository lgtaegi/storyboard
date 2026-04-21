# AI Story Builder

Created: 2026-04-21 America/Denver  
Created by lgtaegi

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

## Run Locally

1. Open `start.command`
2. Wait for the local server to start
3. Open `http://127.0.0.1:5055`

## Notes

- The app is designed for local use with Ollama-compatible models
- Story output is optimized for short-form video workflows
- Version snapshots can be stored in `versions/` together with update notes
