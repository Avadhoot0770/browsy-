/**
 * AI Provider Abstraction and Implementations for Browsy Intent Engine
 * Implements provider abstraction decoupling the extension from any single AI backend.
 * Provides a local zero-dependency heuristic NLU provider and a secure remote proxy provider.
 */

import type {
  StructuredIntent,
  IntentType,
  TargetType,
  ConversationContext,
  CurrencyCode,
  IntentFilters,
  ActionPlanStep,
} from "./types";
import type { StructuredPageIntelligence, RepeatedItem } from "../page-intelligence/types";
import { extractPrice } from "../page-intelligence/price-rating-parser";
import { parseNumberFromText } from "../shared/text-utils";
import { MessageActions } from "../shared/messages";

export interface ProviderStatus {
  status: "connected" | "loading" | "unavailable" | "bypassed";
  ollamaRunning: boolean;
  available: boolean;
  endpoint?: string;
  recommendedModel?: string;
  activeModel: string;
  availableModels: string[];
  latencyMs?: number;
  message?: string;
  source?: string;
}

export interface BoundedPageContext {
  domain?: string;
  title?: string;
  headings?: string[];
  itemCount?: number;
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  checkAvailability?(): Promise<ProviderStatus>;
  selectModel?(modelName: string): Promise<boolean>;
  generateIntent(
    query: string,
    pageContext: StructuredPageIntelligence | null,
    conversationContext: ConversationContext,
    signal?: AbortSignal
  ): Promise<StructuredIntent>;
  interpretUnfamiliarLabels?(
    labels: string[],
    targetConstraint: string,
    signal?: AbortSignal
  ): Promise<Record<string, number>>;
  suggestErrorRecovery?(
    failedStep: ActionPlanStep,
    errorReason: string,
    pageContext: StructuredPageIntelligence | null,
    remainingBudgetMs: number,
    signal?: AbortSignal
  ): Promise<ActionPlanStep[] | null>;
  compareProducts?(
    query: string,
    intent: StructuredIntent,
    items: RepeatedItem[],
    signal?: AbortSignal
  ): Promise<{ rankedItemIds: string[]; reasoning: Record<string, string> }>;
}

// Common clothing sizes
const SIZES = new Set(["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL", "5XL", "6XL"]);
// Common colors
const COLORS = [
  "red",
  "crimson",
  "maroon",
  "rust",
  "blue",
  "navy",
  "black",
  "white",
  "green",
  "yellow",
  "orange",
  "grey",
  "gray",
  "brown",
  "pink",
  "purple",
];
// Patterns
const PATTERNS = ["checked", "check", "plaid", "gingham", "solid", "striped", "printed", "flannel"];
// Materials
const MATERIALS = ["cashmere", "cotton", "linen", "silk", "wool", "denim", "leather", "polyester", "titanium"];
// Common product categories across e-commerce, retail, and general web
const PRODUCT_CATEGORIES = [
  // Apparel
  "shirt",
  "t-shirt",
  "tshirt",
  "kurta",
  "sneakers",
  "shoes",
  "jeans",
  "trousers",
  "jacket",
  "hoodie",
  "sweater",
  "dress",
  "top",
  "pants",
  "suit",
  "coat",
  "boots",
  // Electronics
  "laptop",
  "phone",
  "smartphone",
  "tablet",
  "monitor",
  "headphone",
  "earbuds",
  "watch",
  "smartwatch",
  "camera",
  "tv",
  "speaker",
  // Home, Work & Lifestyle
  "book",
  "desk",
  "chair",
  "bed",
  "sofa",
  "table",
  "backpack",
  "bag",
  "wallet",
];

/**
 * Heuristic Local NLP Provider
 * High-speed, deterministic, 100% offline natural language understanding.
 * Zero external API keys needed in the client-side extension bundle.
 */
export class HeuristicLocalProvider implements AIProvider {
  public readonly id = "local-heuristic";
  public readonly name = "Browsy Local Heuristic Engine";

  public async checkAvailability(): Promise<ProviderStatus> {
    return {
      status: "connected",
      ollamaRunning: false,
      available: false,
      activeModel: "local-heuristic",
      availableModels: ["local-heuristic"],
      message: "Deterministic offline heuristic engine active.",
      source: "local-heuristic",
    };
  }

  public async selectModel(_modelName: string): Promise<boolean> {
    return true;
  }

  public async interpretUnfamiliarLabels(
    labels: string[],
    targetConstraint: string
  ): Promise<Record<string, number>> {
    const matches: Record<string, number> = {};
    const target = targetConstraint.toLowerCase().trim();

    for (const label of labels) {
      const l = String(label).toLowerCase();
      if (l === target || l.includes(target)) {
        matches[label] = 0.95;
      } else if (target === "red" && /\b(maroon|crimson|wine|rust|burgundy|ruby)\b/i.test(l)) {
        matches[label] = 0.9;
      } else if (target === "checked" && /\b(check|plaid|tartan|gingham|checks)\b/i.test(l)) {
        matches[label] = 0.95;
      } else {
        matches[label] = 0.0;
      }
    }
    return matches;
  }

  public async suggestErrorRecovery(
    failedStep: ActionPlanStep,
    _errorReason: string,
    _pageContext: StructuredPageIntelligence | null,
    remainingBudgetMs: number
  ): Promise<ActionPlanStep[] | null> {
    if (remainingBudgetMs < 1000) return null;
    const targetLabel = failedStep.targetLabel || (failedStep.value != null ? String(failedStep.value) : undefined);
    return [
      {
        id: `recovery-${Date.now()}`,
        type: "click",
        targetLabel,
        description: `Retry locating filter '${targetLabel || ""}' via expandable facet drawers`,
        confidence: 0.85,
      },
    ];
  }

  public async compareProducts(
    _query: string,
    _intent: StructuredIntent,
    items: RepeatedItem[]
  ): Promise<{ rankedItemIds: string[]; reasoning: Record<string, string> }> {
    const qLower = _query.toLowerCase();
    const sorted = [...items].sort((a, b) => {
      if (qLower.includes("review") || qLower.includes("rating") || _intent.constraints?.minRating) {
        const rA = a.rating?.score || 0;
        const rB = b.rating?.score || 0;
        if (rB !== rA) return rB - rA;
      }
      return (a.price?.amount || 999999) - (b.price?.amount || 999999);
    });
    const rankedItemIds = sorted.map((i) => i.elementId);
    const reasoning: Record<string, string> = {};
    for (const item of sorted) {
      reasoning[item.elementId] = item.rating?.score
        ? `Grounded in verified rating ${item.rating.score}★ and price: ${item.price?.raw || "N/A"}`
        : `Grounded in verified price: ${item.price?.raw || "N/A"}`;
    }
    return { rankedItemIds, reasoning };
  }

