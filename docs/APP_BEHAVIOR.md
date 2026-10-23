# Dit App Behavior

This document captures the intended, shared behavior across web and iOS. iOS carries more features than web; platform-specific behavior is called out inline.

## Supported iOS versions

The next iOS release requires iOS 16.4 or later.

## Core input

- Tap the big Morse button for dit, hold longer (dit threshold) for dah.
- The keyed tone should start immediately on press, including the first press
  after a page refresh or app launch. On web, the first post-refresh key press
  may happen while Chrome is still resuming Web Audio; Dit preserves that first
  sidetone long enough to be audible instead of letting a quick release cancel
  it before the audio context wakes up.
- Practice and Freestyle build input from dit/dah sequences.
- A short pause submits the current Freestyle sequence or commits the current Practice attempt.

## Modes

- On iOS, the single-line mode label opens a system action sheet for Practice, Freestyle, Listen, and Conversation. Cancelling preserves the current mode.

### NUX (New User Experience)

- On first launch, a welcome screen shows the Dit logo and "Welcome to Dit" before advancing to onboarding. This screen must be preserved. It is the app's first impression and brand moment.
- The app asks whether the user is new to Morse or already knows it. The answer is stored as `learnerProfile` and changes what the Reference modal emphasizes later (mastered count vs. best WPM).
- Both paths begin with a sound check and a short input tutorial that explicitly teaches the big Morse key.
- The button tutorial requires one short tap (dit) and one long press (dah) before continuing.
- Web provides a visible Back button on every onboarding step after welcome and within the app tour. From the first tour stop it returns to the Morse key tutorial, skipping the iOS-only reminder. Returning to the key tutorial clears its counters so it does not immediately advance again.
- Users can swipe left during onboarding to return to the previous step. Moving back from sound check clears its completion; moving back from the Morse key tutorial clears its tap/hold counts so stale progress does not auto-advance the user.
- Returning learners who go back from the iOS reminder step to the Morse key tutorial also restart both tap and hold counts, keeping the tutorial open until they practice again.
- On iOS, the Morse key tutorial exposes a **Haptics** toggle that controls the same persisted haptics setting as Settings.
- iOS also asks the user to set a daily practice reminder during NUX. The user can skip this and turn it on later in Settings.
- Known users see the daily reminder screen, then a short app tour, then enter
  the normal app flow.
- Beginner users enter the guided course, which introduces letters in small packs and advances automatically.
- NUX status (`pending`, `completed`, `skipped`) is persisted so it only runs once unless replayed from Settings.

- On web, welcome shows **Get started** as the primary action and **Already use Dit? Sign in** below it, with no delayed reveal. Get started enters profile selection without requiring an account. Sign-in replaces the onboarding content on the same full-screen stage; Back returns from email to providers, then to welcome. The onboarding UI and tour are hidden while sign-in is open. Settings continues to use the sign-in sheet.

- Web sound-check playback retries browser audio activation from the Play sound click if an earlier automatic playback request is still waiting for permission to start. Onboarding runs at `/app` and does not inherit Conversation audio suppression.

- Pending web onboarding owns `/app`. Opening `/app/qso` before completion, or replaying onboarding from Conversation, replaces the URL with `/app` and exits Conversation. Its surface is unmounted, including during onboarding sign-in. Returning users with completed or skipped onboarding can open `/app/qso` directly. The liquid background remains visible.

- Web onboarding keeps Continue anchored across steps. At desktop widths (900px and above), Back sits at the upper-left and Continue at the bottom-center of the viewport; the exercise remains centered. Smaller screens keep Continue centered. Sound playback and confirmation controls stay in place when feedback or troubleshooting appears; long content scrolls inside the middle region.

#### Post-onboarding intro hints

After NUX completes, a short two-step hint sequence may run on first use of the main app (persisted in `dit-intro-hint-step`):

1. **Morse key** — callout on the big key explaining dit vs dah. Dismisses on first key press.
2. **Settings** — spotlight on the settings control. Dismisses when the user opens Settings.

iOS renders both steps as on-screen overlays. Web does not render these overlays; it still advances the persisted step when the user keys or opens Settings so the sequence does not repeat. Listen mode suppresses both steps.

#### Sign-in entry points

Two surfaces open the same sign-in bottom sheet:

- **NUX welcome** — see the next subsection.
- **Settings** — when signed out, the Account group shows a single **Sign in** row (the Apple / Google provider list was collapsed into the shared sheet). Tapping it closes the Settings modal first, then opens the shared sign-in sheet from the app root. The Learning sheet follows the same anti-stack pattern on both platforms. The two surfaces never stack. On successful sign-in the sheet dismisses and Settings reopens so the user sees the signed-in state (email, Sign Out, Delete Account). On cancel the user returns to the main screen without Settings reopening.

The shared sheet implementation lives at `apps/ios/src/components/SignInSheet.tsx`. `NuxModal.tsx` renders its own instance for the welcome-screen entry point; the Settings instance is rendered at the `App.tsx` root so it survives `SettingsModal` unmounting when Settings closes.

#### Welcome-screen sign-in

- Signed-out users see two options fade in ~2 seconds after paint: **Sign in** (primary) and **Stay signed out** (secondary).
- **Sign in** opens a bottom sheet with three provider rows: **Continue with Apple**, **Continue with Google**, and **Continue with Email**. Each row renders its provider logo (Apple's SF Symbol `applelogo`, the Google "G", and a mail icon) plus a Cancel row. On successful sign-in, remote progress loads via `useFirebaseProgressSync`. If the loaded snapshot has `nuxCompleted === true` or any meaningful progress (learner profile, guided course active, or non-zero scores), NUX is marked `'skipped'` and the user lands in the main app with their progress restored. Otherwise the welcome screen advances automatically to profile selection once auth state updates.
- **Continue with Email** swaps the sheet content in-place to an email form: email field, password field, primary "Sign in", secondary "Create account", and a back chevron to the provider picker. Errors render inline above the primary button (see below). Form state resets whenever the sheet dismisses. No password-reset or email-verification flow in v1.
  - **Sign in** calls `signInWithEmailAndPassword`; bad-credential errors (`auth/invalid-credential`, `auth/user-not-found`, `auth/wrong-password`) all show the same message, `"Email or password is incorrect."` — Firebase v11+ collapses these codes for enumeration resistance and we mirror that.
  - **Create account** calls `createUserWithEmailAndPassword`; it creates the user and signs them in immediately. No confirm-password field.
- **Stay signed out** advances to the next NUX step (profile selection), identical to the prior tap-anywhere behavior.
- Cancel or error on the sign-in sheet returns to the welcome screen with both options still visible.
- When a user is already signed in (e.g., replaying NUX from Settings), the two options are not rendered; the welcome screen advances automatically so replay does not prompt for re-auth.

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

Analytics for this surface is deliberately bounded: opening the sheet emits
`learning_method_opened`, changing **Course** / **Open practice** emits
`learning_method_selected`, and choosing a course pack, tier preset, or custom
character set emits `learning_scope_selected`. The custom event records only the
selected count, not the actual characters.

#### `nuxCompleted` flag

- Stored at `users/{uid}/progress/nuxCompleted: boolean` in Firebase RTDB, inside the existing progress object.
- Written via the normal progress save path whenever a signed-in user's local NUX status is `'completed'` or `'skipped'`. The value is derived from the onboarding state in `useMorseSessionController`'s progress snapshot.
- Read on sign-in inside `applyParsedProgress`: if `true` (or the `hasMeaningfulRemoteProgress` heuristic passes), NUX is marked skipped locally via `persistNuxStatus('skipped')`.
- Accounts created before this flag existed fall back to the heuristic, so no returning user is forced back through NUX unexpectedly.

### Practice

- A target character is shown with its Morse pattern.
- Input must match the target exactly.
- On web, Space keeps the same timed press behavior as the on-screen key. On web and iOS, VBand-compatible external paddle input is also supported in the main Practice surface: left Control or `[` enters a dit, and right Control or `]` enters a dah. On iOS, the capture is disabled while sheets, modals, tour, sign-in, or Listen UI is active.
- Correct: score +1, brief success state, next target (or next letter in the current word). The brief success state tints the main Practice feedback green.
- Incorrect: score -1 and input clears. The brief error state tints the main Practice feedback red. With IFR mode on, the app advances immediately and queues misses for delayed review. With IFR mode off, the same target stays.
- The **Play** button replays the current target's Morse tone so the user can hear before answering.
- **Auto-play sound** (on by default) plays the target tone automatically when it appears.
- **Sequential order** (the "learn mode" toggle, on by default) makes Practice serve letters from the start of the active set rather than weighted-random. Turning it off switches to the weighted algorithm below.
- With sequential order off, character selection prioritizes less proficient characters ahead of well-known ones.
- Hints and mnemonics can be toggled in Settings. When **Show hints** is on, Practice does not accumulate scores, streak credit, or `letterAccuracy` updates (guided course practice is exempt). When hints are off, both platforms expose a one-time **Show this hint** control outside the guided course (web also binds `N`) that reveals the pattern for the current letter only and disables scoring for that attempt.
- **Word mode** (Practice Words) shows a full word, highlights progress letter by letter, and computes WPM on completion.
- During the guided beginner course, Practice runs in fixed lesson phases:
  - Teach: repeat the new letters until each is answered correctly enough times.
  - Practice: mix the current pack with already unlocked letters.
  - On misses, the app keeps the same target, replays feedback, and does not silently advance.
- A phase modal appears when the course advances from one phase or pack to the next.
- If the user switches modes while a guided course is active, a "Return to lesson" button appears so they can jump back in without losing their place.

### Freestyle

- Tap a sequence and pause to submit.
- On web, Space keeps the same timed press behavior as the on-screen key. On web and iOS, VBand-compatible external paddle input is also supported in the main Freestyle surface: left Control or `[` enters a dit, and right Control or `]` enters a dah. On iOS, the capture is disabled while sheets, modals, tour, sign-in, or Listen UI is active.
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
- Both platforms display a sine wave visualization of the playback.

#### Words

A recognition exercise inside Listen for English words or Q codes on both platforms. iOS native verification is pending, tracked in `PLATFORM_PARITY.md`.

- Standard Listen shows a **Characters / Words** selector. Characters remains the fallback during the guided beginner course and whenever neither vocabulary has four choices available from the learner's active character set.
- On iOS, **Characters / Words** is a native segmented control fixed below the top bar. Words uses a native **Common words / Q codes** menu. These selectors keep the same eligibility, silent entry, and saved preferences as before.
- Entering Words is silent and shows a ready state. **Start listening** chooses one eligible single-token CW word, plays it with the user's Listen character speed, effective speed, and tone frequency, then presents four written CW words as answers.
- Inside Words, **Common words / Q codes** chooses the vocabulary. Common words defaults to the existing Practice English bank, excluding its radio signals (`CQ`, `DE`, `QSO`, `QTH`, `QSL`, `RST`, `SOS`). Q codes uses only the curated three-letter Q signals and retains their teaching definitions. Targets and distractors always come from the same bank. Multiword phrases and joined prosigns are excluded.
- Changing vocabulary stops audio and returns to the quiet ready state without resetting session counts. If the selected bank has fewer than four eligible choices, Start is disabled with an explanation; the vocabulary selector remains usable so the learner can switch banks.
- Distractors prefer the same difficulty tier as the target. A new round does not immediately repeat the previous target.
- Selecting an answer stops playback and locks the choices. The correct word is identified; Q codes also reveal their plain-English meaning. English answers have no extra definition card content. Incorrect selections are also marked so the learner can compare them with the correct word.
- Choices and their shortcuts stay concealed and disabled until audio finishes, including Farnsworth spacing. The reveal follows audio completion, not the call that schedules playback.
- **Replay** repeats the same target, temporarily concealing choices and any explanation again. The selected answer and feedback return unchanged when playback finishes. After an answer, **Next** explicitly begins another round so the learner has time to read the explanation.
- On web, Enter advances to the next word after a correct or incorrect answer, once playback has finished. It does not skip unanswered questions.
- On web, number keys 1 through 4 select the corresponding answer only after playback finishes. Space starts from the ready state or replays the current word. Other letter and digit keys do not feed the single-character Listen answer handler while Words is active.
- Correct and attempted counts last for the current app session, including vocabulary and mode switches. Word answers do not change per-letter score, retention, recognition-time, streak, or daily-activity data and are not synced to Firebase.
- The selected Listen content persists locally (localStorage on web, AsyncStorage on iOS) under `dit-listen-content-v1`; vocabulary persists under `dit-listen-vocabulary-v1`, defaulting to Common words.

#### Custom text

A sub-mode of Listen that plays a user-entered passage as Morse for head-copy practice on both platforms. iOS native verification is pending.

- iOS uses a native sheet to edit the passage and workflow. Normalization, the 2000-character cap, estimated duration, and the post-playback diff use the shared core helpers.
- iOS keeps the passage and Type along choice in AsyncStorage under `dit-ios-custom-listen-v1`; the content choice uses `dit-listen-content-v1`. Returning to the mode restores Setup silently. Done returns to Characters and retains the saved passage for next time; Clear removes it. Reset App removes both preferences and the passage.
- iOS Type along uses the system keyboard and accepts hardware typing. Copy stays editable only during playback. A scrollable surface and keyboard avoidance keep the controls reachable.
- iOS Pause and Resume freeze/restart the native audio player and haptic sequence. The waveform and progress use the native sample clock; natural Reveal waits for the player's completed-playback state, including trailing spacing. Leaving Listen, opening another app surface, or backgrounding stops the exercise and returns it to Setup.
- Native PCM playback queues bounded chunks so long passages do not require a single full-length audio buffer. Word spacing is one Farnsworth word gap, matching the core timing helpers.

The following details describe the existing web surface:

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
- **Reveal** — audio has finished or the user tapped End. Source text is shown. If type-along was on, an LCS-aligned char-level diff sits below it (`ok` matches in green, `miss` source chars red, `extra` typed chars red on a tinted background, `gap` `·` glyphs for trailing chars the user didn't type). A `matched / total · missed · extra` tally appears below the diff. Actions: **Replay** · **New text** · **Done**.

**No tracking.** Custom-text playback does not increment `dailyActivity`, `letterAccuracy`, or `listenTtr`, and never writes to Firebase. The session is intentionally unscored.

**Pause / resume.** Implemented via `AudioContext.suspend()` / `resume()`, which freezes scheduled audio in place. The progress bar and the sine wave both read from the same audio clock (`getPlaybackElapsedMs()` in `apps/web/src/utils/tone.ts`) so they cannot drift relative to the audio.

### Conversation (web and iOS)

Practices a realistic CW QSO against an LLM playing the other station. Both platforms use the shared session and station rules. The iOS app has been rebuilt and launched. Simulator App Check and Firebase AI connectivity are verified, including a received station opener and native playback. Physical-device audio, haptics, and a complete two-way contact remain pending.

- On web, Conversation has its own `/app/qso` route. Selecting the mode updates the URL, and refreshing that route keeps Conversation selected. Loading the route is silent: no shared Practice audio may start behind the Conversation surface. Audio begins only after the operator chooses a direction, replays a turn, or keys.
- Idle asks whether the operator wants to **Send first** or **Receive first**. Either start action prepares audio; on web it unlocks Web Audio in the direct click. iOS initializes App Check before opening the contact. Receive first requests and plays the other station's opener; Send first opens the Morse key immediately so the user can call CQ. A later audio retry replaces any stale pending suspended-context resume. Each contact gives the other station a locally generated US-style practice callsign that remains fixed for that QSO and cannot immediately repeat in the next one. The other station learns the user's name and callsign only from what the user keys during the contact.
- The other station's turns are generated by an LLM (Gemini via Firebase AI Logic), encoded with Conversation-specific prosign support, and played at the user's global playback WPM and tone frequency. Standalone labels from the Prosigns reference are sent as continuous characters; matching letters inside callsigns and other words retain normal letter spacing. Joined prosigns keyed by the learner decode to their written labels in the draft. Custom Listen and scored character practice keep their existing alphabet. Conversation uses the global WPM for both character timing and standard Morse spacing rather than inheriting Listen's adaptive Farnsworth effective speed.
- During playback, **Show letters as received** optionally reveals each character when its Morse tones finish. A joined prosign's full label appears together when its continuous signal ends. The reveal uses the same AudioContext clock as playback, so pause and replay stay synchronized. The full received plaintext stays concealed in the transcript while audio plays. With live letters off, it remains concealed after playback until the operator reveals it, checks copy, or begins keying a response. With live letters on, it becomes visible when playback finishes.
- The user can type copy during playback. When the transmission ends, the reception layout and focused copy field stay in place with **Transmission complete**. The received transcript entry is deferred until **Reply** on iOS, **Start my turn** on web, or **End QSO**, so it cannot push the reception controls while the operator finishes typing. There is no automatic timeout. The handoff explicitly opens the Morse key; copying and grading are never required. On web, empty copy collapses to a compact optional row below the key; copy already typed during playback stays expanded, and the operator may expand or hide it. On iOS, copy stays on the reception screen with no show/hide controls. **Check copy** becomes available when playback finishes; **Reply** replaces the copy workspace with the draft and key. Replay returns to reception. Checked copy uses the same matched/missed/extra comparison as custom Listen and displays the actual expected characters for omissions, including trailing misses.
- An initial iOS connection error groups Retry and End QSO with its explanation. The empty transcript and Prosigns reference are omitted until a contact exists.
- On web, a compact **Prosigns** edge tab opens a non-modal side reference on desktop and a bottom sheet on narrow screens. iOS uses a collapsible non-modal reference above the transcript. It lists common QSO prosigns and plain-language meanings without showing visual dot-and-dash patterns. The operator can leave it open while keying.
- The user replies by keying the Morse key; dits/dahs decode into a running draft line the same way Freestyle's word mode accumulates letters. Space works as a straight key. Conversation, Practice, and Freestyle all use the same core paddle engine for timed symbols, held-key repeat, paddle switching, and cancellation. The web browser maps left/right Control or bracket keys once, then routes the input to the active mode. **Backspace** and **Clear** edit the draft. Backspace removes a freshly auto-inserted trailing space together with the preceding character. Subsequent deletions remove one character at a time, including spaces exposed by earlier deletions. Backspace cancels any pending automatic word space so it cannot reappear during editing. The keyboard Backspace key also deletes the last draft character during your turn, including held-key repeat; when a text field has focus it edits that field instead; **Send** or Enter submits it as the next turn. Enter does not key a Morse tone in Conversation, and focused text fields retain their normal Enter behavior.
- A received line is added to the visible transcript after playback and an explicit handoff or End QSO; outgoing lines appear when sent. Nothing is revealed early, so a reply is always grounded in what was actually keyed on both sides.
- **Pause** / **Resume** / **Replay** control the currently-playing turn, same semantics as Listen's custom text. iOS uses the native sample clock and final-buffer completion rather than a JS duration timeout. **End QSO** stops the session and shows the full transcript; **New QSO** starts over with a fresh callsign and persona.
- Replaying or retrying audio never adds another transcript entry for the same transmission, including after Reply or End QSO. Separate station responses remain separate turns even when their text is identical.
- If the LLM call fails, the surface shows an error with **Retry**, which resends the same reply. Both adapters replace the failed SDK chat with one containing only previously accepted turns, so a rejected request cannot permanently poison Retry or duplicate a failed turn.
- If the station responds successfully but audio fails, **Retry** plays that accepted response again without another LLM request. This also applies to audio failures during Pause, Resume, or Replay. A new outgoing reply clears the previous audio recovery target so an LLM failure retries the new reply instead.
- The LLM is instructed to use real CW operating conventions (CQ, RST, Q-codes, 73/SK) at a casual, learner-appropriate pace. Perfect `599` reports are sent as the CW cut-number form `5NN`; returned model text is normalized so this remains deterministic. The device's local hour supplies the appropriate `GM`, `GA`, `GE`, or `GN` greeting context when a QSO starts. A CQ answer is limited to the callsign exchange and handoff. Later turns introduce one exchange unit at a time rather than front-loading RST, name, QTH, and station details. See `docs/DECISIONS.md` for why vocabulary isn't restricted to the user's unlocked letter set here.

- Before starting each iOS contact, a native permission alert identifies Google Gemini and explains that keyed messages are sent for replies while typed copy stays local. **Cancel** leaves the session idle; **Allow** starts the chosen direction. Permission lasts for that contact, including retries, and a new contact asks again. No station session is created before Allow.
- Selecting Conversation on iOS stays silent and cancels pending input from the previous mode. The underlying scored Practice/Freestyle/Listen session keeps its saved mode but cannot play or stop QSO audio. Conversation is an app surface, not a persisted progress mode, and its header omits the guided-course pack badge.
- iOS supports the existing Morse key and external paddles for replies. Hardware capture is enabled only during the unobstructed keying turn. Copy uses the system keyboard; finishing playback preserves the same editable field and focus until the explicit handoff. During replies, the Morse key stays at the bottom safe area, with draft editing and Send immediately above it. An empty draft shows **Reply**, replaced by the keyed text; there is no separate turn label, copy field, or comparison. Concealed transcript entries use **Reveal** to reveal that specific message; its accessibility label is **Reveal received message**. Transcript and prosign meanings scroll above the fixed reply area. Each new turn opens at the latest content and controls while manual scrolling allows reviewing older messages. Opening Prosigns scrolls to its reference. The copy keyboard scrolls the focused reception field into view.
- On iOS, leaving the mode, opening another app sheet, or backgrounding ends the current QSO and stops keying and playback. The received transcript remains available; returning does not automatically resume sound. Onboarding replay discards the QSO. End, reset, and unmount invalidate pending station requests on both platforms, so late responses cannot start playback.

**No tracking.** Conversation content and scores are never written to Firebase, and the mode does not affect `dailyActivity`, `letterAccuracy`, `listenTtr`, or streak — same precedent as custom Listen text.

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
- Listen speed (WPM). Dit length in ms = 1200 / WPM. Applies to every Dit-initiated playback, including reference chart taps and the Settings sound check.
- Tone frequency. Applies to the same Dit-initiated playback surfaces as listen speed.
- Haptics (iOS): toggles the dit/dah CoreHaptics pulses that mirror tone playback. On by default.
- Sound check in Settings on both platforms; iOS also checks system volume during NUX
- Reference chart modal
- Daily reminder (iOS): picks a local notification time using the native date picker. Requires notification permission, which the app requests on first enable.
- Use recommended settings: resets Practice toggles, listen speed options, and max level to the preset for the current `learnerProfile` via `getRecommendedSettings` in `@dit/core`:
  - **Beginner** (profile not `known`): hints and mnemonics on, max level 1, learn mode and auto-play on, IFR and review-misses off, default listen WPM / effective WPM / auto-tightening.
  - **Known**: hints and mnemonics off, max level 3, learn mode and auto-play on, IFR and review-misses at their defaults, same listen defaults as beginner.
- Replay NUX: runs the onboarding flow again (dev builds only).
- Reset App: available whether signed in or signed out, including offline. The first confirmation explains the on-device reset. After the user confirms, Dit checks network reachability before changing anything. Signed-in users who are offline get a second confirmation explaining that server data will not be cleared unless they cancel, connect, and try again, and that they can still reset this device locally by choosing Reset Device.
- Cloud sync:
  - Web: Google sign-in (popup).
  - iOS: Sign in with Apple and Sign in with Google. Also exposes **Delete account**, which removes the Firebase user and their synced progress.

Availability rules:

- Playback speed, tone frequency, and account/reference actions are global.
- Max level applies to Practice and Listen.
- Freestyle word mode is Freestyle-only.
- Practice-only options can be adjusted from other modes but stay grouped separately from the current mode's settings.
- During the guided beginner course, controls that would change the fixed lesson flow are unavailable: Practice Words, Sequential order, Immediate flow recovery, and Review misses later.
- **Use recommended settings** is also unavailable during the guided beginner course because it resets the fixed lesson flow's underlying practice and level settings.

## Keyboard shortcuts (web)

- `F`: Freestyle
- `L`: Listen
- `P`: Practice
- `N`: one-time **Show this hint** in Practice when global hints are off; clear input in Freestyle
- `Space`: hold to key (Practice/Freestyle), tap to replay the current Listen character, or start/replay the current Listen word
- `1` through `4`: choose an answer in Listen Words
- `Esc`: close the reference modal
- Any letter or digit key while in Listen Characters submits that character as the answer.

Top-bar buttons, the morse key, the Play button in Listen, and the Clear button in Freestyle all surface their action label and (where applicable) the shortcut chip on hover or focus.

## Feedback

- Visual: success/error states on the main display, plus the pip row that fills in as input matches the target. In Practice, correct answers briefly tint the target/active word letter, status text, and pips green; missed answers briefly tint the same feedback surfaces red.
- Audio: tone on press, and playback in Listen and for the Practice Play button.
- Haptics (iOS): dit/dah pulses mirror tone playback while keying or during Morse playback. User-toggleable in Settings.
- On iOS, the background keeps moving throughout a foreground QSO, including connection, reception, copy, replies, and recovery, until End QSO or leaving Conversation. Active contacts bypass idle and Low Power Mode pausing. Outside an active QSO, Low Power Mode or ten seconds without interaction freezes the last frame; interaction resumes motion without a fade.

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

- The Reference modal shows letters and numbers grouped into Known by ear, Now learning, and Not yet. Patterns are shown on mastered letters; iOS in-progress cards say Train the ear.
- Mastered letters use a shared relative score tint (green/red vs the section median). Both platforms show Listen recognition bars and average recognition time across mastered letters with samples. Missing samples do not imply zero latency. These iOS display changes await native visual review.
- iOS also shows the hero metric, current streak, today's correct count, and, when the guided course is active, the current pack, phase, and pack letters. Tapping a card plays that character at the current playback letter speed from Settings.

## Reminders and widget (iOS)

- A single daily local notification, scheduled for the time set in Settings or NUX. The app reschedules it whenever progress changes and when the app returns to the foreground, so the "next fire" always reflects current state.
- The DitProgress home-screen widget publishes streak, daily activity, and hero metric from the same progress snapshot that drives the Reference modal, so the widget and in-app view stay consistent.
