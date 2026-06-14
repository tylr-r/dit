# Why Dit → alternating story bands

Date: 2026-06-13
Status: approved for planning

## Problem

The homepage `Why Dit` section (`apps/web/src/components/HomePage.tsx`,
`SELLING_POINTS`) is a six-row numbered ledger. Every row carries identical
visual weight, so it reads as one long wall rather than a set of distinct
ideas. Three further problems:

- **Mixed altitude.** Core differentiators (auditory reflex, the proven
  method) sit at the same weight as conveniences (no account, paddle support,
  self-pacing), so the strongest arguments do not land harder than the
  footnotes.
- **The page argues the method twice.** The separate `The method` section
  (`METHOD_PRINCIPLES`: Koch / Farnsworth / adaptive review) restates what the
  ledger rows already claim. This redundancy is most of why the mid-page feels
  long.
- **It tells, never shows.** Six text rows, no product, no visual.

Reference the user cited: venmo.com, where each idea gets its own breathing
band with a visual, so the eye resets between points.

## Goal

Sell why Dit beats chart-based competitors in a tasteful, trustworthy way.
Lead with the science (Koch 1935, ARRL Farnsworth standard) rather than hype.
Shorter section, clearer hierarchy, one idea per screen moment.

## Hard constraints

- **Never show dot/dash marks anywhere.** This is the core pedagogy: seeing
  the visual pattern trains the wrong skill. See
  `docs/Pedagogical_philosophy.md`. Band visuals must not render Morse
  patterns.
- The real problem being sold against is the **count-and-translate step that
  caps speed**, not "looking at a chart."
- Copy must read as human-written. All copy below has been through the
  humanizer pass (no negative parallelisms, rule-of-three, or AI vocabulary).
- Reuse existing design tokens and the established full-bleed band pattern. No
  new ambient motion (DESIGN.md).

## Design

### New page flow

Hero → **three Why bands** → **convenience pill strip** → iPhone band →
closing CTA. The standalone `The method` section is **deleted**; its pedagogy
moves into bands 02 and 03.

### The three bands

Each band is full-bleed (same break-out pattern as the existing `.home-app`
band), with copy on one side and a visual on the other, alternating sides
(01 copy-left, 02 copy-right, 03 copy-left). Generous vertical padding so each
band owns its own screen moment.

Each band has: an eyebrow label, a headline, a body paragraph, and a visual.

**Band 01 — Recognition, not translation** (copy left)

- Eyebrow: `Recognition, not translation`
- Headline: `Fluent operators never count. Neither will you.`
- Body: `Learn Morse off a chart and you build a step you can't undo: hear
  it, count the beats, look it up. That step is the ceiling on your speed. Dit
  skips it. Every letter is a sound you come to know on contact, the way you
  know your own name the moment someone says it.`

**Band 02 — The method** (copy right)

- Eyebrow: `The method`
- Headline: `The same method serious operators have trusted for 90 years.`
- Body: `In 1935 Ludwig Koch showed that letters have to be learned at full
  speed from the start. Slow them down and the muscle memory falls apart the
  moment real traffic speeds up. So Dit plays every letter at real speed and
  stretches only the silence between them, the way the ARRL's Farnsworth
  standard sets out. Those gaps close as you get faster.`
- Citation line (small, `text.primary40`): `Koch, 1935 · ARRL Farnsworth
  timing standard`

**Band 03 — It tracks your speed** (copy left)

- Eyebrow: `It tracks your speed`
- Headline: `It can tell which letters you're still working out in your head.`
- Body: `You can answer every prompt right and still be slow, solving each one
  a half-second behind. Dit times how long a letter takes you to recognize and
  brings the slow ones around more often. The hesitation is what fades.`

### Convenience pill strip

After the three bands, one centered row of pills (wraps on narrow screens):

- `No sign-up to start`
- `Your own pace, no streaks to keep`
- `Works with a paddle`

