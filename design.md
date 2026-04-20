# DESIGN.md

Canonical design reference for Dit. Covers visual, motion, and interaction
decisions only — implementation, architecture, and app behavior live
elsewhere (`CLAUDE.md`, `docs/APP_BEHAVIOR.md`, `docs/STYLE_GUIDE.md`).

Token source of truth:
- `apps/ios/src/design/tokens.ts` — colors, spacing, radii
- `apps/ios/src/components/nux/animationTokens.ts` — TIMING, BEZIER, SPRING

If a value here disagrees with code, update the code.

---

## 1. Visual Theme & Atmosphere

- **Mood:** instrument-like, precise, quiet. The UI supports the sound, it
  does not compete with it.
- **Density:** generous whitespace. One primary action per screen.
- **"Premium" here means:** tight timing, custom easing, haptics that
  mirror the Morse audio. It does *not* mean glows, gradients, or ambient
  decoration.

---

## 2. Color Palette & Roles

All HSL. Opacities derive from a single hue per role.

### Brand hues

| Role    | Hue | Use                                 |
| ------- | --- | ----------------------------------- |
| primary | 24  | Warm orange — brand, accent, ink    |
| liquid  | 207 | Vivid blue — shaders, dark surfaces |
| success | 154 | Green — confirmation only           |
| error   | 0   | Red — errors only                   |

### Text (ink)

| Token            | Value                         | Use                          |
| ---------------- | ----------------------------- | ---------------------------- |
| `text.primary`   | `hsl(24, 29%, 97%)`           | Headlines, active copy       |
| `text.primary90` | `hsla(24, 29%, 97%, 0.9)`     | Near-primary, high-emphasis  |
| `text.primary80` | `hsla(24, 29%, 97%, 0.8)`     | De-emphasized primary        |
| `text.primary70` | `hsla(24, 29%, 97%, 0.7)`     | Between body and primary     |
| `text.primary60` | `hsla(24, 29%, 97%, 0.6)`     | Secondary copy               |
| `text.primary40` | `hsla(24, 29%, 97%, 0.4)`     | Hints, disabled, meta labels |
| `text.primary20` | `hsla(24, 29%, 97%, 0.2)`     | Separators, connector lines  |

### Accent

| Token         | Value                | Use                           |
| ------------- | -------------------- | ----------------------------- |
| `accent.wave` | `hsl(24, 100%, 65%)` | Active progress, ripple rings |

### Surfaces

| Token                   | Value                       | Use                            |
| ----------------------- | --------------------------- | ------------------------------ |
| `surface.solidBackdrop` | `hsla(207, 40%, 4%, 1)`     | App background                 |
| `surface.backdrop`      | `hsla(207, 40%, 4%, 0.72)`  | Full-screen modal backdrop     |
| `surface.backdropSoft`  | `hsla(207, 40%, 4%, 0.35)`  | Soft scrim                     |
| `surface.panelStrong`   | `hsla(207, 33%, 7%, 0.92)`  | Cards, option cards, chips     |
| `surface.panel`         | `hsla(0, 0%, 0%, 0.4)`      | Panels over content            |
| `surface.card`          | `hsla(209, 34%, 12%, 0.45)` | Secondary cards                |
| `surface.input`         | `hsla(0, 0%, 100%, 0.06)`   | Text inputs, inactive toggles  |
| `surface.inputPressed`  | `hsla(0, 0%, 100%, 0.12)`   | Pressed inputs                 |

### Borders

| Token           | Value                     |
| --------------- | ------------------------- |
| `border.subtle` | `hsla(0, 0%, 100%, 0.12)` |
| `border.error`  | `hsla(0, 100%, 71%, 0.4)` |

### Feedback

| Token              | Value                | Use                       |
| ------------------ | -------------------- | ------------------------- |
| `feedback.success` | `hsl(154, 88%, 58%)` | Checkmarks, confirmed state |
| `feedback.error`   | `hsl(0, 100%, 71%)`  | Error text, error state   |

