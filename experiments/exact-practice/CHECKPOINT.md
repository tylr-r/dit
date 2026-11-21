# Dit Exact experiment

This branch preserves the in-progress migration from Dit at `609ed8b9bf2d53879d7c9efd3e32b7d32b85b77f`. The comparison baseline is the shipped Dit experience. The experiment uses bundle ID `com.tylerobinson.dit.exactspike` and targets iOS 26.0 or later.

## Source and verification

The Contract describes the views, routes, widget and UI tests. The Apple modules provide native input, audio, haptics, session storage, reminder and accessibility behavior. The shared reducers, browser modules, generated session bundle, icon layers, audio and widget artwork are included. Account UI tests use synthetic identities and an isolated Simulator-only service.

Use the pinned Exact checkout at `38a027fd41f7e060791de33883766a4317956bcc`. From this directory, `EXACT=/path/to/exact bun exact.mjs --help` links the checkout for the launcher. The Bun lockfile references the shader package inside that checkout. Some comparison tools and tests retain development-machine paths to Bun, Playwright or pinned Dit source. They require the corresponding local toolchain layout.

- `node --test --test-concurrency=1 tests/*.mjs` runs the JavaScript tests.
- `sh tools/check-apple-session.sh` exercises the Apple session with Swift, JavaScriptCore and temporary private records on macOS.
- Under `parity-docs/evidence/`, the included Swift files and XCTest project generator are test source. The installed-account driver exercises cold restoration, rejected and delayed reads, switching and sign-out.

Full iOS feature and UX parity remains open. Previous Simulator comparisons used iOS 27.0 beta. The deployment minimum alone does not verify execution on iOS 26. Native motion, VoiceOver, physical paddle timing, audio onset and haptic synchronization still require matched evaluation. The Git checkpoint adds no release or deployment.
