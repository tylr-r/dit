# DESIGN.md

<!-- TODO: remove arbritrary values unless platform/views are specified -->

Canonical design reference for Dit. Covers visual, motion, and interaction
direction only — durable product decisions, implementation, architecture, and
app behavior live elsewhere (`docs/DECISIONS.md`, `CLAUDE.md`,
`docs/APP_BEHAVIOR.md`, `docs/STYLE_GUIDE.md`).

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
  mirror the Morse audio. Avoid unnecessary glows, gradients, or ambient
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

| Token            | Value                     | Use                          |
| ---------------- | ------------------------- | ---------------------------- |
| `text.primary`   | `hsl(24, 29%, 97%)`       | Headlines, active copy       |
| `text.primary90` | `hsla(24, 29%, 97%, 0.9)` | Near-primary, high-emphasis  |
| `text.primary80` | `hsla(24, 29%, 97%, 0.8)` | De-emphasized primary        |
| `text.primary70` | `hsla(24, 29%, 97%, 0.7)` | Between body and primary     |
| `text.primary60` | `hsla(24, 29%, 97%, 0.6)` | Secondary copy               |
| `text.primary40` | `hsla(24, 29%, 97%, 0.4)` | Hints, disabled, meta labels |
| `text.primary20` | `hsla(24, 29%, 97%, 0.2)` | Separators, connector lines  |

### Accent

| Token         | Value                | Use                           |
| ------------- | -------------------- | ----------------------------- |
| `accent.wave` | `hsl(24, 100%, 65%)` | Active progress, ripple rings |

### Surfaces

| Token                   | Value                       | Use                           |
| ----------------------- | --------------------------- | ----------------------------- |
| `surface.solidBackdrop` | `hsla(207, 40%, 4%, 1)`     | App background                |
| `surface.backdrop`      | `hsla(207, 40%, 4%, 0.72)`  | Full-screen modal backdrop    |
| `surface.backdropSoft`  | `hsla(207, 40%, 4%, 0.35)`  | Soft scrim                    |
| `surface.panelStrong`   | `hsla(207, 33%, 7%, 0.92)`  | Cards, option cards, chips    |
| `surface.panel`         | `hsla(0, 0%, 0%, 0.4)`      | Panels over content           |
| `surface.card`          | `hsla(209, 34%, 12%, 0.45)` | Secondary cards               |
| `surface.input`         | `hsla(0, 0%, 100%, 0.06)`   | Text inputs, inactive toggles |
| `surface.inputPressed`  | `hsla(0, 0%, 100%, 0.12)`   | Pressed inputs                |

### Borders

| Token           | Value                     |
| --------------- | ------------------------- |
| `border.subtle` | `hsla(0, 0%, 100%, 0.12)` |
| `border.error`  | `hsla(0, 100%, 71%, 0.4)` |

### Feedback

| Token              | Value                | Use                         |
| ------------------ | -------------------- | --------------------------- |
| `feedback.success` | `hsl(154, 88%, 58%)` | Checkmarks, confirmed state |
| `feedback.error`   | `hsl(0, 100%, 71%)`  | Error text, error state     |

**Semantic rules.**

- Success green is for _confirmation of a check_, not selection or reward. A
  checkmark may be green; a selected card may not.
- Accent orange signals _direction or progress_. Do not use orange for
  success or error.
- Never introduce a new text shade — use the `primary{20,40,60,70,80,90}`
  scale.

### Forbidden

- **No gradients behind content.** We tried an aurora-style radial gradient
  on welcome and removed it — pulled focus from the logo.
- **No decorative glows.** Profile-card green halo, CTA success-glow pulse,
  and sound-check green wash were all removed for the same reason.

### Liquid shader background (iOS + web)