  public async generateIntent(
    query: string,
    _pageContext: StructuredPageIntelligence | null,
    conversationContext: ConversationContext
  ): Promise<StructuredIntent> {
    const raw = query.trim();
    const lower = raw.toLowerCase();
    const intentId = `intent-${Date.now()}`;

    // 1. Handle gibberish / unknown requests
    const isKeyboardMash =
      lower.length < 3 ||
      /^[bcdfghjklmnpqrstvwxyz]{6,}$/i.test(lower) ||
      /^[asdfghjkl]{5,}$/i.test(lower) ||
      /^[qwertyuiop]{5,}$/i.test(lower) ||
      /^[zxcvbnm]{5,}$/i.test(lower) ||
      /^[^a-zA-Z0-9\s]+$/.test(lower);

    if (isKeyboardMash) {
      return {
        id: intentId,
        intent: "unknown",
        target: "unknown",
        entities: {},
        filters: {},
        constraints: {},
        scope: "current_page",
        confidence: 0.1,
        requiresClarification: false,
        clarificationPrompt: "I couldn't understand that request. Try asking something like: 'Find red checked shirts in XL under ₹1,000'.",
        rawQuery: query,
        timestamp: Date.now(),
      };
    }

    // 2. Relative references & Contextual pronouns
    const isCheapest = /cheapest|lowest price|most affordable/i.test(lower);
    const isFirstThree = /first\s*(?:3|three)/i.test(lower);
    const isPureComparison =
      /^(?:compare\b|compare\s+(?:the\s+)?(?:first|top|these|those|items|products))/i.test(lower.trim()) &&
      !/(?:find|search|show me\s+(?:a|an)|buy)\s+/i.test(lower);
    const isSummarize = /summarize\s*(?:this|the)?\s*page|summary\s*of|key\s*points/i.test(lower);
    const isNavigation = /^(?:open|go to|take me to|navigate to)\s*(?:the\s*)?([a-zA-Z\s]+)/i.test(lower);

    // 3. Summarization intent
    if (isSummarize) {
      return {
        id: intentId,
        intent: "summarize",
        target: "page",
        entities: {},
        filters: {},
        constraints: {},
        scope: "current_page",
        confidence: 0.95,
        requiresClarification: false,
        rawQuery: query,
        timestamp: Date.now(),
      };
    }

    // 4. Pure comparison intent (comparing items on page without search/filtering criteria)
    if (isPureComparison) {
      return {
        id: intentId,
        intent: "compare",
        target: "products",
        entities: {},
        filters: {},
        constraints: {},
        relativeRef: {
          type: "first",
          count: 3,
        },
        scope: "current_page",
        confidence: 0.92,
        requiresClarification: false,
        rawQuery: query,
        timestamp: Date.now(),
      };
    }

    // 5. Navigation intent
    if (isNavigation) {
      const match = lower.match(/(?:open|go to|take me to|navigate to)\s*(?:the\s*)?([a-zA-Z\s]+)/i);
      const rawDest = match ? match[1].trim() : "target";
      const dest = rawDest.replace(/\s+(?:and|then)\s+.*$/i, "").trim();
      return {
        id: intentId,
        intent: "navigate",
        target: "controls",
        entities: { destination: dest },
        filters: {},
        constraints: {},
        scope: "current_page",
        confidence: 0.95,
        requiresClarification: false,
        rawQuery: query,
        timestamp: Date.now(),
      };
    }

    // 6. Extract Constraints (Price & Ratings with natural language and word numbers)
    const constraints: {
      maxPrice?: number;
      minPrice?: number;
      currency?: CurrencyCode;
      minRating?: number;
      location?: string;
      date?: string;
    } = {};

    // Price extraction: direct numeric matches first ("1,000", "3000", "Increase the budget to 1,500"), then natural words ("three thousand", "50k")
    const numericMatch = lower.match(
      /(?:under|below|less than|max(?:imum)?|<|budget(?:\s+(?:of|to|is|up to|around|limit))?|costing less than|cost less than|(?:increase|raise|up|lower|reduce|decrease|change|update|set|make)\s+(?:the\s+)?(?:budget|max\s*price|price\s*limit)?\s*(?:to|under|at)?)\s*(?:₹|rs\.?|inr|\$|€|£)?\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/i
    );
    if (numericMatch) {
      const parsed = parseFloat(numericMatch[1].replace(/,/g, ""));
      if (!isNaN(parsed)) {
        constraints.maxPrice = parsed;
        const curMatch = raw.match(/₹|\b(?:Rs\.?|INR|rupees)\b|\$|€|£|\b(?:dollars?|bucks|usd|eur|gbp)\b/i);
        if (curMatch) {
          const sample = extractPrice(`${curMatch[0]} ${parsed}`);
          constraints.currency = sample?.currency || "INR";
        } else {
          constraints.currency = "INR";
        }
      }
    } else {
      const priceTextMatch = lower.match(
        /(?:under|below|less than|max(?:imum)?|<|budget(?:\s+(?:of|to|is|up to|around|limit))?|costing less than|cost less than|(?:increase|raise|up|lower|reduce|decrease|change|update|set|make)\s+(?:the\s+)?(?:budget|max\s*price|price\s*limit)?\s*(?:to|under|at)?)\s*(?:₹|rs\.?|inr|\$|€|£)?\s*([a-z0-9,\s]+?)(?:\s*(?:rupees|inr|dollars|bucks|eur|gbp|[,.;]|$))/i
      );
      if (priceTextMatch && priceTextMatch[1]) {
        const parsed = parseNumberFromText(priceTextMatch[1]);
        if (parsed !== null && !isNaN(parsed)) {
          constraints.maxPrice = parsed;
          const curMatch = raw.match(/₹|\b(?:Rs\.?|INR|rupees)\b|\$|€|£|\b(?:dollars?|bucks|usd|eur|gbp)\b/i);
          if (curMatch) {
            const sample = extractPrice(`${curMatch[0]} ${parsed}`);
            constraints.currency = sample?.currency || "INR";
          } else {
            constraints.currency = "INR";
          }
        }
      }
    }

    // Rating extraction: handles phrases ("highly rated", "top rated", "good reviews") and numbers ("rating above 4", "4-star")
    if (/highly\s+rated|top\s+rated|best\s+rated|best\s+reviewed|good\s+reviews?|well\s+reviewed|positive\s+reviews?|great\s+reviews?/i.test(lower)) {
      constraints.minRating = 4;
    } else {
      const ratingMatch = lower.match(/([1-5](?:\.[0-9])?)\s*(?:-| )?star|rating\s*(?:above|greater than|>)\s*([1-5](?:\.[0-9])?)/i);
      if (ratingMatch) {
        const score = parseFloat(ratingMatch[1] || ratingMatch[2]);
        if (!isNaN(score)) constraints.minRating = score;
      }
    }

    // 7. Extract Filters (Color, Pattern, Size, Exclusions)
    const filters: IntentFilters = {};

    // Detect Negations & Exclusions (e.g. "no red", "without polyester", "not plaid", "exclude Roadster")
    const exclusions: string[] = [];
    const excludeMatches = lower.matchAll(/(?:no|without|not|except|exclude|excluding|remove)\s+(?:brand\s+|products?\s+from\s+)?([a-z0-9&'\-]+)/gi);
    for (const m of excludeMatches) {
      if (m[1]) {
        const term = m[1].toLowerCase();
        if (!["the", "a", "an", "all", "any", "this", "these", "other", "some"].includes(term)) {
          if (!exclusions.includes(term)) exclusions.push(term);
        }
      }
    }
    if (exclusions.length > 0) {
      filters.exclude = exclusions;
    }

    for (const color of COLORS) {
      if (!exclusions.includes(color) && new RegExp(`\\b${color}\\b`, "i").test(lower)) {
        filters.color = color;
        break;
      }
    }

    for (const pattern of PATTERNS) {
      if (!exclusions.includes(pattern) && new RegExp(`\\b${pattern}\\b`, "i").test(lower)) {
        filters.pattern = pattern;
        break;
      }
    }

    for (const mat of MATERIALS) {
      if (!exclusions.includes(mat) && new RegExp(`\\b${mat}\\b`, "i").test(lower)) {
        filters.material = mat;
        break;
      }
    }

    // Size detection (e.g. "in XL", "size XL", "XL", "size: M")
    for (const size of SIZES) {
      if (size.length > 1) {
        if (new RegExp(`\\b${size}\\b`, "i").test(raw)) {
          filters.size = size;
          break;
        }
      } else {
        if (
          new RegExp(`(?:\\bsize\\s*[:=]?\\s*|\\bin\\s+)(${size})\\b`, "i").test(raw) ||
          new RegExp(`\\b(${size})\\b`).test(raw)
        ) {
          filters.size = size;
          break;
        }
      }
    }
    if (!filters.size) {
      const explicitSizeMatch = raw.match(/\bsize\s*[:=]?\s*([0-9]+[a-zA-Z]*|[a-zA-Z]+[0-9]*)\b/i);
      if (explicitSizeMatch && explicitSizeMatch[1]) {
        filters.size = explicitSizeMatch[1].toUpperCase();
      }
    }

    // 8. Extract Entities (Category, Brand, Role)
    const entities: Record<string, string> = {};
    const isJobQuery = /(?:jobs?|internships?|interns?|freshers?|engineers?|engineering|developers?|analysts?|opportunities|openings|positions|roles|careers|vacancies)\b/i.test(lower);
    const isTravelQuery = /(?:hotels?|flights?|stays?|resorts?)\b/i.test(lower);

    if (!isJobQuery && !isTravelQuery) {
      for (const cat of PRODUCT_CATEGORIES) {
        if (new RegExp(`\\b${cat}s?\\b`, "i").test(lower)) {
          entities.category = cat;
          break;
        }
      }

      // Fallback category from action verb phrases ("find [a/an] <item>")
      if (!entities.category) {
        const verbMatch = lower.match(/(?:find|show me|search for|looking for)\s+(?:a\s+|an\s+|some\s+)?([a-z]{3,})/i);
        const nonCategoryWords = new Set([
          "the", "any", "all", "best", "good", "cheap", "more", "entry", "only", "just",
          "one", "ones", "me", "item", "items", "something", "another", "other", "similar",
          "options", "results", "products", "this", "that", "these", "those", "what",
          ...COLORS,
          ...PATTERNS,
        ]);
        if (verbMatch && verbMatch[1] && !nonCategoryWords.has(verbMatch[1].toLowerCase())) {
          entities.category = verbMatch[1];
        }
      }
    }

    // Brands (broad consumer brands + proper nouns, and generic "from <brand>" or "by <brand>")
    let brandMatch = lower.match(
      /\b(lenovo|roadster|highlander|wrogn|dennis lingo|here&now|apple|samsung|dell|hp|asus|acer|sony|bose|nike|adidas|puma|zara|h&m|levis|levi's)\b/i
    );
    if (!brandMatch) {
      const fromBrandMatch = lower.match(/\b(?:from|by)\s+([a-z0-9&'\-]+)\b/i);
      if (
        fromBrandMatch &&
        fromBrandMatch[1] &&
        !["under", "over", "between", "cheap", "best", "myntra", "amazon", "flipkart", "the", "a", "an"].includes(
          fromBrandMatch[1].toLowerCase()
        )
      ) {
        brandMatch = fromBrandMatch;
      }
    }
    if (brandMatch) {
      entities.brand = brandMatch[1];
      filters.brand = brandMatch[1];
    }

    // Job keywords
    let targetType: TargetType = "unknown";
    if (/(?:jobs?|internships?|interns?|freshers?|engineers?|engineering|developers?|analysts?|opportunities|openings|positions|roles|careers|vacancies)\b/i.test(lower)) {
      targetType = "jobs";
      const roleMatch = lower.match(/(software engineer(?:ing)?|data analyst|data scientist|data engineer|python(?: developer)?|frontend|backend|product manager)/i);
      if (roleMatch) entities.role = roleMatch[1].toLowerCase();
      if (/internships?|interns?/i.test(lower)) entities.type = "internship";
      else if (/freshers?/i.test(lower)) entities.type = "fresher";
      else if (/entry-level|entry level|junior/i.test(lower)) entities.type = "entry-level";
      else if (/senior|lead|principal/i.test(lower)) entities.type = "senior";

      const locMatch = lower.match(/\bin\s+([a-zA-Z]+)/i);
      if (locMatch) {
        constraints.location = locMatch[1];
      }
      if (/this week|today|recent/i.test(lower)) {
        constraints.date = "this week";
      }
    } else if (/(?:hotels?|flights?|stays?|resorts?)\b/i.test(lower)) {
      targetType = "travel";
      const locMatch = lower.match(/in\s+([a-zA-Z]+)/i);
      if (locMatch) constraints.location = locMatch[1];
      if (/breakfast/i.test(lower)) filters.amenities = ["breakfast"];
    } else if (/(?:articles?|papers?|news|story|stories)\b/i.test(lower)) {
      targetType = "articles";
    } else if (entities.category || filters.color || filters.size || constraints.maxPrice || /product|item/i.test(lower)) {
      targetType = "products";
    }

    // 9. Advanced Follow-Up Detection & Context Merging
    // Handles follow-up queries:
    // - "Show me only black ones"
    // - "Increase the budget to ₹1,500"
    // - "Only show size L"
    // - "Find the same product in another color"
    // - "Sort the verified results by lowest price"
    // - "Exclude products from this brand"
    // - "Search another website for similar products"

    // Detect Sorting Intent
    const isSortLowestPrice =
      /\b(?:sort\s+(?:the\s+)?(?:verified\s+)?(?:results\s+)?by\s+(?:lowest\s+price|cheapest|price)|lowest\s+price\s+first|cheapest\s+first|price\s*:\s*low\s+to\s+high)\b/i.test(lower);
    const isSortHighestRating =
      /\b(?:sort\s+(?:the\s+)?(?:verified\s+)?(?:results\s+)?by\s+(?:highest\s+rating|rating|reviews?)|best\s+rated\s+first|highest\s+rating\s+first|top\s+rated\s+first)\b/i.test(lower);

    let sortConfig: { field: string; direction: "asc" | "desc" } | undefined = undefined;
    if (isSortLowestPrice) {
      sortConfig = { field: "price", direction: "asc" };
    } else if (isSortHighestRating) {
      sortConfig = { field: "rating", direction: "desc" };
    }

    // Detect Brand Exclusion: "exclude products from this brand", "exclude this brand"
    const isExcludeThisBrand =
      /\b(?:exclude\s+(?:products?\s+from\s+|items?\s+from\s+)?this\s+brand|without\s+this\s+brand|remove\s+this\s+brand)\b/i.test(lower);
    if (isExcludeThisBrand) {
      const activeB = conversationContext.activeBrand || (conversationContext.lastVerifiedProducts?.[0]?.brand as string);
      if (typeof activeB === "string" && activeB.trim()) {
        const brandNorm = activeB.toLowerCase().trim();
        if (!exclusions.includes(brandNorm)) exclusions.push(brandNorm);
        filters.exclude = exclusions;
      } else {
        return {
          id: intentId,
          intent: "filter",
          target: "products",
          entities: { ...entities, category: entities.category || conversationContext.activeCategory || "shirt" },
          filters,
          constraints,
          scope: "current_page",
          confidence: 0.85,
          requiresClarification: true,
          clarificationPrompt: "Which brand would you like me to exclude?",
          rawQuery: query,
          timestamp: Date.now(),
        };
      }
    }

    // Detect Ambiguous Color Follow-Up: "in another color", "different color" without specific color
    const isAmbiguousColor =
      /\b(?:same\s+(?:product|item|one)?\s+in\s+another\s+color|another\s+color|different\s+color|other\s+colors?)\b/i.test(lower) &&
      !filters.color;
    if (isAmbiguousColor) {
      return {
        id: intentId,
        intent: "find",
        target: "products",
        entities: { ...entities, category: entities.category || conversationContext.activeCategory || "shirt" },
        filters,
        constraints,
        scope: "current_page",
        confidence: 0.85,
        requiresClarification: true,
        clarificationPrompt: "Which color would you like to see (for example: blue, black, navy, or white)?",
        rawQuery: query,
        timestamp: Date.now(),
      };
    }

    // Detect Ambiguous Size Follow-Up: "another size", "different size" without specific size
    const isAmbiguousSize =
      /\b(?:another\s+size|different\s+size|other\s+sizes?)\b/i.test(lower) &&
      !filters.size;
    if (isAmbiguousSize) {
      return {
        id: intentId,
        intent: "find",
        target: "products",
        entities: { ...entities, category: entities.category || conversationContext.activeCategory || "shirt" },
        filters,
        constraints,
        scope: "current_page",
        confidence: 0.85,
        requiresClarification: true,
        clarificationPrompt: "Which size should I check for (for example: S, M, L, XL, or XXL)?",
        rawQuery: query,
        timestamp: Date.now(),
      };
    }

    // Detect Ambiguous Cross-Site Request: "search another website", "on another retailer", etc.
    const isAmbiguousCrossSite =
      /\b(?:(?:search|find|look|shop)\s+(?:on\s+|for\s+)?another\s+(?:supported\s+)?(?:website|site|retailer|store)|(?:on\s+)?another\s+(?:supported\s+)?(?:website|site|retailer|store)|different\s+(?:website|site|retailer|store)|other\s+(?:websites?|sites?|retailers?|stores?))\b/i.test(lower) &&
      !lower.includes("amazon") && !lower.includes("flipkart");
    if (isAmbiguousCrossSite) {
      return {
        id: intentId,
        intent: "navigate",
        target: "products",
        entities: { ...entities, category: entities.category || conversationContext.activeCategory || "shirt" },
        filters,
        constraints,
        scope: "global",
        confidence: 0.85,
        requiresClarification: true,
        clarificationPrompt: "Which website would you like me to search (for example: Amazon or Flipkart)?",
        rawQuery: query,
        timestamp: Date.now(),
      };
    }

    // Detect Explicit Cross-Site Request: Amazon or Flipkart
    const isAmazonReq = /\b(?:amazon|on amazon)\b/i.test(lower);
    const isFlipkartReq = /\b(?:flipkart|on flipkart)\b/i.test(lower);
    if ((isAmazonReq || isFlipkartReq) && (lower.includes("search") || lower.includes("find") || lower.includes("similar") || lower.includes("look") || lower.includes("shop"))) {
      const siteDest = isAmazonReq ? "amazon.in" : "flipkart.com";
      const cat = entities.category || conversationContext?.activeCategory || "shirt";
      const col = filters.color || (conversationContext?.activeFilters?.color as string) || "";
      const pat = filters.pattern || (conversationContext?.activeFilters?.pattern as string) || "";
      const sz = filters.size || (conversationContext?.activeFilters?.size as string) || "";
      const queryTerms = [col, pat, cat, sz ? `size ${sz}` : ""].filter(Boolean).join(" ");
      const mergedFilters: IntentFilters = {
        ...(conversationContext?.activeFilters || {}),
        ...filters,
      };
      if (col) mergedFilters.color = col;
      if (pat) mergedFilters.pattern = pat;
      if (sz) mergedFilters.size = sz;

      const mergedConstraints = {
        ...(conversationContext?.activeConstraints || {}),
        ...constraints,
      };

      return {
        id: intentId,
        intent: "navigate",
        target: "products",
        entities: { destination: siteDest, category: cat, query: queryTerms },
        filters: mergedFilters,
        constraints: mergedConstraints,
        scope: "global",
        confidence: 0.95,
        requiresClarification: false,
        rawQuery: query,
        timestamp: Date.now(),
      };
    }

    // Context Merging Logic
    const hasPriorContext = Boolean(
      conversationContext?.turns?.length ||
      conversationContext?.activeCategory ||
      (conversationContext?.activeFilters && Object.keys(conversationContext.activeFilters).length > 0) ||
      conversationContext?.activeConstraints?.maxPrice
    );

    const isCategoryShift = Boolean(
      entities.category &&
      conversationContext?.activeCategory &&
      entities.category.toLowerCase() !== conversationContext.activeCategory.toLowerCase()
    );

    // If switching to a completely new category without any constraints, ask for clarification
    if (isCategoryShift && Object.keys(filters).length === 0 && !constraints.maxPrice) {
      return {
        id: intentId,
        intent: "find",
        target: "products",
        entities,
        filters,
        constraints,
        scope: "current_page",
        confidence: 0.8,
        requiresClarification: true,
        clarificationPrompt: `You're switching to ${entities.category}. What is your preferred budget, style, or size for ${entities.category}?`,
        rawQuery: query,
        timestamp: Date.now(),
      };
    }

    const isExplicitFollowUpPhrase =
      /^(?:only|also|and|just|now|instead|show\s+me\s+(?:only|just)|change\s+(?:the\s+)?|switch\s+to|update\s+(?:the\s+)?|increase\s+(?:the\s+)?|raise\s+(?:the\s+)?|reduce\s+(?:the\s+)?|decrease\s+(?:the\s+)?|lower\s+(?:the\s+)?|make\s+(?:it|the)|what\s+about|how\s+about|filter\s+by|sort\s+(?:by|the)|exclude\s+|remove\s+|without\s+|same\s+(?:product|item|one)?\s+in|in\s+another\s+color)\b/i.test(lower);

    const isPartialUpdate =
      (Object.keys(filters).length > 0 && !entities.category) ||
      (Boolean(constraints.maxPrice) && !entities.category) ||
      (exclusions.length > 0 && !entities.category) ||
      Boolean(sortConfig);

    const isFollowUp = hasPriorContext && (isExplicitFollowUpPhrase || isPartialUpdate) && !isCategoryShift;

    if (isFollowUp && conversationContext) {
      // 1. Inherit Category & Target
      if (conversationContext.activeCategory && !entities.category) {
        entities.category = conversationContext.activeCategory;
      }
      if (conversationContext.lastTarget && targetType === "unknown") {
        targetType = conversationContext.lastTarget;
      }

      // 2. Inherit Active Filters (except the one explicitly updated)
      if (conversationContext.activeFilters) {
        for (const [k, v] of Object.entries(conversationContext.activeFilters)) {
          if (!filters[k] && v !== undefined) {
            filters[k] = v;
          }
        }
      }

      // 3. Inherit Constraints (except the one explicitly updated)
      if (!constraints.maxPrice && conversationContext.activeConstraints?.maxPrice) {
        constraints.maxPrice = conversationContext.activeConstraints.maxPrice;
        constraints.currency = conversationContext.activeConstraints.currency;
      }
      if (!constraints.minRating && conversationContext.activeConstraints?.minRating) {
        constraints.minRating = conversationContext.activeConstraints.minRating;
      }

      // 4. Inherit active exclusions
      if (conversationContext.activeExclusions && conversationContext.activeExclusions.length > 0) {
        for (const ex of conversationContext.activeExclusions) {
          if (!exclusions.includes(ex)) exclusions.push(ex);
        }
        filters.exclude = exclusions;
      }
    }

    // 10. Unknown / Unrecognized Query Detection
    const hasAnyActionWord = /\b(find|search|show|look|filter|get|buy|pick|give|recommend|browse|see|need|want|help|sort|exclude|change|switch)\b/i.test(lower);
    const hasAnyEntityOrFilter =
      Boolean(entities.category) ||
      Boolean(entities.role) ||
      Boolean(entities.brand) ||
      Object.keys(filters).length > 0 ||
      Boolean(constraints.maxPrice) ||
      Boolean(constraints.location) ||
      Boolean(sortConfig) ||
      isCheapest ||
      isFirstThree ||
      isPureComparison ||
      isSummarize ||
      isNavigation;

    if (!hasAnyActionWord && !hasAnyEntityOrFilter && !lower.includes("something") && !lower.includes("good")) {
      return {
        id: intentId,
        intent: "unknown",
        target: "unknown",
        entities: {},
        filters: {},
        constraints: {},
        scope: "current_page",
        confidence: 0.1,
        requiresClarification: false,
        clarificationPrompt: "I couldn't understand that request. Try asking something like: 'Find red checked shirts in XL under ₹1,000'.",
        rawQuery: query,
        timestamp: Date.now(),
      };
    }

    // 11. Ambiguity & Clarification Detection (Part 11 & Part 12)
    // "Find me something good", "Find me something nice to wear", "Find a shirt", "Book a hotel" without parameters
    const isAmbiguous =
      lower.includes("something good") ||
      lower.includes("a good one") ||
      lower.includes("something nice") ||
      lower.includes("nice to wear") ||
      lower.includes("something to wear") ||
      (targetType === "products" && !entities.category && Object.keys(filters).length === 0 && !constraints.maxPrice && !sortConfig) ||
      (targetType === "travel" && !constraints.location && !constraints.maxPrice) ||
      (raw.split(" ").length <= 3 && !filters.color && !filters.size && !constraints.maxPrice && !isCheapest && !isFirstThree && !sortConfig);

    if (isAmbiguous) {
      let clarificationPrompt = "Could you tell me your preferred size, style, or budget?";
      if (targetType === "travel") {
        clarificationPrompt = "Which city and travel dates are you planning for?";
      } else if (entities.category === "laptop" || lower.includes("laptop")) {
        clarificationPrompt = "What is your preferred budget or brand (e.g. Lenovo, Dell, Apple)?";
      }

      return {
        id: intentId,
        intent: "find",
        target: targetType !== "unknown" ? targetType : "products",
        entities,
        filters,
        constraints,
        scope: "current_page",
        confidence: 0.65,
        requiresClarification: true,
        clarificationPrompt,
        rawQuery: query,
        timestamp: Date.now(),
      };
    }

    // 12. Relative Reference & Limit
    let relativeRef: StructuredIntent["relativeRef"] = undefined;
    if (!sortConfig && isCheapest) {
      relativeRef = { type: "cheapest" };
    } else if (isFirstThree) {
      relativeRef = { type: "first", count: 3 };
    } else {
      const topCountMatch = lower.match(/(?:top|first|best|show me)\s*(?:the\s*)?([0-9]+|five|three|four|six|seven|eight|nine|ten)\b/i);
      if (topCountMatch && topCountMatch[1]) {
        const parsedNum = parseNumberFromText(topCountMatch[1]);
        if (parsedNum && parsedNum > 0) {
          relativeRef = { type: "first", count: parsedNum };
        }
      }
    }

    const intentType: IntentType = sortConfig
      ? "sort"
      : isCheapest
      ? "find"
      : (Object.keys(filters).length > 0 || constraints.maxPrice ? "filter" : "find");

    return {
      id: intentId,
      intent: intentType,
      target: targetType !== "unknown" ? targetType : "products",
      entities,
      filters,
      constraints,
      sort: sortConfig,
      relativeRef,
      scope: "current_page",
      confidence: 0.94,
      requiresClarification: false,
      rawQuery: query,
      timestamp: Date.now(),
    };
  }
}

/**
 * Remote Proxy Provider (Secure Backend Boundary)
 * Calls a local or remote backend endpoint if configured, never storing client API keys.
 * Automatically falls back to HeuristicLocalProvider if the remote endpoint is unavailable.
 */
export class RemoteProxyProvider implements AIProvider {
  public readonly id = "remote-proxy";
  public readonly name = "Browsy Backend Proxy Provider";
  private endpoint: string;
  private fallback: HeuristicLocalProvider;

  constructor(endpoint = "http://localhost:8000/api/intent") {
    this.endpoint = endpoint;
    this.fallback = new HeuristicLocalProvider();
  }

  public async generateIntent(
    query: string,
    pageContext: StructuredPageIntelligence | null,
    conversationContext: ConversationContext
  ): Promise<StructuredIntent> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          query,
          pageContext: pageContext ? { domain: pageContext.hostname, title: pageContext.title } : null,
          conversationContext,
        }),
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === "object" && data.intent && data.target) {
          return data as StructuredIntent;
        }
      }
    } catch {
      // Backend unreachable, timed out, or offline — fallback smoothly to deterministic local NLU
    } finally {
      clearTimeout(timeoutId);
    }

    return this.fallback.generateIntent(query, pageContext, conversationContext);
  }
}

export interface OllamaProviderOptions {
  companionUrl?: string;
  defaultModel?: string;
  timeoutMs?: number;
  simulateMode?: string;
}

/**
 * Local Ollama AI Provider
 * Communicates with the local Ollama daemon via the Browsy Companion Service.
 * Never transmits user data or webpage contents to paid cloud AI APIs.
 * Supports model availability checking, model switching, structured NLU parsing,
 * unfamiliar label interpretation, error recovery, and grounded product comparison.
 */
export class OllamaLocalProvider implements AIProvider {
  public readonly id = "ollama-local";
  public readonly name = "Browsy Local Ollama AI";
  private companionUrl: string;
  private activeModel: string;
  private timeoutMs: number;
  private simulateMode?: string;
  private fallback: HeuristicLocalProvider;

