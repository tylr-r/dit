# Dit Changelog

## Unreleased

Compared against `2026.5.31`.

### Highlights

- Web: practicedit.com now opens with a homepage that introduces Dit, complete with a live Morse key you can try right on the page. The practice app itself now lives at practicedit.com/app.
- Web: Added **Show this hint** in Practice — when hints are turned off, you can reveal the pattern for the current letter once. That round won't count toward your score.

### Changes

- iOS: Onboarding sound check now notices when your volume is all the way down and asks you to turn it up before continuing.
- Reference chart colors on iOS now use the same relative scoring style as web, and only on letters you've mastered.
- Onboarding now lets you swipe left to go back to the previous step.
- iOS: The Morse key tutorial now lets you turn haptics on or off before practicing taps and holds.
- Web: Settings, Learning, and sign-in no longer open on top of each other.

### Fixes

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