A procedural blue swirl shader runs full-viewport behind app content on both
platforms. iOS uses Skia GLSL; web uses a WebGL port of the same fragment
shader. Hue and cycle constants are shared via the `shader` token in
`@dit/core`. The shader honors `prefers-reduced-motion` (frozen at `t=0`)
and pauses with a cross-fade when the tab is hidden / app is backgrounded.
The "no ambient motion" rule still applies to _content_ surfaces — the
shader is the single, expected exception, layered behind everything.

### NUX welcome (iOS)

- **Welcome auto-advance removed (2026-04-23).** The 2.2s `setTimeout` that
  advanced welcome into profile selection was removed in favor of explicit
  user choice. Signed-out users see two centered options (Sign in / Stay
  signed out) fade in ~2000ms after paint. Do not re-add a timer that skips
  this choice before the user acts.
- **Post-auth advance.** Once a signed-out welcome user successfully signs in,
  the welcome screen advances quickly to the next onboarding step unless
  remote progress skips NUX entirely. This prevents the options from
  disappearing while the user stays on the same page.
- **Swipe-back gesture.** Onboarding supports a left swipe to return to the
  previous step. Keep the gesture quiet and non-visual; do not add a visible
  back button unless the flow grows beyond these short stages.
- **Tutorial haptics control.** The Morse key tutorial can show a compact
  haptics toggle on iOS. It uses the same setting as Settings so the user's
  choice persists after onboarding.

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

| Property | Value                                            |
| -------- | ------------------------------------------------ |
| Width    | `min(screen - 48, 480)`                          |
| Height   | 96                                               |
| Radius   | 48                                               |
| Press    | scale 0.98, `TIMING.press` (120ms), `BEZIER.out` |
| Disabled | opacity 0.6, no press response                   |

Both platforms use a glass surface. iOS renders via `expo-glass-effect`'s
`GlassView` (`glassEffectStyle="clear"`) when Liquid Glass is available. On
iOS versions before 26, Dit falls back to `expo-blur` with a thin translucent
tint so the action surface remains visible without pretending to be system
Liquid Glass. Web renders the same look via CSS `backdrop-filter: blur(24px)
saturate(140%)` on a translucent `rgba(255,255,255,0.08)` surface with a 1px
subtle border and a soft inset highlight, falling back to a flat
`rgba(0,0,0,0.35)` where `backdrop-filter` is unsupported.

Optional `showTapHint` pulses a centered fingerprint icon (40px,
`rgba(244,247,249,0.45)`) at `TAP_HINT_PULSE_MS` (1200ms each direction)
during the NUX button-tutorial step on both platforms. Optional
`showShortcutHint` (web only) renders a small "Space" pill beneath the
button on pointer-and-keyboard devices.

Shared dimensions, timings, accessibility labels, and the
`MorseButtonState` contract live in
`@dit/core/components/morseButton`.

### Pressable (`ScalePressable`)

Generic tappable surface. Press scale 0.97, `TIMING.press` (120ms). Currently
a local helper inside `NuxModal.tsx`. Extract it if a second file needs the
same behavior — don't duplicate it.

### Option card

| Property   | Value                                                           |
| ---------- | --------------------------------------------------------------- |
| Background | `surface.panelStrong`                                           |
| Border     | 1px `border.subtle`                                             |
| Radius     | `radii.lg` (20)                                                 |
| Padding    | `spacing.xl` (24)                                               |
| Child gap  | `spacing.sm` (8)                                                |
| Selection  | scale 1.02 over 200ms `BEZIER.out`. No color change, no shadow. |

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

| State    | Width | Color            |
| -------- | ----- | ---------------- |
| Inactive | 6     | `text.primary40` |
| Active   | 18    | `accent.wave`    |
| Done     | 6     | `text.primary80` |

Transition: `TIMING.snap` (160ms).

### Tutorial pip

Empty: 1px `text.primary40` border, transparent fill. Filled: `accent.wave`
background, no border.

### Connector line (stage-to-stage)

1px, `text.primary20`, 28px tall inside a 44px wrap (8px breathing room top
and bottom). Draw: scaleY 0→1 from top, `TIMING.connector` (700ms),
`BEZIER.inOut`.