**Semantic rules.**
- Success green is for *confirmation of a check*, not selection or reward. A
  checkmark may be green; a selected card may not.
- Accent orange signals *direction or progress*. Do not use orange for
  success or error.
- Never introduce a new text shade — use the `primary{20,40,60,70,80,90}`
  scale.

### Forbidden

- **No gradients behind content.** We tried an aurora-style radial gradient
  on welcome and removed it — pulled focus from the logo.
- **No decorative glows.** Profile-card green halo, CTA success-glow pulse,
  and sound-check green wash were all removed for the same reason.

---

## 3. Typography

System font (SF Pro on iOS, matching system stack on web).

### Hierarchy

| Role          | Size | Weight | Color                   |
| ------------- | ---- | ------ | ----------------------- |
| Welcome title | 32   | 600    | `text.primary`          |
| Headline      | 22   | 600    | `text.primary`          |
| Stage title   | 20   | 600    | `text.primary`          |
| Option title  | 18   | 600    | `text.primary`          |
| CTA label     | 17   | 600    | `text.primary`          |
| Letter chip   | 26   | 700    | `text.primary`          |
| Stage number  | 16   | 700    | interpolates to primary |
| Body          | 14   | 400    | `text.primary60`        |
| Pip label     | 13   | 600    | `text.primary40`        |
| Pip hint      | 13   | 400    | `text.primary40`        |

Body line-height: 20. Others: default.

### Rules

- **Weights: 400 / 600 / 700 only.** No 500, no 300, no italic.
- **Sentence case** for headlines, titles, body.
- **UPPERCASE** only for short meta labels (e.g. "TAP", "HOLD"), with
  `letterSpacing: 0.8`. Never uppercase a sentence.
- **Hint-in-parens** pairs an action with a Morse term: `Tap (dit)`,
  `Hold (dah)`. Action first, term in parens at 400 weight with
  `letterSpacing: 0.4`.
- **Buttons commit in 2–3 words.** "Continue", "Start first lesson". Never
  "Next" or "OK".
- **No exclamation points. No marketing voice.**

---

## 4. Components

### Primary CTA (`DitButton`)

| Property | Value                            |
| -------- | -------------------------------- |
| Radius   | `pill` (999)                     |
| Height   | 48 (fixed via `CTA_SLOT_HEIGHT`) |
| Padding  | 16 vertical                      |
| Text     | 17 / 600 / `text.primary`        |
| Press    | scale 0.97, 120ms `BEZIER.out`   |
| Disabled | opacity 0.4, no press response   |

### Morse key (`MorseButton`)

| Property | Value                       |
| -------- | --------------------------- |
| Width    | `min(screen - 48, 480)`     |
| Height   | 96                          |
| Radius   | 48                          |

### Pressable (`ScalePressable`)

Generic tappable surface. Press scale 0.97, `TIMING.press` (120ms). Currently
a local helper inside `NuxModal.tsx`. Extract it if a second file needs the
same behavior — don't duplicate it.

### Option card

| Property    | Value                                          |
| ----------- | ---------------------------------------------- |
| Background  | `surface.panelStrong`                          |
| Border      | 1px `border.subtle`                            |
| Radius      | `radii.lg` (20)                                |
| Padding     | `spacing.xl` (24)                              |
| Child gap   | `spacing.sm` (8)                               |
| Selection   | scale 1.02 over 200ms `BEZIER.out`. No color change, no shadow. |

### Stage card

44px ring (1.5px stroke) with 16px number centered. Number color
interpolates `text.primary40` → `text.primary` as the ring draws. Title
20/600, description 14/400 centered below. 6px gap between ring, title,
description.

### Letter chip (`LetterDealChip`)

72×72, `radii.lg` (20), `surface.panelStrong` background, 1px
`border.subtle`. Letter 26/700. Entrance flips like a dealt card: rotateY
90→0, scale 0.7→1, opacity 0→1, spring `RSPRING.soft`. Under reduced
motion, opacity fades in over 240ms with no transform.

### Inputs

