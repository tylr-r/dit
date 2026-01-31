# Dit App Behavior

This document captures the intended, shared behavior across web and iOS.

## Core input

- Tap the big morse button for dit, hold longer (dit threshold) for dah.
- In practice and freestyle modes, input is built from dit/dah sequences.
- A short pause submits the current freestyle sequence.

## Modes

### Practice

- A target character is shown with its Morse pattern.
- Input must match the target exactly.
- Correct: score +1, brief success state, next target (or next word letter).
- Incorrect: score -1, error state, input clears, same target stays.
- Optional hints and mnemonics which are activated in the settings panel.
- Word mode shows a full word, highlights progress, and computes WPM on completion.
- Character algorithm prioritizes less proficient characters ahead of well-known ones.

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
- Listen speed (WPM) formula: Tdit(ms) = 1200 / WPM
- Reference chart modal
- Sound check
- Cloud sync (sign in/out)

## Feedback

- Visual: success/error states on the main display.
- Audio: tone on press; playback for listen mode.
- Haptics: dit, dah, and success feedback.

## Scoring

- Scores track per-letter performance.
- Correct answers increment; incorrect answers decrement.
- Scores influence weighted letter selection.

## Sync

- Progress (scores, settings, listen speed, modes) syncs to Firebase when signed in, and queues locally while offline.
- Local state remains usable when signed out and is persisted on-device.

## Reference

- Reference modal shows letters, numbers, and their Morse patterns.
- Scores tint each card to highlight strengths and weaknesses.
