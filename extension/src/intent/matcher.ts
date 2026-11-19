/**
 * Intent & Page Intelligence Matcher for Browsy AI Intent Engine
 * Correlates structured intent with real Stage 2 DOM elements and repeated cards.
 */

import type {
  StructuredIntent,
  MatchedItem,
  ConditionEvaluation,
  MatchClassification,
} from "./types";
import type {
  StructuredPageIntelligence,
  InteractiveElement,
  RepeatedItem,
} from "../page-intelligence/types";

export interface ControlMatches {
  searchInput?: InteractiveElement;
  filterControls: Array<{ control: InteractiveElement; reason: string }>;
  applyButton?: InteractiveElement;
  navLink?: InteractiveElement;
}

const RED_COLOR_REGEX = /\b(?:red|maroon|crimson|rust|scarlet|burgundy|wine|ruby|cherry)\b/i;
const OTHER_PRIMARY_COLORS_REGEX = /\b(?:blue|navy|green|olive|yellow|black|white|grey|gray|pink|purple|orange|brown)\b/i;
const CHECKED_PATTERN_REGEX = /\b(?:check|checked|checks|plaid|tartan|gingham|buffalo check|windowpane)\b/i;
const OPPOSING_PATTERNS_REGEX = /\b(?:solid|plain|striped|stripes|polka|floral|printed)\b/i;

/**
 * Evaluates a repeated card item against each constraint independently.
 * Strictly verifies conditions, distinguishes confirmed vs partial matches,
 * and rejects items that violate any specified constraint.
 */
