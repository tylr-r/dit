// ../../../dit/packages/core/src/data/morse.ts
var MORSE_DATA = {
  A: { code: ".-", mnemonic: "a-PART", level: 1 },
  B: { code: "-...", mnemonic: "BOB-is-the-uncle", level: 3 },
  C: { code: "-.-.", mnemonic: "CO-ca-CO-la", level: 3 },
  D: { code: "-..", mnemonic: "DOG-did-it", level: 2 },
  E: { code: ".", mnemonic: "eh?", level: 1 },
  F: { code: "..-.", mnemonic: "fetch-a-FIRE-man", level: 3 },
  G: { code: "--.", mnemonic: "GRAND-MA-g", level: 2 },
  H: { code: "....", mnemonic: "hip-pi-ty-hop", level: 3 },
  I: { code: "..", mnemonic: "i-bid", level: 1 },
  J: { code: ".---", mnemonic: "let's JUMP, JUMP, JUMP", level: 3 },
  K: { code: "-.-", mnemonic: "KICK the CAN", level: 2 },
  L: { code: ".-..", mnemonic: "a LIGHT is lit", level: 3 },
  M: { code: "--", mnemonic: "MA-MA", level: 1 },
  N: { code: "-.", mnemonic: "NA-vy", level: 1 },
  O: { code: "---", mnemonic: "OH-MY-GOD", level: 2 },
  P: { code: ".--.", mnemonic: "a-POO-PY-smell", level: 3 },
  Q: { code: "--.-", mnemonic: "GOD-SAVE-the-QUEEN", level: 3 },
  R: { code: ".-.", mnemonic: "ro-TA-tion", level: 2 },
  S: { code: "...", mnemonic: "su-per-man", level: 2 },
  T: { code: "-", mnemonic: "TALL", level: 1 },
  U: { code: "..-", mnemonic: "u-ni-FORM", level: 2 },
  V: { code: "...-", mnemonic: "vee-vee-vee-VAH", level: 3 },
  W: { code: ".--", mnemonic: "the-WORLD-WAR", level: 2 },
  X: { code: "-..-", mnemonic: "X-marks-the-SPOT", level: 3 },
  Y: { code: "-.--", mnemonic: "WHY did I DIE?", level: 3 },
  Z: { code: "--..", mnemonic: "ZSA ZSA did it", level: 3 },
  "1": { code: ".----", mnemonic: "ONE-dot-then-DASHES", level: 4 },
  "2": { code: "..---", mnemonic: "TWO-dots-then-DASHES", level: 4 },
  "3": { code: "...--", mnemonic: "THREE-dots-then-DASHES", level: 4 },
  "4": { code: "....-", mnemonic: "FOUR-dots-then-DASH", level: 4 },
  "5": { code: ".....", mnemonic: "FIVE-dots", level: 4 },
  "6": { code: "-....", mnemonic: "DASH-then-FOUR-dots", level: 4 },
  "7": { code: "--...", mnemonic: "TWO-DASHES-then-THREE-dots", level: 4 },
  "8": { code: "---..", mnemonic: "THREE-DASHES-then-TWO-dots", level: 4 },
  "9": { code: "----.", mnemonic: "FOUR-DASHES-then-DOT", level: 4 },
  "0": { code: "-----", mnemonic: "FIVE-DASHES", level: 4 }
};

// ../../../dit/packages/core/src/utils/customListenText.ts
var SUPPORTED = /^[A-Z0-9]$/;
var normalizeCustomText = (input, options = {}) => {
  const maxChars = options.maxChars ?? 2000;
  let ignored = 0;
  let out = "";
  let lastWasSpace = true;
  for (const raw of input) {
    const upper = raw.toUpperCase();
    if (SUPPORTED.test(upper)) {
      out += upper;
      lastWasSpace = false;
      continue;
    }
    if (raw === " " || raw === `
` || raw === "\t" || raw === "\r") {
      if (!lastWasSpace) {
        out += " ";
        lastWasSpace = true;
      }
      continue;
    }
    ignored += 1;
  }
  let truncated = false;
  if (out.length > maxChars) {
    out = out.slice(0, maxChars).trimEnd();
    truncated = true;
  } else {
    out = out.trimEnd();
  }
  return { normalized: out, ignored, truncated };
};
var textToMorseCode = (input, options = {}) => {
  const { normalized, ignored, truncated } = normalizeCustomText(input, options);
  if (normalized.length === 0) {
    return { code: "", normalized, ignored, truncated };
  }
  const words = normalized.split(" ");
  const code = words.map((word) => word.split("").map((char) => MORSE_DATA[char].code).join(" ")).join(" / ");
  return { code, normalized, ignored, truncated };
};
export {
  normalizeCustomText,
  textToMorseCode
};
