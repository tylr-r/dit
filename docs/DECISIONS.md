# Dit Product Decisions

Durable product decisions for Dit. This is not a changelog and should not
mirror git history. Add an entry when a decision explains product intent that
future work should preserve, especially if the same implementation could be
changed or "cleaned up" in a way that would accidentally undo that intent.

Entries should be short and written as decisions, not implementation notes:
what was decided, why it matters to the product, and what future agents should
avoid undoing.

## Decisions

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

  Local reset must succeed even offline. After the user confirms Reset App, check
  reachability before clearing anything. Signed-in offline users get a second
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