### Icons

<!-- TODO: see if expo-symbols are available on Android and web -->

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

| Token        | Value | Use                        |
| ------------ | ----- | -------------------------- |
| `sm`         | 10    | Small pressables, pips     |
| `md`         | 14    | Inputs, secondary cards    |
| `lg`         | 20    | Cards, chips               |
| `pill`       | 999   | CTAs, active progress dots |
| `iconCircle` | 36    | Circular icon containers   |

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
7. Glass (`GlassView` on iOS 26+, blur fallback below iOS 26) — pressable CTAs only

### Rules

- **Glass is for action surfaces.** Not backgrounds, not decoration.
- **No box shadows on cards.** Use border + surface alpha.
- **`shadow.base` / `shadow.text`** exist but are reserved for glass CTAs
  and text over imagery.

---

## 7. Motion

### Timing (ms)

<!-- Keep these values consistent across all platforms -->

| Token        | Value | Use                                |
| ------------ | ----- | ---------------------------------- |
| `press`      | 120   | Press feedback                     |
| `exit`       | 140   | Step exit                          |
| `snap`       | 160   | Small state changes                |
| `standard`   | 240   | Step content reveal                |
| `medium`     | 320   | Step enter                         |
| `wash`       | 320   | Sound-check washes, short overlays |
| `circleDraw` | 500   | Stage ring draw                    |
| `morph`      | 520   | Shared-element morphs (rare)       |
| `connector`  | 700   | Stage connector draw               |
| `ripple`     | 1200  | Sonar-style ripple rings           |
| `breath`     | 3000  | Welcome-logo breathing (once)      |

### Bezier curves

| Token    | Value                 | Use                              |
| -------- | --------------------- | -------------------------------- |
| `out`    | `(0.23, 1, 0.32, 1)`  | Entrances, exits, press feedback |
| `inOut`  | `(0.77, 0, 0.175, 1)` | Morphs, on-screen movement       |
| `drawer` | `(0.32, 0.72, 0, 1)`  | iOS-style sheet/drawer slides    |

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

All _decorative_ animation honors `useReduceMotion()` and degrades to an
opacity fade. _Functional_ animation (progress dot widening, pip fill,
connector draw state) keeps the state change but drops the motion.

---

## 8. Haptics

Haptics mirror Morse audio.

- **Haptics only fire when a Morse sound is playing.**
  The haptic pattern matches the audio pattern one-to-one.
- **Silence is the default for UI.** No haptics on selections, step
  transitions, button presses, confirmations, or arrivals — let sound
  carry the rhythm, not touch.
- Haptics ignore `useReduceMotion()` — they are an accessibility aid.
- **iOS/Android users can mute haptics** from Settings ("Haptics" toggle). The toggle
  flips an `isEnabled` flag inside the native `HapticController` so the
  audio path stays untouched.

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
- **Don't add ambient decoration** (gradients, glows, background drift)
  to app surfaces. Long-form editorial pages are an exception — see §11.

### Removed — do not re-add without a stated reason

- **AuroraGlow** — this looks like slop so do not add unnecessary glows around UI.
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

| Device           | Design anchor                         |
| ---------------- | ------------------------------------- |
| iPhone SE / mini | 320pt — every layout must fit here    |
| iPhone standard  | 390pt — default design target         |
| iPhone Pro Max   | 430pt — don't leave unused whitespace |
| iPad             | Out of scope this phase               |

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

---

## 11. Long-form pages (Privacy, Terms, Support)

These pages are **editorial documents**, not app surfaces. They follow
different rules than the practice/NUX flows because their job is to be
read, scanned, and trusted — not used. Code lives in
[apps/web/src/components/LegalPage.tsx](apps/web/src/components/LegalPage.tsx)
and the `.legal-*` styles in [apps/web/src/App.css](apps/web/src/App.css).

### Layout

