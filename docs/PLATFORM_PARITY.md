# Platform Parity: iOS vs Web

Tracks the current delta between `apps/ios` and `apps/web`, plus the differences we intend to keep. The canonical behavior spec is [APP_BEHAVIOR.md](APP_BEHAVIOR.md); this doc records where the two apps actually stand against it.

Update this when you ship a feature that closes (or opens) a gap.

October 4 learning parity work: iOS Words/Q codes, custom-text listening,
one-time hints, recognition feedback, revised intro illustrations, and
Settings sound check are implemented. The app now builds, installs, and launches
on the iOS 26.5 simulator. Intro slides, the single-line header, and initial
Conversation error recovery have received rendered review. The three intro
slides also fit the 375×667 iPhone SE simulator. New learning surfaces
remain 🟡 pending device audio, haptics, and active keyboard review. Native Firebase
AI Logic and App Check are wired. The iPhone 17 simulator development token is
registered, and attestation, model response, and native opener playback are verified.
A full two-way contact and physical-device audio/haptics remain pending.
Unit tests and TypeScript checks do not replace native review.

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
| Shared sign-in controls | ✅ | ✅ | iOS uses a sheet from Settings and welcome. Web uses a sheet in Settings and a full-screen stage during onboarding. |
| Delete account | ✅ | ✅ | Web has no native session to revoke; Firebase deleteUser handles it |
| Sign out | ✅ | ✅ | |

## NUX & onboarding

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Welcome screen | ✅ | ✅ | Both preserve the brand moment |
| Onboarding visual layout | ✅ | ✅ | Web uses an open background, subtle profile choices, unboxed tutorial/stages, and large first-letter typography. iOS retains its native layout. |
| Intro-slide illustrations | 🟡 | ✅ | Web replaces encoded patterns with animated recognition feedback, headphones, and whole-letter spacing, with static reduced-motion alternatives. iOS now uses whole-letter recognition, headphones, and equal-size letters whose gaps contract. Native visual review is pending. |
| Profile selection (new vs known) | ✅ | ✅ | Persists `learnerProfile` |
| Sound check | ✅ | ✅ | iOS: NUX step reads system volume when it looks low. Web: NUX step plus a Settings playback test row |
| Button tutorial (one dit + one dah) | ✅ | ✅ | |
| Welcome-screen sign-in options | ✅ | ✅ | iOS: Sign in / Stay signed out fade in after 2s. Web prototype: immediate Get started action and secondary sign-in link; sign-in replaces welcome content. |
| Visible Back control | 🚫 | ✅ | Web onboarding and tour expose Back; iOS retains swipe navigation. |
| Swipe left to go back | ✅ | ✅ | Backing up clears sound-check or Morse-key tutorial completion where needed |
| Tutorial haptics toggle | ✅ | 🚫 | iOS-only since web has no haptic surface |
| Daily reminder step | ✅ | 🚫 | Web has no notifications surface; auto-skipped in [NuxModal.tsx](../apps/web/src/components/NuxModal.tsx) |
| Known-user app tour | ✅ | ✅ | Web tour spotlights real header elements via getBoundingClientRect + portal |
| Post-onboarding intro hints (Morse key → Settings) | ✅ | 🟡 | iOS renders overlays; web advances persisted steps without overlay UI |
| `nuxCompleted` persisted to RTDB | ✅ | ✅ | |

