# Dit Changelog

## Unreleased

Compared against `2026.5.31`.

### Highlights

- iOS: Listen mode now offers word recognition. Choose English words or Q codes, listen before the answer choices appear, and learn what each Q code means after answering.
- iOS: Added custom-text listening. Paste a passage, pause and resume playback, and optionally type along to compare your copy afterward.

- Web: practicedit.com now opens with a homepage that introduces Dit, complete with a live Morse key you can try right on the page. The practice app itself now lives at practicedit.com/app.
- Added **Show this hint** in Practice — when hints are turned off, you can reveal the pattern for the current letter once. That round won't count toward your score.
- Added a new **Conversation** mode: practice a realistic CW conversation with an AI operator. Key your replies on the Morse key and hear the other station's replies played back as Morse, just like an on-air QSO.
- Web: Listen mode now offers word recognition. Choose English words or Q codes, listen before the answer choices appear, and learn what each Q code means after answering.

### Changes

- iOS: Conversation asks permission before sharing your keyed messages with Google Gemini.

- iOS: Conversation separates copying from keying, with optional copy checking before you reply.
- iOS: Conversation uses shorter labels and a single reply prompt.

- iOS: Progress now groups letters by mastery and shows how quickly you recognize them by ear.
- iOS: Added Test sound in Settings so you can check your playback speed and pitch.
- iOS: Onboarding has larger, animated listening and recognition illustrations, clearer text, and a consistent Continue button.
- iOS: Conversation keeps connection errors and recovery actions together.

- Web: Press Enter to send your Conversation reply.
- Web: After choosing an answer in Listen Words or Q codes, press Enter for the next question.

- Web: Conversation now waits for you to choose **Start my turn** after a transmission, giving you time to finish copying the last word.

- Web: Added a Back button throughout onboarding and the app tour. Desktop onboarding places navigation at the screen edges, leaving the exercise centered.

- Web: Onboarding has a lighter layout over the liquid background, with fewer panels, larger listening and recognition illustrations with subtle animations, clearer playback controls, and clearer lesson previews.

- Web: Welcome now leads with Get started, with sign-in available on a dedicated screen for returning users.

- Web: Conversation now sends perfect RST reports as `5NN` and chooses `GM`, `GA`, `GE`, or `GN` from the learner's local time.
- Web: Conversation replies now follow a natural CW exchange, keying is visually primary, optional copy collapses when empty, and a compact prosign reference is available during a QSO.
- iOS: Onboarding sound check now notices when your volume is all the way down and asks you to turn it up before continuing.
- Reference chart colors on iOS now use the same relative scoring style as web, and only on letters you've mastered.
- Onboarding now lets you swipe left to go back to the previous step.
- iOS: The Morse key tutorial now lets you turn haptics on or off before practicing taps and holds.
- Web: Settings, Learning, and sign-in no longer open on top of each other.

### Fixes

- Conversation replays the same station response when retrying failed audio.

- iOS: Listen answer cards respond to taps across the whole card.

- iOS: Conversation keeps the background moving throughout a contact, even while listening without touching the screen.

- iOS: Conversation keeps the Morse key at the bottom while you reply.
- iOS: Long conversations open at the latest turn so controls stay within reach.

- Conversation can retry a failed station request without losing earlier turns.
- iOS: Conversation no longer shows the guided-course pack badge.
- iOS: Mode names now stay on one line.
- iOS: VoiceOver can reach both welcome screen choices.
- iOS: Fixed extra-long gaps between words during Morse playback.

- Web: The Backspace key now deletes characters from your outgoing Conversation reply. A fresh automatic space is skipped with the first letter deletion; spaces reached while editing can still be deleted on their own.

- Web: Onboarding now opens on the main app page instead of running over Conversation.

- Web: Fixed silent onboarding sound checks after blocked browser audio and when opening onboarding from Conversation.

