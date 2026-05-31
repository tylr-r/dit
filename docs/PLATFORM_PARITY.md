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
| Apple sign-in | ✅ | ✅ | Web uses Firebase OAuthProvider('apple.com') with popup and redirect fallback |
| Email + password | ✅ | ✅ | Sign in + create account with the collapsed bad-credential message |
| Shared sign-in sheet | ✅ | ✅ | Web sheet wired in Settings; NUX welcome reuse comes in PR5 |
| Delete account | ✅ | ✅ | Web has no native session to revoke; Firebase deleteUser handles it |
| Sign out | ✅ | ✅ | |

## NUX & onboarding

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Welcome screen | ✅ | ✅ | Both preserve the brand moment |
| Profile selection (new vs known) | ✅ | ✅ | Persists `learnerProfile` |
| Sound check | ✅ | ✅ | |
| Button tutorial (one dit + one dah) | ✅ | ✅ | |
| Welcome-screen sign-in options | ✅ | ✅ | Sign in / Stay signed out fade in 2s after paint when signed out; reuses the SignInSheet from PR3 |
| Daily reminder step | ✅ | 🚫 | Web has no notifications surface; auto-skipped at [NuxModal.tsx:92-95](../apps/web/src/components/NuxModal.tsx#L92-L95) |
| Known-user app tour | ✅ | ✅ | Web tour spotlights real header elements via getBoundingClientRect + portal |
| `nuxCompleted` persisted to RTDB | ✅ | ✅ | |

## Practice mode

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Tap-to-input dit/dah | ✅ | ✅ | Both platforms accept VBand-compatible external paddle keys in the main Practice surface: left Control or `[` for dit, right Control or `]` for dah. iOS disables capture while sheets, modals, tour, sign-in, or Listen UI is active. |
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
| On-screen + physical keyboard answer | ✅ | ✅ | Web binds letter/digit keys. iOS always shows the on-screen keyboard (unavailable letters dimmed); web only shows it on coarse-pointer devices and hides it when a hardware keyboard is detected. |
| Replay current letter | ✅ | ✅ | Web binds spacebar |
| Sine wave visualization | ✅ | ✅ | Both use [@dit/core](../packages/core) `getListenToneLevelAtElapsedMs` |
| Time-to-respond indicator | ❓ | ❌ | Spec says iOS-only; not located in either codebase. Confirm whether spec is aspirational or feature exists under another name. |
| Custom text playback (head copy) | ❌ | ✅ | Web-only sub-mode of Listen — paste a passage, hear it as Morse, optionally type along with a char-level diff after. iOS adoption deferred. |

## Freestyle mode

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Tap-and-pause to submit | ✅ | ✅ | Both platforms accept VBand-compatible external paddle keys in the main Freestyle surface: left Control or `[` for dit, right Control or `]` for dah. iOS disables capture while sheets, modals, tour, sign-in, or Listen UI is active. |
| Word mode (running word + auto-spaces) | ✅ | ✅ | |
| Live waveform while keying | ✅ | ✅ | Both share [@dit/core](../packages/core) tone-level helpers; `ListenSineWave` accepts `liveActive` |
| Suppress raw dits/dashes from big stage | ✅ | ✅ | Stage shows resolved letter / running word; mid-input pattern reads as the wave + status text |
| Clear button | ✅ | ✅ | |
| Keyboard `N` to clear | 🚫 | ✅ | Web-only; tooltip on the Clear button surfaces the chip |

## Settings

Information architecture (section order, grouping, headers, collapse behavior, per-row platform availability) is shared via [`packages/core/src/settings/schema.ts`](../packages/core/src/settings/schema.ts). Web drives its render directly from the schema; iOS keeps its existing render code and asserts at dev time that its hardcoded section order matches the schema (so any drift is caught immediately). Control idioms (sliders vs steppers, RN Switch vs HTML toggle), modal chrome, and section card layout stay per-platform.

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
| Haptics on/off | ✅ | 🚫 | iOS-only since web has no haptic surface |
| Daily reminder | ✅ | 🚫 | Native notifications; web has no equivalent surface |
| Use recommended settings | ✅ | ✅ | Resets Practice toggles per `learnerProfile` |
| Replay NUX | ✅ | ✅ | Web exposes the action only in dev builds (per __DEV__/import.meta.env.DEV gating) |
| Cloud sync (sign in) | ✅ | ✅ | Apple, Google, Email all available |
| Delete account | ✅ | ✅ | |

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

Web shipped a redesign that splits the grid into status-based sections (Known by ear / Now learning / Not yet) and replaces the score-tinted cards with per-letter recognition bars driven by Listen TTR EMAs from `@dit/core`. iOS still ships the legacy score-tinted grid; iOS adoption of the new layout is deferred. Helpers `classifyLetter`, `getAverageRecognitionMs`, and `getRecognitionFillRatio` live in core so iOS can consume them when it adopts.

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Letter/number cards with Morse patterns | ✅ | ✅ | Web shows pattern only on mastered tiles ("train the ear" for in-progress letters) |
| Score-tinted cards | ✅ | 🚫 | Web replaced score tint with status sectioning + recognition bar |
| Sectioned by mastery status | 🚫 | ✅ | Web-only for now; iOS adoption deferred |
| Per-letter recognition bar (Listen TTR fill) | 🚫 | ✅ | Web only; `getRecognitionFillRatio` lives in core |
| Avg recognition (ms) summary | 🚫 | ✅ | Web only; `getAverageRecognitionMs` lives in core |
| Hero metric (mastered count or best WPM) | ✅ | ✅ | Web shows mastered count + total in stats card |
| Current streak | ✅ | ✅ | Both render in stats card |
| Today's correct count | ✅ | ✅ | Both render with progress bar |
| Guided course banner (pack/phase/letters) | ✅ | 🚫 | Web redesign drops the banner; the section grid carries the same signal |
| Tap card to play character | ✅ | ✅ | |
| Streak "at risk" treatment | ✅ | ✅ | Web tints the streak fill red when at-risk |

## Scoring & metrics

All computation lives in [packages/core/src/utils/retention.ts](../packages/core/src/utils/retention.ts) and runs on both platforms. The gap is *display*, not data.

| Metric | iOS computes | Web computes | iOS displays | Web displays |
|---|---|---|---|---|
| Per-letter score | ✅ | ✅ | ✅ | ✅ |
| `letterAccuracy` (rolling correctness) | ✅ | ✅ | ✅ | ✅ |
| `bestWpm` | ✅ | ✅ | ✅ | ✅ |
| `dailyActivity` (per-day correct + modes) | ✅ | ✅ | ✅ | ✅ |
| `streak` (current + longest + at-risk) | ✅ | ✅ | ✅ | ✅ |
| `hero` metric routing by profile | ✅ | — | ✅ | ✅ |

## Background behavior

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Liquid shader background | ✅ | ✅ | iOS: Skia GLSL via [MorseLiquidSurface.tsx](../apps/ios/src/components/MorseLiquidSurface.tsx). Web: WebGL port at [MorseLiquidSurface.tsx](../apps/web/src/components/MorseLiquidSurface.tsx). Hue and cycle constants share `shader` tokens in `@dit/core`. |
| Soft radial glow overlay | ✅ | ✅ | iOS: SVG radial gradients. Web: CSS `radial-gradient`. RGB and alpha values match across platforms. |
| Pause animation in Low Power Mode | ✅ | 🚫 | iOS: [hooks/useSystemLowPowerMode.ts](../apps/ios/src/hooks/useSystemLowPowerMode.ts). Web has no Low Power Mode API. |
| Pause animation when idle/backgrounded | ✅ | ✅ | iOS: `useBackgroundIdle`. Web: `document.visibilitychange` with 420ms / 320ms cross-fade. |
| Honor `prefers-reduced-motion` | ✅ | ✅ | Both freeze the shader at `t=0` instead of animating. |
| Reschedule daily reminder on foreground | ✅ | 🚫 | iOS-only by design |

## Analytics & telemetry

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Typed `AnalyticsClient` in `@dit/core` | ✅ | ✅ | 18-event union covers funnels, screens, milestones, settings, identity |
| `mode_start` / `onboarding_completed` / `streak_day_reached` | ✅ | ✅ | Fired from controller / onboarding actions |
| NUX step funnel (`nux_step_view` / `nux_step_complete` / `nux_step_skipped`) | 🟡 | ✅ | Web only via [useNuxStepTracker](../packages/core/src/hooks/useNuxStepTracker.ts); the hook lives in core and iOS can adopt it |
| Per-screen dwell time (`screen_view` / `screen_exit`) | ✅ | ✅ | Web uses `useScreenTracker`; iOS tracks AppShell screen state and also sends Firebase `screen_name` / `screen_class` |
| Activation milestones (`first_mode_session` / `first_correct_letter`) | ✅ | ✅ | Shared loose-event logger suppresses internal `mode_correct_answer`; web gates once per install via localStorage, iOS gates once per install via AsyncStorage plus an in-memory race guard |
| Guided phase progression (`guided_phase_advance` / `guided_phase_complete`) | ✅ | ✅ | Fired from `useMorseSessionController` to whichever client is wired |
| Learning method funnel (`learning_method_opened` / `learning_method_selected` / `learning_scope_selected`) | ✅ | ✅ | Captures Course vs Open practice discovery and selected scope without logging individual custom characters |
| Settings-changed events (debounced sliders) | 🟡 | ✅ | Web only in [SettingsPanel.tsx](../apps/web/src/components/SettingsPanel.tsx) |
| Phase-modal-dismissed event | 🟡 | ✅ | Web only in [PhaseModal.tsx](../apps/web/src/components/PhaseModal.tsx) |
| GA4 / Firebase `user_id` linkage on sign-in/out | 🟡 | ✅ | Web wires `analytics.setUserId(user?.uid ?? null)` |
| Event surface context (`app_surface`) | ✅ | ✅ | Adapters attach `ios` or `web` to emitted event params so shared Firebase/GA4 reports can be segmented |
| Analytics dev/test guard | ✅ | ✅ | Adapters skip emission in dev and test by default; release-like testing builds can opt out with `EXPO_PUBLIC_ANALYTICS_ENABLED=false` or `VITE_ANALYTICS_ENABLED=false` |
| Concrete adapter | ✅ | ✅ | Web: [apps/web/src/lib/analytics.ts](../apps/web/src/lib/analytics.ts) (GA4 via gtag). iOS: [apps/ios/src/analytics.ts](../apps/ios/src/analytics.ts) (Firebase Analytics with milestone translation and native screen reporting) |

---

## Intentional differences

These are not gaps. Don't open tickets to "fix" them.

### iOS-only by design

- **Haptics** (dit, dah, success) — no useful web equivalent
- **Home-screen widget (DitProgress)** — native-only surface
- **Daily local notification** — depends on iOS notification permissions; web has no equivalent app-foreground story
- **Low Power Mode / idle animation pause** — iOS battery story
- **Native date picker for reminder** — paired with the iOS-only reminder feature

### Web-only by design

- **Desktop keyboard shortcuts** (`F`/`L`/`P` mode switching, `N` clear in Freestyle, `Space` to key or replay, `Esc` close reference, and letter/digit keys to answer in Listen) — broad physical keyboard control is web's affordance. VBand-style left/right paddle keys in Practice/Freestyle are shared between web and iOS. The `H`/`W`/`Backspace` bindings referenced in older specs are not implemented.
- **Hover/focus tooltips** with optional shortcut chips on the logo, settings gear, morse key, Listen replay, and Freestyle clear — desktop affordance; iOS uses `accessibilityHint` instead.
- **Hardware-keyboard detection** that hides the on-screen Listen keyboard for fine-pointer devices.
- **Google popup auth flow** — different transport from iOS's native Google sign-in, same provider

### Shared but implemented natively per platform

- Audio playback (Web Audio API vs native via [@dit/dit-native](../modules/dit-native))
- Glass surfaces — iOS uses `expo-glass-effect` (`GlassView`), web uses CSS `backdrop-filter`. Same visual treatment, two primitives. The Morse key (`MorseButton`) shares dimensions, timings, accessibility labels, and the `MorseButtonState` type via [packages/core/src/components/morseButton](../packages/core/src/components/morseButton).
- Modal/sheet chrome (custom React vs UIKit / `@expo/ui`)
- Sign-in transport (Firebase popup vs native OAuth)

---

## How to use this doc

- **Before claiming web parity on a feature**, find its row here and update the status.
- **Before adding a feature to one platform**, decide if it should land on both. If web is intentionally skipping it, add a row under [Intentional differences](#intentional-differences) with a one-line reason.
- **When the spec changes**, update [APP_BEHAVIOR.md](APP_BEHAVIOR.md) first, then reconcile this table.
- Items marked ❓ need investigation; resolve them when you next touch the area.