## Practice mode

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Tap-to-input dit/dah | ✅ | ✅ | Both platforms accept VBand-compatible external paddle keys in the main Practice surface: left Control or `[` for dit, right Control or `]` for dah. iOS disables capture while sheets, modals, tour, sign-in, or Listen UI is active. |
| Play current target tone | ✅ | ✅ | |
| Hints toggle | ✅ | ✅ | |
| Mnemonics toggle | ✅ | ✅ | |
| One-time "Show this hint" | 🟡 | ✅ | Both expose a button when global hints are off, outside the guided course. The hinted attempt is unscored. Web also binds `N`. iOS native review pending. |
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
| Listen word recognition | 🟡 | ✅ | Both offer separate Common words (Practice English bank) and Q codes vocabularies. Four choices stay concealed during playback; Q-code answers also teach the meaning. Word results are session-only and do not affect per-letter stats. iOS uses the shared round hook; native playback review pending. |
| Time-to-respond indicator | ✅ | ✅ | Already wired as `listenTtrText` in both StageDisplay implementations. No new feature required. |
| Custom text playback (head copy) | 🟡 | ✅ | Both accept a private passage and optional copy with a character diff. iOS adds native pause/resume and an audio clock, local AsyncStorage persistence, and a system copy keyboard. Native audio/haptic review pending. |

## Freestyle mode

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Tap-and-pause to submit | ✅ | ✅ | Both platforms accept VBand-compatible external paddle keys in the main Freestyle surface: left Control or `[` for dit, right Control or `]` for dah. iOS disables capture while sheets, modals, tour, sign-in, or Listen UI is active. |
| Word mode (running word + auto-spaces) | ✅ | ✅ | |
| Live waveform while keying | ✅ | ✅ | Both share [@dit/core](../packages/core) tone-level helpers; `ListenSineWave` accepts `liveActive` |
| Suppress raw dits/dashes from big stage | ✅ | ✅ | Stage shows resolved letter / running word; mid-input pattern reads as the wave + status text |
| Clear button | ✅ | ✅ | |
| Keyboard `N` to clear | 🚫 | ✅ | Web-only; tooltip on the Clear button surfaces the chip |

## Conversation mode

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Practice a CW QSO against an LLM | 🟡 | ✅ | Both share the session, station prompt, callsign rules, and model. iOS uses native Firebase AI Logic with App Check. Native rebuild, App Check, model connectivity, and received-opener playback verified on iPhone 17. Full two-way contact and physical-device review pending. |
| Explicit AI sharing permission | 🟡 | ❌ | iOS asks before each contact, with Cancel remaining idle and Allow starting the chosen direction. Retries reuse that contact's permission. Automated behavior verified; rendered alert review pending. Web has no equivalent prompt. The shared privacy page source includes AI sharing but deployment remains pending. |
| Keyed replies decode into a running draft | 🟡 | ✅ | Shared straight-key and paddle engine, automatic spaces, Backspace, Clear, and Send. iOS hardware capture yields to copy text entry. Native input review pending. |
| Optional reception copy grading | 🟡 | ✅ | After playback, reception stays editable until **Reply** on iOS or **Start my turn** on web. Web allows showing/hiding copy during keying. iOS checks copy before the handoff, then shows only the draft and fixed bottom key; Replay returns to reception. Copy and grading remain optional on both platforms. New native turns open at the latest controls, and older transcript entries remain scrollable. Empty drafts show one Reply prompt; concealed transcript entries use Reveal. iPhone 17 reviewed; smaller-device review pending. |
| In-QSO prosign reference | 🟡 | ✅ | Plain meanings without encoded patterns. Web uses a side reference or bottom sheet; iOS uses a collapsible non-modal reference above the transcript, leaving the key usable. Native visual review pending. |
| Pause / Resume / Replay / Retry | 🟡 | ✅ | iOS uses the native sample clock and completion callback. Late station replies are discarded after End, reset, or exit. Failed SDK chats are recreated with accepted history on both platforms so Retry can reach the server again. Audio failures retry playback of the accepted response without another AI request on both platforms. Physical-device audio/haptic review pending. |

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
| Sound check | 🟡 | ✅ | Both now expose a Settings playback test using global speed/pitch. iOS also checks system volume during NUX. Native Settings review pending. |
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

Web adds status-based sections (Known by ear / Now learning / Not yet) and per-letter recognition bars driven by Listen TTR EMAs from `@dit/core`. Both platforms tint mastered letters with the same relative score helpers in core. iOS now implements these sections, recognition bars, and the average recognition summary; native visual review is pending. Helpers `classifyLetter`, `getAverageRecognitionMs`, and `getRecognitionFillRatio` live in core for when iOS adopts.

