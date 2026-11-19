/**
 * Generic Text and NLP Utilities for Browsy
 * Provides website-agnostic word stemming, text-to-number parsing, and semantic matching.
 */

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const MAGNITUDES: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  k: 1000,
  lakh: 100000,
  million: 1000000,
};

/**
 * Parses numeric value from a string that may contain digits ("1,000", "3.5k") or English words ("three thousand").
 */
export function parseNumberFromText(input: string): number | null {
  if (!input) return null;
  const clean = input.trim().toLowerCase();

  // 1. Direct digit with optional k/m suffix (e.g. "3k", "3.5k", "1000", "1,000")
  const digitSuffixMatch = clean.match(/([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*([km])?\b/i);
  if (digitSuffixMatch) {
    const rawNum = parseFloat(digitSuffixMatch[1].replace(/,/g, ""));
    const suffix = digitSuffixMatch[2]?.toLowerCase();
    if (!isNaN(rawNum)) {
      if (suffix === "k") return rawNum * 1000;
      if (suffix === "m") return rawNum * 1000000;
      return rawNum;
    }
  }

  // 2. English word numbers (e.g. "three thousand", "two thousand five hundred", "five hundred")
  const words = clean.replace(/[^a-z\s-]/g, " ").split(/[\s-]+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let hasNumberWord = false;

  for (const w of words) {
    if (NUMBER_WORDS[w] !== undefined) {
      current += NUMBER_WORDS[w];
      hasNumberWord = true;
    } else if (MAGNITUDES[w] !== undefined) {
      const mag = MAGNITUDES[w];
      hasNumberWord = true;
      if (current === 0) current = 1;
      if (mag === 100) {
        current *= 100;
      } else {
        total += current * mag;
        current = 0;
      }
    }
  }

  if (hasNumberWord) {
    total += current;
    return total > 0 ? total : null;
  }

  return null;
}

/**
 * Generic English pluralization for common nouns.
 */
export function pluralize(word: string): string {
  if (!word) return "";
  const w = word.trim().toLowerCase();
  if (w.endsWith("s") || w.endsWith("sh") || w.endsWith("ch") || w.endsWith("x") || w.endsWith("z")) {
    return `${w}es`;
  }
  if (w.endsWith("y") && !/[aeiou]y$/i.test(w)) {
    return `${w.slice(0, -1)}ies`;
  }
  return `${w}s`;
}

/**
 * Generic English singularization for common nouns.
 */
export function singularize(word: string): string {
  if (!word) return "";
  const w = word.trim().toLowerCase();
  if (w.endsWith("ies") && w.length > 3) {
    return `${w.slice(0, -3)}y`;
  }
  if (w.endsWith("es") && (w.endsWith("shes") || w.endsWith("ches") || w.endsWith("xes") || w.endsWith("sses"))) {
    return w.slice(0, -2);
  }
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 2) {
    return w.slice(0, -1);
  }
  return w;
}

/**
 * Checks if two words match semantically (accounting for singular/plural forms).
 */
export function wordsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  if (cleanA === cleanB) return true;
  if (pluralize(cleanA) === cleanB || singularize(cleanA) === cleanB) return true;
  if (pluralize(cleanB) === cleanA || singularize(cleanB) === cleanA) return true;
  return false;
}

/**
 * Checks if a corpus of text contains a word in either singular or plural form.
 */
export function textContainsWord(corpus: string, word: string): boolean {
  if (!corpus || !word) return false;
  const c = corpus.toLowerCase();
  const w = word.toLowerCase();
  const sing = singularize(w);
  const plur = pluralize(w);
  const regex = new RegExp(`\\b(?:${sing}|${plur})\\b`, "i");
  return regex.test(c);
}
