# NUX educational slides — design

## Goal

Add three short educational slides to the first-run flow, right after profile selection, to frame Dit's approach before the user touches the key. These slides are the app's one chance to explain *why* it teaches the way it does, and to set expectations about what "real Morse fluency" means here.

## Placement

Insert three new steps between `profile` and `sound_check`. Both learner paths (`beginner` and `known`) see the same slides. The known-Morse user swipes through faster; the signal that "this app respects the method" still lands for them.

New flow:

```
welcome
  → profile
  → intro_fluency      ← new
  → intro_listen       ← new
  → intro_speed        ← new
  → sound_check
  → button_tutorial
  → known_tour | beginner_stages → beginner_intro
  → reminder
```

## Slide content (final copy)

### Slide 1 — `intro_fluency`

> **Real Morse fluency.**
>
> Science-backed training, instant feedback, and smart review that targets your weakest letters.

### Slide 2 — `intro_listen`

> **No chart. Just listen.**
>
> Experienced operators don't count dots and dashes. They hear each letter the way you hear your name. Dit trains that reflex from the start.

### Slide 3 — `intro_speed`

> **Real speed from day one.**
>
> Slow letters teach you to count. Dit uses the **Koch method**, which keeps every character at a usable speed. The gaps between letters start roomy and tighten as you improve, so you always have time to think.

Copy rules applied: no em dashes, "usable speed" rather than "full speed", Koch named, Farnsworth concept kept but name omitted.

## Interaction

Each slide is passive: headline, body copy, illustration, no interactive element. The CTA slot shows a single **Continue** button that advances to the next slide. After slide 3, Continue advances to `sound_check`.

Swipe-forward gesture on iOS is not required for v1. Continue button is the primary advance. If we want swipe later, the existing directional `useStepTransition` already animates in that direction so the gesture just needs to trigger the same step change.

No back navigation. Matches the rest of the NUX flow (which is also forward-only).

## Illustrations

All three slides share a "translation" visual grammar: a ghosted "from" state on the left, an orange "to" state on the right, a thin arrow between them, mono uppercase labels at the bottom. The arrow represents a transformation Dit performs. Same grammar across all three slides makes the set feel coherent.

Implementation: inline SVG per slide (no Lottie, no image assets). Stroke widths, colors, and typography pull from existing tokens (`accent.wave` for the orange signal, `text.primary` / `text.primary40` for labels, SF Mono for ticks).

### Slide 1 — "Real Morse fluency"

- **Left (ghost):** a vertical stack of 5 letters representing weakest-learned characters (e.g., K, Q, Z, X, J), each followed by a small mono "×N" miss-count tick. Opacity ~0.35.
- **Arrow:** thin horizontal arrow pointing right, at vertical center.
- **Right (signal):** one letter pulled from the stack, rendered large (48px, 600 weight) in accent orange, with its Morse pattern drawn as a small square-wave trace below in the same orange.
- **Bottom labels:** `WEAKEST` (left) and `MASTERED` (right), mono 9px, `text.primary40`, letterspacing 0.1em.

### Slide 2 — "No chart. Just listen."

- **Left (ghost):** a 5-row chart table (A / N / R / T / E) with each letter's dit/dah pattern rendered in mono text. Opacity ~0.4.
- **Arrow:** thin horizontal arrow pointing right, at vertical center.
- **Right (signal):** a flowing waveform in accent orange, ~2.5px stroke, no chart reference.
- **Bottom labels:** `DECODE` (left) and `HEAR` (right).

### Slide 3 — "Real speed from day one"

- **Top row (ghost):** four letters (N, R, A, T) rendered as dit/dah pattern bars with wide inter-letter gaps. Opacity ~0.4. Label above: `12 / 8 WPM` (mono).
- **Arrow:** thin vertical arrow, pointing down, at horizontal center between rows.
- **Bottom row (signal):** same four letters, same pattern bars, tight gaps, accent orange. Label above: `12 / 12 WPM` (mono).
- Using Dit's Farnsworth notation as the row labels rewards users who notice the pattern ("same first number, second number changes") without demanding they understand it. Casual readers just read it as "two speeds."

## Motion

Each slide's ghost side (left or top) renders with the step-entrance animation as part of the `useStepTransition` body. After the body has settled, the signal side (right or bottom, orange) and the arrow stagger in:

- Arrow: short draw-in (stroke dash animation) or opacity fade, ~200ms, `BEZIER.out`.
- Signal: translateX or translateY from 8px offset + opacity fade, ~340ms, staggered 60ms after the arrow.
- Slide 3 bottom row additionally animates its gap-width: starts at the wide spacing, contracts to the tight spacing over ~600ms once in view.

All motion uses existing `TIMING` and `BEZIER` tokens. Extends the existing `useSlideStagger` pattern rather than introducing new primitives.

### Reduce motion

- Ghost + signal + arrow all render immediately at their final state, no translateX/Y or stroke draw.
- Slide 3 renders at the tight spacing directly; no gap-width interpolation.
- Step-level enter/exit fade still runs (matches the rest of the NUX under reduce-motion).

