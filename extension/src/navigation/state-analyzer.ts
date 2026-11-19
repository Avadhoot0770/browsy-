/**
 * Current Page State Analyzer for Browsy Stage 4.5
 * Evaluates whether the current page is a homepage, search results page,
 * product detail page, or unrelated, and inspects active filters and results.
 */

import type { StructuredPageIntelligence } from "../page-intelligence/types";
import type { StructuredIntent } from "../intent/types";
import type { CurrentPageState, PageStateKind, TargetWebsiteState } from "./types";
import { pluralize } from "../shared/text-utils";

/**
 * Analyzes the current page to determine its structure, relevance, and active filters.
 */
export function analyzeCurrentPageState(
  pageContext: StructuredPageIntelligence | null,
  intent: StructuredIntent
): CurrentPageState {
  if (!pageContext) {
    return {
      kind: "unknown",
      url: "",
      hostname: "",
      pathname: "",
      title: "",
      isRelevantToIntent: false,
      activeFilters: {},
      availableFilterCategories: [],
      resultsCount: 0,
    };
  }

  const url = (pageContext.url || "").toLowerCase();
  let pathname = (pageContext.pathname || "").toLowerCase();
  if (!pathname && pageContext.url) {
    try {
      pathname = new URL(pageContext.url).pathname.toLowerCase();
    } catch {}
  }
  const title = (pageContext.title || "").toLowerCase();

  const headings = pageContext.headings || [];
  const buttons = pageContext.buttons || [];
  const inputs = pageContext.inputs || [];
  const repeatedItemsCount = (pageContext.repeatedGroups || []).reduce(
    (sum, group) => sum + (group.items?.length || 0),
    0
  );

  // 1. Determine Relevance to User Intent
  let isRelevantToIntent = false;
  let activeCategory: string | undefined;

  const targetCategory = intent.entities.category?.toLowerCase();
  const searchTerms = [
    targetCategory,
    intent.entities.role?.toLowerCase(),
    intent.filters.color?.toLowerCase(),
  ].filter(Boolean) as string[];

  const pageCorpus = `${title} ${pathname} ${headings.map((h) => h.text).join(" ")}`.toLowerCase();

  if (targetCategory && pageCorpus.includes(targetCategory)) {
    isRelevantToIntent = true;
    activeCategory = intent.entities.category;
  } else if (searchTerms.some((term) => pageCorpus.includes(term))) {
    isRelevantToIntent = true;
  }

  // 2. Identify Page State Kind
  let kind: PageStateKind = "unknown";

  const isCart = pathname.includes("cart") || pathname.includes("bag") || pathname.includes("basket");
  const isCheckout = pathname.includes("checkout") || pathname.includes("payment");
  const hasCartButtons = buttons.some((b) =>
    /add to (?:cart|bag|basket)|buy now/i.test(b.text)
  );

  if (isCheckout) {
    kind = "checkout";
  } else if (isCart) {
    kind = "cart";
  } else if (hasCartButtons && repeatedItemsCount <= 4) {
    kind = "product_detail";
  } else if (pathname === "/" || pathname === "" || pathname === "/home" || pathname === "/index.html") {
    if (isRelevantToIntent && repeatedItemsCount >= 4) {
      kind = "category_listing";
    } else if (repeatedItemsCount >= 6 && (url.includes("q=") || url.includes("search="))) {
      kind = "search_results";
    } else {
      kind = "homepage";
    }
  } else if (
    repeatedItemsCount >= 1 ||
    url.includes("search") ||
    url.includes("catalog") ||
    url.includes("q=") ||
    url.includes("category") ||
    (isRelevantToIntent && pathname !== "/" && pathname !== "")
  ) {
    kind = url.includes("search") || url.includes("q=") ? "search_results" : "category_listing";
  } else {
    kind = "unrelated";
  }

  // 3. Inspect Active Filters and Available Filter Categories
  const activeFilters: Record<string, string | number | boolean> = {};
  const availableFilterCategories: string[] = [];

  const targetColor = intent.filters.color?.toString().toLowerCase();
  const targetPattern = intent.filters.pattern?.toString().toLowerCase();
  const targetSize = intent.filters.size?.toString().toLowerCase();

  // Inspect URL parameters for active filters
  const decodedUrl = decodeURIComponent(url);
  if (targetColor && decodedUrl.includes(targetColor)) {
    activeFilters.color = intent.filters.color!;
  }
  if (targetPattern && decodedUrl.includes(targetPattern)) {
    activeFilters.pattern = intent.filters.pattern!;
  }
  if (targetSize && decodedUrl.includes(targetSize)) {
    activeFilters.size = intent.filters.size!;
  }

  // Inspect inputs / checkboxes
  for (const input of inputs) {
    const text = `${input.text} ${input.placeholder || ""} ${input.ariaLabel || ""} ${input.nearbyLabel || ""}`.toLowerCase();
    if (input.type === "checkbox" || input.type === "radio") {
      // If we detect size, color, or price labels in surrounding text
      if (text.includes("xl") || text.includes("size")) availableFilterCategories.push("size");
      if (text.includes("red") || text.includes("color")) availableFilterCategories.push("color");
      if (text.includes("price") || text.includes("under")) availableFilterCategories.push("price");
      if (text.includes("check") || text.includes("pattern")) availableFilterCategories.push("pattern");

      if (input.checked) {
        if (targetColor && text.includes(targetColor)) {
          activeFilters.color = intent.filters.color!;
        }
        if (targetPattern && text.includes(targetPattern)) {
          activeFilters.pattern = intent.filters.pattern!;
        }
        if (targetSize && text.includes(targetSize)) {
          activeFilters.size = intent.filters.size!;
        }
      }
    }
  }

  // Check buttons / filter controls
  for (const btn of buttons) {
    const txt = `${btn.text} ${btn.ariaLabel || ""}`.toLowerCase();
    if (txt.includes("filter") || txt.includes("sort")) {
      availableFilterCategories.push("filters");
    }
    if (targetColor && txt.includes(targetColor)) activeFilters.color = intent.filters.color!;
    if (targetPattern && txt.includes(targetPattern)) activeFilters.pattern = intent.filters.pattern!;
    if (targetSize && txt.includes(targetSize)) activeFilters.size = intent.filters.size!;
  }

  // Results count
  const resultsCount = repeatedItemsCount;

  return {
    kind,
    url: pageContext.url,
    hostname: pageContext.hostname,
    pathname: pageContext.pathname,
    title: pageContext.title,
    isRelevantToIntent,
    activeCategory,
    activeFilters,
    availableFilterCategories: Array.from(new Set(availableFilterCategories)),
    resultsCount,
  };
}

