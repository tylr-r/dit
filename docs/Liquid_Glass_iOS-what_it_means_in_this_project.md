# Liquid Glass in Dit (for AI agents and contributors)

Liquid Glass is Apple's current iOS design language — the translucent material treatment applied to navigation chrome, sheets, menus, toolbars, and standard controls from iOS 26 onward. Dit opts _into_ it on iOS rather than reimplementing it, and does its best to recreate the feel on every other platform.

## On iOS: use the system, don't fake it

If Apple ships a native control for the job, use it. Liquid Glass is what you get for free when you do. The moment you recreate a control with styled `View`s or stack your own blur layers, you've opted out and you will never match the system.

In practice:

- **Use** `@expo/ui` components, UIKit-backed RN primitives, and [expo-glass-effect](https://docs.expo.dev/versions/latest/sdk/glass-effect/) for glass surfaces.
- **Don't** recreate toggles, pickers, segmented controls, sheets, or menus with custom Views.
- **Don't** paint fake glass (gradient backgrounds, specular highlights, manually stacked blurs) onto standard controls.
- **Don't** force web spacing/radii/colors onto iOS chrome — system defaults are the point.

A PR that adds a `LiquidGlassButton` or `GlassPanel` of its own is almost always going the wrong way. Use the native control.

### iOS baseline checks

Any iOS PR should:

- Use native controls for standard interactions.
- Avoid custom backgrounds on navigation bars, tab bars, and toolbars.
- Work in dark mode and at large Dynamic Type sizes without breaking.
- Leave the MorseButton alone (see below).

## On web and other platforms: recreate the feel

There's no system material to opt into on web, so we build it ourselves. The goal is to feel like the same product as iOS, not to pixel-match iOS screens.

The standard recipe for a glass surface on web:

- Translucent background (e.g. `rgba(12, 18, 24, 0.62)` against the app's dark base).
- `backdrop-filter: blur(...) saturate(...)` with the matching `-webkit-` prefix.
- Minimal borders; let the blur separate the surface from what's behind it.
- Layout and hierarchy from Dit's own design tokens, not iOS-specific sizing.

And the same "don't fake depth" discipline applies: avoid heavy drop shadows, gradient overlays, or specular highlights. The material should read as *thin and alive*, not as a styled card.

The information architecture matches iOS (same screens, same hierarchy), but the controls and chrome are custom React components sized for web conventions. A picker on iOS is a native picker; on web it's a custom dropdown that follows Dit's web design language — not a copy of the iOS picker.

## Off-limits: the MorseButton

The `MorseButton` (the tap target learners use to send dits and dahs) is the central branding element of Dit. It's deliberately custom on both iOS and web, and it's already dialed in. **Do not restyle it, re-skin it, or try to make it "more Liquid Glass." Leave it alone unless explicitly asked to change it.**

Everything _around_ the MorseButton — chrome, settings, panels — should still follow the rules above for its platform.

---

See [STYLE_GUIDE.md](STYLE_GUIDE.md) for the broader UI intent on both platforms; [NATIVE_IOS.md](NATIVE_IOS.md) for what lives in the native module; [DESIGN.md](../DESIGN.md) for motion and visual tokens.
