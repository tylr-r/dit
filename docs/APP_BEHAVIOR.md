# Dit App Behavior

This document captures the intended, shared behavior across web and iOS. iOS carries more features than web; platform-specific behavior is called out inline.

## Core input

- Tap the big Morse button for dit, hold longer (dit threshold) for dah.
- Practice and Freestyle build input from dit/dah sequences.
- A short pause submits the current Freestyle sequence or commits the current Practice attempt.

## Modes

### NUX (New User Experience)

- On first launch, a welcome screen shows the Dit logo and "Welcome to Dit" before advancing to onboarding. This screen must be preserved. It is the app's first impression and brand moment.
- The app asks whether the user is new to Morse or already knows it. The answer is stored as `learnerProfile` and changes what the Reference modal emphasizes later (mastered count vs. best WPM).
- Both paths begin with a sound check and a short input tutorial that explicitly teaches the big Morse key.
- The button tutorial requires one short tap (dit) and one long press (dah) before continuing.
- iOS also asks the user to set a daily practice reminder during NUX. The user can skip this and turn it on later in Settings.
- Known users see a short app tour and then enter the normal app flow.
- Beginner users enter the guided course, which introduces letters in small packs and advances automatically.
- NUX status (`pending`, `completed`, `skipped`) is persisted so it only runs once unless replayed from Settings.

### Practice

- A target character is shown with its Morse pattern.
- Input must match the target exactly.
- Correct: score +1, brief success state, next target (or next letter in the current word).
- Incorrect: score -1 and input clears. With IFR mode on, the app advances immediately and queues misses for delayed review. With IFR mode off, the same target stays.
- The **Play** button replays the current target's Morse tone so the user can hear before answering.
- **Auto-play sound** (on by default) plays the target tone automatically when it appears.
- **Sequential order** (the "learn mode" toggle, on by default) makes Practice serve letters from the start of the active set rather than weighted-random. Turning it off switches to the weighted algorithm below.
- With sequential order off, character selection prioritizes less proficient characters ahead of well-known ones.
- Hints and mnemonics can be toggled in Settings. Requesting a hint (including the one-time "Show this hint" button on web) disables scoring for that attempt.
- **Word mode** (Practice Words) shows a full word, highlights progress letter by letter, and computes WPM on completion.
- During the guided beginner course, Practice runs in fixed lesson phases:
  - Teach: repeat the new letters until each is answered correctly enough times.
  - Practice: mix the current pack with already unlocked letters.
  - On misses, the app keeps the same target, replays feedback, and does not silently advance.
- A phase modal appears when the course advances from one phase or pack to the next.
- If the user switches modes while a guided course is active, a "Return to lesson" button appears so they can jump back in without losing their place.

### Freestyle

- Tap a sequence and pause to submit.
- Result shows the decoded letter or "No match".
- Word mode appends decoded letters into a running word and auto-inserts spaces after word gaps.
- Clear and Backspace remove the current input (web also binds `N` to clear and `Backspace` to delete).

### Listen

- The app plays a Morse letter at the selected WPM.
- The user answers with keyboard input (on-screen or physical).
- Correct: score +1, next playback.
- Incorrect: score -1, reveal the correct letter, then move on.
- Replay plays the current letter again (web binds this to the spacebar).
- iOS displays a sine wave visualization of the playback and a time-to-respond indicator.

## Settings

Toggles and controls available across both platforms unless noted.

- Show hints
- Show mnemonics
- Max level (letter set size, 1 through 4)
- Word mode (Freestyle)
- Practice Words (Practice word mode)
- Auto-play sound (Practice, iOS)
- Sequential order (Practice, iOS)
- IFR mode, aka Immediate flow recovery
- Review misses later
- Listen speed (WPM). Dit length in ms = 1200 / WPM.
- Tone frequency
- Sound check
- Reference chart modal
- Daily reminder (iOS): picks a local notification time using the native date picker. Requires notification permission, which the app requests on first enable.
- Use recommended settings (iOS): resets the Practice toggles to the defaults chosen for the current `learnerProfile`.
- Replay NUX (iOS): runs the onboarding flow again.
- Cloud sync:
  - Web: Google sign-in (popup).
  - iOS: Sign in with Apple and Sign in with Google. Also exposes **Delete account**, which removes the Firebase user and their synced progress.

Availability rules:

- Playback speed, tone frequency, and account/reference actions are global.
- Max level applies to Practice and Listen.
- Freestyle word mode is Freestyle-only.
- Practice-only options can be adjusted from other modes but stay grouped separately from the current mode's settings.

## Keyboard shortcuts (web)

- `F`: Freestyle
- `I`: Listen
- `L`: Practice
- `H`: toggle Show hints (Practice only)
- `W`: toggle Word mode (Freestyle only)
- `N`: show this hint once (Practice) / clear input (Freestyle)
- `Backspace`: delete last symbol (Freestyle)
- `Space`: replay current letter (Listen)
- `Esc`: close the reference modal
- Any letter or digit key while in Listen submits that character as the answer.

## Feedback

- Visual: success/error states on the main display, plus the pip row that fills in as input matches the target.
- Audio: tone on press, and playback in Listen and for the Practice Play button.
- Haptics (iOS): dit, dah, and success feedback.
- Background animation pauses when the device is in Low Power Mode or the user has been idle, so the app doesn't cook the battery while sitting on a desk.

## Scoring and progression

- Scores track per-letter performance. Correct answers increment; incorrect answers decrement.
- Scores feed both the weighted letter selection (when sequential order is off) and the per-card tint in the Reference modal.
- iOS additionally tracks:
  - `letterAccuracy`: per-letter rolling correctness used to determine mastery.
  - `bestWpm`: the fastest Practice-word completion the user has recorded.
  - `dailyActivity`: how many correct answers the user got on each day, and which modes they used.
  - `streak`: consecutive days the user has hit the daily goal of 15 correct answers. The day counts toward the streak the moment they reach 15 that day. If they hit the goal two days in a row, `current` goes up by one; skip a day and it resets to 1 the next time they hit 15. `longest` remembers the best run ever. A streak is "at risk" if the user has an active streak but hasn't yet hit today's goal.
  - `hero`: a headline metric shown in the Reference modal. Beginners see mastered letters out of the total; known users see their best WPM.

## Sync

- Progress (scores, settings, listen speed, mode, streak, daily activity, best WPM, learner profile, letter accuracy, reminder) syncs to Firebase when signed in.
- Local state remains usable when signed out.

## Reference

- The Reference modal shows letters, numbers, and their Morse patterns.
- Scores tint each card to highlight strengths and weaknesses.
- iOS also shows the hero metric, current streak, today's correct count, and, when the guided course is active, the current pack, phase, and pack letters. Tapping a card plays that character at the reference WPM.

## Reminders and widget (iOS)

- A single daily local notification, scheduled for the time set in Settings or NUX. The app reschedules it whenever progress changes and when the app returns to the foreground, so the "next fire" always reflects current state.
- The DitProgress home-screen widget publishes streak, daily activity, and hero metric from the same progress snapshot that drives the Reference modal, so the widget and in-app view stay consistent.
