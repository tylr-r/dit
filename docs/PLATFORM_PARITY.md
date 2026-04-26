# Platform Parity: iOS vs Web

Tracks the current delta between `apps/ios` and `apps/web`, plus the differences we intend to keep. The canonical behavior spec is [APP_BEHAVIOR.md](APP_BEHAVIOR.md); this doc records where the two apps actually stand against it.

Update this when you ship a feature that closes (or opens) a gap.

## Legend

- ✅ shipped and at parity with the spec
- 🟡 partial — present but missing pieces (described in Notes)
- ❌ missing
- 🚫 intentionally not on this platform (see [Intentional differences](#intentional-differences))

Data plumbing for everything below is shared via [@dit/core](../packages/core). When a feature is missing on web it's almost always a UI/wiring gap, not a core gap. The relevant fields (`practiceAutoPlay`, `practiceLearnMode`, `customLetters`, `dailyActivity`, `letterAccuracy`, `bestWpm`) all live in [packages/core/src/types.ts](../packages/core/src/types.ts) and round-trip through [packages/core/src/utils/morseUtils.ts](../packages/core/src/utils/morseUtils.ts) on both platforms.

---

## Auth & sign-in

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Google sign-in | ✅ | ✅ | iOS uses native flow; web uses Firebase popup |
| Apple sign-in | ✅ | ❌ | iOS: [SignInSheet.tsx](../apps/ios/src/components/SignInSheet.tsx). Web has no equivalent. |
| Email + password | ✅ | ❌ | iOS: bottom-sheet form with the collapsed-error string per spec |
| Shared sign-in sheet | ✅ | ❌ | iOS: NUX welcome and Settings both open the same sheet at the app root |
| Delete account | ✅ | ❌ | iOS: [services/auth.ts](../apps/ios/src/services/auth.ts) `prepareAppleAccountDeletion` |
| Sign out | ✅ | ✅ | |

## NUX & onboarding

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Welcome screen | ✅ | ✅ | Both preserve the brand moment |
| Profile selection (new vs known) | ✅ | ✅ | Persists `learnerProfile` |
| Sound check | ✅ | ✅ | |
| Button tutorial (one dit + one dah) | ✅ | ✅ | |
| Welcome-screen sign-in options | ✅ | ❌ | Web has no Sign-in / Stay-signed-out fork on welcome |
| Daily reminder step | ✅ | 🚫 | Web has no notifications surface; auto-skipped at [NuxModal.tsx:92-95](../apps/web/src/components/NuxModal.tsx#L92-L95) |
| Known-user app tour | ✅ | ❌ | iOS: [tour/TourOverlay.tsx](../apps/ios/src/components/tour/TourOverlay.tsx). Web shows static text. |
| `nuxCompleted` persisted to RTDB | ✅ | ✅ | |

## Practice mode

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Tap-to-input dit/dah | ✅ | ✅ | |
| Play current target tone | ✅ | ✅ | |
| Hints toggle | ✅ | ✅ | |
| Mnemonics toggle | ✅ | ✅ | |
| One-time "Show this hint" (`N` key) | 🚫 | ✅ | Web-only keyboard affordance |
| Practice Words (word mode) | ✅ | ✅ | |
| Auto-play sound toggle (`practiceAutoPlay`) | ✅ | ✅ |  |
| Sequential order toggle (`practiceLearnMode`) | ✅ | ✅ |  |
| IFR mode toggle | ✅ | ✅ |  |
| Review misses later toggle | ✅ | ✅ |  |
| Guided course phases (teach/practice) | ✅ | 🟡 | Verify web phase handling matches spec for misses |
| Phase modal between phases/packs | ✅ | ✅ | Both have [PhaseModal.tsx](../apps/web/src/components/PhaseModal.tsx) |
| "Return to lesson" button when off-mode | ✅ | ✅ |  |

## Listen mode

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Playback at WPM | ✅ | ✅ | |
| On-screen + physical keyboard answer | ✅ | ✅ | Web binds letter/digit keys |
| Replay current letter | ✅ | ✅ | Web binds spacebar |
| Sine wave visualization | ✅ | ✅ | Both use [@dit/core](../packages/core) `getListenToneLevelAtElapsedMs` |
| Time-to-respond indicator | ❓ | ❌ | Spec says iOS-only; not located in either codebase. Confirm whether spec is aspirational or feature exists under another name. |

## Freestyle mode

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Tap-and-pause to submit | ✅ | ✅ | |
| Word mode (running word + auto-spaces) | ✅ | ✅ | |
| Clear / Backspace controls | ✅ | ✅ | |
| Keyboard `N` (clear) and `Backspace` | 🚫 | ✅ | Web-only |

## Settings

| Setting | iOS | Web | Notes |
|---|---|---|---|
| Show hints | ✅ | ✅ | |
| Show mnemonics | ✅ | ✅ | |
| Max level (1-4) | ✅ | ✅ | Web surfaces via Learning sheet tiers |
| Practice Words | ✅ | ✅ | |
| Freestyle Word mode | ✅ | ✅ | |
| Listen speed (WPM) | ✅ | ✅ | |
| Tone frequency | ✅ | ✅ | |
| Sound check | ✅ | ✅ | |
| Reference chart entry point | ✅ | ✅ | |
| Auto-play sound (Practice) | ✅ | ✅ | |
| Sequential order (Practice) | ✅ | ✅ | |
| IFR mode | ✅ | ✅ | |
| Review misses later | ✅ | ✅ | |
| Daily reminder | ✅ | 🚫 | Native notifications; web has no equivalent surface |
| Use recommended settings | ✅ | ✅ | Resets Practice toggles per `learnerProfile` |
| Replay NUX | ✅ | ✅ | Web exposes the action only in dev builds (per __DEV__/import.meta.env.DEV gating) |
| Cloud sync (sign in) | ✅ | 🟡 | Web is Google-only (see [Auth](#auth--sign-in)) |
| Delete account | ✅ | ❌ | |

## Learning configuration

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Unified Learning sheet | ✅ | ✅ | |
| Course / Open practice segmented control | ✅ | ✅ | |
| Pack list with current + completed marks | ✅ | ✅ | |
| Tier presets (Beginner / Common / Full / Full+digits) | ✅ | ✅ | |
| "Pick your own" custom-letters grid | ✅ | ✅ | |
| `guidedMaxPackReached` tracking | ✅ | ✅ | Shared via core |

## Reference modal

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Letter/number cards with Morse patterns | ✅ | ✅ | |
| Score-tinted cards | ✅ | ✅ | |
| Hero metric (mastered count or best WPM) | ✅ | ✅ | Web passes `letterAccuracy` and `bestWpm` to the modal ([App.tsx:741-748](../apps/web/src/App.tsx#L741-L748)); confirm hero rendering matches iOS profile-aware routing |
| Current streak | ✅ | ✅ | Both have data; verify web display |
| Today's correct count | ✅ | ✅ | `todayStreakContribution` is wired in web App.tsx; verify modal display |
| Guided course banner (pack/phase/letters) | ✅ | ❌ | |
| Tap card to play character | ✅ | ❌ | Web cards have no `onClick` for playback |
| Streak "at risk" treatment | ✅ | ❌ | |

## Scoring & metrics

All computation lives in [packages/core/src/utils/retention.ts](../packages/core/src/utils/retention.ts) and runs on both platforms. The gap is *display*, not data.

| Metric | iOS computes | Web computes | iOS displays | Web displays |
|---|---|---|---|---|
| Per-letter score | ✅ | ✅ | ✅ | ✅ |
| `letterAccuracy` (rolling correctness) | ✅ | ✅ | ✅ | ✅ |
| `bestWpm` | ✅ | ✅ | ✅ | ✅ |
| `dailyActivity` (per-day correct + modes) | ✅ | ✅ | ✅ | ✅ |
| `streak` (current + longest + at-risk) | ✅ | ✅ | ✅ | 🟡 |
| `hero` metric routing by profile | ✅ | — | ✅ | ✅ |

## Background behavior

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Pause animation in Low Power Mode | ✅ | 🚫 | iOS: [hooks/useSystemLowPowerMode.ts](../apps/ios/src/hooks/useSystemLowPowerMode.ts). Web has no Low Power Mode API. |
| Pause animation when idle/backgrounded | ✅ | 🚫 | Web tabs hide via `visibilitychange`; not currently wired |
| Reschedule daily reminder on foreground | ✅ | 🚫 | iOS-only by design |

---

## Intentional differences

These are not gaps. Don't open tickets to "fix" them.

### iOS-only by design

- **Haptics** (dit, dah, success) — no useful web equivalent
- **Home-screen widget (DitProgress)** — native-only surface
- **Daily local notification** — depends on iOS notification permissions; web has no equivalent app-foreground story
- **Low Power Mode / idle animation pause** — iOS battery story
- **Native date picker for reminder** — paired with the iOS-only reminder feature
- **Sign in with Apple** — Apple-only provider

### Web-only by design

- **Keyboard shortcuts** (`F`/`I`/`L` mode switching, `H` toggle hints, `W` toggle word mode, `N` show-this-hint / clear, `Backspace` delete, `Space` replay, `Esc` close reference, letter/digit keys to answer in Listen) — physical keyboard is web's affordance, not iOS's
- **One-time "Show this hint" button in Practice** — paired with the `N` shortcut
- **Google popup auth flow** — different transport from iOS's native Google sign-in, same provider

### Shared but implemented natively per platform

- Audio playback (Web Audio API vs native via [@dit/dit-native](../modules/dit-native))
- Glass surfaces (CSS vs `expo-glass-effect`)
- Modal/sheet chrome (custom React vs UIKit / `@expo/ui`)
- Sign-in transport (Firebase popup vs native OAuth)

---

## How to use this doc

- **Before claiming web parity on a feature**, find its row here and update the status.
- **Before adding a feature to one platform**, decide if it should land on both. If web is intentionally skipping it, add a row under [Intentional differences](#intentional-differences) with a one-line reason.
- **When the spec changes**, update [APP_BEHAVIOR.md](APP_BEHAVIOR.md) first, then reconcile this table.
- Items marked ❓ need investigation; resolve them when you next touch the area.
