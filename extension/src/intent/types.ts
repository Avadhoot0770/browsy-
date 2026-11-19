/**
 * Strong TypeScript types for Browsy Stage 3 AI Intent Engine
 * Natural language understanding, structured intent, and safe action planning.
 */

import type { PriceInfo, RatingInfo, CurrencyCode } from "../page-intelligence/types";

export type IntentType =
  | "find"
  | "filter"
  | "search"
  | "navigate"
  | "compare"
  | "extract"
  | "summarize"
  | "sort"
  | "explain"
  | "unknown";

export type TargetType =
  | "products"
  | "jobs"
  | "travel"
  | "articles"
  | "forms"
  | "page"
  | "controls"
  | "unknown";

export type PageCategory =
  | "shopping"
  | "jobs"
  | "travel"
  | "news"
  | "documentation"
  | "forms"
  | "research"
  | "generic";

export interface IntentEntities {
  category?: string;
  role?: string;
  brand?: string;
  type?: string;
  [key: string]: string | undefined;
}

export interface IntentFilters {
  color?: string;
  pattern?: string;
  size?: string;
  amenities?: string[];
  [key: string]: string | string[] | undefined;
}

export interface IntentConstraints {
  maxPrice?: number;
  minPrice?: number;
  currency?: CurrencyCode;
  minRating?: number;
  location?: string;
  date?: string;
  other?: string[];
}

export interface RelativeReference {
  type: "cheapest" | "first" | "second" | "third" | "matching" | "similar" | "all";
  count?: number;
}

export interface StructuredIntent {
  id: string;
  intent: IntentType;
  target: TargetType;
  entities: IntentEntities;
  filters: IntentFilters;
  constraints: IntentConstraints;
  sort?: {
    field: string;
    direction: "asc" | "desc";
  };
  relativeRef?: RelativeReference;
  scope: "current_page" | "global";
  confidence: number;
  requiresClarification: boolean;
  clarificationPrompt?: string;
  rawQuery: string;
  timestamp: number;
}

export type { CurrencyCode } from "../page-intelligence/types";

export type ActionPlanStatus = "proposed"; // STRICTLY proposed in Stage 3 — never executed!

export type ActionPlanStepType =
  | "search"
  | "click"
  | "type"
  | "select"
  | "check"
  | "uncheck"
  | "scroll"
  | "open"
  | "navigate"
  | "filter"
  | "sort"
  | "extract"
  | "compare"
  | "summarize";

export interface ActionPlanStep {
  id: string;
  type: ActionPlanStepType;
  targetElementId?: string; // Stable Stage 2 runtime element handle (e.g. browsy-el-001)
  targetLabel?: string;
  value?: string | number | boolean;
  description: string;
  confidence: number;
}

export type MatchClassification = "confirmed" | "partial" | "rejected";

export type ConditionStatus = "verified" | "unverified" | "violated";

export interface ConditionEvaluation {
  name: string; // e.g. "category" | "color" | "pattern" | "size" | "maxPrice" | "minRating"
  label: string; // e.g. "Category: shirt" | "Color: red" | "Pattern: checked" | "Size: XL" | "Price ≤ ₹1,000"
  status: ConditionStatus;
  evidence?: string;
}

export interface MatchedItem {
  elementId: string;
  title: string;
  price?: PriceInfo;
  rating?: RatingInfo;
  reasons: string[];
  score: number;
  matchClassification?: MatchClassification;
  evaluations?: ConditionEvaluation[];
  verifiedConditions?: string[];
  unverifiedConditions?: string[];
  link?: {
    href: string;
    text?: string;
  };
  imageUrl?: string;
  imageAlt?: string;
  productResult?: any;
}

export interface ActionPlan {
  id: string;
  status: ActionPlanStatus;
  steps: ActionPlanStep[];
  matchedItems: MatchedItem[];
  explanation: string;
  confidence: number;
  timestamp: number;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
  intent?: StructuredIntent;
  timestamp: number;
}

export interface ConversationContext {
  turns: ConversationTurn[];
  activeCategory?: string;
  activeBrand?: string;
  activeFilters: IntentFilters;
  activeConstraints: IntentConstraints;
  activeExclusions?: string[];
  lastTarget?: TargetType;
  lastMatchedElementIds?: string[];
  lastVerifiedProducts?: any[];
  lastSearchQuery?: string;
}

export interface IntentProcessingResult {
  intent: StructuredIntent;
  plan: ActionPlan;
  requiresClarification: boolean;
  clarificationPrompt?: string;
  matchedItems: MatchedItem[];
  summaryMessage: string;
  contextUpdated?: {
    changedConstraint?: string;
    preservedConstraints: string[];
  };
}
