/**
 * Runtime Schema Validator for Browsy Stage 3 AI Intent Engine
 * Guarantees structural integrity, safe bounds, and strictly proposed plan status.
 */

import type { StructuredIntent, ActionPlan, IntentType, TargetType } from "./types";
import type { StructuredPageIntelligence } from "../page-intelligence/types";

const VALID_INTENTS: Set<IntentType> = new Set([
  "find",
  "filter",
  "search",
  "navigate",
  "compare",
  "extract",
  "summarize",
  "explain",
  "sort",
  "unknown",
]);

const VALID_TARGETS: Set<TargetType> = new Set([
  "products",
  "jobs",
  "travel",
  "articles",
  "forms",
  "page",
  "controls",
  "unknown",
]);

export class IntentValidationError extends Error {
  constructor(message: string) {
    super(`[Browsy Intent Validation] ${message}`);
    this.name = "IntentValidationError";
  }
}

/**
 * Validates a StructuredIntent object at runtime.
 */
export function validateStructuredIntent(intent: unknown): asserts intent is StructuredIntent {
  if (!intent || typeof intent !== "object") {
    throw new IntentValidationError("Intent must be a non-null object.");
  }

  const candidate = intent as Partial<StructuredIntent>;

  if (typeof candidate.id !== "string" || !candidate.id) {
    throw new IntentValidationError("Missing or invalid intent id.");
  }

  if (!candidate.intent || !VALID_INTENTS.has(candidate.intent)) {
    throw new IntentValidationError(`Invalid intent type: ${String(candidate.intent)}`);
  }

  if (!candidate.target || !VALID_TARGETS.has(candidate.target)) {
    throw new IntentValidationError(`Invalid target type: ${String(candidate.target)}`);
  }

  if (typeof candidate.confidence !== "number" || candidate.confidence < 0 || candidate.confidence > 1) {
    throw new IntentValidationError(`Confidence must be a number between 0 and 1: ${candidate.confidence}`);
  }

  if (typeof candidate.requiresClarification !== "boolean") {
    throw new IntentValidationError("requiresClarification must be a boolean.");
  }

  if (candidate.scope !== "current_page" && candidate.scope !== "global") {
    throw new IntentValidationError(`Scope must be 'current_page' or 'global': ${String(candidate.scope)}`);
  }
}

/**
 * Validates an ActionPlan at runtime, enforcing safety and 'proposed' status invariant.
 */
export function validateActionPlan(
  plan: unknown,
  pageContext?: StructuredPageIntelligence | null
): asserts plan is ActionPlan {
  if (!plan || typeof plan !== "object") {
    throw new IntentValidationError("Action plan must be a non-null object.");
  }

  const candidate = plan as Partial<ActionPlan>;

  if (typeof candidate.id !== "string" || !candidate.id) {
    throw new IntentValidationError("Missing or invalid action plan id.");
  }

  // Safety Invariant: Stage 3 plans MUST have status 'proposed'
  if (candidate.status !== "proposed") {
    throw new IntentValidationError(`Safety violation: Action plan status must strictly be 'proposed', received '${candidate.status}'.`);
  }

  if (!Array.isArray(candidate.steps)) {
    throw new IntentValidationError("Action plan steps must be an array.");
  }

  // Collect all valid element IDs from page intelligence if provided
  const validElementIds = new Set<string>();
  if (pageContext) {
    (pageContext.searchInputs || []).forEach((el) => validElementIds.add(el.elementId));
    (pageContext.buttons || []).forEach((el) => validElementIds.add(el.elementId));
    (pageContext.inputs || []).forEach((el) => validElementIds.add(el.elementId));
    (pageContext.links || []).forEach((el) => validElementIds.add(el.elementId));
    (pageContext.forms || []).forEach((el) => validElementIds.add(el.elementId));
    (pageContext.repeatedGroups || []).forEach((g) => (g.items || []).forEach((item) => validElementIds.add(item.elementId)));
  }

  for (const step of candidate.steps) {
    if (!step || typeof step !== "object") {
      throw new IntentValidationError("Invalid action step.");
    }
    if (typeof step.description !== "string" || !step.description) {
      throw new IntentValidationError("Each step must have a human-readable description.");
    }

    // Verify element reference format and validity
    if (step.targetElementId) {
      if (!/^browsy-el-\d{3,}$/.test(step.targetElementId)) {
        throw new IntentValidationError(`Invalid element handle format: '${step.targetElementId}'. Must follow 'browsy-el-xxx'.`);
      }
      if (validElementIds.size > 0 && !validElementIds.has(step.targetElementId)) {
        console.warn(`[Browsy Intent Validator] Referenced element ID '${step.targetElementId}' not found in current page context.`);
      }
    }
  }
}
