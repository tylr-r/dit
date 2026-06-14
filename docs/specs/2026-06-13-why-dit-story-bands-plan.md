# Why Dit story bands — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six-row "Why Dit" ledger on the web homepage with three alternating full-bleed story bands plus a convenience pill strip, and delete the now-redundant "The method" section.

**Architecture:** Pure presentational change in two files — `HomePage.tsx` (data arrays + section JSX) and `HomePage.css` (styles). No new dependencies, no app/iOS changes. Band visuals ship as intentional CSS/SVG placeholders sized so real assets can drop in later. Copy is final and already humanized; no dot/dash marks anywhere.

**Tech Stack:** React 19, Vite, Vitest + @testing-library/react, plain CSS with the project's design tokens.

Plan location note: the brainstorming default `docs/superpowers/plans/` is gitignored in this repo (`*/superpowers/`), so this plan lives in `docs/specs/` alongside the approved spec `docs/specs/2026-06-13-why-dit-story-bands-design.md`.

---

### Task 1: Failing test for the new Why section

**Files:**
- Modify: `apps/web/tests/unit/components/HomePage.test.tsx`

- [ ] **Step 1: Add the failing test**

Add this `it(...)` block inside the existing `describe('HomePage', ...)` block in `apps/web/tests/unit/components/HomePage.test.tsx`, after the existing tests:

```tsx
  it('sells the method with three story bands, a citation, and a pill strip', () => {
    render(<HomePage />)

    expect(
      screen.getByRole('heading', {
        name: 'Fluent operators never count. Neither will you.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'The same method serious operators have trusted for 90 years.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: "It can tell which letters you're still working out in your head.",
      }),
    ).toBeInTheDocument()

    // The proven method is cited, not just asserted.
    expect(
      screen.getByText('Koch, 1935 · ARRL Farnsworth timing standard'),
    ).toBeInTheDocument()

    // Conveniences collapse into a pill strip.
    expect(screen.getByText('No sign-up to start')).toBeInTheDocument()
    expect(screen.getByText('Works with a paddle')).toBeInTheDocument()

    // The old six-row ledger content is gone.
    expect(
      screen.queryByText(
        'No charts. You build the reflex, not a translation habit.',
      ),
    ).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @dit/web test:unit:run -- HomePage`
Expected: FAIL — the three new headings, the citation, and the pills do not exist yet (the old ledger text still does).

---

### Task 2: Rewrite the HomePage section data and JSX

**Files:**
- Modify: `apps/web/src/components/HomePage.tsx`

- [ ] **Step 1: Replace the data constants**

In `apps/web/src/components/HomePage.tsx`, delete the `SELLING_POINTS` constant (currently lines 24-49) and the `METHOD_PRINCIPLES` constant (currently lines 51-64), and replace both with:

```tsx
type WhyBand = {
  eyebrow: string
  headline: string
  body: string
  visual: 'reflex' | 'speed' | 'ttr'
  cite?: string
}

const WHY_BANDS: WhyBand[] = [
  {
    eyebrow: 'Recognition, not translation',
    headline: 'Fluent operators never count. Neither will you.',
    body: "Learn Morse off a chart and you build a step you can't undo: hear it, count the beats, look it up. That step is the ceiling on your speed. Dit skips it. Every letter is a sound you come to know on contact, the way you know your own name the moment someone says it.",
    visual: 'reflex',
  },
  {
    eyebrow: 'The method',
    headline: 'The same method serious operators have trusted for 90 years.',
    body: "In 1935 Ludwig Koch showed that letters have to be learned at full speed from the start. Slow them down and the muscle memory falls apart the moment real traffic speeds up. So Dit plays every letter at real speed and stretches only the silence between them, the way the ARRL's Farnsworth standard sets out. Those gaps close as you get faster.",
    cite: 'Koch, 1935 · ARRL Farnsworth timing standard',
    visual: 'speed',
  },
  {
    eyebrow: 'It tracks your speed',
    headline:
      "It can tell which letters you're still working out in your head.",
    body: 'You can answer every prompt right and still be slow, solving each one a half-second behind. Dit times how long a letter takes you to recognize and brings the slow ones around more often. The hesitation is what fades.',
    visual: 'ttr',
  },
]

const CONVENIENCES = [
  'No sign-up to start',
  'Your own pace, no streaks to keep',
  'Works with a paddle',
]
```

- [ ] **Step 2: Add the placeholder band-visual component**

In the same file, add this component just above the `HomePage` component (i.e. after the `HomeKeyDemo` component, before `/** Public marketing homepage for Dit, served at the web root. */`):