  constructor(options: OllamaProviderOptions = {}) {
    this.companionUrl = options.companionUrl || "http://127.0.0.1:8765";
    this.activeModel = options.defaultModel || "qwen2.5:1.5b";
    this.timeoutMs = options.timeoutMs || 10000;
    this.simulateMode = options.simulateMode;
    this.fallback = new HeuristicLocalProvider();
  }

  public setSimulateMode(mode?: string): void {
    this.simulateMode = mode;
  }

  public getActiveModel(): string {
    return this.activeModel;
  }

  public getCompanionUrl(): string {
    return this.companionUrl;
  }

  public async checkAvailability(): Promise<ProviderStatus> {
    try {
      // 1. Try background worker messaging if in extension context
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        const status = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ action: MessageActions.AI_STATUS }, (res) => {
            if (chrome.runtime.lastError || !res) {
              resolve(null);
            } else {
              resolve(res);
            }
          });
        });
        if (status) {
          if (status.activeModel) this.activeModel = status.activeModel;
          return {
            ...status,
            available: status.available ?? (status.status === "connected" || status.ollamaRunning === true),
            endpoint: status.endpoint || this.companionUrl,
            recommendedModel: status.recommendedModel || "qwen2.5:1.5b",
          };
        }
      }

      // 2. Direct fetch fallback for test runners / companion
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${this.companionUrl}/api/status`, {
        method: "GET",
        headers: {
          "X-Browsy-Client": "extension",
          ...(this.simulateMode ? { "X-Browsy-Simulate": this.simulateMode } : {}),
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data.activeModel) this.activeModel = data.activeModel;
        return {
          ...data,
          available: data.available ?? (data.status === "connected" || data.ollamaRunning === true),
          endpoint: data.endpoint || this.companionUrl,
          recommendedModel: data.recommendedModel || "qwen2.5:1.5b",
        };
      }
    } catch {
      // Companion offline
    }

    return {
      status: "unavailable",
      ollamaRunning: false,
      available: false,
      endpoint: this.companionUrl,
      recommendedModel: "qwen2.5:1.5b (recommended for 16GB RAM / 8-core CPU)",
      activeModel: this.activeModel,
      availableModels: [],
      message: `Local companion service not running on ${this.companionUrl}`,
      source: "ollama-local",
    };
  }

  public async selectModel(modelName: string): Promise<boolean> {
    const trimmed = modelName.trim();
    if (!trimmed) return false;

    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        const res = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            { action: MessageActions.AI_SELECT_MODEL, model: trimmed },
            (r) => resolve(r)
          );
        });
        if (res && res.success) {
          this.activeModel = trimmed;
          return true;
        }
      }

      const res = await fetch(`${this.companionUrl}/api/models/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Browsy-Client": "extension" },
        body: JSON.stringify({ model: trimmed }),
      });
      if (res.ok) {
        this.activeModel = trimmed;
        return true;
      }
    } catch {
      // ignore
    }

    this.activeModel = trimmed;
    return true;
  }

  private async queryCompanion(endpoint: string, payload: any, timeoutMs?: number, signal?: AbortSignal): Promise<any> {
    const tMs = timeoutMs || this.timeoutMs;

    // Check if parent signal already aborted
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    // A. Extension background worker route
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      return new Promise((resolve, reject) => {
        let done = false;
        const abortHandler = () => {
          if (!done) {
            done = true;
            reject(new DOMException("Aborted", "AbortError"));
          }
        };
        if (signal) signal.addEventListener("abort", abortHandler, { once: true });

        chrome.runtime.sendMessage(
          {
            action: MessageActions.AI_QUERY,
            endpoint,
            payload,
            timeoutMs: tMs,
            simulate: this.simulateMode,
          },
          (response) => {
            if (signal) signal.removeEventListener("abort", abortHandler);
            if (done) return;
            done = true;

            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response?.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          }
        );
      });
    }

    // B. Direct fetch route (node / test scripts)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), tMs);
    const abortHandler = () => controller.abort();
    if (signal) signal.addEventListener("abort", abortHandler, { once: true });

    try {
      const res = await fetch(`${this.companionUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Browsy-Client": "extension",
          ...(this.simulateMode ? { "X-Browsy-Simulate": this.simulateMode } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", abortHandler);

      if (!res.ok) {
        throw new Error(`Companion HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", abortHandler);
      throw err;
    }
  }

  public async generateIntent(
    query: string,
    pageContext: StructuredPageIntelligence | null,
    conversationContext: ConversationContext,
    signal?: AbortSignal
  ): Promise<StructuredIntent> {
    try {
      const data = await this.queryCompanion(
        "/api/intent",
        {
          query,
          pageContext: pageContext ? { domain: pageContext.hostname, title: pageContext.title } : null,
          conversationContext,
        },
        this.timeoutMs,
        signal
      );

      if (data && typeof data === "object" && data.intent && data.target) {
        const isSentinel = (val: unknown): boolean =>
          typeof val === "string" && ["none", "unknown", "null", "undefined", "n/a", ""].includes(val.trim().toLowerCase());

        const entities = { ...(data.entities || {}) };
        for (const [k, v] of Object.entries(entities)) {
          if (isSentinel(v) || v === null || v === undefined) delete entities[k];
        }

        const filters = { ...(data.filters || {}) };
        for (const [k, v] of Object.entries(filters)) {
          if (isSentinel(v) || v === null || v === undefined) delete filters[k];
        }

        const constraints = { ...(data.constraints || {}) };
        for (const [k, v] of Object.entries(constraints)) {
          if (isSentinel(v) || v === null || v === undefined) delete constraints[k];
        }

        return {
          id: data.id || `intent-${Date.now()}`,
          intent: data.intent,
          target: data.target,
          entities,
          filters,
          constraints,
          relativeRef: data.relativeRef,
          scope: "current_page",
          confidence: typeof data.confidence === "number" ? data.confidence : 0.94,
          requiresClarification: Boolean(data.requiresClarification),
          clarificationPrompt: data.clarificationPrompt,
          rawQuery: query,
          timestamp: Date.now(),
        };
      }
    } catch {
      // Offline, timeout, or schema failure: graceful deterministic fallback
    }

    return this.fallback.generateIntent(query, pageContext, conversationContext);
  }

  public async interpretUnfamiliarLabels(
    labels: string[],
    targetConstraint: string,
    signal?: AbortSignal
  ): Promise<Record<string, number>> {
    try {
      const data = await this.queryCompanion(
        "/api/interpret-labels",
        { labels, targetConstraint },
        this.timeoutMs,
        signal
      );
      if (data && data.matches && typeof data.matches === "object") {
        return data.matches;
      }
    } catch {
      // Fallback
    }

    return this.fallback.interpretUnfamiliarLabels(labels, targetConstraint);
  }

  public async suggestErrorRecovery(
    failedStep: ActionPlanStep,
    errorReason: string,
    pageContext: StructuredPageIntelligence | null,
    remainingBudgetMs: number,
    signal?: AbortSignal
  ): Promise<ActionPlanStep[] | null> {
    if (remainingBudgetMs < 1000) return null;

    try {
      const data = await this.queryCompanion(
        "/api/recover",
        { failedStep, errorReason, remainingTimeMs: remainingBudgetMs },
        Math.min(this.timeoutMs, remainingBudgetMs - 300),
        signal
      );

      if (data && Array.isArray(data.suggestedSteps)) {
        // Enforce safety guard: reject sensitive or malicious steps
        const safeSteps = data.suggestedSteps.filter((s: ActionPlanStep) => {
          const text = `${s.description} ${s.targetLabel || ""} ${s.value || ""}`.toLowerCase();
          const isProhibited =
            text.includes("cvv") ||
            text.includes("password") ||
            text.includes("credit card") ||
            text.includes("payment") ||
            text.includes("javascript:");
          return !isProhibited;
        });
        if (safeSteps.length > 0) {
          return safeSteps;
        }
      }
    } catch {
      // Fallback
    }

    return this.fallback.suggestErrorRecovery(failedStep, errorReason, pageContext, remainingBudgetMs);
  }

  public async compareProducts(
    query: string,
    intent: StructuredIntent,
    items: RepeatedItem[],
    signal?: AbortSignal
  ): Promise<{ rankedItemIds: string[]; reasoning: Record<string, string> }> {
    if (!items || items.length === 0) {
      return { rankedItemIds: [], reasoning: {} };
    }

    try {
      const boundedItems = items.slice(0, 8).map((it) => ({
        elementId: it.elementId,
        title: it.title,
        price: it.price,
        metaText: it.metaText,
        rating: it.rating,
      }));

      const data = await this.queryCompanion(
        "/api/compare",
        { query, intent, items: boundedItems },
        this.timeoutMs,
        signal
      );

      if (data && Array.isArray(data.rankedItemIds)) {
        // Anti-hallucination check: ensure IDs exist in real items
        const realIds = new Set(items.map((i) => i.elementId));
        const filteredRanked = data.rankedItemIds.filter((id: string) => realIds.has(id));
        if (filteredRanked.length > 0) {
          return {
            rankedItemIds: filteredRanked,
            reasoning: data.reasoning || {},
          };
        }
      }
    } catch {
      // Fallback
    }

    return this.fallback.compareProducts(query, intent, items);
  }
}