- Web: Onboarding buttons stay in place when steps change or sound-check feedback appears.

- Web: Sign-in is now usable from the welcome screen instead of staying hidden until later in onboarding.

- Web: Conversation no longer exposes an incoming message in the transcript before the operator is ready to reveal it.
- Web: Loading `/app/qso` no longer starts hidden Practice audio before the operator chooses what to do.

- Onboarding now moves forward automatically after a successful sign-in instead of leaving you on the welcome screen without sign-in choices.
- iOS: Practice now shows green or red feedback again when an answer is correct or missed.
- Fixed the Reference chart playing letters at a speed that didn't match your Listen setting.
- Fixed **Use recommended settings** always applying the returning-learner preset, even when you said you're new to Morse.

## 2026.5.31

Compared against `2026.4.22`.

### Highlights

- Added support for external Morse paddles, including VBand-compatible adapters, in iOS Practice and Freestyle.
- Added a Learning method sheet for choosing a course pack, open practice, or custom letters.
- Added a welcome flow with sign-in and stay-signed-out options.
- Added Apple, Google, and email sign-in from onboarding and Settings.
- Added a haptics toggle in Settings.
- Added Reset App in Settings so you can return Dit to a fresh first-run state without deleting your account.

### Changes

- External paddles now use the left paddle for dits and the right paddle for dahs in Practice and Freestyle.
- Paddle input repeats while held, supports quick left/right changes, and follows the current playback WPM.
- Paddle capture pauses automatically while sheets, sign-in, settings, tours, or Listen mode are open.
- Returning learners now get a guided spotlight tour for Modes, Settings, and Progress.
- Learning options now live in the Learning method flow instead of Settings.
- The Learning method sheet now matches the Settings sheet visual style.
- Listen playback and haptic spacing now better match the timing shown on screen.
- Settings now prevents course-specific options from changing while a guided course is active.

### Fixes

- Kept the iOS background animation active while an external paddle is held.
- Improved Listen timing for Farnsworth-style playback.
- Removed extra helper space in Practice when hints and mnemonics are turned off.
- Hid development-only settings in production builds.
- Improved onboarding layout and reset behavior.

## 2026.4.22

Compared against `v1.0.0`.

### Highlights

- Daily reminders with notification permission handling, reminder scheduling, and streak-aware reminder copy.
- DitProgress home-screen widgets for streak, daily progress, letters learned, and best WPM.
- Progress modal and retention model for daily activity, streaks, mastered letters, and best WPM.
- Native CoreHaptics feedback synchronized with Morse keying and playback.

### Changes

- Redesigned onboarding into a staged welcome flow with profile choice, sound check, Morse key tutorial, beginner course intro, returning-user tour, and reminder setup.
- Made onboarding resumable after app close and replayable from Settings in development.
- Refined guided lesson prompts, beginner course progress, and transition handling.
- Redesigned Settings with grouped practice, helper, reminder, app action, and account controls.
- Added Practice settings for words, auto-play, sequential order, immediate flow recovery, and review misses later.
- Added tone pitch controls and simplified playback speed settings.
- Improved consistency between iOS and web for shared Morse practice behavior.
- Upgraded the iOS app to Expo SDK 55.
- Updated app icon, splash/welcome assets, widget imagery, and design tokens.
- Added Low Power Mode detection in the native module and app UI.
- Added Firebase Analytics client for basic iOS user events.
- Added Phase modal for guided course transitions.
- Updated documentation for onboarding, widgets, reminders, analytics, and shared app behavior.

### Fixes

- Fixed iOS settings persistence across app restarts.
- Fixed iOS progress sync render loops.
- Fixed onboarding transition glitches and aligned the splash screen with the welcome screen.
- Fixed replay behavior for letters in the onboarding Morse key tutorial.
- Added reset confirmation and accessibility/styling polish in the progress/reference surface.
- Improved Listen waveform/playback duration calculation.