```tsx
/**
 * Placeholder band visuals. Each is sized to its slot so a real asset (looping
 * clip, archival image, stats screenshot) can replace it later without layout
 * churn — see docs/specs/2026-06-13-why-dit-story-bands-design.md. Never renders
 * dot/dash marks: showing the pattern trains the wrong skill.
 */
function BandVisual({ kind }: { kind: WhyBand['visual'] }) {
  if (kind === 'reflex') {
    return (
      <div className="home-band-vis" aria-hidden="true">
        <span className="home-band-glyph">R</span>
        <svg className="home-band-wave" viewBox="0 0 120 22" fill="none">
          <path
            d="M2 11 Q 12 1, 22 11 T 42 11 T 62 11 T 82 11 T 102 11 T 118 11"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <p className="home-band-caption">a sound you recognize on contact</p>
      </div>
    )
  }

  if (kind === 'speed') {
    return (
      <div className="home-band-vis" aria-hidden="true">
        <span className="home-band-speed">12 WPM</span>
        <p className="home-band-caption">
          full speed from the first letter, wider gaps to think
        </p>
      </div>
    )
  }

  const bars = [
    { letter: 'T', height: 30 },
    { letter: 'E', height: 80 },
    { letter: 'N', height: 45 },
    { letter: 'R', height: 95 },
    { letter: 'A', height: 55 },
  ]
  return (
    <div className="home-band-vis" aria-hidden="true">
      <div className="home-band-bars">
        {bars.map((bar) => (
          <span className="home-band-bar-col" key={bar.letter}>
            <span
              className="home-band-bar"
              style={{ height: `${bar.height}%` }}
            />
            <span className="home-band-bar-label">{bar.letter}</span>
          </span>
        ))}
      </div>
      <p className="home-band-caption">time to recognize, per letter</p>
    </div>
  )
}
```

- [ ] **Step 3: Replace the two sections in the page JSX**

In the `HomePage` component, delete the entire `<section className="home-why" ...>...</section>` block (currently lines 264-289) and the entire `<section className="home-method" ...>...</section>` block (currently lines 291-310). Replace both with:

```tsx
      {WHY_BANDS.map((band, index) => (
        <section
          className={index % 2 === 1 ? 'home-band home-band-flip' : 'home-band'}
          key={band.eyebrow}
          aria-labelledby={`home-band-${index}`}
        >
          <div className="home-band-copy">
            <p className="home-band-eyebrow">{band.eyebrow}</p>
            <h2 className="home-band-h" id={`home-band-${index}`}>
              {band.headline}
            </h2>
            <p className="home-band-b">{band.body}</p>
            {band.cite ? <p className="home-band-cite">{band.cite}</p> : null}
          </div>
          <BandVisual kind={band.visual} />
        </section>
      ))}

      <section className="home-conveniences" aria-label="Also">
        <ul className="home-conveniences-list">
          {CONVENIENCES.map((item) => (
            <li className="home-pill" key={item}>
              {item}
            </li>
          ))}
        </ul>
      </section>
```

- [ ] **Step 4: Run the unit tests and verify they pass**

Run: `pnpm --filter @dit/web test:unit:run -- HomePage`
Expected: PASS — all three HomePage tests green, including the new one from Task 1.

- [ ] **Step 5: Type-check**

Run: `pnpm run test:types`
Expected: PASS — no type errors (the `WhyBand` union covers every `visual` value, `cite` is optional).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/HomePage.tsx apps/web/tests/unit/components/HomePage.test.tsx
git commit -m "Replace Why Dit ledger with three story bands"
```

---

### Task 3: Swap the CSS — remove ledger + method, add bands

**Files:**
- Modify: `apps/web/src/components/HomePage.css`

- [ ] **Step 1: Delete the old styles**

In `apps/web/src/components/HomePage.css`, delete two contiguous regions:
- The entire `/* --- Why Dit band (full-bleed editorial ledger) --- */` region: every rule from `.home-why` through the `@supports (animation-timeline: view())` block that targets `.home-why-row` (currently lines 254-394).
- The entire `/* --- The method --- ... */` region: every rule from `.home-method` through its trailing `@media (max-width: 720px)` block (currently lines 396-500).

Also remove `.home-why-row` from the `@media (prefers-reduced-motion: reduce)` selector list near the end of the file (currently around line 794) and from the transition-reset selector list (currently around line 802), since those classes no longer exist. After editing, that block should read:

```css
@media (prefers-reduced-motion: reduce) {
  .home-hero > *,
  .home-band {
    opacity: 1;
    transform: none;
    animation: none;
  }

  .home-nav a,
  .home-cta,
  .home-cta-quiet {
    transition: none;
    animation: none;
  }
}
```

- [ ] **Step 2: Add the band styles**

Insert this block where the deleted "Why Dit band" region was (between the key-demo styles and the iPhone app section styles):

```css
/* --- Why Dit story bands ---
   Three full-bleed bands replace the old ledger. Each pairs one claim with a
   placeholder visual and alternates sides (.home-band-flip). Same break-out
   pattern as .home-app below; the standalone "method" section was folded in.
   No dot/dash marks anywhere — see docs/Pedagogical_philosophy.md. */

.home-band {
  align-self: stretch;
  margin-inline: calc(-1 * clamp(18px, 6vw, 80px));
  background: var(--color-surface-panel);
  border-block: 1px solid var(--color-border-subtle);
  padding-block: clamp(80px, 11vw, 168px);
  display: grid;
  grid-template-columns:
    minmax(clamp(18px, 6vw, 80px), 1fr)
    minmax(0, 540px) minmax(0, 460px)
    minmax(clamp(18px, 6vw, 80px), 1fr);
  column-gap: clamp(40px, 7vw, 120px);
  align-items: center;
}