Background `surface.input`, shifts to `surface.inputPressed` on focus.
`radii.md` (14). No border — the background shift carries the affordance.

### Progress dots

| State    | Width | Color              |
| -------- | ----- | ------------------ |
| Inactive | 6     | `text.primary40`   |
| Active   | 18    | `accent.wave`      |
| Done     | 6     | `text.primary80`   |

Transition: `TIMING.snap` (160ms).

### Tutorial pip

Empty: 1px `text.primary40` border, transparent fill. Filled: `accent.wave`
background, no border.

### Connector line (stage-to-stage)

1px, `text.primary20`, 28px tall inside a 44px wrap (8px breathing room top
and bottom). Draw: scaleY 0→1 from top, `TIMING.connector` (700ms),
`BEZIER.inOut`.

### Icons

- iOS: SF Symbols via `expo-symbols`.
- Android fallback: `MaterialIcons`.
- Sizes: 22 inline, 28 standalone.
- Color inherits from surrounding text token — no custom colorizing.

---

## 5. Layout

### Spacing scale

| Token | Value | Use                        |
| ----- | ----- | -------------------------- |
| `xs`  | 4     | Tight grouping, icon gaps  |
| `sm`  | 8     | Paragraph gap, small stack |
| `md`  | 12    | Control gap                |
| `lg`  | 16    | Section gap                |
| `xl`  | 24    | Card padding, screen edge  |

No one-off values (`10`, `18`, `20`, etc). Extend the scale instead.

### Radii scale

| Token        | Value | Use                         |
| ------------ | ----- | --------------------------- |
| `sm`         | 10    | Small pressables, pips      |
| `md`         | 14    | Inputs, secondary cards     |
| `lg`         | 20    | Cards, chips                |
| `pill`       | 999   | CTAs, active progress dots  |
| `iconCircle` | 36    | Circular icon containers    |

### Structure

- **Safe areas:** `useSafeAreaInsets()` on iOS. Never hardcode notch offsets.
- **One primary action per screen.** If you think you need two, one is a
  text link at `text.primary60`.
- **Fixed CTA slot (48pt)** always rendered, even when empty, to prevent
  layout shift between steps.
- **Progress anchors** (e.g. `ProgressDots`) render outside the animated
  body so they do not move during step transitions.

---

## 6. Depth & Elevation

Elevation comes from **layered transparency + border-subtle**, not drop
shadows.

### Surface stack (back → front)

1. `surface.solidBackdrop`
2. `surface.backdrop`
3. `surface.backdropSoft`
4. `surface.panel`
5. `surface.card`
6. `surface.panelStrong`
7. Glass (`GlassView` on iOS) — pressable CTAs only

### Rules

- **Glass is for action surfaces.** Not backgrounds, not decoration.
- **No box shadows on cards.** Use border + surface alpha.
- **`shadow.base` / `shadow.text`** exist but are reserved for glass CTAs
  and text over imagery.

---

## 7. Motion

### Timing (ms)

| Token          | Value | Use                                  |
| -------------- | ----- | ------------------------------------ |
| `press`        | 120   | Press feedback                       |
| `exit`         | 140   | Step exit                            |
| `snap`         | 160   | Small state changes                  |
| `standard`     | 240   | Step content reveal                  |
| `medium`       | 320   | Step enter                           |
| `wash`         | 320   | Sound-check washes, short overlays   |
| `circleDraw`   | 500   | Stage ring draw                      |
| `morph`        | 520   | Shared-element morphs (rare)         |
| `connector`    | 700   | Stage connector draw                 |
| `ripple`       | 1200  | Sonar-style ripple rings             |
| `breath`       | 3000  | Welcome-logo breathing (once)        |

### Bezier curves

| Token    | Value                    | Use                                  |
| -------- | ------------------------ | ------------------------------------ |
| `out`    | `(0.23, 1, 0.32, 1)`     | Entrances, exits, press feedback     |
| `inOut`  | `(0.77, 0, 0.175, 1)`    | Morphs, on-screen movement           |
| `drawer` | `(0.32, 0.72, 0, 1)`     | iOS-style sheet/drawer slides        |

