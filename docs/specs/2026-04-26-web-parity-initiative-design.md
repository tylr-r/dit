# Web Parity Initiative: Design

Date: 2026-04-26
Status: Approved
Related: [docs/APP_BEHAVIOR.md](../APP_BEHAVIOR.md), [docs/PLATFORM_PARITY.md](../PLATFORM_PARITY.md)

## Goal

Bring `apps/web` to feature parity with `apps/ios` per the canonical behavior spec. Items intentionally scoped to iOS (haptics, home-screen widget, daily reminder, low-power-mode animation pause) remain 🚫 and are not part of this initiative.

Success means every row in [PLATFORM_PARITY.md](../PLATFORM_PARITY.md) that is currently ❌ or 🟡 (and not 🚫) becomes ✅.

## Phasing

The work splits into 5 PRs by surface area. Each PR is independently reviewable and shippable. Each PR ends by flipping the relevant rows in PLATFORM_PARITY.md from ❌/🟡 to ✅.

### PR1: Settings parity + metrics wiring

Smallest risk; pure UI + state wiring; validates the shared-core round-trip before bigger PRs.

**Add to [SettingsPanel.tsx](../../apps/web/src/components/SettingsPanel.tsx):**
- Auto-play sound toggle (`practiceAutoPlay`)
- Sequential order toggle (`practiceLearnMode`)
- IFR mode toggle
- Review misses later toggle
- "Use recommended settings" button (resets Practice toggles per `learnerProfile`)
- "Replay NUX" button (re-runs onboarding)

**Wire 🟡 metric displays in [ReferenceModal.tsx](../../apps/web/src/components/ReferenceModal.tsx):**
- Verify `letterAccuracy` is read and rendered (already passed in via App.tsx:741-748)
- Verify `bestWpm` displays for known-user hero metric path
- Verify `dailyActivity` and today's correct count render
- Resolve any wiring gaps found during verification

All fields exist in [packages/core/src/types.ts](../../packages/core/src/types.ts) and round-trip through [packages/core/src/utils/morseUtils.ts](../../packages/core/src/utils/morseUtils.ts). The gap is web display, not data plumbing.

### PR2: Learning sheet + custom letters

Highest behavior-change PR; covers the largest missing surface on web.

**New `apps/web/src/components/LearningSheet.tsx`** mirroring the structure of [iOS LearningSheet](../../apps/ios/src/components/LearningSheet.tsx):
- Segmented Course / Open practice control bound to `guidedCourseActive`
- Course view: scrollable pack list with current pack highlighted and packs below `guidedMaxPackReached` shown as completed
- Open practice view: tier presets (Beginner / Common / Full alphabet / Full + digits) plus "Pick your own ›" entry
- "Pick your own" swap-in: 36-character grid (A–Z + 0–9), tappable chips, selected count in subtitle, Apply button persists `customLetters`

**Settings entry point:**
- Replace the existing max-level stepper with a "Learning ›" disclosure row that opens the sheet
- Sheet opens at App root so it survives Settings unmounting (mirroring iOS pattern)

**Core integration:**
- `customLetters` field already exists in core types and is parsed by `morseUtils.ts`. Verify the write path is wired on web (likely needs the same handler iOS uses)
- When `customLetters` is non-empty and guided mode is off, `activeLetters` resolves to the custom set

**Tier preset levels** match iOS exactly; see [PLATFORM_PARITY.md](../PLATFORM_PARITY.md) "Learning configuration" section and APP_BEHAVIOR.md lines 65-69.

### PR3: Auth expansion

**Pre-PR config check:** Confirm the Firebase project has Apple and Email/Password providers enabled before writing code. If they aren't enabled, block on user enabling them in Firebase console.

**New `apps/web/src/components/SignInSheet.tsx`** mirroring [iOS SignInSheet](../../apps/ios/src/components/SignInSheet.tsx):
- Bottom-sheet pattern matching web's design language (don't mimic iOS chrome)
- Provider list: Continue with Apple, Continue with Google, Continue with Email
- Email form swap-in: email field, password field, primary "Sign in", secondary "Create account", back chevron
- Form state resets on sheet dismiss
- Errors render inline above the primary button
- Bad-credential message collapses to `"Email or password is incorrect."` (matches iOS spec for Firebase v11+ enumeration resistance)

**Apple sign-in** via Sign in with Apple JS (web SDK). No native bridge needed.

**Email auth:**
- Sign in: `signInWithEmailAndPassword`
- Create account: `createUserWithEmailAndPassword` (no confirm-password field, no email verification flow in v1)

**Delete account flow:**
- New action in Settings under Account group
- Removes Firebase user and synced progress
- Confirmation dialog before destructive action