/* Collapse the doubled hairline where bands stack. */
.home-band + .home-band {
  border-top: none;
}

.home-band-copy {
  grid-column: 2;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.home-band-vis {
  grid-column: 3;
}

.home-band-flip .home-band-copy {
  grid-column: 3;
}

.home-band-flip .home-band-vis {
  grid-column: 2;
}

.home-band-eyebrow {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 0.7rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--color-accent-wave);
}

.home-band-eyebrow::before {
  content: '';
  width: 18px;
  height: 1px;
  background: currentColor;
  display: inline-block;
}

.home-band-h {
  margin: 0;
  font-size: clamp(1.7rem, 3.2vw, 2.5rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.12;
}

.home-band-b {
  margin: 0;
  font-size: 1rem;
  line-height: 1.65;
  color: var(--color-text-primary-60);
  max-width: 46ch;
}

.home-band-cite {
  margin: 4px 0 0;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  color: var(--color-text-primary-40);
}

/* --- Placeholder visuals (swap for real assets later) --- */

.home-band-vis {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 240px;
  padding: clamp(28px, 4vw, 48px);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-subtle);
  background: var(--color-surface-card);
  color: var(--color-accent-wave);
  text-align: center;
}

.home-band-glyph {
  font-size: clamp(2.6rem, 5vw, 3.4rem);
  font-weight: 600;
  line-height: 1;
  color: var(--color-text-primary);
}

.home-band-wave {
  width: 120px;
  height: 22px;
}

.home-band-speed {
  font-size: clamp(1.8rem, 3.6vw, 2.6rem);
  font-weight: 600;
  line-height: 1;
}

.home-band-caption {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--color-text-primary-40);
  max-width: 28ch;
}

.home-band-bars {
  display: flex;
  align-items: flex-end;
  gap: clamp(10px, 1.4vw, 16px);
  height: 64px;
}

.home-band-bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.home-band-bar {
  width: 14px;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  background: var(--color-accent-wave);
  opacity: 0.85;
}

.home-band-bar-label {
  font-size: 0.75rem;
  color: var(--color-text-primary-40);
}

/* Scroll-driven reveal where supported; static elsewhere. */
@supports (animation-timeline: view()) {
  .home-band {
    animation: homeRise 520ms var(--ease-out) both;
    animation-timeline: view();
    animation-range: entry 0% entry 45%;
  }
}

/* --- Convenience pill strip --- */

.home-conveniences {
  width: var(--home-col);
  display: flex;
  justify-content: center;
}

.home-conveniences-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 12px;
}

.home-pill {
  font-size: 0.85rem;
  color: var(--color-text-primary-60);
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border-subtle);
  background: var(--color-surface-panel);
}

/* Bands stack to copy-over-visual on narrow screens. */
@media (max-width: 880px) {
  .home-band {
    grid-template-columns: 1fr;
    padding-inline: clamp(18px, 6vw, 80px);
    row-gap: 40px;
  }

  .home-band-copy,
  .home-band-vis,
  .home-band-flip .home-band-copy,
  .home-band-flip .home-band-vis {
    grid-column: 1;
  }
}
```

- [ ] **Step 2b: Confirm no orphaned references remain**

Run: `grep -n "home-why\|home-method" apps/web/src/components/HomePage.css apps/web/src/components/HomePage.tsx`
Expected: no output (every `home-why*` and `home-method*` reference is gone from both files).

- [ ] **Step 3: Lint**

Run: `pnpm run lint`
Expected: PASS — no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/HomePage.css
git commit -m "Style Why Dit story bands and convenience strip"
```

---

### Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the web unit suite**

Run: `pnpm --filter @dit/web test:unit:run`
Expected: PASS — full web unit suite green.

- [ ] **Step 2: Type-check and lint together**

Run: `pnpm run test:types && pnpm run lint`
Expected: PASS for both.

- [ ] **Step 3: Manual visual check (dev server)**

If verifying in the browser, ask the developer to run `pnpm --filter @dit/web dev` and open the homepage. Confirm:
- Three distinct bands with breathing room, sides alternating (copy left / right / left).
- The standalone "method" section is gone; the page is shorter.
- No dot/dash marks anywhere in the Why section.
- Citation line shows under band 02.
- Pills wrap on a narrow window; bands stack copy-over-visual below 880px.
- With OS "reduce motion" on, bands render static (no rise/scroll animation).

---

## Notes for the implementer

- Copy is final — do not paraphrase. It was approved verbatim and run through the humanizer pass.
- Strings use double quotes where the text contains an apostrophe; Prettier keeps them (avoidEscape). Everything else stays single-quoted, no semicolons.
- The placeholder visuals are intentional, not stubs to "finish later" in code. Real assets get sourced separately and dropped into the same slots (see the spec's content-wishlist table).
