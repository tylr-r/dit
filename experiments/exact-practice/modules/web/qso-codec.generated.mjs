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

// ../../../dit/packages/core/src/utils/conversation.ts
var CONVERSATION_PROSIGNS = [
  ["K", "Go ahead"],
  ["KN", "Named station only"],
  ["BK", "Quick handoff"],
  ["AR", "End of message"],
  ["SK", "End of contact"],
  ["BT", "Separator"],
  ["AS", "Wait"],
  ["HH", "Correction"]
];

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

// ../../../dit/packages/core/src/utils/listenWave.ts
var isMorseSymbol = (value) => {
  "worklet";
  return value === "." || value === "-";
};
var tokenize = (code) => {
  "worklet";
  return code.split(" ").filter((token) => token === "/" || /^[.\-]+$/.test(token));
};
var getReceivedTextAtElapsedMs = (text, code, unitMs, elapsedMs, interCharacterGapMs = unitMs * 3, interWordGapMs = interCharacterGapMs * 7 / 3) => {
  if (unitMs <= 0 || elapsedMs < 0 || text.length === 0) {
    return "";
  }
  const tokens = tokenize(code);
  let cursorMs = 0;
  let textIndex = 0;
  let received = "";
  for (let tokenIndex = 0;tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    if (token === "/") {
      cursorMs += interWordGapMs;
      if (elapsedMs < cursorMs) {
        return received;
      }
      if (text[textIndex] === " ") {
        received += " ";
        textIndex += 1;
      }
      continue;
    }
    const symbols = token.split("").filter(isMorseSymbol);
    for (let symbolIndex = 0;symbolIndex < symbols.length; symbolIndex += 1) {
      cursorMs += symbols[symbolIndex] === "." ? unitMs : unitMs * 3;
      if (symbolIndex < symbols.length - 1) {
        cursorMs += unitMs;
      }
    }
    if (elapsedMs < cursorMs) {
      return received;
    }
    if (textIndex < text.length && text[textIndex] !== " ") {
      received += text[textIndex];
      textIndex += 1;
    }
    if (tokenIndex < tokens.length - 1 && tokens[tokenIndex + 1] !== "/") {
      cursorMs += interCharacterGapMs;
    }
  }
  return received;
};

// ../../../dit/packages/core/src/utils/morseUtils.ts
var LETTERS = Object.keys(MORSE_DATA);
var decodeMorseCode = (code) => {
  const match = Object.entries(MORSE_DATA).find(([, data]) => data.code === code);
  return match ? match[0] : null;
};

// ../../../dit/packages/core/src/utils/conversationMorse.ts
var prosignCodes = new Map(CONVERSATION_PROSIGNS.map(([name]) => [
  name,
  [...name].map((letter) => MORSE_DATA[letter].code).join("")
]));
var prosignNames = new Map([...prosignCodes].map(([name, code]) => [code, name]));
var tokenizeConversationText = (text) => text.split(/( )/).flatMap((word) => word === " " || prosignCodes.has(word) ? [word] : [...word]);
var textToConversationMorseCode = (input) => {
  const result = normalizeCustomText(input);
  const code = tokenizeConversationText(result.normalized).map((token) => token === " " ? "/" : prosignCodes.get(token) ?? MORSE_DATA[token].code).join(" ");
  return { ...result, code };
};
var decodeConversationMorseCode = (code) => prosignNames.get(code) ?? decodeMorseCode(code);
var getReceivedConversationTextAtElapsedMs = (text, code, unitMs, elapsedMs, interCharacterGapMs = unitMs * 3, interWordGapMs = interCharacterGapMs * 7 / 3) => getReceivedTextAtElapsedMs(tokenizeConversationText(text), code, unitMs, elapsedMs, interCharacterGapMs, interWordGapMs);
export {
  decodeConversationMorseCode,
  getReceivedConversationTextAtElapsedMs,
  textToConversationMorseCode
};
