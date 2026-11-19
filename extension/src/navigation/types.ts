/**
 * Navigation and Target Website State Types for Browsy Stage 4.5
 * Defines the models for evaluating current page state vs target website state,
 * planning navigation vs filter sequences, and verifying final results.
 */

/**
 * High-level semantic classification of the current webpage.
 */
export type PageStateKind =
  | "homepage"
  | "product_detail"
  | "search_results"
  | "category_listing"
  | "cart"
  | "checkout"
  | "article"
  | "unrelated"
  | "unknown";

/**
 * Current status and contents of the webpage the user is on.
 */
export interface CurrentPageState {
  kind: PageStateKind;
  url: string;
  hostname: string;
  pathname: string;
  title: string;
  isRelevantToIntent: boolean;
  activeCategory?: string;
  detectedSearchQuery?: string;
  activeFilters: Record<string, string | number | boolean>;
  availableFilterCategories: string[];
  resultsCount: number;
}

/**
 * Desired end state on the website that will satisfy the user's request.
 */
export interface TargetWebsiteState {
  domain: string;
  category?: string;
  searchQuery?: string;
  requiredFilters: Record<string, string | number | boolean>;
  maxPrice?: number;
  minRating?: number;
  expectedResultType: "products" | "jobs" | "travel" | "articles" | "general";
}

/**
 * High-level determination made by the navigation planner.
 */
export type NavigationStrategy =
  | "already_target_state"       // Already on filtered target results page
  | "apply_filters_only"        // On relevant results page, only missing filters needed
  | "search_and_filter"         // Need to search on site first, then apply filters
  | "navigate_link_and_filter"  // Need to follow category link first, then apply filters
  | "no_navigation_possible";   // Site does not expose search or category controls

/**
 * Outcome of navigation planning comparing current state to target state.
 */
export interface NavigationPlanResult {
  strategy: NavigationStrategy;
  currentState: CurrentPageState;
  targetState: TargetWebsiteState;
  explanation: string;
  requiredSearchQuery?: string;
  targetLinkElementId?: string;
  targetLinkLabel?: string;
  missingFilters: Record<string, string | number | boolean>;
}

import type { MatchedItem } from "../intent/types";

/**
 * High-level truthful outcome status for Stage 4.5 and technical evaluation.
 */
export type VerificationOutcomeStatus =
  | "COMPLETED"
  | "PARTIALLY COMPLETED"
  | "FAILED"
  | "NEEDS USER INPUT";

/**
 * Verification of the final website state following execution.
 */
export interface FinalStateVerificationResult {
  status: VerificationOutcomeStatus;
  isSuccess: boolean;
  isPartialSuccess: boolean;
  verifiedCategory: boolean;
  verifiedFilters: Record<string, boolean>;
  unverifiedFilters: string[];
  resultsPresent: boolean;
  resultsCount: number;
  userFacingSummary: string;
  confirmedMatches?: MatchedItem[];
  partialMatches?: MatchedItem[];
  reasonsForPartial?: string[];
}

/**
 * Options for waiting for page stabilization and SPA updates.
 */
export interface PageWaitOptions {
  timeoutMs?: number;
  checkIntervalMs?: number;
  condition?: () => boolean;
}