### Reanimated springs

| Token    | Damping | Stiffness |
| -------- | ------- | --------- |
| `snappy` | 22      | 300       |
| `soft`   | 20      | 180       |
| `pop`    | 12      | 400       |

### Motion rules

- **Never scale from 0.** Minimum entrance scale is 0.95 (0.97 preferred),
  paired with opacity 0→1.
- **No default easings.** Use `BEZIER` tokens, not `Easing.out`.
- **Step transitions are asymmetric.** Exit 140ms (`BEZIER.out`), enter
  320ms (`BEZIER.out`) with a slight translate + scale.
- **Do not animate rapid-repeat actions** (typing, button mashing,
  hotkeys). They repeat hundreds of times.
- **Ambient motion is forbidden.** No aurora, no glowing backgrounds, no
  always-on breathing. Breathing exists only on the welcome logo (one
  moment, once per session).

### Reduced motion

All *decorative* animation honors `useReduceMotion()` and degrades to an
opacity fade. *Functional* animation (progress dot widening, pip fill,
connector draw state) keeps the state change but drops the motion.

---

## 8. Haptics

Haptics mirror Morse audio. They are pattern, not punctuation.

- **Haptics only fire when a Morse sound is playing.** A dit sound pairs
  with a dit-length haptic; a dah sound pairs with a dah-length haptic.
  The haptic pattern matches the audio pattern one-to-one.
- **Silence is the default for UI.** No haptics on selections, step
  transitions, button presses, confirmations, or arrivals — let sound
  carry the rhythm, not touch.
- Haptics ignore `useReduceMotion()` — they are an accessibility aid.

---

## 9. Do's and Don'ts

### Do

- Use the token scales. Every value you use should already exist in
  `tokens.ts` or `animationTokens.ts`.
- Scale pressables to 0.97 on press with `TIMING.press` + `BEZIER.out`.
- Honor `useReduceMotion()` for every decorative animation.
- Fire haptics only to mirror Morse audio. No UI haptics.
- Keep functional animation (progress state, pip fill) under reduce-motion.

### Don't

- **Don't scale from 0.** Start from 0.95+.
- **Don't use default easings** or `ease-in` for UI.
- **Don't use success green for selection.** Green is confirmation only.
- **Don't pulse an enabled CTA.** Its presence is the signal.
- **Don't present two equal CTAs.** One primary, one tertiary text link.
- **Don't add new hex values or one-off sizes.** Extend the token scales.
- **Don't add ambient decoration** (gradients, glows, background drift).

### Removed — do not re-add without a stated reason

- **AuroraGlow** — welcome background radial drift. Pulled focus from the
  logo.
- **SuccessWash** — green radial wash on sound-check confirmation. Loud,
  competed with the checkmark pop.
- **CtaPulse** — shadow pulse on Continue when it became enabled. Enabled
  state doesn't need to announce itself.
- **Green border + shadow on selected profile card.** Success green is for
  confirmation checks, not selection.

---

## 10. Responsive Behavior

iOS is primary; web is secondary. Layout adapts to device size, not
browser breakpoints.

### iOS targets

| Device           | Design anchor                               |
| ---------------- | ------------------------------------------- |
| iPhone SE / mini | 320pt — every layout must fit here          |
| iPhone standard  | 390pt — default design target               |
| iPhone Pro Max   | 430pt — don't leave unused whitespace       |
| iPad             | Out of scope this phase                     |

### Touch targets

- **Minimum 44×44pt** (Apple HIG). Smaller visuals extend via `hitSlop`.
- Primary CTAs: 48pt tall.
- Morse key: 96pt tall (sized for hold-sensitivity).

### Rules

- **CTA width caps at 480pt.** On wider surfaces (iPad, web), it centers
  with screen padding — it does not grow.
- **Vertical flex, not media queries.** Use `flex: 1` fill regions.
- **Web:** single column, max content width 480pt, background full-bleed.
  Hover states only on pointer devices (`@media (hover: hover)`).
