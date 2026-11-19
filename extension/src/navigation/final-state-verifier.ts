/**
 * Final Website State Verifier for Browsy Stage 4.5
 * Verifies that the website visibly transitioned to the intended results page,
 * checks that filters are active and matching results are present,
 * evaluates visible product card metadata, and formulates honest, non-technical status messages.
 */

import type { StructuredPageIntelligence } from "../page-intelligence/types";
import type { StructuredIntent, MatchedItem } from "../intent/types";
import type { FinalStateVerificationResult } from "./types";
import { textContainsWord } from "../shared/text-utils";
import { matchItemsOnPage } from "../intent/matcher";

export interface FinalStateVerificationOptions {
  verifiedCandidateProducts?: MatchedItem[];
}

/**
 * Extracts a friendly brand name from a hostname (e.g. "www.myntra.com" -> "Myntra").
 */
export function formatFriendlySiteName(hostname: string): string {
  if (!hostname) return "The website";
  const clean = hostname.replace(/^(?:www\.)?([^.]+)\..*$/, "$1");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Verifies the final state of the webpage after plan execution.
 */
export function verifyFinalWebsiteState(
  pageContext: StructuredPageIntelligence | null,
  intent: StructuredIntent,
  options?: FinalStateVerificationOptions
): FinalStateVerificationResult {
  const siteName = formatFriendlySiteName(pageContext?.hostname || "");
  const category = (intent.target === "jobs" ? intent.entities.role || "jobs" : intent.entities.category) || "items";

  // Check if intent requires user clarification
  if (intent.requiresClarification) {
    return {
      status: "NEEDS USER INPUT",
      isSuccess: false,
      isPartialSuccess: false,
      verifiedCategory: false,
      verifiedFilters: {},
      unverifiedFilters: [],
      resultsPresent: false,
      resultsCount: 0,
      userFacingSummary: intent.clarificationPrompt || "Please provide additional details to continue.",
    };
  }

  if (!pageContext) {
    return {
      status: "FAILED",
      isSuccess: false,
      isPartialSuccess: false,
      verifiedCategory: false,
      verifiedFilters: {},
      unverifiedFilters: [],
      resultsPresent: false,
      resultsCount: 0,
      userFacingSummary: "Could not inspect the final page state.",
    };
  }

  const headings = pageContext.headings || [];
  const inputs = pageContext.inputs || [];
  const buttons = pageContext.buttons || [];
  const decodedUrl = decodeURIComponent(pageContext.url || "").toLowerCase();

  // Handle summarization intent
  if (intent.intent === "summarize") {
    const headingBullets = headings.slice(0, 4).map((h) => `• ${h.text}`).join("\n");
    const summaryText = pageContext.summary ? `\n\n${pageContext.summary}` : "";
    return {
      status: "COMPLETED",
      isSuccess: true,
      isPartialSuccess: false,
      verifiedCategory: true,
      verifiedFilters: {},
      unverifiedFilters: [],
      resultsPresent: true,
      resultsCount: headings.length,
      userFacingSummary: `Page summary for "${pageContext.title || siteName}":\n\nKey Topics:\n${headingBullets || "• General page content"}${summaryText}`,
    };
  }

  // Aggregate item cards
  const allItems = (pageContext.repeatedGroups || []).flatMap((g) => g.items || []);
  const itemTitles = allItems.map((i) => (i.title || "").toLowerCase()).join(" ");
  const itemMetaTexts = allItems.flatMap((i) => i.metaText || []).map((t) => t.toLowerCase()).join(" ");
  const itemAltTexts = allItems.map((i) => (i.imageAlt || "").toLowerCase()).join(" ");
  const combinedItemEvidence = `${itemTitles} ${itemMetaTexts} ${itemAltTexts}`;
  const itemPrices = allItems
    .map((i) => i.price?.amount)
    .filter((p): p is number => typeof p === "number" && !isNaN(p));

  const pageCorpus = `${pageContext.title || ""} ${pageContext.summary || ""} ${pageContext.url || ""} ${headings.map((h) => h.text).join(" ")}`.toLowerCase();

  // 1. Verify Category / Target Role
  const categoryWord = (intent.entities.category || "").toLowerCase();
  const roleWord = (intent.entities.role || "").toLowerCase();
  let verifiedCategory = true;

  if (intent.target === "jobs" && roleWord) {
    verifiedCategory =
      pageCorpus.includes(roleWord) ||
      decodedUrl.includes(roleWord) ||
      combinedItemEvidence.includes(roleWord) ||
      pageCorpus.includes("job") ||
      pageCorpus.includes("career");
  } else if (categoryWord) {
    verifiedCategory =
      pageCorpus.includes(categoryWord) ||
      decodedUrl.includes(categoryWord) ||
      combinedItemEvidence.includes(categoryWord) ||
      textContainsWord(pageCorpus, categoryWord) ||
      textContainsWord(decodedUrl, categoryWord) ||
      textContainsWord(combinedItemEvidence, categoryWord);
  }

  // 2. Verify Requested Filters
  const verifiedFilters: Record<string, boolean> = {};
  const unverifiedFilters: string[] = [];

  // Inspect page inputs: active checked checkboxes and inputs
  const activeControlTexts: string[] = [];
  for (const input of inputs) {
    const text = `${input.text} ${input.nearbyLabel || ""} ${input.ariaLabel || ""} ${input.placeholder || ""} ${input.name || ""}`.toLowerCase();
    if (input.checked || input.type === "input" || input.type === "search" || input.inputType === "text") {
      activeControlTexts.push(text);
    }
  }
  for (const btn of buttons) {
    activeControlTexts.push(`${btn.text} ${btn.ariaLabel || ""}`.toLowerCase());
  }
  for (const heading of headings) {
    activeControlTexts.push(heading.text.toLowerCase());
  }

  // Also include active filter summary chips from live DOM if available
  if (typeof document !== "undefined") {
    try {
      const chipElements = document.querySelectorAll(
        ".filter-summary, .active-filter, [class*='selected' i], [class*='chip' i], [class*='badge' i], [class*='pill' i], [aria-checked='true']"
      );
      for (let i = 0; i < chipElements.length; i++) {
        const t = (chipElements[i].textContent || "").trim().toLowerCase();
        if (t && t.length < 60 && !activeControlTexts.includes(t)) {
          activeControlTexts.push(t);
        }
      }
    } catch {
      // In mock DOM / non-DOM environments
    }
  }

  const combinedControls = activeControlTexts.join(" ");

  // Color Filter
  if (intent.filters.color) {
    const colorStr = String(intent.filters.color).toLowerCase();
    const colorFacetRegex = new RegExp(`(?:color|colors|colour|color_facet)[=:_%3a]+${colorStr}\\b`, "i");
    const isColorPresent =
      combinedControls.includes(colorStr) ||
      colorFacetRegex.test(decodedUrl) ||
      decodedUrl.includes(colorStr) ||
      combinedItemEvidence.includes(colorStr);

    verifiedFilters.color = isColorPresent;
    if (!isColorPresent) unverifiedFilters.push(intent.filters.color as string);
  }

  // Size Filter
  if (intent.filters.size) {
    const sizeStr = String(intent.filters.size).toLowerCase();
    const sizeFacetRegex = new RegExp(`(?:size|sizes|size_facet)[=:_%3a]+${sizeStr}\\b`, "i");
    const isSizePresent =
      combinedControls.includes(sizeStr) ||
      sizeFacetRegex.test(decodedUrl) ||
      decodedUrl.includes(`size:${sizeStr}`) ||
      decodedUrl.includes(`size=${sizeStr}`) ||
      decodedUrl.includes(`size%3a${sizeStr}`) ||
      (combinedItemEvidence.length > 0 && new RegExp(`\\b${sizeStr}\\b`, "i").test(combinedItemEvidence));

    verifiedFilters.size = isSizePresent;
    if (!isSizePresent) unverifiedFilters.push(`Size ${intent.filters.size}`);
  }

  // Pattern Filter
  if (intent.filters.pattern) {
    const patternStr = String(intent.filters.pattern).toLowerCase();
    const isPatternPresent =
      combinedControls.includes(patternStr) ||
      decodedUrl.includes(patternStr) ||
      pageCorpus.includes(patternStr) ||
      combinedItemEvidence.includes(patternStr) ||
      (patternStr === "checked" && (combinedItemEvidence.includes("check") || combinedItemEvidence.includes("plaid") || pageCorpus.includes("check")));

    verifiedFilters.pattern = isPatternPresent;
    if (!isPatternPresent) unverifiedFilters.push(intent.filters.pattern as string);
  }

  // Job Type Filter (e.g. entry-level, internship)
  if (intent.entities.type) {
    const typeStr = intent.entities.type.toLowerCase();
    const isTypePresent =
      combinedControls.includes(typeStr) ||
      decodedUrl.includes(typeStr) ||
      pageCorpus.includes(typeStr) ||
      combinedItemEvidence.includes(typeStr);

    verifiedFilters.type = isTypePresent;
    if (!isTypePresent) unverifiedFilters.push(intent.entities.type);
  }

  // Brand Filter (either in filters.brand or entities.brand)
  const rawBrand = (intent.filters.brand || intent.entities.brand) as string | undefined;
  const brandVal =
    rawBrand && !["none", "unknown", "n/a", "undefined", "null"].includes(rawBrand.trim().toLowerCase())
      ? rawBrand
      : undefined;
  if (brandVal) {
    const brandStr = String(brandVal).toLowerCase();
    const brandFacetRegex = new RegExp(`(?:brand|brand_facet)[=:_%3a]+${brandStr}\\b`, "i");
    const isBrandPresent =
      combinedControls.includes(brandStr) ||
      brandFacetRegex.test(decodedUrl) ||
      decodedUrl.includes(`brand:${brandStr}`) ||
      decodedUrl.includes(`brand=${brandStr}`) ||
      decodedUrl.includes(`brand%3a${brandStr}`) ||
      decodedUrl.includes(brandStr) ||
      pageCorpus.includes(brandStr) ||
      combinedItemEvidence.includes(brandStr);

    verifiedFilters.brand = isBrandPresent;
    if (!isBrandPresent) unverifiedFilters.push(brandVal);
  }

  // Generic Arbitrary Filters (e.g. material, amenities, etc.)
  for (const [filterKey, filterVal] of Object.entries(intent.filters)) {
    if (["color", "pattern", "size", "brand"].includes(filterKey) || !filterVal) continue;
    if (typeof filterVal === "string" && ["none", "unknown", "n/a", "undefined", "null"].includes(filterVal.trim().toLowerCase())) continue;
    const filterStr = String(filterVal).toLowerCase();
    const isFilterPresent =
      combinedControls.includes(filterStr) ||
      decodedUrl.includes(filterStr) ||
      pageCorpus.includes(filterStr) ||
      combinedItemEvidence.includes(filterStr);

    verifiedFilters[filterKey] = isFilterPresent;
    if (!isFilterPresent) unverifiedFilters.push(String(filterVal));
  }

  // Price Constraint
  if (intent.constraints.maxPrice) {
    const maxP = intent.constraints.maxPrice;
    const priceStr = String(maxP);

    const hasPriceControl =
      combinedControls.includes(`under ${priceStr}`) ||
      combinedControls.includes(`under ₹${maxP.toLocaleString()}`) ||
      combinedControls.includes(`under ?${maxP.toLocaleString()}`) ||
      combinedControls.includes(`price: under`) ||
      combinedControls.includes(`price under`) ||
      (combinedControls.includes("price") && (combinedControls.includes(priceStr) || combinedControls.includes("under")));

    const priceRegex = new RegExp(`price[=:][^&]*(?:${maxP}|to[_\\s]*${maxP})`, "i");
    const hasPriceUrl =
      decodedUrl.includes(`maxprice=${maxP}`) ||
      decodedUrl.includes(`price:${maxP}`) ||
      priceRegex.test(decodedUrl);

    let hasEmpiricalPrices = false;
    if (itemPrices.length > 0) {
      const conforming = itemPrices.filter((p) => p <= maxP);
      if (conforming.length / itemPrices.length >= 0.75) {
        hasEmpiricalPrices = true;
      }
    }

    const hasPriceFilter = hasPriceControl || hasPriceUrl || hasEmpiricalPrices;
    verifiedFilters.price = hasPriceFilter;
    if (!hasPriceFilter) unverifiedFilters.push(`under ₹${maxP.toLocaleString()}`);
  }

  // 3. Verify Results Present
  const resultsCount = (pageContext.repeatedGroups || []).reduce(
    (sum, group) => sum + (group.items?.length || 0),
    0
  );

  const isExplicitZeroResults =
    pageCorpus.includes("0 results") ||
    pageCorpus.includes("no results found") ||
    pageCorpus.includes("no products found") ||
    pageCorpus.includes("did not match any");

  const isCardOriented = ["products", "jobs", "travel"].includes(intent.target);
  const tableRowsCount = (pageContext.tables || []).reduce((sum, t) => sum + t.rowCount, 0);
  const candidateProductsCount = options?.verifiedCandidateProducts?.length || 0;
  const effectiveCount = resultsCount > 0 ? resultsCount : candidateProductsCount > 0 ? candidateProductsCount : tableRowsCount;

  // 3b. Evaluate product items against requested constraints independently
  const matchedItems = matchItemsOnPage(intent, pageContext);
  let confirmedMatches = matchedItems.filter((m) => m.matchClassification === "confirmed");
  const partialMatches = matchedItems.filter((m) => m.matchClassification === "partial");

  // Incorporate candidate products verified via product-level detail inspection
  if (options?.verifiedCandidateProducts && options.verifiedCandidateProducts.length > 0) {
    for (const vProduct of options.verifiedCandidateProducts) {
      if (!confirmedMatches.some((c) => c.elementId === vProduct.elementId || c.title === vProduct.title)) {
        confirmedMatches.unshift(vProduct);
      }
    }
  }

  // Non-card oriented queries (articles, forms, navigation, documentation) do not require repeated cards
  const resultsPresent = !isExplicitZeroResults && (effectiveCount > 0 || confirmedMatches.length > 0 || !isCardOriented);

  // If size filter was requested and not verified by controls/URL, but confirmed item matches have verified size
  if (intent.filters.size && !verifiedFilters.size) {
    if (confirmedMatches.length > 0 && confirmedMatches.some((m) => m.verifiedConditions?.some((c) => c.toLowerCase().includes("size")))) {
      verifiedFilters.size = true;
      const idx = unverifiedFilters.findIndex((f) => f.toLowerCase().includes("size"));
      if (idx !== -1) unverifiedFilters.splice(idx, 1);
    }
  }

  // If price constraint was requested and not verified by controls/URL, but confirmed item matches have verified price within budget
  if (intent.constraints.maxPrice && !verifiedFilters.price) {
    if (confirmedMatches.length > 0 && confirmedMatches.some((m) => m.price && m.price.amount <= intent.constraints.maxPrice!)) {
      verifiedFilters.price = true;
      const idx = unverifiedFilters.findIndex((f) => f.toLowerCase().includes("under") || f.toLowerCase().includes(String(intent.constraints.maxPrice)));
      if (idx !== -1) unverifiedFilters.splice(idx, 1);
    }
  }

  // If color filter was requested and not verified by controls/URL, but confirmed item matches have verified color
  if (intent.filters.color && !verifiedFilters.color) {
    const colLower = String(intent.filters.color).toLowerCase();
    if (confirmedMatches.length > 0 && confirmedMatches.some((m) => m.verifiedConditions?.some((c) => c.toLowerCase().includes("color") || c.toLowerCase().includes(colLower)))) {
      verifiedFilters.color = true;
      const idx = unverifiedFilters.findIndex((f) => f.toLowerCase().includes(colLower));
      if (idx !== -1) unverifiedFilters.splice(idx, 1);
    }
  }

  // If pattern filter was requested and not verified by controls/URL, but confirmed item matches have verified pattern
  if (intent.filters.pattern && !verifiedFilters.pattern) {
    const patLower = String(intent.filters.pattern).toLowerCase();
    if (confirmedMatches.length > 0 && confirmedMatches.some((m) => m.verifiedConditions?.some((c) => c.toLowerCase().includes("pattern") || c.toLowerCase().includes(patLower)))) {
      verifiedFilters.pattern = true;
      const idx = unverifiedFilters.findIndex((f) => f.toLowerCase().includes(patLower));
      if (idx !== -1) unverifiedFilters.splice(idx, 1);
    }
  }

  const reasonsForPartial: string[] = [];
  if (unverifiedFilters.length > 0) {
    for (const f of unverifiedFilters) {
      reasonsForPartial.push(`Filter '${f}' could not be verified on this site or in visible item card metadata.`);
    }
  }

  // 4. Formulate Honest Outcome
  const isAllFiltersVerified = unverifiedFilters.length === 0;

  // Never equate opening an unverified search results page with task completion:
  // COMPLETED requires all mandatory constraints to be verified (either via active facets/url or via product-level inspection).
  const isSuccess = verifiedCategory && isAllFiltersVerified && resultsPresent;
  const isPartialSuccess = verifiedCategory && resultsPresent && !isSuccess;

  let status: FinalStateVerificationResult["status"] = "FAILED";
  let userFacingSummary = "";

  if (isSuccess) {
    status = "COMPLETED";
    userFacingSummary = `Done. ${siteName} is showing ${effectiveCount} matching ${category}.`;
  } else if (!resultsPresent) {
    status = "FAILED";
    userFacingSummary = `I reached ${siteName}'s ${category} page, but no matching results were found.`;
  } else if (!verifiedCategory) {
    status = "FAILED";
    userFacingSummary = `Could not reach ${siteName}'s ${category} page.`;
  } else if (isPartialSuccess) {
    status = "PARTIALLY COMPLETED";
    if (partialMatches.length > 0 && unverifiedFilters.length > 0) {
      userFacingSummary = `I reached ${siteName}'s ${category} page and found ${partialMatches.length} partial match${partialMatches.length === 1 ? "" : "es"}, but I couldn't verify the ${unverifiedFilters.join(", ")} filter on this site.`;
    } else if (unverifiedFilters.length > 0) {
      userFacingSummary = `I reached ${siteName}'s ${category} page, but I couldn't verify the ${unverifiedFilters.join(", ")} filter on this site (partial match).`;
    } else {
      userFacingSummary = `I navigated to ${siteName}, but one or more requested constraints remain unverified (partial match).`;
    }
  } else {
    status = "FAILED";
    userFacingSummary = `I navigated to ${siteName}, but could not confirm all requested criteria.`;
  }

  return {
    status,
    isSuccess,
    isPartialSuccess,
    verifiedCategory,
    verifiedFilters,
    unverifiedFilters,
    resultsPresent,
    resultsCount: confirmedMatches.length > 0 ? confirmedMatches.length : effectiveCount,
    userFacingSummary,
    confirmedMatches,
    partialMatches,
    reasonsForPartial,
  };
}
