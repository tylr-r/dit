# More Simple Morse

A minimal, single-letter Morse practice app. Tap for dot, hold for dash. When the
sequence matches, you get a new letter.

## Mission

Make Morse code practice feel calm, focused, and repeatable by removing every
non-essential interaction.

## Principles

- One letter at a time. No words, no levels, no clutter.
- One control. A single large button for all input.
- Immediate feedback. Correct advances, mistakes reset.
- Muscle memory first. Favor repetition and timing over menus.
- Works on touch and keyboard. Space or Enter is supported.

## How it works

1. A random letter appears.
2. Tap for dot, hold for dash to build the sequence.
3. If the sequence matches, you advance to a new letter.

## Development

```bash
npm install
npm run dev
```

## Deployment (Firebase Hosting)

Update `.firebaserc` if your Firebase project ID differs.

```bash
npm install -g firebase-tools
firebase login
npm run build
firebase deploy
```
