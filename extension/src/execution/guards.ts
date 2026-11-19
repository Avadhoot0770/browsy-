/**
 * Safety Guards for Browsy Stage 4 Execution Engine
 * Validates every proposed action before execution to prevent unauthorized,
 * dangerous, or invalid DOM interactions.
 */

import type { ActionPlanStep } from "../intent/types";
import type { StructuredPageIntelligence } from "../page-intelligence/types";
import type { GuardCheckResult } from "./types";
import { resolveElement } from "./resolver";
import {
  isSensitiveAuthField,
  isPaymentOrFinancialField,
  classifyActionRisk,
  getHighRiskWarning,
} from "./high-risk";

const SUPPORTED_ACTION_TYPES = new Set([
  "click",
  "type",
  "select",
  "check",
  "uncheck",
  "scroll",
  "search",
  "open",
  "navigate",
  "summarize",
  "compare",
]);

/**
 * Validates whether an individual action step is safe and eligible to execute on the current page.
 */
export function canExecuteAction(
  step: ActionPlanStep,
  _pageContext?: StructuredPageIntelligence | null
): GuardCheckResult {
  // 1. Validate Action Type
  if (!step || typeof step !== "object") {
    return {
      canExecute: false,
      reason: "Invalid action step object.",
      riskLevel: "low",
    };
  }

  const actionType = step.type.toLowerCase();
  if (!SUPPORTED_ACTION_TYPES.has(actionType)) {
    return {
      canExecute: false,
      reason: `Action type '${step.type}' is not supported for browser execution.`,
      riskLevel: "low",
    };
  }

  // 1.5. Script and URI injection prevention (Treat webpage text and inputs as untrusted data)
  if (step.value && typeof step.value === "string" && /^(?:javascript:|data:text\/html|<script)/i.test(step.value.trim())) {
    return {
      canExecute: false,
      reason: "Security boundary: Script or URI injection in action parameters is strictly blocked.",
      riskLevel: "high",
    };
  }

  // 2. Classify Risk Level
  const riskLevel = classifyActionRisk(step);
  const requiresConfirmation = riskLevel === "high";

  // Actions that do not strictly require a target element
  if (actionType === "scroll" || actionType === "summarize" || actionType === "compare") {
    return {
      canExecute: true,
      riskLevel,
      requiresConfirmation,
    };
  }

  // 3. Validate Target Element ID
  if (!step.targetElementId) {
    return {
      canExecute: false,
      reason: `Action '${step.description}' has no target element ID assigned.`,
      riskLevel,
    };
  }

  // 4. Resolve Target Element in Live DOM (with semantic re-resolution)
  const resolution = resolveElement(step.targetElementId, {
    targetLabel: step.targetLabel,
    text: step.description,
    type: step.type,
  });
  if (!resolution.success || !resolution.element) {
    return {
      canExecute: false,
      reason: resolution.reason || `Target element '${step.targetElementId}' could not be resolved.`,
      riskLevel,
    };
  }

  const target = resolution.element;

  // 5. Visibility and Enablement Guards
  if (!resolution.isVisible) {
    return {
      canExecute: false,
      reason: `Target element '${step.targetElementId}' is not visible on the webpage.`,
      riskLevel,
    };
  }

  if (!resolution.isEnabled) {
    return {
      canExecute: false,
      reason: `Target element '${step.targetElementId}' is currently disabled on the webpage.`,
      riskLevel,
    };
  }

  // 6. Hard Security Boundaries: Prohibit Authentication & Payment Fields
  if (isSensitiveAuthField(target)) {
    return {
      canExecute: false,
      reason: "Security boundary: Browsy does not automate passwords or authentication fields.",
      riskLevel: "high",
    };
  }

  if (isPaymentOrFinancialField(target)) {
    return {
      canExecute: false,
      reason: "Security boundary: Browsy does not automate payment or financial transactions.",
      riskLevel: "high",
    };
  }

  // 7. Semantic Element Type Match
  if (actionType === "type" || actionType === "search") {
    const isTextInput =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.getAttribute("contenteditable") === "true";

    if (!isTextInput) {
      return {
        canExecute: false,
        reason: `Target '${step.targetElementId}' (<${target.tagName.toLowerCase()}>) is not a valid text input field.`,
        riskLevel,
      };
    }
  }

  if (actionType === "select") {
    const isSelect =
      target instanceof HTMLSelectElement ||
      target.getAttribute("role") === "listbox" ||
      target.getAttribute("role") === "combobox" ||
      target.querySelector("select") !== null;

    if (!isSelect && !(target instanceof HTMLElement)) {
      return {
        canExecute: false,
        reason: `Target '${step.targetElementId}' is not a select or dropdown element.`,
        riskLevel,
      };
    }
  }

  if (actionType === "check" || actionType === "uncheck") {
    const isCheckable =
      (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio")) ||
      target.getAttribute("role") === "checkbox" ||
      target.getAttribute("role") === "radio" ||
      target.getAttribute("role") === "switch" ||
      target.querySelector('input[type="checkbox"], input[type="radio"]') !== null;

    if (!isCheckable) {
      return {
        canExecute: false,
        reason: `Target '${step.targetElementId}' is not a checkbox or radio control.`,
        riskLevel,
      };
    }
  }

  return {
    canExecute: true,
    riskLevel,
    requiresConfirmation,
    reason: requiresConfirmation ? getHighRiskWarning(step) : undefined,
  };
}
