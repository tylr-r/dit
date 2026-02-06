# Native iOS Components

**Last Updated:** January 21, 2026  
**Status:** ✅ Core components functional  
**Commit:** `3439663`

---

## Overview

We've implemented native iOS UI components with authentic "Liquid Glass" aesthetics, replacing generic React Native components with platform-native controls that leverage `UIVisualEffectView` blur effects.

**What's Working:**
- ✅ Glass surface containers with configurable blur
- ✅ Glass buttons with press states
- ✅ Native segmented control for mode selection
- ✅ Full integration with existing app

---

## Components

### Glass Surface (`GlassSurface` → `DitGlassView`)
Foundational blur effect container using native `UIVisualEffectView`.

- **Type:** Custom native Swift wrapper
- **Where:** Settings panel background, containers
- **Key Feature:** Adjustable blur intensity
- **Architecture:** Rendered as background sibling to avoid Fabric crashes

### Glass Buttons (`GlassButton`)
Interactive buttons with blur effects and press feedback.

- **Type:** Expo's `expo-glass-effect` package
- **Where:** Settings panel actions (Reference, Sign in, etc.)
- **Key Feature:** Press opacity (0.85 → 0.7)
- **Why Expo:** Official package, well-maintained, less custom code

### Mode Selector (`GlassSegmentedControl`)
Native iOS segmented control for Practice/Freestyle/Listen modes.

- **Type:** Custom native UIKit (`UISegmentedControl`)
- **Where:** Top of main screen
- **Key Feature:** Pixel-perfect iOS appearance
- **Why Custom:** No React Native library matches native look

---

## Architecture

### Module Structure
```
modules/dit-native/
├── expo-module.config.json    # Registers native modules
├── index.tsx                  # TypeScript exports
└── ios/
    ├── DitNativeModule.swift           # Audio/haptic utilities
    ├── DitGlassView.swift              # Custom blur container
    └── DitGlassSegmentedControl.swift  # Mode selector
```

### Key Decisions

**UIKit over SwiftUI:** Direct UIKit controls avoid `UIHostingController` complexity and crashes.

**Expo Package for Buttons:** Using `expo-glass-effect` instead of custom implementation reduces maintenance burden and leverages Expo's testing.

**Sibling Architecture:** Glass blur views are siblings (not parents) to avoid React Native Fabric subview indexing issues.

---

## Known Issues

### Expo Prop Binding (Non-Critical)
**Problem:** Dynamic props (`items`, `selectedIndex`) aren't passed to native Swift code in `DitGlassSegmentedControl`.

**Workaround:** Mode names hardcoded in Swift. Works perfectly for current static use case.

**Impact:** 
- ✅ Functionality unaffected
- ❌ Can't change mode labels dynamically
- ⚠️ Not suitable for i18n without fix

**Investigation:** Likely Expo SDK 54 issue with array props or Fabric-specific problem.

---

## Implementation Guide

### Adding New Components

1. **Create native module:**
   ```bash
   # Add Swift file to modules/dit-native/ios/
   # Register in expo-module.config.json
   cd apps/ios/ios && pod install
   ```

2. **Create React wrapper:**
   ```tsx
   // apps/ios/src/components/YourComponent.tsx
   import { NativeYourComponent } from 'dit-native'
   export const YourComponent = (props) => <NativeYourComponent {...props} />
   ```

3. **Export types:**
   ```tsx
   // modules/dit-native/index.tsx
   export type YourComponentProps = ViewProps & { /* ... */ }
   ```

### Making Changes

**Native code (Swift):** Requires full rebuild via `npx expo run:ios`  
**React wrappers (TSX):** Hot reload works (press `r` in Metro)  
**Module registration:** Run `pod install` after editing `expo-module.config.json`

### Debugging

**Logs:**
- JavaScript: Metro terminal
- Native: Xcode console (filter for "Dit")

**Common Issues:**
- Build errors after deleting files → run `pod install`
- Props not updating → check for Expo prop binding issue
- Crashes on view creation → verify UIKit (not SwiftUI with UIHostingController)

---

## Roadmap

### ✅ Phase 1: Core (Complete)
Native components implemented and integrated.

### 🔄 Phase 2: Polish (In Progress)
- Debug Expo prop system
- Add SF Symbol icons to buttons
- Fine-tune glass opacity/appearance
- Verify settings panel stability

### 📋 Phase 3: Advanced
- Custom glass styles (vibrant, prominent)
- Animated mode transitions
- Haptic feedback enhancements
- i18n support (requires prop fix)

### 📋 Phase 4: Release
- Comprehensive testing on devices
- Performance profiling
- Accessibility verification
- TestFlight beta

---

## Dependencies

```json
{
  "expo-glass-effect": "~0.1.8"
}
```

**Requirements:**
- iOS 15+ (for `expo-glass-effect`)
- Expo SDK 54+
- React Native Fabric enabled

---

## FAQ

**Q: Why native instead of React Native libraries?**  
A: Authentic iOS appearance, better performance, system integration (haptics, etc.).

**Q: When to use custom native vs Expo packages?**  
A: Custom when no alternative exists. Expo packages when available (less maintenance).

**Q: Why hardcode mode names?**  
A: Pragmatic - works perfectly for static data, unblocks development, easy to fix later.

**Q: Will this work on Android?**  
A: No - iOS only. Android needs separate Material Design implementation.

**Q: How do I customize blur appearance?**  
A: Use `glassEffectStyle` ("clear"/"regular") or `intensity` prop on `GlassSurface`.

**Q: Can I use SwiftUI?**  
A: Not recommended - `UIHostingController` adds complexity. Use UIKit for React Native bridges.

---

## References

- [Expo Glass Effect](https://docs.expo.dev/versions/latest/sdk/glass-effect/)
- [Expo Modules API](https://docs.expo.dev/modules/module-api/)
- [UIVisualEffectView](https://developer.apple.com/documentation/uikit/uivisualeffectview)
- [UISegmentedControl](https://developer.apple.com/documentation/uikit/uisegmentedcontrol)

**Project Files:**
- Native modules: `modules/dit-native/ios/`
- React wrappers: `apps/ios/src/components/`
- Type definitions: `modules/dit-native/index.tsx`

---

**Questions?** Check Xcode logs or review the [Expo Modules documentation](https://docs.expo.dev/modules/module-api/).