| Feature | iOS | Web | Notes |
|---|---|---|---|
| Letter/number cards with Morse patterns | ✅ | ✅ | Both show patterns on mastered tiles, with "Train the ear" for in-progress iOS letters. iOS change awaits native review. |
| Score-tinted cards | ✅ | ✅ | Both tint mastered letters via shared `@dit/core` relative score helpers; both now implement status sections and recognition bars |
| Sectioned by mastery status | 🟡 | ✅ | Known by ear / Now learning / Not yet on both platforms. iOS native visual review pending. |
| Per-letter recognition bar (Listen TTR fill) | 🟡 | ✅ | Both use `getRecognitionFillRatio` from core. iOS native visual review pending. |
| Avg recognition (ms) summary | 🟡 | ✅ | Both use `getAverageRecognitionMs` from core. iOS native visual review pending. |
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
| Pause animation in Low Power Mode | ✅ | 🚫 | iOS: [hooks/useSystemLowPowerMode.ts](../apps/ios/src/hooks/useSystemLowPowerMode.ts); active foreground QSOs bypass this pause. Web has no Low Power Mode API. |
| Pause animation when idle/backgrounded | ✅ | ✅ | iOS: active foreground QSOs keep moving without interaction until ended. Outside a QSO, `useBackgroundIdle` freezes the visible frame after ten seconds. Web: `document.visibilitychange` with 420ms / 320ms cross-fade for hidden tabs. |
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
| GA4 / Firebase `user_id` linkage on sign-in/out | ✅ | ✅ | Both call `analyticsClient.setUserId` from auth state |
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

- **Desktop keyboard shortcuts** (`F`/`L`/`P`/`C` mode switching, `N` for the shared one-time Practice hint or web Freestyle clear depending on mode, `Space` to key or replay, `Esc` close reference, and letter/digit keys to answer in Listen) are a broad web affordance. VBand-style left/right paddle keys work in Practice, Freestyle, and Conversation on web, and in Practice, Freestyle, and Conversation on iOS. `Enter` sends a Conversation draft or advances an answered Listen Words/Q codes round. Keyboard `Backspace` edits the outgoing Conversation draft during your turn. The `H`/`W` bindings referenced in older specs are not implemented.
- **Post-onboarding intro hints** (Morse key callout, then Settings spotlight) — iOS renders overlay UI; web advances the persisted hint step without showing those overlays (opening Settings still dismisses the settings step).
- **Hover/focus tooltips** with optional shortcut chips on the logo, settings gear, morse key, Listen replay, and Freestyle clear — desktop affordance; iOS uses `accessibilityHint` instead.
- **Hardware-keyboard detection** that hides the on-screen Listen keyboard for fine-pointer devices.
- **Google popup auth flow** — different transport from iOS's native Google sign-in, same provider

### Shared but implemented natively per platform

- Audio playback (Web Audio API vs native via [@dit/dit-native](../modules/dit-native))
- Glass surfaces — iOS uses `expo-glass-effect` (`GlassView`) when Liquid Glass is available and an `expo-blur` fallback on iOS versions before 26; web uses CSS `backdrop-filter`. Same visual treatment, platform-specific primitives. The Morse key (`MorseButton`) shares dimensions, timings, accessibility labels, and the `MorseButtonState` type via [packages/core/src/components/morseButton](../packages/core/src/components/morseButton).
- Modal/sheet chrome (custom React vs UIKit / `@expo/ui`)
- Sign-in transport (Firebase popup vs native OAuth)

---

## How to use this doc

- **Before claiming web parity on a feature**, find its row here and update the status.
- **Before adding a feature to one platform**, decide if it should land on both. If web is intentionally skipping it, add a row under [Intentional differences](#intentional-differences) with a one-line reason.
- **When the spec changes**, update [APP_BEHAVIOR.md](APP_BEHAVIOR.md) first, then reconcile this table.
- Items marked ❓ need investigation; resolve them when you next touch the area.