- **Top nav row spans full viewport** ("Back to Dit" left, page links right),
  respecting only the page's outer horizontal padding. Do not constrain it
  to the reading column.
- **Reading column: `min(720px, 100%)`** for hero text and body sections.
  Wider would tank readability; narrower would feel cramped.
- **Side-rail section numbers on desktop (≥1100px).** CSS counter on
  `.legal-card`, incremented per `.legal-section`. Below 1100px the
  number falls back inline with the section h2.
- **Page padding:** clamp(40, 7vw, 80) top / clamp(64, 10vw, 120) bottom /
  clamp(18, 6vw, 80) horizontal. Generous; legal pages aren't dashboards.
- **Region gap:** clamp(56, 10vw, 112). Nav → hero → body → footer all
  separated by this.

### Hero

| Property     | Value                                                  |
| ------------ | ------------------------------------------------------ |
| Title        | clamp(2.6, 6vw, 4.8)rem, weight 500, tracking -0.025em |
| Intro        | clamp(1.05, 1.4vw, 1.2)rem, line-height 1.55           |
| Last Updated | 0.7rem uppercase, tracking 0.24em, `text.primary40`    |

Title weight 500 (not 600+) at large size reads more editorial / less
SaaS. Stagger hero children on page-load (~70ms apart, 520ms each,
`BEZIER.out`) — page-load is a rare moment where motion is allowed.

### "At a glance" callout

Above the numbered sections on the privacy page only. NOT a `LegalSection`
(it does not get a number). Treatment:

- 2x2 grid of bold one-line title + soft supporting sentence, bracketed
  by top + bottom hairlines at `border.subtle`, **symmetric 36px padding**
- Stacks to single column under 600px

This is the scannable summary; the body sections carry the detail.

### Body

- Section h2 in tracked uppercase (0.78rem, 0.22em tracking, `text.primary70`),
  prefixed by zero-padded counter (`01`, `02`, …) in tabular numerals.
- h2 wraps the title in an `<a href="#slug">` so each section is
  deep-linkable. Anchor styling looks like text; brightens to `accent.wave`
  on hover.
