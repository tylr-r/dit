# Project Brief: Dit Universal Platform

## 1. High-Level Objective

Transition an existing React TypeScript web app (hosted on Firebase) into a high-performance, multi-platform ecosystem. The goal is to maintain a web presence while launching a flagship iOS application that feels truly native, utilizing modern Apple design aesthetics.

## 2. Current State

- **Stack**: React 19 + TypeScript + Vite 7, hosted on Firebase
- **Structure**: Single-project web app (not yet a monorepo)
- **Core Logic**: Morse code encoding/decoding lives in `src/data/morse.ts`
- **Styling**: Plain CSS
- **Modes**: Practice, Freestyle, and Listen

## 3. Architectural Strategy: The "Single Source of Truth"

> **Migration Path**: The current web app will be restructured into a monorepo when iOS development begins.

- **Structure**: A Turborepo monorepo to manage shared code and platform-specific apps.
- **Shared Core**: All Morse code encoding/decoding logic, signal processing algorithms, and Firebase data schemas will reside in a shared TypeScript package (`packages/core`).
- **Web App** (`apps/web`): Maintain the existing React/Vite/Firebase web app, pulling from the shared logic package.
- **iOS App** (`apps/ios`): Built using React Native/Expo, with emphasis on Native Modules.

## 4. Design & Performance Intentions

- **"Liquid Glass" UI**: The iOS app should not feel like a web wrapper. Use SwiftUI for high-fidelity components, specifically focusing on glassmorphism, fluid gestures, and Apple-standard blur effects.
- **Native Integration**: Where performance or "feel" is critical (e.g., haptics, real-time audio synthesis for Morse signals, or complex shaders), prioritize writing native Swift code and bridging it to the React Native layer.
- **AI-Assisted Development**: Leverage AI to generate SwiftUI views and bridge code (Expo Modules) based on existing React component specifications.

## 5. Maintenance & Scalability

- **Logic Isolation**: Business logic should remain platform-agnostic. If a change is made to how Morse code is parsed, it should update both Web and iOS simultaneously.
- **Modern Tooling**: Use current stable versions—React 19, Vite 7, TypeScript 5.9, and Firebase 10. VS Code as primary IDE.
- **Firebase**: Maintain a unified backend for user profiles, saved messages, and cross-platform synchronization.

## 6. Coding Assistant Instructions

- **When writing Web UI**: Use React functional components with plain CSS (current convention).
- **When writing iOS UI**: Prioritize SwiftUI for native views.
- **When writing Logic**: Ensure code is strictly typed in TypeScript. Currently in `src/data/`; will migrate to `packages/core/` when monorepo is established.
- **Flexibility**: Suggest the most performant "native" way to achieve an effect before defaulting to a cross-platform library.
- **Context Awareness**: Always consider how changes affect shared logic and both platforms once the monorepo structure is in place.

## 7. Implementation Checklist

### Phase 0: Test Safety Net

- [x] Install Vitest and React Testing Library
- [x] Add `MORSE_CODE` data integrity tests (36 chars, unique codes, valid patterns)
- [x] Add unit tests for pure utilities: `clamp`, `formatWpm`, `getLettersForLevel`, `initializeScores`
- [x] Add unit tests for scoring: `getRandomWeightedLetter`, score increment/decrement logic
- [x] Add unit tests for parsers: `parseFirebaseScores`, `parseProgress`, `parseLocalStorageScores`
- [x] Install Playwright for E2E tests
- [x] Add E2E test: Practice mode correct/incorrect flow
- [x] Add E2E test: Freestyle mode decode flow
- [x] Add E2E test: Listen mode answer flow

### Phase 1: Web App Refactoring

- [x] Split `App.tsx` (~2030 lines) into custom hooks: `useMorseInput`, `useAudio`, `useProgress`, `useFirebaseSync`
- [x] Abstract platform-specific code: `navigator.vibrate`, `localStorage`, `AudioContext`
- [x] Create shared component props interfaces
- [x] Add React Testing Library tests for key components

### Phase 2: Monorepo Setup

- [x] Initialize Turborepo at project root
- [x] Configure `turbo.json` with build/lint/test pipelines
- [x] Move web app to `apps/web/`
- [x] Create `packages/core/` directory structure with `package.json` and `tsconfig.json`
- [x] Verify web app builds and deploys correctly

### Phase 3: Core Package Extraction

- [ ] Extract `MORSE_CODE` and `Letter` type from `src/data/morse.ts`
- [ ] Extract `PRACTICE_WORDS` from `src/data/practiceWords.ts`
- [ ] Extract utility functions: `clamp`, `formatWpm`, `getLettersForLevel`, `getRandomLetter`, `getRandomWeightedLetter`, `getWordsForLetters`, `getRandomWord`, `initializeScores`, `parseFirebaseScores`, `parseProgress`
- [ ] Extract constants: `DASH_THRESHOLD`, `UNIT_TIME_MS`, `INTER_LETTER_UNITS`, `INTER_WORD_UNITS`, `AUDIO_FREQUENCY`, `AUDIO_VOLUME`, `DEBOUNCE_DELAY`, `WPM_RANGE`
- [ ] Create TypeScript types package: `Progress`, `Letter`, score records
- [ ] Set up Vitest and write unit tests for all core utilities
- [ ] Create platform-agnostic Firebase service abstraction
- [ ] Update `apps/web` to import from `@dit/core`

### Phase 4: iOS App Development

- [ ] Initialize Expo app in `apps/ios/`
- [ ] Configure Expo Modules for native bridging
- [ ] Create SwiftUI components for "Liquid Glass" UI
- [ ] Implement native haptics module (replace `navigator.vibrate`)
- [ ] Implement native audio synthesis module (replace Web Audio API)
- [ ] Connect to `@dit/core` for Morse logic
- [ ] Implement Firebase Auth (Google Sign-In) for iOS
- [ ] Implement Firebase Realtime Database sync
- [ ] TestFlight beta deployment
- [ ] App Store submission
