# AI Story Builder User Guide

Created: 2026-04-22 America/Denver  
Created by lgtaegi

## Overview

This guide explains how to use the storyboard tool from idea generation to save, upload preparation, and model management.

The app is designed for:
- short-form AI video ideas
- storyboard scene generation
- reference-based structure borrowing
- YouTube upload copy generation
- local save and upload-queue workflows

## Start The App

1. Open the Ollama app
2. Run `check-requirements.command`
3. Run `start.command`
4. Open [http://127.0.0.1:5055](http://127.0.0.1:5055)

## Main Workflow

The simplest workflow is:

1. Choose or type a `Character`
2. Optionally type an `Object keyword`
3. Optionally type a `Set`
4. Set `Genre` and `Mood`
5. Click `Generate Idea`
6. Click `Create AI Story`
7. Click `Generate YouTube Upload Content`
8. Check `Save name`
9. Click `Save Story` or `Send to Upload`

## What Each Main Field Does

### Character

Use this for the main protagonist or subject.

Examples:
- `Among Us Pink`
- `Among Us Yellow`
- `A nervous astronaut`

If this is empty, the model may invent a protagonist on its own.

### Object keyword

If you type an object here, that object becomes the highest-priority object for the story and for title generation.

Examples:
- `face mask`
- `rubber chicken toy`
- `soap dish`

If this field is empty:
- the app chooses a truly random object first
- then the selected `Mood` shapes the story around that object

### Set

Use this for the main place or environment.

Examples:
- `spaceship bathroom`
- `old supermarket aisle`
- `foggy playground at night`

If it is empty, the app creates a location from the story idea or generated story.

### Art Style

This controls the visual direction.

You can use:
- `2D Animation`
- `Live-Action`
- `Custom`
- `Saved Art Style`

You can also save and reload art styles for reuse.

## Generate Idea

`Generate Idea` creates one short hook sentence.

Current behavior:
- one object stays at the center of the idea
- if `Object keyword` is empty, the object is chosen first as a truly random item
- `Mood` shapes the tone of the event
- the object may be used in absurd or impossible ways on purpose

## Create AI Story

`Create AI Story` expands the current setup into timed storyboard scenes.

The story generator tries to preserve:
- the selected character
- the selected object
- the selected set
- the selected art style
- the chosen genre and mood

If some of those fields are empty, the app fills the missing parts from the story logic.

## Reference Script

Open this section with `Show reference script`.

It contains:
- `Reference script`
- `Reference strength`
- `Always keep my settings first`

### Reference strength

- `0`: reference off
- `1–30`: light inspiration
- `31–60`: balanced borrowing
- `61–85`: strong borrowing
- `86–99`: very strong borrowing
- `100`: near-original replay behavior

### Always keep my settings first

When this is on:
- your character stays first
- your object stays first
- your set stays first
- your art style stays first

When this is off:
- the reference can take over more strongly

## Generate YouTube Upload Content

This creates:
- a YouTube title
- a description
- keyword/tag sections

The app also uses this content to help verify the main object used in the generated story title.

## Save Name Rules

The save-name logic currently works like this:

1. If `Object keyword` exists, it is used first
2. Otherwise, the app estimates the first trigger object from the storyboard and related text
3. Then it checks whether that object matches the YouTube upload content
4. If the object and YouTube content point to the same object, that matched name is preferred
5. If no clear object can be confirmed, save is blocked until the object becomes clearer

The goal is:
- not the funniest phrase
- not the whole sentence
- just the clearest important object name

Examples:
- `Soap Dish`
- `Toy Dinosaur`
- `Face Mask`
- `Traffic Cone`

## Save Story vs Send To Upload

### Save Story

Stores the current project in:
- `data/`

Use this for normal story storage.

### Send to Upload

Stores a second copy in:
- `upload-stories/`

Use this when the story is moving toward publishing or upload preparation.

The app also has:
- `Saved Storys`
- `Upload Storys`

These are separate lists on purpose.

## Revert Story

`Revert Story` restores the previous in-session story state.

## AI Model Controls

### Main AI model selector

Shows installed models for actual generation.

### Show advanced model tools

This section includes:
- installed model manager
- recommendation list
- custom model install field

### Installed model manager

Use this to:
- update installed models
- remove installed models

### Recommended newer models

This list is loaded from:
- `recommended-models.json`

### Custom model tag

Use this to install a model by name manually.

Examples:
- `qwen3:latest`
- `gemma3:latest`
- `deepseek-r1:latest`

## Large Model Warnings

Some models may be too heavy for smaller Macs.

Example:
- `llama3.3` is often too slow on a 16GB Mac for smooth interactive use

## Language Conversion

`Convert Script` switches between English and Korean.

Use it after a storyboard already exists.

## Practical Recommended Workflows

### Fast random idea workflow

1. Leave `Object keyword` empty
2. Choose a `Mood`
3. Click `Generate Idea`
4. Click `Create AI Story`

### Controlled product workflow

1. Enter `Object keyword`
2. Enter `Character`
3. Enter `Set`
4. Click `Generate Idea`
5. Click `Create AI Story`

### Reference-driven workflow

1. Paste a reference script
2. Set `Reference strength`
3. Decide whether to turn on `Always keep my settings first`
4. Generate the story

## If Something Looks Wrong

### Save name is wrong

Try this order:
- make sure `Object keyword` is correct
- regenerate YouTube upload content
- regenerate the idea
- regenerate the storyboard

### The model is too slow

Use a smaller model in the main model selector.

### Reference 100% feels too literal

Lower the reference strength to:
- `60`
- `75`
- `85`

## Main Local Folders

- `data/` — normal saved stories
- `upload-stories/` — upload-ready story copies
- `auto-generated/` — automatically saved outputs
- `art-styles/` — saved art style presets
- `app-settings/` — local UI/app settings
- `versions/` — local backup folders

## Final Notes

- The app is local-first
- smaller models are better for fast iteration
- reference scripts are strongest at `100`
- absurd object behavior is allowed on purpose
- the best workflow is usually: idea -> story -> YouTube -> save -> upload queue
