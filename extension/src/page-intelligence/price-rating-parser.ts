/**
 * Generic Price and Rating Heuristic Parsers for Browsy Page Intelligence
 * Extracts currency-annotated values and review score indicators.
 */

import type { PriceInfo, RatingInfo, CurrencyCode } from "./types";

// Patterns for currencies
const PRICE_REGEXES: Array<{ regex: RegExp; currency: CurrencyCode }> = [
  // INR: ₹799, ₹ 1,299.00, Rs. 799, Rs 1299, INR 1,499
  { regex: /(?:₹|Rs\.?|INR)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i, currency: "INR" },
  // USD: $29.99, $ 1,400, USD 99
  { regex: /(?:\$|USD)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i, currency: "USD" },
  // EUR: €39, € 12.50, 45 €
  { regex: /(?:€|EUR)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+(?:[.,][0-9]{2})?)|([0-9]+(?:[.,][0-9]{2})?)\s*€/i, currency: "EUR" },
  // GBP: £45, £ 120.00
  { regex: /(?:£|GBP)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i, currency: "GBP" },
];

/**
 * Parses price information from raw text.
 */
export function extractPrice(text: string): PriceInfo | null {
  if (!text) return null;

  for (const { regex, currency } of PRICE_REGEXES) {
    const match = text.match(regex);
    if (match) {
      const rawNumberStr = match[1] || match[2] || "";
      const normalizedNumStr = rawNumberStr.replace(/,/g, "").replace(/\.(?=.*\.)/g, "");
      const amount = parseFloat(normalizedNumStr);

      if (!isNaN(amount) && amount > 0 && amount < 100000000) {
        return {
          raw: match[0].trim(),
          amount,
          currency,
        };
      }
    }
  }

  return null;
}

/**
 * Star unicode characters
 */
const STAR_CHARS = ["★", "⭐", "☆"];

/**
 * Parses rating information from raw text or element context.
 */
export function extractRating(text: string): RatingInfo | null {
  if (!text) return null;
  const trimmed = text.trim();

  // Pattern 1: Star icon presence (e.g. "4.2 ★", "4.5⭐", "4.8 out of 5")
  const hasStar = STAR_CHARS.some((s) => trimmed.includes(s));

  // 4.5 / 5 or 4.5/5
  const scoreSlashFive = trimmed.match(/([0-5](?:\.[0-9])?)\s*\/\s*5/);
  if (scoreSlashFive) {
    const score = parseFloat(scoreSlashFive[1]);
    if (!isNaN(score) && score >= 0 && score <= 5) {
      return {
        raw: scoreSlashFive[0],
        score,
        maxScore: 5,
      };
    }
  }

  // 4.2 out of 5
  const outOfFive = trimmed.match(/([0-5](?:\.[0-9])?)\s*(?:out of|\/)\s*5/i);
  if (outOfFive) {
    const score = parseFloat(outOfFive[1]);
    if (!isNaN(score) && score >= 0 && score <= 5) {
      return {
        raw: outOfFive[0],
        score,
        maxScore: 5,
      };
    }
  }

  // Score accompanied by star symbol: "4.2 ★" or "★ 4.2"
  if (hasStar) {
    const starMatch = trimmed.match(/([1-5](?:\.[0-9])?)/);
    if (starMatch) {
      const score = parseFloat(starMatch[1]);
      if (!isNaN(score) && score >= 1 && score <= 5) {
        return {
          raw: trimmed,
          score,
          maxScore: 5,
        };
      }
    }
    // Count filled stars: e.g. "★★★★☆"
    const filledStars = (trimmed.match(/★/g) || []).length;
    if (filledStars > 0 && filledStars <= 5) {
      return {
        raw: trimmed,
        score: filledStars,
        maxScore: 5,
      };
    }
  }

  return null;
}
