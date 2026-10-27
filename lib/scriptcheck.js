export const RANGES = {
  as: [0x0980, 0x09ff],
  bn: [0x0980, 0x09ff],
  gu: [0x0a80, 0x0aff],
  hi: [0x0900, 0x097f],
  kn: [0x0c80, 0x0cff],
  ml: [0x0d00, 0x0d7f],
  mr: [0x0900, 0x097f],
  or: [0x0b00, 0x0b7f],
  ta: [0x0b80, 0x0bff],
  te: [0x0c00, 0x0c7f]
};

export const MARKERS = {
  as: ["ৰ", "ৱ", "নকৰে", "আছে", "হয়"],
  bn: ["এই", "হয়", "করে", "আছে", "না"],
  gu: ["છે", "નથી", "અને", "માટે"],
  hi: ["है", "और", "का", "की", "नहीं"],
  kn: ["ಇದು", "ಮತ್ತು", "ಇಲ್ಲ", "ಆಗಿದೆ", "ಅದು"],
  ml: ["ാണ്", "ില്ല", "ഇത്", "അത്", "ഒരു", "ഉള്ള"],
  mr: ["आहे", "आणि", "नाही", "ला", "च्या"],
  or: ["ଏହା", "ନାହିଁ", "ଅଛି", "ଏବଂ", "ପାଇଁ", "ଦ୍ୱାରା", "ହୋଇ", "ଇଛି", "ନ୍ତୁ", "ଭାବେ"],
  ta: ["இது", "உள்ள", "மற்றும்", "ஒரு", "அது"],
  te: ["ఇది", "మరియు", "ఉంది", "ఒక", "లేదు"]
};

export const NEGATIONS = {
  as: /নকৰে|নিদিয়ে|নলয়|নহয়|নকয়/u,
  bn: /করে না|দেয় না|নেয় না|নয়|বলে না/u,
  gu: /નથી|નહીં|નહિ/u,
  hi: /नहीं/u,
  kn: /ಿಲ್ಲ|ಇಲ್ಲ|ಅಲ್ಲ/u,
  ml: /ില്ല|ഇല്ല|അല്ല|മല്ല/u,
  mr: /नाही/u,
  or: /ନାହିଁ|ନୁହେଁ/u,
  ta: /ாது|அல்ல|ில்ல|இல்ல/u,
  te: /దు(?![\p{L}\p{M}])|కాదు|లేదు/u
};

export const BRANDS = ["LabDecode", "Google", "Gemini", "WhatsApp", "HER2", "PDF"];

const ZERO = { hi: 0x966, mr: 0x966, bn: 0x9e6, as: 0x9e6, gu: 0xae6, or: 0xb66, ta: 0xbe6, te: 0xc66, kn: 0xce6, ml: 0xd66 };

const LETTER = /[\p{L}\p{M}]/u;

export function scriptShare(text, code) {
  const range = RANGES[code];
  if (!range) return 0;
  let inRange = 0;
  let total = 0;
  for (const char of String(text || "")) {
    if (!LETTER.test(char)) continue;
    total += 1;
    const point = char.codePointAt(0);
    if (point >= range[0] && point <= range[1]) inRange += 1;
  }
  return total ? inRange / total : 0;
}

export function stripLatinTokens(text) {
  let out = String(text || "");
  for (const brand of BRANDS) out = out.split(brand).join(" ");
  return out.replace(/[A-Za-z][A-Za-z0-9-]*/g, " ");
}

export function hasMarker(text, code) {
  return (MARKERS[code] || []).some((marker) => String(text || "").includes(marker));
}

export function toAsciiDigits(text, code) {
  const zero = ZERO[code];
  return Array.from(String(text || ""))
    .map((char) => {
      const point = char.codePointAt(0);
      if (zero && point >= zero && point <= zero + 9) return String(point - zero);
      return char;
    })
    .join("");
}

export function numbersIn(text, code) {
  return (toAsciiDigits(text, code).match(/\d+(?:\.\d+)?/g) || []).map(String);
}