/**
 * Composite AI Provider
 * Coordinates between Local Ollama and Deterministic Heuristic Engine.
 * Caches availability status with a 10s TTL, falls back automatically when Ollama is
 * stopped or unavailable, and exposes connection state for UI presentation.
 */
export class CompositeAIProvider implements AIProvider {
  public readonly id = "composite-ai";
  public readonly name = "Browsy Intelligent Coordinator (Ollama + Deterministic)";
  private ollama: OllamaLocalProvider;
  private fallback: HeuristicLocalProvider;
  private cachedStatus: ProviderStatus | null = null;
  private statusCheckedAt = 0;
  private readonly STATUS_CACHE_TTL_MS = 10000;

  constructor(options: OllamaProviderOptions = {}) {
    this.ollama = new OllamaLocalProvider(options);
    this.fallback = new HeuristicLocalProvider();
  }

  public getOllamaProvider(): OllamaLocalProvider {
    return this.ollama;
  }

  public getFallbackProvider(): HeuristicLocalProvider {
    return this.fallback;
  }

  public async checkAvailability(): Promise<ProviderStatus> {
    const now = Date.now();
    if (this.cachedStatus && now - this.statusCheckedAt < this.STATUS_CACHE_TTL_MS) {
      return this.cachedStatus;
    }

    try {
      const status = await this.ollama.checkAvailability();
      this.cachedStatus = status;
      this.statusCheckedAt = now;
      return status;
    } catch {
      const unavailable: ProviderStatus = {
        status: "unavailable",
        ollamaRunning: false,
        available: false,
        endpoint: this.ollama.getCompanionUrl(),
        recommendedModel: "qwen2.5:1.5b",
        activeModel: "none",
        availableModels: [],
        message: "Ollama companion service offline. Using deterministic engine.",
        source: "composite-ai",
      };
      this.cachedStatus = unavailable;
      this.statusCheckedAt = now;
      return unavailable;
    }
  }

