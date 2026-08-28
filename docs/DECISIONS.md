# Dit Product Decisions

Durable product decisions for Dit. This is not a changelog and should not
mirror git history. Add an entry when a decision explains product intent that
future work should preserve, especially if the same implementation could be
changed or "cleaned up" in a way that would accidentally undo that intent.

Entries should be short and written as decisions, not implementation notes:
what was decided, why it matters to the product, and what future agents should
avoid undoing.

## Decisions

- **2026-08-27: Conversation uses on-air CW shorthand and local-time greetings.** Perfect RST reports are
  transmitted as `5NN`, not `599`. Time-of-day greetings use the learner's browser-local hour to choose
  `GM`, `GA`, `GE`, or `GN`. Keep both behaviors deterministic rather than relying only on model judgment.

- **2026-08-27: Conversation transcript text never gives away a reception exercise.** A received message stays
  concealed while its audio plays. Without live letters, it remains concealed until the operator explicitly
  reveals it, checks copy, or begins responding. With live letters enabled, the completed message may appear
  when playback finishes. Keep plaintext out of the DOM until one of those reveal conditions is met.

- **2026-08-26: Conversation copy is optional and never blocks keying.** The operator regains the Morse key as
  soon as the other station finishes, and keying stays visually primary. Empty copy is collapsed below the key;
  copy typed during playback remains expanded for grading. Checking or dismissing it is not a workflow gate.
  Keep reception practice and on-air turn-taking independent.

- **2026-08-26: Entering Conversation is silent until the operator acts.** Directly loading `/app/qso` must not
  allow hidden Practice auto-play to schedule a tone. Sound begins only from an explicit Conversation action
  such as choosing Send first or Receive first, replaying, or keying.

- **2026-08-26: Conversation exchanges progress one unit per turn.** A response to CQ contains only the
  callsign exchange and a handoff. Reports, names, locations, and station details belong in later turns and
  should not be front-loaded into one generated transmission. Preserve this pacing when changing models or
  prompts because realistic sequencing matters more than maximizing information per response.

- **2026-08-25: Conversation mode's vocabulary is not gated by the user's unlocked letter set.** Practice and
  Listen restrict content to `activeLetters` so learners never see unlearned characters, but a realistic CW QSO
  needs callsigns, RST reports, and other numbers to be authentic. Conversation is an optional, supplementary
  mode outside the guided beginner course — like the Reference modal, it always uses the full alphabet and
  digits. Do not thread `activeLetters`/`maxLevel` into the LLM prompt to "fix" this; that would defeat the
  point of the mode.

- **2026-08-25: Conversation mode is unscored and its content never syncs to Firebase.** Same precedent as
  custom Listen text: it doesn't touch `dailyActivity`, `letterAccuracy`, `listenTtr`, or streak, and neither
  the user's replies nor the LLM's turns are written to RTDB. Keep it that way — this is meant as unscored,
  private practice, not a tracked drill.

- **2026-08-25: LLM calls for Conversation mode go client-side through Firebase AI Logic, not a hand-rolled
  backend.** Dit has no server beyond Firebase hosting/RTDB; adding a custom backend just to proxy an API key
  would be disproportionate. Firebase AI Logic (Gemini Developer API backend) lets the web client call Gemini
  directly, protected by Firebase App Check (reCAPTCHA v3) instead of a bespoke key-management layer. If a
  second AI-backed feature needs this later, reuse this pattern rather than standing up a separate backend.

- **2026-06-12: The web root is a public homepage, not the app.** practicedit.com/
  introduces Dit to first-time visitors; the practice app lives at /app until it
  moves to a dedicated app subdomain. The homepage links to the app through the
  `WEB_APP_URL` constant in `HomePage.tsx`; update that constant (and add a /app
  redirect) when the subdomain goes live. Do not route the app back to the root.

- **2026-06-13: Homepage CTA hierarchy is web-first.** Visitors are already on the
  web, so the primary call to action everywhere is "Start practicing" (the web app);
  the App Store is the secondary link. A dedicated "On iPhone" section carries iOS
  conversion (copy, App Store badge, QR). Do not flip the App Store to primary just
  because the native app is the bigger product — the visitor's context wins.

- **2026-06-13: The homepage sells the method honestly — no invented claims.** The
  page exists to convince a skeptical learner that Dit is a serious way to learn
  Morse by ear, so every factual claim (Koch real-speed, Farnsworth spacing, TTR /
  adaptive review, frequency-ordered letters, paddle support, no account) must trace
  to `docs/Pedagogical_philosophy.md` or `docs/PLATFORM_PARITY.md`. Do not add
  marketing copy that overstates or invents capability; the credibility is the
  product.

- **2026-06-11: Show hints disables Practice scoring.** When the global **Show hints**
  setting is on, Practice attempts do not update scores, streak credit, or
  `letterAccuracy`. Guided course practice is exempt. Web's one-time **Show this hint**
  is a separate, per-letter affordance when global hints are off.

- **2026-06-11: Global playback settings apply to every Dit-initiated tone.**
  Playback letter speed and tone frequency from Settings are used for Listen, Practice
  auto-play, reference chart taps, Settings sound check (web), and NUX sound check.
  Use `buildPlaybackToneRequest` in `@dit/core` for ad-hoc playback outside the session
  controller; do not hardcode WPM or frequency for these surfaces.

- **2026-06-11: Morse tone volume lives in `@dit/core`.** Default playback amplitude is
  `AUDIO_VOLUME` (0.75), capped at `AUDIO_VOLUME_MAX` (0.9) via `resolveToneVolume`.
  Both web and iOS tone wrappers must use that helper — do not reintroduce per-platform
  floors or stale constants that fight the default.

- **2026-06-06: Local reset must succeed even offline.** After the user confirms Reset App,
  check reachability before clearing anything. Signed-in offline users get a second
  confirmation that server data will not be cleared unless they cancel, connect,
  and try again, and that Reset Device still clears this device only.

- **2026-06-06: Pre-iOS-26 glass action surfaces need a visible fallback.**
  Native Liquid Glass remains the preferred iOS material on iOS 26 and newer.
  On older iOS versions, custom action surfaces should use a restrained blur
  fallback instead of collapsing to Expo's plain `View` fallback, so primary
  controls keep their intended presence without faking system Liquid Glass.

- **2026-06-04: Web key sidetone must survive cold audio wake-up.** The first
  Morse key press after a refresh should feel as immediate as later presses.
  Browser audio startup is not a reason to drop or truncate that first keyed
  tone; preserve the first audible sidetone through Web Audio resume instead of
  optimizing only the already-warm path.

- **2026-06-02: Practice correctness feedback stays color-coded.** Correct
  answers briefly tint the Practice display with `feedback.success`; missed
  answers briefly tint it with `feedback.error`. This applies to the status
  text, the target character or active word character, and the pip row. Keep the
  feedback transient and tied to answer confirmation only; green/red are not
  selection colors, reward decoration, or persistent score styling.