export function evaluateItemMatch(
  item: RepeatedItem,
  intent: StructuredIntent
): {
  isMatch: boolean;
  matchClassification: MatchClassification;
  evaluations: ConditionEvaluation[];
  verifiedConditions: string[];
  unverifiedConditions: string[];
  reasons: string[];
  score: number;
} {
  const evaluations: ConditionEvaluation[] = [];
  const verifiedConditions: string[] = [];
  const unverifiedConditions: string[] = [];
  const reasons: string[] = [];
  let score = 0;

  const fullText = `${item.title} ${(item.metaText || []).join(" ")} ${(item.badges || []).join(" ")} ${item.imageAlt || ""}`.toLowerCase();

  // 1. Category Constraint
  if (intent.entities.category) {
    const cat = intent.entities.category.toLowerCase();
    if (fullText.includes(cat)) {
      evaluations.push({
        name: "category",
        label: `Category: ${cat}`,
        status: "verified",
        evidence: `Category '${cat}' confirmed in item title`,
      });
      verifiedConditions.push(`Category: ${cat}`);
      reasons.push(`Category: ${cat}`);
      score += 2;
    } else if (/\b(?:jeans|trousers|pants|shorts|shoes|sneakers|jacket)\b/i.test(fullText) && !fullText.includes(cat)) {
      evaluations.push({
        name: "category",
        label: `Category: ${cat}`,
        status: "violated",
        evidence: `Item is not in requested category '${cat}'`,
      });
    } else {
      evaluations.push({
        name: "category",
        label: `Category: ${cat}`,
        status: "unverified",
        evidence: `Category not explicitly stated on card`,
      });
      unverifiedConditions.push(`Category: ${cat}`);
    }
  }

  // 2. Color Constraint
  if (intent.filters.color) {
    const color = String(intent.filters.color).toLowerCase();
    const isRedReq = color === "red";
    const colorRegex = isRedReq ? RED_COLOR_REGEX : new RegExp(`\\b${color}\\b`, "i");

    if (colorRegex.test(fullText)) {
      evaluations.push({
        name: "color",
        label: `Color: ${color}`,
        status: "verified",
        evidence: `Color matches '${color}'`,
      });
      verifiedConditions.push(`Color: ${color}`);
      reasons.push(`Color: ${color}`);
      score += 2;
    } else if (OTHER_PRIMARY_COLORS_REGEX.test(fullText) && !colorRegex.test(fullText)) {
      evaluations.push({
        name: "color",
        label: `Color: ${color}`,
        status: "violated",
        evidence: `Color differs from requested '${color}'`,
      });
    } else {
      evaluations.push({
        name: "color",
        label: `Color: ${color}`,
        status: "unverified",
        evidence: `Color not specified on item card`,
      });
      unverifiedConditions.push(`Color: ${color}`);
    }
  }

  // 3. Pattern Constraint
  if (intent.filters.pattern) {
    const pattern = String(intent.filters.pattern).toLowerCase();
    const isCheckReq = pattern === "checked";
    const patternRegex = isCheckReq ? CHECKED_PATTERN_REGEX : new RegExp(`\\b${pattern}\\b`, "i");

    if (patternRegex.test(fullText)) {
      evaluations.push({
        name: "pattern",
        label: `Pattern: ${pattern}`,
        status: "verified",
        evidence: `Pattern matches '${pattern}'`,
      });
      verifiedConditions.push(`Pattern: ${pattern}`);
      reasons.push(`Pattern: ${pattern}`);
      score += 2;
    } else if (OPPOSING_PATTERNS_REGEX.test(fullText) && !patternRegex.test(fullText)) {
      evaluations.push({
        name: "pattern",
        label: `Pattern: ${pattern}`,
        status: "violated",
        evidence: `Pattern is not checked (e.g. solid or striped)`,
      });
    } else {
      evaluations.push({
        name: "pattern",
        label: `Pattern: ${pattern}`,
        status: "unverified",
        evidence: `Pattern not specified on item card`,
      });
      unverifiedConditions.push(`Pattern: ${pattern}`);
    }
  }

  // 4. Size Constraint
  if (intent.filters.size) {
    const size = String(intent.filters.size).toUpperCase();
    const sizeRegex = new RegExp(`\\b${size}\\b|size:\\s*${size}\\b|extra large`, "i");

    if (sizeRegex.test(fullText)) {
      evaluations.push({
        name: "size",
        label: `Size: ${size}`,
        status: "verified",
        evidence: `Size ${size} confirmed on card`,
      });
      verifiedConditions.push(`Size: ${size}`);
      reasons.push(`Size: ${size}`);
      score += 2;
    } else if (/available\s+sizes?:\s*([smlxxl,\s]+)/i.test(fullText) && !sizeRegex.test(fullText)) {
      evaluations.push({
        name: "size",
        label: `Size: ${size}`,
        status: "violated",
        evidence: `Size ${size} not in available sizes`,
      });
    } else {
      evaluations.push({
        name: "size",
        label: `Size: ${size}`,
        status: "unverified",
        evidence: `Size availability not displayed on listing card`,
      });
      unverifiedConditions.push(`Size ${size}`);
    }
  }

  // 5. Max Price Constraint
  if (intent.constraints.maxPrice !== undefined) {
    const maxP = intent.constraints.maxPrice;
    if (item.price && item.price.amount !== undefined) {
      if (item.price.amount <= maxP) {
        evaluations.push({
          name: "maxPrice",
          label: `Price: ${item.price.raw} (≤ ₹${maxP.toLocaleString()})`,
          status: "verified",
          evidence: `Price ${item.price.raw} meets budget ≤ ₹${maxP.toLocaleString()}`,
        });
        verifiedConditions.push(`Price: ${item.price.raw}`);
        reasons.push(`Price: ${item.price.raw} (≤ ₹${maxP.toLocaleString()})`);
        score += 3;
      } else {
        evaluations.push({
          name: "maxPrice",
          label: `Price: ${item.price.raw} (exceeds ₹${maxP.toLocaleString()})`,
          status: "violated",
          evidence: `Price ${item.price.raw} exceeds limit of ₹${maxP.toLocaleString()}`,
        });
      }
    } else {
      evaluations.push({
        name: "maxPrice",
        label: `Price: ≤ ₹${maxP.toLocaleString()}`,
        status: "unverified",
        evidence: `Price not displayed on card`,
      });
      unverifiedConditions.push(`Price ≤ ₹${maxP.toLocaleString()}`);
    }
  }

  // 6. Min Rating Constraint
  if (intent.constraints.minRating !== undefined) {
    const minR = intent.constraints.minRating;
    if (item.rating && item.rating.score !== undefined) {
      if (item.rating.score >= minR) {
        evaluations.push({
          name: "minRating",
          label: `Rating: ${item.rating.score}★`,
          status: "verified",
          evidence: `Rating ${item.rating.score}★ is ≥ ${minR}★`,
        });
        verifiedConditions.push(`Rating: ${item.rating.score}★`);
        reasons.push(`Rating: ${item.rating.score}★ (≥ ${minR}★)`);
        score += 2;
      } else {
        evaluations.push({
          name: "minRating",
          label: `Rating: ${item.rating.score}★ (below ${minR}★)`,
          status: "violated",
          evidence: `Rating ${item.rating.score}★ is below minimum ${minR}★`,
        });
      }
    } else {
      evaluations.push({
        name: "minRating",
        label: `Rating: ≥ ${minR}★`,
        status: "unverified",
        evidence: `Rating not displayed on card`,
      });
      unverifiedConditions.push(`Rating ≥ ${minR}★`);
    }
  }

  // Fallback: If no structured filters were specified, match based on query terms
  if (evaluations.length === 0) {
    const words = intent.rawQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    for (const w of words) {
      if (fullText.includes(w)) {
        reasons.push(`Matches keyword "${w}"`);
        verifiedConditions.push(`Matches "${w}"`);
        score += 1;
      }
    }
    const isMatch = reasons.length > 0;
    return {
      isMatch,
      matchClassification: isMatch ? "confirmed" : "rejected",
      evaluations: [],
      verifiedConditions,
      unverifiedConditions: [],
      reasons,
      score,
    };
  }

  // Determine overall match classification
  const hasViolation = evaluations.some((e) => e.status === "violated");
  if (hasViolation) {
    return {
      isMatch: false,
      matchClassification: "rejected",
      evaluations,
      verifiedConditions,
      unverifiedConditions,
      reasons: [],
      score: 0,
    };
  }

  const hasAllVerified = evaluations.length > 0 && evaluations.every((e) => e.status === "verified");
  if (hasAllVerified) {
    return {
      isMatch: true,
      matchClassification: "confirmed",
      evaluations,
      verifiedConditions,
      unverifiedConditions,
      reasons,
      score: score + 10, // Priority boost for fully confirmed matches
    };
  }

  // At least one condition verified and zero violated -> Partial match
  const hasAnyVerified = evaluations.some((e) => e.status === "verified");
  if (hasAnyVerified) {
    return {
      isMatch: true,
      matchClassification: "partial",
      evaluations,
      verifiedConditions,
      unverifiedConditions,
      reasons,
      score,
    };
  }

  return {
    isMatch: false,
    matchClassification: "rejected",
    evaluations,
    verifiedConditions,
    unverifiedConditions,
    reasons: [],
    score: 0,
  };
}