  public async selectModel(modelName: string): Promise<boolean> {
    const ok = await this.ollama.selectModel(modelName);
    this.statusCheckedAt = 0; // invalidate cache
    return ok;
  }

  public async generateIntent(
    query: string,
    pageContext: StructuredPageIntelligence | null,
    conversationContext: ConversationContext,
    signal?: AbortSignal
  ): Promise<StructuredIntent> {
    // Stage 3 Performance Optimization: Deterministic Fast-Path Router
    // High-confidence intents (>= 0.92) with unambiguous domain entities and constraints
    // are resolved immediately via the heuristic engine (< 1 ms latency), bypassing local LLM inference.
    const fastResult = await this.fallback.generateIntent(query, pageContext, conversationContext);

    if (
      fastResult.requiresClarification ||
      (fastResult.confidence >= 0.92 && fastResult.intent !== "unknown")
    ) {
      return fastResult;
    }

    // Secondary path: queries requiring semantic reasoning or low confidence
    const status = await this.checkAvailability();
    if (status.ollamaRunning && status.status === "connected") {
      try {
        return await this.ollama.generateIntent(query, pageContext, conversationContext, signal);
      } catch {
        return fastResult;
      }
    }
    return fastResult;
  }

  public async interpretUnfamiliarLabels(
    labels: string[],
    targetConstraint: string,
    signal?: AbortSignal
  ): Promise<Record<string, number>> {
    // Fast deterministic heuristic evaluation first (sub-millisecond)
    const fastMatches = await this.fallback.interpretUnfamiliarLabels(labels, targetConstraint);
    const hasStrongMatch = Object.values(fastMatches).some(
      (score) => typeof score === "number" && score >= 0.85
    );
    if (hasStrongMatch) {
      return fastMatches;
    }

    const status = await this.checkAvailability();
    if (status.ollamaRunning && status.status === "connected") {
      try {
        return await this.ollama.interpretUnfamiliarLabels(labels, targetConstraint, signal);
      } catch {
        return fastMatches;
      }
    }
    return fastMatches;
  }

  public async suggestErrorRecovery(
    failedStep: ActionPlanStep,
    errorReason: string,
    pageContext: StructuredPageIntelligence | null,
    remainingBudgetMs: number,
    signal?: AbortSignal
  ): Promise<ActionPlanStep[] | null> {
    const status = await this.checkAvailability();
    if (status.ollamaRunning && status.status === "connected") {
      return this.ollama.suggestErrorRecovery(failedStep, errorReason, pageContext, remainingBudgetMs, signal);
    }
    return this.fallback.suggestErrorRecovery(failedStep, errorReason, pageContext, remainingBudgetMs);
  }

  public async compareProducts(
    query: string,
    intent: StructuredIntent,
    items: RepeatedItem[],
    signal?: AbortSignal
  ): Promise<{ rankedItemIds: string[]; reasoning: Record<string, string> }> {
    const status = await this.checkAvailability();
    if (status.ollamaRunning && status.status === "connected") {
      return this.ollama.compareProducts(query, intent, items, signal);
    }
    return this.fallback.compareProducts(query, intent, items);
  }
}