- List bullets are 4px `accent.wave` dots (no default disc).
- `<strong>` lifts to `--color-text-primary` (full opacity) at weight 600.
  Use it sparingly for key reassurances ("without signing in", "We do not
  sell"), not for emphasis-by-default.

### Links (body)

| State | Color                 | Underline                         |
| ----- | --------------------- | --------------------------------- |
| Rest  | `text.primary90`      | 1px, `text.primary40`, offset 3px |
| Hover | `text.primary` (full) | thickens to `text.primary80`      |

The body link color is **not** `accent.wave`. The accent is reserved for
brand marks (Morse glyph, list bullets, the at-a-glance label, the
scroll progress bar). Tinting body links the same orange devalues the
accent.

### Atmospheric background — exception to §9

`.legal-page::before` paints two soft radial gradients (warm orange at
top-center, cool navy top-right) at very low opacity. **This is the
documented exception to the "no ambient decoration" rule in §9.** Legal
pages have no logo or interactive focal point to compete with; the glow
adds atmosphere and brand presence without distracting from anything.
**Do not port this to app surfaces.**

### Scroll progress indicator

A 2px fixed bar at `top: 0` of the viewport, `accent.wave`, scales from
left to right as the page scrolls. Driven by CSS scroll-driven animations:
`scroll-timeline-name: --legal-scroll` on `.legal-page`, referenced via
`animation-timeline: --legal-scroll` on the bar. No JS. Falls back to
hidden in browsers without scroll-timeline support (Firefox).

### Motion budget

Scroll-driven progress, hero+section page-load stagger, and a
sequence-pulse on the Morse mark on hover. Everything else respects
`@media (prefers-reduced-motion: reduce)` — opacity stays, transforms
strip out.

## 12. Homepage (`/`)

The public homepage ([apps/web/src/components/HomePage.tsx](apps/web/src/components/HomePage.tsx),
styles in `HomePage.css`) is **the app's front door and must feel like the
app**, not an editorial document. It reuses the product's real surfaces
instead of describing them:

- **Backdrop is the app stack**: `MorseLiquidSurface` (liquid shader) +
  `BackgroundGlow` (black dim + glows) in a fixed full-viewport layer,
  exactly as the main app composes them. Do not swap this for static
  gradients; the blue liquid is the brand.
- **The hero demo is the real glass Morse key** (`MorseButton`) wired to
  the shared tone engine. Tap/hold classify with `DASH_THRESHOLD`, commit
  with `DEBOUNCE_DELAY`, and decode against `MORSE_DATA`, exactly like
  Freestyle. The fingerprint tap hint shows until first press. Keep this
  honest: real key, real sidetone, real decode. No canned audio or video.
- **Copy budget is deliberately tiny.** One headline, one supporting line,
  three mode cards at one line each, one closing line, one meta line.
  An earlier all-text editorial version was replaced for feeling flat and
  off-brand (2026-06-12); do not grow the page back into paragraphs.
- **Brand row uses the real `DitLogo`** (36px, rotating rings) next to a
  "Dit" wordmark at 1.125rem/600. The dah-dit-dit glyph mark is a
  legal-page eyebrow device, not the logo; do not use it as the homepage
  brand. An earlier 26px tracked-uppercase version read as unidentifiable.
- **Key hints follow the app's pointer rules**: fingerprint tap hint only
  on coarse pointers (until first key), "Space" shortcut pill only on fine
  pointers, with Space keying the demo globally like in the app.
- **CTA hierarchy: web first.** Visitors are already on the web, so
  "Start practicing" (the web app) is the glass primary everywhere and
  the App Store link is the tertiary. The dedicated "On iPhone" section
  carries iOS conversion as a **full-bleed band**: a `surface.panelStrong`
  band that breaks out of the page padding (`align-self: stretch` +
  negative `margin-inline`, same pattern as the why bands) with `border-block`
  hairlines and `flex-shrink: 0` so the page's fixed-height flex column
  cannot crush it. A full-bleed grid centers an 1100px content zone via side
  gutters so the copy's left edge aligns with the why bands above; the copy
  (the only padded region) takes the left half, and the atmospheric "scene"
  panel spans the right half through the right gutter, bleeding to the
  viewport's right edge (and to the band's top/bottom; on mobile it stacks
  full-width below the copy, flush left/right/bottom). The scene paints
  Dit's own audio-wave render
  (`public/home/app-scene.webp`, from `dit-cover-3`) under a ~45% navy
  scrim, and the full app screen (`ios-screenshot-2.webp`, Freestyle, so
  the iconic key reads) floats over it in a solid-backdrop bezel, tilted
  6° (4° on mobile) with a soft drop shadow, fully visible. The phone is
  NOT cropped — the whole screen must be legible. The get cluster is a
  white QR card + "Scan to download" + the **official Apple "Download on
  the App Store" badge** (`public/home/app-store-badge.svg`, the real
  outlined-path asset — do not recolor, restretch, or hand-redraw it; it
  has brand rules). On coarse pointers the QR and its caption hide
  (scanning the device you hold is pointless); the badge carries it alone.

  This is the **Venmo-direction** treatment: the phone is a hero object
  with depth (tilt + shadow) floating over a contextual scene, rather than
  a flat screenshot. Earlier attempts and why they were dropped — keep this
  history so they don't return: two overlapping bezel frames floated
  directly on the shader (2026-06-12, illegible: app screens share the
  page's liquid look); a screen-cropped autoplay video (the demo is a
  composed promo, not a flat capture — if video returns, use it uncropped
  as its own block); a single phone bleeding off a flat card bottom
  (2026-06-13, the mobile read was poor). Source assets live in the
  untracked `temp/` folder; re-derive web copies with ffmpeg/sips and
  re-export the badge from the Figma `Dit` file if they change.
