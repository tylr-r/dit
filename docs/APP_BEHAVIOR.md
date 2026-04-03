# Dit App Behavior

This document captures the intended, shared behavior across web and iOS.

## Core input

- Tap the big morse button for dit, hold longer (dit threshold) for dah.
- In practice and freestyle modes, input is built from dit/dah sequences.
- A short pause submits the current freestyle sequence.

## Modes

### NUX (New User Experience)

- On first launch, the app asks whether the user is new to Morse or already knows it.
- Both paths begin with a sound check and a short input tutorial that explicitly teaches the big Morse key.
- The button tutorial requires one short tap (dit) and one long press (dah) before continuing.
- Known users see a short app tour, then enter the normal app flow.
- Beginner users enter a guided course that introduces letters in small packs and advances automatically.
- NUX status (`pending`, `completed`, `skipped`) is persisted so it only runs once unless replayed from settings.

### Practice

- A target character is shown with its Morse pattern.
- Input must match the target exactly.
- Correct: score +1, brief success state, next target (or next word letter).
- Incorrect: score -1 and input clears. With IFR mode on, the app advances immediately and queues misses for delayed review; with IFR mode off, the same target stays.
- Optional hints and mnemonics which are activated in the settings panel.
- Word mode shows a full word, highlights progress, and computes WPM on completion.
- Character algorithm prioritizes less proficient characters ahead of well-known ones.
- During the guided beginner course, Practice runs in fixed lesson phases:
  - Teach: repeat the new letters until each is answered correctly enough times.
  - Practice: mix the current pack with already unlocked letters.
  - On misses, the app keeps the same target, replays feedback, and does not silently advance.

### Freestyle

- Tap a sequence and pause to submit.
- Result shows the decoded letter or "No match".
- Word mode appends decoded letters into a running word and auto-inserts spaces after word gaps.

### Listen

- App plays a Morse letter at the selected WPM.
- User answers with keyboard input (on-screen or physical).
- Correct: score +1, next playback.
- Incorrect: score -1, reveal correct letter, then move on.
- Replay plays the current letter again.

## Settings

- Show hints
- Show mnemonics
- Max level (letter set size)
- Words (practice word mode)
- IFR mode (immediate flow recovery)
- Review misses later
- Listen speed (WPM) formula: Tdit(ms) = 1200 / WPM
- Reference chart modal
- Sound check
- Cloud sync (sign in/out)
- Availability by mode:
  - Playback speed and account/reference actions are global.
  - Max level applies to Practice and Listen.
  - Freestyle word mode is freestyle-only.
  - Practice-only options can be adjusted from other modes, but should stay grouped separately from the current mode's settings.

## Feedback

- Visual: success/error states on the main display.
- Audio: tone on press; playback for listen mode.
- Haptics: dit, dah, and success feedback.

## Scoring

- Scores track per-letter performance.
- Correct answers increment; incorrect answers decrement.
- Scores influence weighted letter selection.

## Sync

- Progress (scores, settings, listen speed, modes) syncs to Firebase when signed in.
- Local state remains usable when signed out.

## Reference

- Reference modal shows letters, numbers, and their Morse patterns.
- Scores tint each card to highlight strengths and weaknesses.
