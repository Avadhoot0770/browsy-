/**
 * Action Planner for Browsy AI Intent Engine
 * Generates safe, structured, proposed action sequences from intent and page matches.
 * STRICT INVARIANT: Status is always 'proposed' — Stage 3 NEVER executes actions.
 */

import type {
  StructuredIntent,
  ActionPlan,
  ActionPlanStep,
  MatchedItem,
} from "./types";
import type { StructuredPageIntelligence } from "../page-intelligence/types";
import { matchItemsOnPage, matchControlsOnPage } from "./matcher";
import { planNavigationSequence } from "../navigation/navigation-planner";
import { formatFriendlySiteName } from "../navigation/final-state-verifier";

export function generateActionPlan(
  intent: StructuredIntent,
  pageContext: StructuredPageIntelligence | null
): ActionPlan {
  const planId = `plan-${Date.now()}`;
  const steps: ActionPlanStep[] = [];
  let stepIndex = 0;
  const siteName = formatFriendlySiteName(pageContext?.hostname || "");

  // 1. If clarification is required, propose zero browser steps and explain
  if (intent.requiresClarification) {
    return {
      id: planId,
      status: "proposed",
      steps: [],
      matchedItems: [],
      explanation: intent.clarificationPrompt || "I need one more detail to proceed with your request.",
      confidence: intent.confidence,
      timestamp: Date.now(),
    };
  }

  // 2. Match items and controls against current page context
  const matchedItems: MatchedItem[] = matchItemsOnPage(intent, pageContext);
  const controlMatches = matchControlsOnPage(intent, pageContext);

  // 3. Consult Navigation Planner (Stage 4.5 Current State vs Target State)
  const navPlan = planNavigationSequence(pageContext, intent);

  // 4. Propose steps based on intent type and navigation strategy
  if (intent.intent === "navigate" && controlMatches.navLink) {
    stepIndex += 1;
    steps.push({
      id: `step-${stepIndex}`,
      type: "navigate",
      targetElementId: controlMatches.navLink.elementId,
      targetLabel: controlMatches.navLink.text,
      description: `Open "${controlMatches.navLink.text}" page`,
      confidence: 0.9,
    });
  } else if (intent.intent === "summarize") {
    stepIndex += 1;
    steps.push({
      id: `step-${stepIndex}`,
      type: "summarize",
      description: "Summarize key information on this page",
      confidence: 0.95,
    });
  } else if (intent.intent === "compare") {
    stepIndex += 1;
    steps.push({
      id: `step-${stepIndex}`,
      type: "compare",
      description: `Compare attributes of ${matchedItems.length > 0 ? matchedItems.length : 3} candidate items`,
      confidence: 0.9,
    });
  } else if (navPlan.strategy === "already_target_state") {
    // Current page is already the target results page with matching filters
    // Propose 0 steps to avoid redundant navigation
  } else if (navPlan.strategy === "search_and_filter" && controlMatches.searchInput && navPlan.requiredSearchQuery) {
    stepIndex += 1;
    steps.push({
      id: `step-${stepIndex}`,
      type: "search",
      targetElementId: controlMatches.searchInput.elementId,
      targetLabel: controlMatches.searchInput.placeholder || "Search input",
      value: navPlan.requiredSearchQuery,
      description: `Search ${siteName} for "${navPlan.requiredSearchQuery}"`,
      confidence: 0.92,
    });

    // Add filter steps for requested criteria (to be executed/refined on results page)
    if (intent.filters.color) {
      stepIndex += 1;
      steps.push({
        id: `step-${stepIndex}`,
        type: "check",
        value: intent.filters.color,
        description: `Apply ${intent.filters.color} color filter`,
        confidence: 0.88,
      });
    }
    if (intent.filters.pattern) {
      stepIndex += 1;
      steps.push({
        id: `step-${stepIndex}`,
        type: "check",
        value: intent.filters.pattern,
        description: `Apply ${intent.filters.pattern} pattern filter`,
        confidence: 0.88,
      });
    }
    if (intent.filters.size) {
      stepIndex += 1;
      steps.push({
        id: `step-${stepIndex}`,
        type: "check",
        value: intent.filters.size,
        description: `Apply Size ${intent.filters.size} filter`,
        confidence: 0.88,
      });
    }
    const rawBrand = (intent.filters.brand || intent.entities.brand) as string | undefined;
    const brandVal =
      rawBrand && !["none", "unknown", "n/a", "undefined", "null"].includes(rawBrand.trim().toLowerCase())
        ? rawBrand
        : undefined;
    if (brandVal) {
      stepIndex += 1;
      steps.push({
        id: `step-${stepIndex}`,
        type: "check",
        value: brandVal,
        description: `Apply ${brandVal} brand filter`,
        confidence: 0.88,
      });
    }
    if (intent.constraints.maxPrice) {
      stepIndex += 1;
      steps.push({
        id: `step-${stepIndex}`,
        type: "check",
        value: intent.constraints.maxPrice,
        description: `Apply price under ₹${intent.constraints.maxPrice.toLocaleString()}`,
        confidence: 0.88,
      });
    }

    // Generic filters (e.g. material, amenities, etc., excluding already handled ones)
    for (const [filterKey, filterVal] of Object.entries(intent.filters)) {
      if (["color", "pattern", "size", "brand"].includes(filterKey) || !filterVal) continue;
      const displayVal = Array.isArray(filterVal) ? filterVal.join(", ") : String(filterVal);
      stepIndex += 1;
      steps.push({
        id: `step-${stepIndex}`,
        type: "check",
        value: displayVal,
        description: `Apply ${displayVal} ${filterKey} filter`,
        confidence: 0.85,
      });
    }
  } else if (navPlan.strategy === "navigate_link_and_filter" && navPlan.targetLinkElementId) {
    stepIndex += 1;
    steps.push({
      id: `step-${stepIndex}`,
      type: "navigate",
      targetElementId: navPlan.targetLinkElementId,
      targetLabel: navPlan.targetLinkLabel,
      description: `Navigate to ${navPlan.targetLinkLabel}`,
      confidence: 0.9,
    });
  } else {
    // Current page is already relevant or filters match on page
    for (const f of controlMatches.filterControls) {
      stepIndex += 1;
      const isCheckbox = f.control.type === "checkbox";
      steps.push({
        id: `step-${stepIndex}`,
        type: isCheckbox ? "check" : "select",
        targetElementId: f.control.elementId,
        targetLabel: f.control.text || f.control.nearbyLabel,
        description: `Select ${f.reason} (${f.control.text || f.control.nearbyLabel || "Filter Option"})`,
        confidence: 0.88,
      });
    }

    // If "Apply" button is present and filters were identified, propose clicking apply
    if (controlMatches.applyButton && controlMatches.filterControls.length > 0) {
      stepIndex += 1;
      steps.push({
        id: `step-${stepIndex}`,
        type: "click",
        targetElementId: controlMatches.applyButton.elementId,
        targetLabel: controlMatches.applyButton.text,
        description: `Click "${controlMatches.applyButton.text || "Apply Filters"}" to update results`,
        confidence: 0.85,
      });
    }

    // If search control exists and no specific filters were matched, propose searching
    if (steps.length === 0 && controlMatches.searchInput && intent.rawQuery) {
      stepIndex += 1;
      steps.push({
        id: `step-${stepIndex}`,
        type: "search",
        targetElementId: controlMatches.searchInput.elementId,
        targetLabel: controlMatches.searchInput.placeholder || "Search input",
        value: intent.rawQuery,
        description: `Search ${siteName} for "${intent.rawQuery}"`,
        confidence: 0.85,
      });
    }
  }

  // 4. Formulate clear explanation of proposed plan
  let explanation = "";
  if (matchedItems.length > 0) {
    explanation = `Found ${matchedItems.length} candidate item${matchedItems.length === 1 ? "" : "s"} matching your request on this page.`;
    if (steps.length > 0) {
      explanation += ` Proposed ${steps.length} action${steps.length === 1 ? "" : "s"} to refine page view.`;
    }
  } else if (steps.length > 0) {
    explanation = `Prepared ${steps.length} action${steps.length === 1 ? "" : "s"} to locate matching content on this page.`;
  } else {
    explanation = `Understood intent for ${intent.target}. No immediate page controls required adjustment.`;
  }

  return {
    id: planId,
    status: "proposed",
    steps,
    matchedItems,
    explanation,
    confidence: intent.confidence,
    timestamp: Date.now(),
  };
}