- **The "why" section is three alternating full-bleed story bands.** It
  replaced a single full-bleed editorial ledger of six numbered selling
  points (2026-06-13: the ledger read as one long undifferentiated wall,
  weighted core differentiators and conveniences equally, and restated the
  method section that followed it). Each band escapes the page padding via
  negative `margin-inline` (not 100vw, which fights the scrollbar), carries
  a `surface.panel` background with `border.subtle` top/bottom hairlines,
  and pairs one claim (accent eyebrow label, headline, body, optional
  citation line) with one visual on a four-column grid (gutter, content,
  content, gutter), alternating copy-left / copy-right / copy-left via a
  `.home-band-flip` modifier. The three claims, in order: the auditory
  reflex (counting dits and dahs is the habit that caps your speed), the
  proven method (Koch 1935 plus the ARRL Farnsworth standard, with a
  visible citation), and recognition-speed tracking (TTR). The conveniences
  that used to be ledger rows (no account, self-paced, paddle support)
  collapse into one contained pill strip after the third band. Bands rise
  on scroll where `animation-timeline: view()` is supported; they carry an
  explicit `opacity: 0` base so the reveal is real, not inert. Symmetric
  card grids were tried for this content and dropped for reading as
  template design (2026-06-12). Claims must stay verifiable against
  `docs/Pedagogical_philosophy.md` and `docs/PLATFORM_PARITY.md`. Do not
  invent marketing claims, and never render dot/dash marks in a band
  visual.
- **Section cadence: contained and full-bleed alternate, and full-bleed
  bands never butt together.** The three why bands are full-bleed but each
  sits a full `clamp(120px, 17vw, 248px)` section gap from the next, so the
  shader shows through between them as the breather (they never stack into
  one slab). The contained pill strip sits between the last why band and
  the full-bleed iPhone band, so no two full-bleed bands touch. Rhythm:
  hero (contained) → why band → why band → why band → conveniences
  (contained) → iPhone (band) → closing (contained). An earlier rhythm put
  a single contained "method" section between one why band and the iPhone
  band; it folded into the bands (2026-06-13, see below).
- **Lean far more generous on whitespace than feels normal.** This page
  wants a lot of air: section gaps run `clamp(120px, 17vw, 248px)`, band
  vertical padding `clamp(80px, 11vw, 168px)`, body line-heights ~1.6.
  Tighter, app-like spacing was tried twice and read as cramped and
  text-heavy (2026-06-13); the generous version is the intended look.
  Whitespace, not density, carries the page. Don't "tighten it up."
- **The "method" breather section was removed (2026-06-13).** It was a
  contained `min(900px)` centered section over the shader carrying the
  pedagogy: an auditory-reflex lead, then three principles (Koch /
  Farnsworth / adaptive review) on a hairline rail with `accent.wave`
  numbered markers. It said what the why bands now say, so its content
  folded into why band 02 (the method) and band 03 (TTR). Do not re-add a
  separate method section; if the pedagogy needs more room, extend the
  bands. An earlier empty "Hear it / Answer / It sticks" loop in this slot
  was rejected as filler (2026-06-13).
- **CTAs** are the §4 glass pill in CSS (48px, pill radius, blur(24px)
  saturate(140%) over `rgba(255,255,255,0.08)`), one primary plus one
  tertiary text link per cluster.
- **Closing brand moment** reuses the rotating `DitLogo` above "Start by
  listening." with repeated CTAs and a quiet meta line (no account needed,
  Koch, Farnsworth).
- **Motion budget:** hero page-load stagger, plus a one-time rise on
  scroll per why band where `animation-timeline: view()` is supported; the
  shader is the documented ambient exception (§2). Reduced motion freezes
  the shader (built in), drops the stagger, and renders the bands static.
- **Voice:** sentence case, no exclamation points, no dot/dash charts or
  Morse novelty graphics. The brand mark and the live key's own symbols are
  the only Morse glyphs on the page.
