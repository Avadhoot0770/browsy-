/**
 * Generic Navigation Planner for Browsy Stage 4.5
 * Determines whether the user is already on the target results page,
 * or whether the website needs to be navigated/searched first before applying filters.
 * STRICTLY GENERIC — NO WEBSITE-SPECIFIC HARDCODING.
 */

import type { StructuredPageIntelligence } from "../page-intelligence/types";
import type { StructuredIntent } from "../intent/types";
import type { NavigationPlanResult } from "./types";
import { analyzeCurrentPageState, buildTargetWebsiteState } from "./state-analyzer";
import { pluralize } from "../shared/text-utils";

/**
 * Plans the minimum required navigation and filter sequence to transition
 * from the current page state to the desired target website state.
 */
export function planNavigationSequence(
  pageContext: StructuredPageIntelligence | null,
  intent: StructuredIntent
): NavigationPlanResult {
  const currentState = analyzeCurrentPageState(pageContext, intent);
  const targetState = buildTargetWebsiteState(intent, pageContext?.hostname || "");

  // 1. Calculate Missing Filters
  const missingFilters: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(targetState.requiredFilters)) {
    if (currentState.activeFilters[k] !== v) {
      missingFilters[k] = v;
    }
  }

  // 2. Scenario 1: Already at Target State
  if (
    currentState.isRelevantToIntent &&
    (currentState.kind === "search_results" || currentState.kind === "category_listing") &&
    Object.keys(missingFilters).length === 0 &&
    currentState.resultsCount > 0
  ) {
    return {
      strategy: "already_target_state",
      currentState,
      targetState,
      explanation: `You're already on the ${targetState.category || "results"} page with your filters applied.`,
      missingFilters: {},
    };
  }

  // 3. Scenario 2: Current Page is Already Relevant (Category/Search Results Active)
  // No navigation needed; simply apply the missing filters.
  if (
    currentState.isRelevantToIntent &&
    (currentState.kind === "search_results" || currentState.kind === "category_listing")
  ) {
    return {
      strategy: "apply_filters_only",
      currentState,
      targetState,
      explanation: `You're already viewing ${targetState.category || "matching items"}. I will apply the missing filters directly on this page.`,
      missingFilters,
    };
  }

  // 4. Scenario 3: Use Site Search to Reach Relevant Results Page (Priority on e-commerce & homepages)
  const searchInput =
    pageContext?.searchInputs?.[0] ||
    pageContext?.inputs?.find(
      (i) => i.type === "search" || (i.placeholder || "").toLowerCase().includes("search")
    );

  if (
    searchInput ||
    !currentState.isRelevantToIntent ||
    currentState.kind === "homepage" ||
    currentState.kind === "unrelated"
  ) {
    let queryTerm = targetState.searchQuery || (targetState.category ? pluralize(targetState.category) : "") || intent.rawQuery;
    return {
      strategy: "search_and_filter",
      currentState,
      targetState,
      requiredSearchQuery: queryTerm,
      explanation: `Search this site for "${queryTerm}" to reach the results page, then apply filters.`,
      missingFilters,
    };
  }

  // 5. Scenario 4: Navigate to Category Link if no search input exists
  const categoryWord = (targetState.category || "").toLowerCase();
  let candidateLink: { elementId: string; text: string } | null = null;

  if (categoryWord && pageContext?.links) {
    const wordPattern = new RegExp(`\\b${categoryWord}s?\\b`, "i");
    for (const link of pageContext.links) {
      const linkText = link.text.toLowerCase();
      if (wordPattern.test(linkText) && linkText.length <= 35) {
        candidateLink = { elementId: link.elementId, text: link.text };
        break;
      }
    }
  }

  if (candidateLink) {
    return {
      strategy: "navigate_link_and_filter",
      currentState,
      targetState,
      targetLinkElementId: candidateLink.elementId,
      targetLinkLabel: candidateLink.text,
      explanation: `Navigate to "${candidateLink.text}" first, then apply filters on the results page.`,
      missingFilters,
    };
  }

  // Fallback: If page is already partially related, apply whatever filters exist on current page
  return {
    strategy: "apply_filters_only",
    currentState,
    targetState,
    explanation: `Locating relevant controls directly on this page.`,
    missingFilters,
  };
}
