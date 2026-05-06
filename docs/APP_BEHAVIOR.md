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
- Known users see the daily reminder screen, then a short app tour, then enter
  the normal app flow.
- Beginner users enter the guided course, which introduces letters in small packs and advances automatically.
- NUX status (`pending`, `completed`, `skipped`) is persisted so it only runs once unless replayed from Settings.

#### Sign-in entry points (iOS)

Two surfaces open the same sign-in bottom sheet:

- **NUX welcome** — see the next subsection.
- **Settings** — when signed out, the Account group shows a single **Sign in** row (the Apple / Google provider list was collapsed into the shared sheet). Tapping it closes the Settings modal first, then opens the shared sign-in sheet from the app root. The two surfaces never stack. On successful sign-in the sheet dismisses and Settings reopens so the user sees the signed-in state (email, Sign Out, Delete Account). On cancel the user returns to the main screen without Settings reopening.

The shared sheet implementation lives at `apps/ios/src/components/SignInSheet.tsx`. `NuxModal.tsx` renders its own instance for the welcome-screen entry point; the Settings instance is rendered at the `App.tsx` root so it survives `SettingsModal` unmounting when Settings closes.

#### Welcome-screen sign-in (iOS)

- The welcome screen does not auto-advance. Signed-out users see two options fade in ~2 seconds after paint: **Sign in** (primary) and **Stay signed out** (secondary).
- **Sign in** opens a bottom sheet with three provider rows: **Continue with Apple**, **Continue with Google**, and **Continue with Email**. Each row renders its provider logo (Apple's SF Symbol `applelogo`, the Google "G", and a mail icon) plus a Cancel row. On successful sign-in, remote progress loads via `useFirebaseProgressSync`. If the loaded snapshot has `nuxCompleted === true` or any meaningful progress (learner profile, guided course active, or non-zero scores), NUX is marked `'skipped'` and the user lands in the main app with their progress restored. Otherwise NUX continues at profile selection.
- **Continue with Email** swaps the sheet content in-place to an email form: email field, password field, primary "Sign in", secondary "Create account", and a back chevron to the provider picker. Errors render inline above the primary button (see below). Form state resets whenever the sheet dismisses. No password-reset or email-verification flow in v1.
  - **Sign in** calls `signInWithEmailAndPassword`; bad-credential errors (`auth/invalid-credential`, `auth/user-not-found`, `auth/wrong-password`) all show the same message, `"Email or password is incorrect."` — Firebase v11+ collapses these codes for enumeration resistance and we mirror that.
  - **Create account** calls `createUserWithEmailAndPassword`; it creates the user and signs them in immediately. No confirm-password field.
- **Stay signed out** advances to the next NUX step (profile selection), identical to the prior tap-anywhere behavior.
- Cancel or error on the sign-in sheet returns to the welcome screen with both options still visible.
- When a user is already signed in (e.g., replaying NUX from Settings), the two options are not rendered; the welcome screen keeps its single tap-anywhere advance so replay does not prompt for re-auth.

#### Learning sheet (iOS)

Settings exposes a single **Learning ›** disclosure row above the Account
group. Tapping it dismisses Settings and opens the Learning sheet from the
app root, which unifies what used to be two competing controls (the
Guided Learning group and the Max Difficulty stepper).

Inside the sheet:

- A segmented control switches between **Course** and **Open practice**.
  Bound to `guidedCourseActive`. Switching is instant; pack/phase/progress
  state on one side and `maxLevel`/`customLetters` on the other are
  preserved, so toggling back and forth never loses position.
- **Course** mode lists all 14 beginner packs as a scrollable list. The
  current pack is highlighted; packs whose index is below
  `guidedMaxPackReached` render with a checkmark. Selecting a pack
  ensures `guidedCourseActive` is `true` and runs `moveIntoGuidedLesson`
  with a fresh `teach` phase. The sheet dismisses.
- **Open practice** mode lists four named tier presets, mapped 1:1 to
  the underlying frequency-tier `maxLevel` values, plus a fifth
  "Pick your own" row for fine-grained control:
    - Beginner letters (level 1): A E I M N T
    - Common letters (level 2): adds D G K O R S U W
    - Full alphabet (level 3): adds B C F H J L P Q V X Y Z
    - Full alphabet + digits (level 4): adds 0 1 2 3 4 5 6 7 8 9
    - Pick your own ›: opens a grid for character-level selection.

  Selecting a tier flips `guidedCourseActive` to `false`, clears any
  prior custom selection, and sets `maxLevel` directly to the tier's
  level. The sheet dismisses.

  **Pick your own** swaps the sheet content in-place to a grid of all 36
  characters (A-Z plus 0-9). Each character is a tappable chip; the
  count of selected characters is shown in the subtitle. The Apply
  button persists the selection to a new `customLetters` field on
  `Progress` / `ProgressSnapshot`, sets `guidedCourseActive` to `false`,
  and dismisses the sheet. While `customLetters` is non-empty and
  guided mode is off, `activeLetters` resolves to that custom set
  instead of the level-derived set.

The course ends with two digit packs split at the rhythmic mid-point:
Pack 13 (1 2 3 4 5, dots-then-dashes) and Pack 14 (6 7 8 9 0,
dashes-then-dots). The course-complete celebration fires after Pack 14.

The "passed" state is tracked by `guidedMaxPackReached` — a single
non-decreasing number persisted alongside `guidedPackIndex` in RTDB. It
bumps whenever the course unlocks the next pack via
`unlockNextGuidedPack` or the user selects a higher pack from the
Learning sheet, and never decreases when the user selects an earlier
pack. `Pack N` is shown as completed when its index is strictly less
than `guidedMaxPackReached`.

When the user leaves Course mode (via the segmented control or by
selecting a free-practice tier directly), the existing
`handleSetGuidedCourseActive(false)` semantics fire: `maxLevel` snaps
back up to at least `DEFAULT_MAX_LEVEL` if the course had narrowed it,
so the user is never stranded with only their current pack's letters in
free practice.

Settings closes before the picker opens so the two sheets never stack.
The picker is rendered at the app root so it survives Settings unmounting.

#### `nuxCompleted` flag

- Stored at `users/{uid}/progress/nuxCompleted: boolean` in Firebase RTDB, inside the existing progress object.
- Written via the normal progress save path whenever a signed-in user's local NUX status is `'completed'` or `'skipped'`. The value is derived from the onboarding state in `useMorseSessionController`'s progress snapshot.
- Read on sign-in inside `applyParsedProgress`: if `true` (or the `hasMeaningfulRemoteProgress` heuristic passes), NUX is marked skipped locally via `persistNuxStatus('skipped')`.
- Accounts created before this flag existed fall back to the heuristic, so no returning user is forced back through NUX unexpectedly.

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
- Both platforms display a live sine wave that pulses with the keyed tone; resolved letters and the running word overlay the wave instead of showing raw dits/dashes.
- The Clear button resets the in-progress input. Web also binds `N` to clear.

### Listen

- The app plays a Morse letter at the selected WPM.
- The user answers with keyboard input (on-screen or physical). On web, the on-screen keyboard renders only on coarse-pointer (touch) devices; with a physical keyboard attached the Play button and shortcut hint stand alone.
- Correct: score +1, next playback.
- Incorrect: score -1, reveal the correct letter, then move on.
- Replay plays the current letter again (web binds this to the spacebar).
- Both platforms display a sine wave visualization of the playback. iOS adds a time-to-respond indicator.

#### Custom text (web)

A sub-mode of Listen that plays a user-entered passage as Morse for head-copy practice. iOS adoption deferred.

- Listen idle shows a small **Use custom** chip below the Play button. Tapping it opens a bottom sheet.
- The sheet contains a textarea, a `chars / 2000` counter, an **Ignored** count for stripped characters, an estimated playback duration, a **Type along** toggle (default on), and **Discard** / **Save** actions.
- Pasted text is normalized on input: A-Z and 0-9 are preserved (lowercase letters uppercase), whitespace runs collapse to single spaces, and any other character is stripped and counted in **Ignored**. Hard cap of 2000 characters; longer paste is trimmed.
- Saving a non-empty passage enters custom mode. Saving an empty textarea exits custom mode and returns to normal Listen. **Discard** abandons in-flight edits; previously-saved text remains loaded if any.
- Last-used text and workflow choice persist in `localStorage` (keys `dit-listen-custom-text-v1`, `dit-listen-custom-typealong-v1`, `dit-listen-custom-active-v1`). Pasted text is never synced to Firebase.
- On reload the surface re-enters the Setup phase the next time the user lands on Listen, with the saved text and workflow.

**Phases.** When custom text is loaded, the Listen surface holds in one of these phases:

- **Setup** — source text is hidden behind a `chars · words ready` indicator. Type-along input (when on) is rendered but disabled. **Play** arms the audio; **Edit text** reopens the sheet; **Clear** drops custom mode.
- **Playing** — the full passage plays as a continuous Morse stream at the user's `listenWpm` and `listenEffectiveWpm` (Farnsworth gaps between letters and words). The sine wave renders in the same StageDisplay slot regular Listen uses; the wave, progress bar, and audio share `AudioContext.currentTime` as their clock so they stay in sync across pause/resume. A progress bar shows elapsed / total time. Type-along (when on) accepts input live — on coarse-pointer (touch) devices it renders the same on-screen keyboard regular Listen uses (plus Space and Backspace) and suppresses the system keyboard via `readOnly` + `inputMode="none"`; on fine-pointer devices it accepts physical-keyboard input directly. Actions: **Pause** (primary) · **Restart** (start over from the beginning) · **End** (stop early and go to Reveal).
- **Paused** — audio frozen via `AudioContext.suspend()`. Wave and progress bar freeze in place. Type-along is disabled. Actions: **Resume** (primary) · **Restart** · **End**.
- **Reveal** — audio has finished or the user tapped End. Source text is shown. If type-along was on, an LCS-aligned char-level diff sits below it (`ok` matches in green, `miss` source chars red and underlined, `extra` typed chars red on a tinted background, `gap` `·` glyphs for trailing chars the user didn't type). A `matched / total · missed · extra` tally appears below the diff. Actions: **Replay** · **New text** · **Done**.

**No tracking.** Custom-text playback does not increment `dailyActivity`, `letterAccuracy`, or `listenTtr`, and never writes to Firebase. The session is intentionally unscored.

**Pause / resume.** Implemented via `AudioContext.suspend()` / `resume()`, which freezes scheduled audio in place. The progress bar and the sine wave both read from the same audio clock (`getPlaybackElapsedMs()` in `apps/web/src/utils/tone.ts`) so they cannot drift relative to the audio.

## Settings

Toggles and controls available across both platforms unless noted.

- Show hints
- Show mnemonics
- Max level (letter set size, 1 through 4)
- Word mode (Freestyle)
- Practice Words (Practice word mode)
- Auto-play sound (Practice)
- Sequential order (Practice)
- IFR mode, aka Immediate flow recovery
- Review misses later
- Listen speed (WPM). Dit length in ms = 1200 / WPM.
- Tone frequency
- Haptics (iOS): toggles the dit/dah CoreHaptics pulses that mirror tone playback. On by default.
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
- `L`: Listen
- `P`: Practice
- `N`: clear input (Freestyle)
- `Space`: hold to key (Practice/Freestyle), tap to replay current letter (Listen)
- `Esc`: close the reference modal
- Any letter or digit key while in Listen submits that character as the answer.

Top-bar buttons, the morse key, the Play button in Listen, and the Clear button in Freestyle all surface their action label and (where applicable) the shortcut chip on hover or focus.

## Feedback

- Visual: success/error states on the main display, plus the pip row that fills in as input matches the target.
- Audio: tone on press, and playback in Listen and for the Practice Play button.
- Haptics (iOS): dit/dah pulses mirror tone playback while keying or during Morse playback. User-toggleable in Settings.
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