/**
 * Builds the Target Website State based on the user's StructuredIntent.
 */
export function buildTargetWebsiteState(
  intent: StructuredIntent,
  hostname: string
): TargetWebsiteState {
  const requiredFilters: Record<string, string | number | boolean> = {};

  if (intent.filters.color) requiredFilters.color = intent.filters.color;
  if (intent.filters.pattern) requiredFilters.pattern = intent.filters.pattern;
  if (intent.filters.size) requiredFilters.size = intent.filters.size;

  const descriptiveTerms: string[] = [];
  if (intent.filters.color && typeof intent.filters.color === "string") {
    descriptiveTerms.push(intent.filters.color);
  }
  if (intent.filters.pattern && typeof intent.filters.pattern === "string") {
    descriptiveTerms.push(intent.filters.pattern);
  }
  if (intent.filters.brand && typeof intent.filters.brand === "string") {
    descriptiveTerms.push(intent.filters.brand);
  }

  let cat = intent.entities.category ? pluralize(intent.entities.category) : "";

  let searchQuery = "";
  if (intent.target === "jobs") {
    const jobTerms = [intent.entities.type, intent.entities.role].filter(Boolean);
    searchQuery = jobTerms.length > 0 ? jobTerms.join(" ") : intent.rawQuery;
  } else if (descriptiveTerms.length > 0 && cat) {
    searchQuery = `${descriptiveTerms.join(" ")} ${cat}`;
  } else if (cat) {
    searchQuery = cat;
  } else if (intent.rawQuery) {
    searchQuery = intent.rawQuery;
  }

  return {
    domain: hostname,
    category: intent.entities.category || (intent.target === "jobs" ? intent.entities.role : undefined),
    searchQuery,
    requiredFilters,
    maxPrice: intent.constraints.maxPrice,
    minRating: intent.constraints.minRating,
    expectedResultType: intent.target === "products" ? "products" : intent.target === "jobs" ? "jobs" : "general",
  };
}