/**
 * Finds all candidate matching items from the page's repeated collections.
 * Confirmed matches (all criteria verified) are placed first, followed by partial matches.
 * Violating items are strictly excluded.
 */
export function matchItemsOnPage(
  intent: StructuredIntent,
  pageContext: StructuredPageIntelligence | null
): MatchedItem[] {
  if (!pageContext) return [];

  const matched: MatchedItem[] = [];

  for (const group of pageContext.repeatedGroups) {
    for (const item of group.items) {
      const result = evaluateItemMatch(item, intent);
      if (result.isMatch) {
        matched.push({
          elementId: item.elementId,
          title: item.title,
          price: item.price,
          rating: item.rating,
          reasons: result.reasons,
          score: result.score,
          matchClassification: result.matchClassification,
          evaluations: result.evaluations,
          verifiedConditions: result.verifiedConditions,
          unverifiedConditions: result.unverifiedConditions,
        });
      }
    }
  }

  // Sort: Confirmed matches first, then highest score, then highest rating, then lowest price
  matched.sort((a, b) => {
    if (a.matchClassification === "confirmed" && b.matchClassification !== "confirmed") return -1;
    if (b.matchClassification === "confirmed" && a.matchClassification !== "confirmed") return 1;
    if (b.score !== a.score) return b.score - a.score;
    // Tie-breaker 1: Highest rating first
    const ratingA = a.rating?.score || 0;
    const ratingB = b.rating?.score || 0;
    if (ratingB !== ratingA) return ratingB - ratingA;
    // Tie-breaker 2: Lowest price first
    const priceA = a.price?.amount || 999999;
    const priceB = b.price?.amount || 999999;
    return priceA - priceB;
  });

  // Handle Relative References (Part 14)
  if (intent.relativeRef?.type === "cheapest") {
    // Pick the item with the lowest numeric price from matched items
    const withPrice = (matched.length > 0 ? matched : pageContext.repeatedGroups.flatMap((g) =>
      g.items.map((i) => ({
        elementId: i.elementId,
        title: i.title,
        price: i.price,
        rating: i.rating,
        reasons: ["Cheapest item on page"],
        score: 5,
        matchClassification: "partial" as const,
        verifiedConditions: ["Cheapest price"],
        unverifiedConditions: [],
      }))
    )).filter((m) => m.price && m.price.amount > 0);

    withPrice.sort((a, b) => (a.price?.amount || 0) - (b.price?.amount || 0));
    return withPrice.slice(0, 1);
  }

  if (intent.relativeRef?.type === "first" && intent.relativeRef.count) {
    const count = intent.relativeRef.count;
    if (matched.length > 0) {
      return matched.slice(0, count);
    }
    // Fall back to first N items of first group
    const firstGroup = pageContext.repeatedGroups[0];
    if (firstGroup) {
      return firstGroup.items.slice(0, count).map((item, idx) => ({
        elementId: item.elementId,
        title: item.title,
        price: item.price,
        rating: item.rating,
        reasons: [`Result #${idx + 1}`],
        score: 1,
      }));
    }
  }

  return matched;
}

