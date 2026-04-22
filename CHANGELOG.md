# Changelog

Created: 2026-04-21 America/Denver  
Created by lgtaegi
Updated:
- added an unreleased section to track the current post-1.0.0 app changes

## Unreleased

- no entries yet

## v1.1.0

- added fixed `Art Style` slots for `2D Animation`, `Live-Action`, and `Custom`
- added saved art style titles and reload support
- added save-name prefix settings with persistent storage
- added story revert support for the current session
- added automatic story save folders and local settings storage
- added a separate `upload-stories/` store with `Send to Upload` and `Load Upload`
- added advanced Ollama model tools inside the app
- added installed model manager with update and removal support
- added recommendation loading from `recommended-models.json`
- added custom model tag install support
- added loading-state feedback on recommendation install buttons
- added large-model warnings for slower Mac setups
- added reference-script controls with `0–100` strength and `Always keep my settings first`
- made `100%` reference strength the only near-original replay mode
- shortened Ollama keep-alive time so models release memory faster after generation
- improved idea generation so object-based hooks can branch into more surprising event directions
- allowed absurd or unrealistic object use in short hook ideas
- made empty object selection choose a truly random item first, then let mood shape the idea around it
- removed hardcoded fallback defaults for story idea, character, set, art style, and reference behavior
- tightened automatic save-name extraction to prefer object keyword, then idea, then storyboard text
- added YouTube cross-checking and retry logic for save-name object matching
- refreshed local backup and release workflow files
- removed the temporary separate storyboard-page tab from the UI

## v1.0.0

- initial official release structure
- local storyboard app with scene-based story generation
- art style slots and saved art styles
- YouTube upload content generation
- local install guide and environment checks
- version backup system and release packaging flow
