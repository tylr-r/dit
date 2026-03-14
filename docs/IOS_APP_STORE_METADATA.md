# iOS App Store Metadata

**Last Updated:** March 14, 2026
**Scope:** `apps/ios`

This document packages the App Store copy and review notes that can be prepared
in-repo before App Store Connect entry.

## Store Identity

- App name: `Dit`
- Bundle ID: `com.tylerobinson.dit`
- Privacy policy URL: `https://practicedit.com/privacy`
- Support URL: `https://practicedit.com/support`

## Subtitle

Recommended subtitle:

`Learn Morse code by ear`

Alternative options:

- `Practice Morse every day`
- `Train Morse timing and copy`

## Promotional Text

Recommended promotional text:

`Build Morse speed with guided drills, free translation, and listening practice in a focused iPhone and iPad app.`

## Keywords

Recommended keywords:

`morse,morse code,ham radio,cw,telegraph,radio,copy practice,learn morse`

## Description

Recommended App Store description:

`Dit is a focused Morse code trainer for iPhone and iPad. Practice sending, copying, and recognizing letters with a clean interface built around fast repetition.`

`Use Practice mode for guided drills, Freestyle mode to translate on your own, and Listen mode to copy letters by ear. Adjust speed, spacing, hints, and difficulty as you improve.`

`Progress is stored on your device by default. If you choose to sign in with Apple or Google, Dit can sync your settings and progress with Firebase so you can restore them later.`

`Features:`

- `Practice` mode for guided character drills
- `Freestyle` mode for open translation
- `Listen` mode for copying Morse by ear
- Adjustable character speed and spacing
- Optional hints, mnemonics, and beginner-friendly defaults
- Reference chart with letters, numbers, and score tinting
- Optional cloud sync with in-app sign out and account deletion
- Works on both iPhone and iPad

## Review Notes

Recommended App Review notes:

`Dit can be used without creating an account. Sign-in is optional and is only used for cloud sync of progress and settings.`

`If the reviewer wants to test account features, open Settings and use either "Sign in with Apple" or "Sign in with Google".`

`Account deletion is available in-app at Settings > Delete Account. That flow deletes the Firebase account, synced progress, and local progress on the device.`

`There is no special hardware, entitlement, or external account required to review the core learning experience.`

## Screenshot Shot List

Prepare screenshots for both iPhone and iPad if shipping the universal binary.

Recommended capture order:

1. Practice mode with target letter and Morse key visible
2. Listen mode with waveform and keyboard visible
3. Freestyle mode showing decoded output
4. Settings sheet with speed and helper controls
5. Reference sheet with tinted score cards

Capture notes:

- Use a signed-out state for the main marketing screenshots unless a sync screen is needed.
- Prefer a mid-progress account so the UI shows meaningful scores and settings.
- Keep the status bar clean and avoid debug overlays.
- Capture both iPhone and iPad in portrait because the app is portrait-only.

Suggested filenames:

- `iphone-01-practice.png`
- `iphone-02-listen.png`
- `iphone-03-freestyle.png`
- `iphone-04-settings.png`
- `iphone-05-reference.png`
- `ipad-01-practice.png`
- `ipad-02-listen.png`
- `ipad-03-freestyle.png`
- `ipad-04-settings.png`
- `ipad-05-reference.png`

## Remaining Manual Entry

The following still must be entered or confirmed manually in App Store Connect:

- App privacy questionnaire answers
- Support URL
- Privacy policy URL
- Age rating and content declarations
- Final screenshots