/**
 * Finds interactive controls on the page that correspond to the intent.
 */
export function matchControlsOnPage(
  intent: StructuredIntent,
  pageContext: StructuredPageIntelligence | null
): ControlMatches {
  if (!pageContext) return { filterControls: [] };

  const matches: ControlMatches = {
    filterControls: [],
  };

  // 1. Search Input
  if ((pageContext.searchInputs || []).length > 0) {
    matches.searchInput = pageContext.searchInputs[0];
  }

  // 2. Filter Controls (checkboxes, selects, buttons matching size, color, price)
  const allControls = [...(pageContext.inputs || []), ...(pageContext.buttons || [])];

  // Match size filter (e.g. checkbox for XL)
  if (intent.filters.size) {
    const sizeStr = String(intent.filters.size).toLowerCase();
    for (const ctrl of allControls) {
      const label = `${ctrl.text} ${ctrl.nearbyLabel || ""} ${ctrl.name || ""}`.toLowerCase();
      if (new RegExp(`\\b${sizeStr}\\b`, "i").test(label)) {
        matches.filterControls.push({
          control: ctrl,
          reason: `Size filter control (${intent.filters.size})`,
        });
        break;
      }
    }
  }

  // Match color filter
  if (intent.filters.color) {
    const colorStr = String(intent.filters.color).toLowerCase();
    for (const ctrl of allControls) {
      const label = `${ctrl.text} ${ctrl.nearbyLabel || ""}`.toLowerCase();
      if (label.includes(colorStr)) {
        matches.filterControls.push({
          control: ctrl,
          reason: `Color filter control (${intent.filters.color})`,
        });
        break;
      }
    }
  }

  // Match price filter radio / range
  if (intent.constraints.maxPrice !== undefined) {
    const pStr = String(intent.constraints.maxPrice);
    const pFormatted = intent.constraints.maxPrice.toLocaleString();
    for (const ctrl of allControls) {
      const label = `${ctrl.text} ${ctrl.nearbyLabel || ""}`.toLowerCase();
      if (label.includes(pStr) || label.includes(pFormatted) || label.includes("under") || label.includes("below")) {
        matches.filterControls.push({
          control: ctrl,
          reason: `Price range control (under ₹${intent.constraints.maxPrice})`,
        });
        break;
      }
    }
  }

  // 3. "Apply Filters" button
  for (const btn of pageContext.buttons) {
    const text = (btn.text || "").toLowerCase();
    if (text.includes("apply") || text.includes("filter") || text.includes("search")) {
      matches.applyButton = btn;
      break;
    }
  }

  // 4. Navigation Links (e.g. "contact", "checkout", "bag")
  if (intent.intent === "navigate" && intent.entities.destination) {
    const rawDest = intent.entities.destination.toLowerCase();
    const cleanDest = rawDest.replace(/\b(?:page|tab|screen|link|view|section)\b/gi, "").trim();
    for (const link of pageContext.links) {
      const text = (link.text || "").toLowerCase().trim();
      if (text && (text === cleanDest || text.includes(cleanDest) || cleanDest.includes(text))) {
        matches.navLink = link;
        break;
      }
    }
  }

  return matches;
}
