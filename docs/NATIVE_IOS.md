# Native iOS Components

**Last Updated:** January 21, 2026  
**Status:**

---

## Overview

We have an existing web app that is stable.

---

## Architecture

### Module Structure

### Key Decisions

---

## Known Issues

---

## Implementation Guide

### Adding New Components

### Making Changes

**Native code (Swift):** Requires full rebuild via `npx expo run:ios`  
**React wrappers (TSX):** Hot reload works (press `r` in Metro)  
**Module registration:** Run `pod install` after editing `expo-module.config.json`

### Debugging

**Logs:**

- JavaScript: Metro terminal
- Native: Xcode console (filter for "Dit")

**Common Issues:**

---

## Roadmap

---

## Dependencies

---

## Audio Playback: Listen Mode Strategy

**Why is the audio player kept alive and looping in listen mode?**

To ensure instant and accurate Morse code playback in listen mode, the app keeps the tone audio player alive, looping, and muted/unmuted between tones, rather than loading/unloading or pausing. This prevents any delay or cutoff at the start/end of playback, which can occur if the player is reloaded or started from a stopped state. The player is only unloaded when leaving listen mode or backgrounding the app. See inline comments in `App.tsx` for implementation details.

---

## FAQ

**Q: Why native instead of React Native libraries?**  
A: Authentic iOS appearance, better performance, system integration (haptics, etc.).

**Q: When to use custom native vs Expo packages?**  
A: Custom when no alternative exists. Expo packages when available (less maintenance).

**Q: How do use the Expo Glass Effect?**  
A: Use the provided Expo Glass Effect components to leverage `UIVisualEffectView`. This ensures performant, native-quality blurring instead of simulating it with CSS transparency.

---

## References

- [Expo Glass Effect](https://docs.expo.dev/versions/latest/sdk/glass-effect/)
  - React components that render a liquid glass effect using iOS's native UIVisualEffectView.
- [Expo UI](https://docs.expo.dev/versions/latest/sdk/ui/)
  - A set of components that allow you to build UIs directly with Jetpack Compose and SwiftUI from React.
- [UIVisualEffectView](https://developer.apple.com/documentation/uikit/uivisualeffectview)
- [UISegmentedControl](https://developer.apple.com/documentation/uikit/uisegmentedcontrol)

**Project Files:**

---

**Questions?** Check Xcode logs or review the [Expo Modules documentation](https://docs.expo.dev/modules/module-api/).
