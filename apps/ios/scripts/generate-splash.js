/**
 * Generates assets/splash-welcome.png — the native iOS splash image rendered
 * as the NUX "Welcome to Dit" screen (logo + title on dark bg).
 *
 * The canvas aspect ratio matches modern iPhones (393×852pt ≈ 2.167:1) so
 * `resizeMode: contain` fills the screen edge-to-edge on both the LaunchScreen
 * storyboard and the expo-splash-screen runtime view. Without edge-to-edge
 * fill, the two layers letterbox around different vertical centers (full
 * window vs safe area), causing a visible jump at hand-off.
 *
 * Run: `node apps/ios/scripts/generate-splash.js`
 */

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const LOGO_SVG_PATH = path.join(__dirname, '../../web/public/Dit-logo.svg')
const OUT_PATH = path.join(__dirname, '../assets/splash-welcome.png')
// Expo prebuild is incremental and skips re-copying the splash image when
// app.json hasn't changed, so we write directly into the Xcode asset catalog
// too. Without this, regenerating the PNG leaves a stale copy bundled in the
// app and the user sees the old splash on cold launch.
const IOS_IMAGESET_DIR = path.join(
  __dirname,
  '../ios/Dit/Images.xcassets/SplashScreenLegacy.imageset',
)

const logoSource = fs.readFileSync(LOGO_SVG_PATH, 'utf8')
const innerMatch = logoSource.match(/<svg[^>]*>([\s\S]*)<\/svg>/)
if (!innerMatch) throw new Error('Failed to parse Dit-logo.svg')
const logoInner = innerMatch[1]

// Canvas = iPhone 17 @3x (1179×2556 px ≙ 393×852 pt). Content positioned to
// match the React welcome screen: logo centered in the body area
// (insets.top + spacing.xl above, insets.bottom + spacing.xl below), with the
// title 24pt below the logo. Numbers below are in pixels (@3x).
const CANVAS_W = 1179
const CANVAS_H = 2556
const SCALE_PT = 3 // @3x pt→px

// Welcome composition (NuxModal is absoluteFill over the 852pt window, center
// at 426pt). Match React's actual visible geometry:
//   Logo box 120pt. Text "Welcome to Dit" is fontSize 32 weight 600 in a flex
//   column with `gap: 48`. React's flex gap is box-to-box, but the Text box is
//   ~40pt tall (line height) while the cap height is ~22pt — so there's
//   ~9pt of top padding above the visible letters, making the visible gap
//   between logo bottom and cap top ~57pt. SVG <text y=…> places the
//   baseline, so baseline = logo_bottom + 57 + 22 = logo_bottom + 79.
const LOGO_SIZE_PT = 120
const LOGO_SIZE = LOGO_SIZE_PT * SCALE_PT // 360px
const LOGO_TOP_PT = 325
const LOGO_X = (CANVAS_W - LOGO_SIZE) / 2
const LOGO_Y = LOGO_TOP_PT * SCALE_PT
const LOGO_SCALE = LOGO_SIZE / 806
const TEXT_BASELINE_PT = 526
const TEXT_Y = TEXT_BASELINE_PT * SCALE_PT // 1500px
const TEXT_SIZE_PT = 32
const TEXT_SIZE = TEXT_SIZE_PT * SCALE_PT // 96px
const TEXT_FILL = '#F9F7F4' // hsl(24, 29%, 97%) — matches colors.text.primary
const BG = '#0a0c12'

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="${BG}"/>
  <g transform="translate(${LOGO_X}, ${LOGO_Y}) scale(${LOGO_SCALE})" opacity="0.9" fill="${TEXT_FILL}">
    ${logoInner}
  </g>
  <text
    x="${CANVAS_W / 2}"
    y="${TEXT_Y}"
    font-family="SF Pro Display, -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, sans-serif"
    font-size="${TEXT_SIZE}"
    font-weight="600"
    letter-spacing="-1"
    fill="${TEXT_FILL}"
    text-anchor="middle"
  >Welcome to Dit</text>
</svg>`

sharp(Buffer.from(svg))
  .png()
  .toFile(OUT_PATH)
  .then((info) => {
    console.log(`Wrote ${OUT_PATH} (${info.width}x${info.height}, ${info.size} bytes)`)
    if (fs.existsSync(IOS_IMAGESET_DIR)) {
      for (const name of ['image.png', 'image@2x.png', 'image@3x.png']) {
        const dest = path.join(IOS_IMAGESET_DIR, name)
        fs.copyFileSync(OUT_PATH, dest)
      }
      console.log(`Synced to ${IOS_IMAGESET_DIR}`)
    }
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
