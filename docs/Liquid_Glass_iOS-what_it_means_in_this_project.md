# Liquid Glass (iOS) in our Expo UI + React Native app

## The point

We are NOT building “Liquid Glass” as a custom style.  
We are building an iOS app version of the website using **native iOS controls** (via Expo UI / platform components) so iOS automatically renders the newest “Liquid Glass” material and behaviors where applicable.

## Constraints (how we actually work)

- We build in **VS Code**, not Xcode.
- Stack: **React Native + Expo**, monorepo.
- We already have a **web UI** that looks good, iOS is a separate implementation optimized for:
  - interaction performance
  - native iOS feel for controls
  - automatic adoption of Apple’s current UI style with a focus on iOS 26's liquid glass

## Definition: “Liquid Glass” (for this project)

“Liquid Glass” = the **system’s current translucent/material treatment** applied to:

- navigation chrome (bars, sheets, popovers, menus, toolbars)
- standard controls (buttons, toggles, sliders, pickers)

We do not implement it manually. We enable it by:

- using native components
- avoiding custom backgrounds/overrides that block system materials
- keeping layout + typography aligned with system defaults

## Rule 1: Native-first component policy (iOS)

When building the iOS app screens:

1. If a standard iOS control exists, use the **native control equivalent** in Expo UI / RN.
2. If we can’t get a native control, use the simplest RN fallback, but do NOT “fake iOS”.
3. Only create a custom component if it’s core to the product and cannot be represented with native controls.

### Practical mapping examples

- Toggle → native `Switch`
- Text entry → native `TextInput`
- Date/time → native date/time picker (platform)
- Menus → native menu component (platform)
- Sheets/popovers → native presentation patterns (platform)
- Segmented control → native segmented control (platform)

(Do not recreate these with styled Views.)

## Rule 2: Don’t fight system materials

Avoid, especially on iOS:

- custom gradient “glass” backgrounds on controls
- custom blur layers stacked everywhere
- heavy shadows, hard borders, fake specular highlights
- forcing web spacing/radii onto native controls

Prefer:

- default/native appearances
- system colors / dynamic colors
- minimal container styling (layout only)

## Rule 3: Web design ≠ iOS design

We are not porting pixel-perfect web UI to iOS.
We are porting:

- information architecture
- screen structure
- content hierarchy
  …and then using native iOS controls for interaction and chrome.

If the web UI has a custom dropdown, on iOS it becomes a native picker/menu.
If the web UI has a custom segmented control, on iOS it becomes a native segmented control.
If the web UI has a custom modal, on iOS it becomes a native sheet.

## Rule 4: Layout guidance (keep it native)

- Use system-ish spacing, don’t “tight pack” controls like web.
- Avoid overlapping translucent layers (looks messy and hurts legibility).
- Keep tap targets comfortably large.
- Let lists/forms use their natural row heights where possible.

## Rule 5: Do not change the MorseButton

The current custom "morse button" is already good to go and no need to edit it's design

If we implement custom UI, we must explicitly provide fallbacks (no glass reliance).

## “Liquid Glass compliant” checklist (iOS PR review)

A PR is compliant if:

- ✅ Uses native controls for all standard interactions
- ✅ No custom backgrounds on navigation bars / tab bars / toolbars
- ✅ No fake “glass” gradients or highlights on controls
- ✅ Minimal styling: layout + spacing only
- ✅ Works in dark mode + larger text sizes without breaking

Fails if:

- ❌ Recreates iOS controls with styled Views
- ❌ Adds “LiquidGlass\*” custom components for standard UI
- ❌ Applies blur/translucency everywhere as decoration
- ❌ Overrides system visuals to match the web version

## Implementation note for the AI coder

When asked to build a UI element, answer in this order:

1. What is the closest native iOS control/pattern?
2. Can Expo UI provide it directly? If yes, use it.
3. If not, use a platform-native library/component.
4. Only then, minimal custom fallback, without pretending it’s Apple UI.