**Settings refactor:**
- Replace current Google-only popup with the unified sheet entry point
- Account group shows single "Sign in" row when signed out; on success, sheet dismisses and Settings stays open showing the signed-in state

### PR4: Reference modal extras

**Tap-to-play on cards:**
- Each card gets `onClick` that plays the character at reference WPM
- Reuse the Practice play path

**Streak "at risk" treatment:**
- Visual treatment when user has an active streak but hasn't yet hit today's 15-correct goal
- Mirror iOS visual cue (consistent with web's design language)

**Guided course banner:**
- When `guidedCourseActive`, show current pack name, phase (teach/practice), and pack letters
- Position consistent with iOS placement

**Hero metric profile-aware routing:**
- Beginner profile shows mastered letters / total
- Known-user profile shows `bestWpm`
- Branch on `learnerProfile`, mirroring iOS logic in `retention.ts:182`

### PR5: NUX welcome sign-in fork + known-user tour

**Welcome screen sign-in fork** in [NuxModal.tsx](../../apps/web/src/components/NuxModal.tsx):
- Signed-out users see Sign in / Stay signed out options fade in ~2s after paint
- Sign in opens the `SignInSheet` from PR3
- Stay signed out advances to profile selection (current behavior)
- Already-signed-in users see the existing tap-anywhere advance (so replay-NUX doesn't re-prompt for auth)

**Restore-progress on sign-in:**
- Mirror iOS `applyParsedProgress` heuristic
- If loaded snapshot has `nuxCompleted === true` or `hasMeaningfulRemoteProgress` (learner profile, guided course active, or non-zero scores), mark NUX `'skipped'` locally and land in main app
- Otherwise NUX continues at profile selection

**Known-user app tour:**
- Web-native implementation. Do NOT literal-port the React Native [TourOverlay](../../apps/ios/src/components/tour/TourOverlay.tsx).
- Spotlight overlay using `getBoundingClientRect` to target elements + React portal for the overlay layer
- Same step sequence as iOS

## Cross-cutting rules

- Each PR updates [PLATFORM_PARITY.md](../PLATFORM_PARITY.md) to flip the relevant rows
- Each PR runs `pnpm run lint` and `pnpm run test:unit:run` clean before merge
- New components get Vitest coverage following [apps/web/src/test/](../../apps/web/src/test/) patterns
- No new production dependencies without confirming with the user (per [AGENTS.md](../../AGENTS.md))
- Web matches its own design language; never mimic UIKit, glass effect chrome, or native iOS visuals
- Code style: 2-space indent, single quotes, no semicolons, no em dashes

## Open verification items

These don't gate the plan. Resolve them as part of the PR they touch.

- **PhaseModal behavior on misses.** Verify [apps/web/src/components/PhaseModal.tsx](../../apps/web/src/components/PhaseModal.tsx) matches spec. Fold any fix into PR1.
- **"Return to lesson" button.** Verify presence on web; if missing, fold into PR1 or PR2.
- **Listen "time-to-respond indicator".** APP_BEHAVIOR.md line 147 mentions it but I couldn't locate it on iOS or web. As part of PR4 (or a dedicated investigation), either find it on iOS and schedule a follow-up PR for web, or update APP_BEHAVIOR.md and PLATFORM_PARITY.md to remove the claim.

## Out of scope

Per the parity doc's [Intentional differences](../PLATFORM_PARITY.md#intentional-differences) section, none of these are part of this initiative:

- **Daily reminder on web.** Confirmed in brainstorming; no service worker push initiative.
- **Haptics.** No useful web equivalent.
- **Home-screen widget (DitProgress).** Native-only surface.
- **Low Power Mode / idle animation pause.** iOS battery story; web has no LPM API.
- **Native date picker for reminder.** Paired with iOS-only reminder.

## Risks

- **Firebase config gating PR3.** Apple and Email providers must be enabled in console before code work begins.
- **Custom letters write path on web.** Field is parsed in core, but the write path may not be wired on web. Verify in PR2.
- **Tour overlay positioning.** Web tour relies on `getBoundingClientRect`; layout shifts during the tour could mis-position the spotlight. Plan: re-measure on resize and after step transitions.
- **`SignInSheet` reuse across PRs.** PR5 depends on PR3's sheet. If PR3 slips, PR5 either waits or uses a temporary fallback.

## Sequencing dependency

```
PR1 (Settings + metrics) ─┐
                          ├─ independent, can ship in any order
PR2 (Learning sheet) ─────┤
                          │
PR4 (Reference extras) ───┘
PR3 (Auth) ────────────────┐
                           ├─ PR5 depends on PR3
PR5 (NUX + tour) ──────────┘
```

PR1, PR2, PR4 are mutually independent. PR3 and PR5 form a chain.