Dropped from the original six: nothing of substance — these three plus the
band content cover all six original points. (The frequency-based "real words
from session one" idea was deliberately left out to keep the section lean.)

### Band visuals — placeholder now, real content later

Ship with CSS/SVG placeholders that look intentional (surface tokens, hairline
borders, `accent.wave`), not empty gray boxes. Each placeholder is built so a
real asset can drop into the same slot later. **No Morse marks in any of them.**

| Band | Placeholder (ship now) | Real content to source later |
| --- | --- | --- |
| 01 | Large letter glyph (e.g. `R`) above a flowing CSS/SVG sine wave in accent orange, caption "a sound you recognize on contact" | A short (3-5s) muted, looping screen recording of Listen or Practice: a tone plays, the correct letter is typed instantly. Autoplay/loop/muted `<video>` (webm). |
| 02 | A speed readout card (`12 WPM`) with caption "full speed from the first letter, wider gaps to think" | Either (a) an archival credibility image — Koch 1935 dissertation scan or a vintage straight key / paddle photo — for trust texture, or (b) a clean motion diagram of inter-character gaps narrowing while character speed stays fixed (letters/blocks, never dots/dashes). Lean toward (a) archival for trust. |
| 03 | A CSS bar chart: 5 bars of varying height labelled T E N R A, caption "time to recognize, per letter" | A real screenshot of the app's per-letter recognition-speed / stats view (the TTR data from Listen mode). |

When you source assets, the placeholder slot keeps the same dimensions, so
swapping is a single element replacement per band.

### Responsive

- Bands collapse to copy-over-visual at the existing `880px` breakpoint used
  elsewhere on the page.
- Pill strip wraps.

### Motion (design-eng notes)

- Reuse the existing scroll reveal: `homeRise` 520ms `var(--ease-out)` with
  `animation-timeline: view()` gated behind `@supports`, one reveal per band
  (matches the current `.home-why-row` behavior). This is
  marketing/explanatory motion, so the longer 520ms duration is appropriate.
- `var(--ease-out)` is `cubic-bezier(0.23, 1, 0.32, 1)` — already the strong
  ease-out curve; do not fall back to built-in `ease-out`.
- No hover-driven movement on the bands. No new ambient motion on content
  surfaces (the liquid shader remains the only exception).
- Honor `prefers-reduced-motion`: bands render static (opacity 1, no
  transform), matching the existing reduced-motion block.
- If band 01 gets the real looping video later: muted, `playsinline`, `loop`,
  and pause when offscreen / under `prefers-reduced-motion` (show a poster
  frame instead).

## Files touched

- `apps/web/src/components/HomePage.tsx`
  - Remove `METHOD_PRINCIPLES` and the `.home-method` `<section>`.
  - Replace `SELLING_POINTS` with a `WHY_BANDS` data structure (eyebrow,
    headline, body, optional citation, visual key) plus a `CONVENIENCES`
    array for the pills.
  - Render three `.home-band` sections (alternating modifier class) and one
    `.home-conveniences` strip in place of the old `.home-why` ledger.
  - Band visuals as small presentational subcomponents keyed by `visual`
    (`reflex`, `speed`, `ttr`) so a real asset can replace each one in one
    place.
- `apps/web/src/components/HomePage.css`
  - Remove `.home-why*` ledger styles and all `.home-method*` styles.
  - Add `.home-band` (full-bleed grid, alternating via a `--flip` modifier),
    `.home-band-copy`, `.home-band-eyebrow`, `.home-band-h`, `.home-band-b`,
    `.home-band-cite`, `.home-band-vis`, and `.home-conveniences` /
    `.home-pill`.
  - Reuse the existing full-bleed `margin-inline` break-out and the
    `homeRise` reveal.

No changes to `apps/ios` (web homepage only). No new dependencies.

## Out of scope

- iOS app, any in-app surface.
- Real video/screenshot/archival assets (sourced later by the user; slots
  ship as placeholders).
- The "real words from session one" differentiator (left out by decision).

## Testing

- `pnpm --filter @dit/web test:unit:run` and `pnpm run lint` pass.
- Manual: section reads as three distinct bands with breathing room; no
  dot/dash marks anywhere; pills wrap on narrow widths; reduced-motion renders
  static; bands stack correctly below 880px.