## Future: character illustrations

Explicitly deferred: a character-illustration variant (a drawn operator, an ear, etc.) was considered and parked. If we revisit later, that direction would justify adding `lottie-react-native` / `lottie-web`. Current choice is SVG-only line art, no animation library.

## Step transitions

Reuse the existing `useStepTransition` on iOS and the existing `bodyExiting` CSS transition on web. The three new steps behave like any other NUX step: the body slides left on exit, the next slides in from the right. No new animation code.

## Progress dots

Group all three intro steps under a single progress-dot position. This preserves the sense that "this is one chapter of the intro" and keeps total dot count manageable (goes from 5 → 6, not 5 → 8).

### iOS (`apps/ios/src/components/NuxModal.tsx`)

Update `progressIndexByStep`:

```ts
const progressIndexByStep: Record<NuxStep, number> = {
  welcome: -1,
  profile: 0,
  intro_fluency: 1,
  intro_listen: 1,
  intro_speed: 1,
  sound_check: 2,
  button_tutorial: 3,
  known_tour: 4,
  beginner_stages: 4,
  beginner_intro: 4,
  reminder: 5,
}
```

Change `ProgressDots` `total` from `5` to `6`.

### Web (`apps/web/src/components/NuxModal.tsx`)

Update `STEP_ORDER`:

```ts
const STEP_ORDER: readonly NuxStep[] = [
  'welcome',
  'profile',
  'intro_fluency',
  'intro_listen',
  'intro_speed',
  'sound_check',
  'button_tutorial',
  'known_tour',
  'beginner_stages',
  'beginner_intro',
]
```

Web already derives active index from array position. To match the iOS grouping (one dot for the three intro steps), the web `ProgressDots` needs to collapse `intro_*` into a single visual dot. Web also skips `reminder` (the component returns `null` during that step) and treats `welcome` as the full-screen logo moment without dots. So web's display array should be: `welcome` (always past once dots appear), `profile`, `intro` (covers all three intro steps), `sound_check`, `button_tutorial`, and the stage group (`known_tour` / `beginner_stages` / `beginner_intro` all map here). Map the current `NuxStep` to whichever display slot owns it when computing `activeIndex`.

## Component changes

### `packages/core/src/utils/appState.ts`

Extend `NuxStep` type:

```ts
export type NuxStep =
  | 'welcome'
  | 'profile'
  | 'intro_fluency'
  | 'intro_listen'
  | 'intro_speed'
  | 'sound_check'
  | 'button_tutorial'
  | 'known_tour'
  | 'beginner_stages'
  | 'beginner_intro'
  | 'reminder'
```

### `packages/core/src/hooks/useOnboardingState.ts`

Add the three new values to `NUX_STEP_VALUES` so persistence validation accepts them. Persisted flows that resume mid-intro will land back on the correct slide.

### `packages/core/src/hooks/useOnboardingActions.ts`

After `onChooseProfile`, advance to `intro_fluency` instead of directly to `sound_check`. Add new actions:

- `onContinueFromIntroFluency` → `setNuxStep('intro_listen')`
- `onContinueFromIntroListen` → `setNuxStep('intro_speed')`
- `onContinueFromIntroSpeed` → `setNuxStep('sound_check')`

These follow the same one-action-per-step pattern as existing advances (`onContinueFromSoundCheck`, `onContinueFromStages`, etc.).

### NuxModal (both platforms)

Add three new `displayedStep === 'intro_*'` branches rendering:

- `.nux-copy` block (headline + body paragraph)
- Continue CTA in the `.nux-cta-slot`

No new reusable subcomponent needed — each slide is five lines of JSX. If a fourth slide is added later, refactor then.

## Skip / replay

- Replay NUX from Settings goes through the new slides the same as a fresh install.
- Resuming from persisted state respects whichever intro slide the user last saw.
- Legacy persisted state with only the old step values continues to parse correctly (the union gained members, `isNuxStep` still rejects anything else).

## Testing

- Unit: `packages/core/tests/unit/useOnboardingState.test.ts` — add cases that parse persisted state at each `intro_*` step.
- Unit: `packages/core/tests/unit/useOnboardingActions.test.ts` — cover the three new advance actions and verify `onChooseProfile` now lands on `intro_fluency`.
- Unit (web, iOS): `NuxModal` renders each new slide's headline and body, Continue advances, progress-dot grouping puts all three on the same dot.
- Manual: fresh launch → beginner path; fresh launch → known path; kill + relaunch mid-intro resumes on the same slide.

## Out of scope

- Swipe-to-advance gesture on iOS (can be added later; transitions already support it).
- Interactive demos (e.g., "tap to hear R at 5 WPM vs. 12 WPM"). Decided against in brainstorming; passive slides only.
- Known-path abbreviation. Both paths see all three slides.
- Named Farnsworth spacing. Concept is kept on slide 3, name omitted per direction.
- Character illustrations / Lottie. Parked for a possible later iteration.

## Open questions

None. Ready to plan.
