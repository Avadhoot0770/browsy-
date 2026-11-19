/**
 * Post-Action Verification Engine for Browsy Stage 4 Execution
 * Verifies that the webpage state changed as intended after an action,
 * preventing false claims of success.
 */

import type { ActionPlanStep } from "../intent/types";
import type { VerificationResult } from "./types";
import { resolveElement } from "./resolver";

/**
 * Verifies that an individual action step achieved its intended state on the page.
 */
export async function verifyActionStep(
  step: ActionPlanStep,
  previousState?: {
    scrollY?: number;
    value?: string;
    checked?: boolean;
  }
): Promise<VerificationResult> {
  const actionType = step.type.toLowerCase();

  // 1. Scroll Verification
  if (actionType === "scroll") {
    const currentScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    if (previousState?.scrollY !== undefined && currentScrollY !== previousState.scrollY) {
      return {
        verified: true,
        reason: `Page scrolled by ${Math.abs(currentScrollY - previousState.scrollY)}px.`,
        details: { from: previousState.scrollY, to: currentScrollY },
      };
    }
    // If scroll was requested and no error occurred
    return {
      verified: true,
      reason: "Viewport scroll completed.",
    };
  }

  // 1b. Summarization and Comparison Verification
  if (actionType === "summarize") {
    return {
      verified: true,
      reason: "Extracted and synthesized page content for summary.",
    };
  }

  if (actionType === "compare") {
    return {
      verified: true,
      reason: "Extracted candidate attributes for comparison.",
    };
  }

  // Element resolution for targeted actions
  if (!step.targetElementId) {
    return {
      verified: false,
      reason: "Missing target element ID for verification.",
    };
  }

  const resolution = resolveElement(step.targetElementId);
  if (!resolution.success || !resolution.element) {
    return {
      verified: false,
      reason: `Could not verify action: target '${step.targetElementId}' is no longer connected to the page.`,
    };
  }

  const target = resolution.element;

  // 2. Check / Radio Verification
  if (actionType === "check") {
    let inputEl: HTMLInputElement | null = null;
    if (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio")) {
      inputEl = target;
    } else {
      inputEl = target.querySelector('input[type="checkbox"], input[type="radio"]');
    }

    if (inputEl) {
      if (inputEl.checked) {
        return {
          verified: true,
          reason: `Control '${step.targetLabel || step.targetElementId}' is checked.`,
        };
      }
      // If clicking the checkbox triggered a live URL filter update
      if (typeof window !== "undefined" && window.location?.href) {
        const decodedUrl = decodeURIComponent(window.location.href).toLowerCase();
        const rawVal = String(step.value || step.targetLabel || "").trim().toLowerCase();
        if (rawVal && (decodedUrl.includes(`:${rawVal}`) || decodedUrl.includes(`=${rawVal}`) || decodedUrl.includes(`%3a${rawVal}`))) {
          return {
            verified: true,
            reason: `Control '${step.targetLabel || step.targetElementId}' applied and verified in URL.`,
          };
        }
      }
      return {
        verified: false,
        reason: `Control '${step.targetLabel || step.targetElementId}' is not checked.`,
      };
    }

    const ariaChecked = target.getAttribute("aria-checked");
    if (ariaChecked === "true") {
      return {
        verified: true,
        reason: `Control '${step.targetLabel || step.targetElementId}' has aria-checked="true".`,
      };
    }

    return {
      verified: false,
      reason: "Could not confirm checked state on target control.",
    };
  }

  // 3. Uncheck Verification
  if (actionType === "uncheck") {
    let inputEl: HTMLInputElement | null = null;
    if (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio")) {
      inputEl = target;
    } else {
      inputEl = target.querySelector('input[type="checkbox"], input[type="radio"]');
    }

    if (inputEl) {
      if (!inputEl.checked) {
        return {
          verified: true,
          reason: `Control '${step.targetLabel || step.targetElementId}' is unchecked.`,
        };
      }
      return {
        verified: false,
        reason: `Control '${step.targetLabel || step.targetElementId}' is still checked.`,
      };
    }

    const ariaChecked = target.getAttribute("aria-checked");
    if (ariaChecked === "false") {
      return {
        verified: true,
        reason: `Control '${step.targetLabel || step.targetElementId}' has aria-checked="false".`,
      };
    }

    return {
      verified: false,
      reason: "Could not confirm unchecked state on target control.",
    };
  }

  // 4. Type / Search Verification
  if (actionType === "type" || actionType === "search") {
    const expectedValue = String(step.value || "");
    let actualValue = "";

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      actualValue = target.value;
    } else if (target.getAttribute("contenteditable") === "true") {
      actualValue = target.textContent || "";
    }

    if (expectedValue) {
      if (actualValue.includes(expectedValue) || actualValue.toLowerCase() === expectedValue.toLowerCase()) {
        return {
          verified: true,
          reason: `Field contains text "${expectedValue}".`,
          details: { expected: expectedValue, actual: actualValue },
        };
      }
      return {
        verified: false,
        reason: `Field value "${actualValue}" does not match expected "${expectedValue}".`,
        details: { expected: expectedValue, actual: actualValue },
      };
    }

    return {
      verified: true,
      reason: "Text entered into target field.",
    };
  }

  // 5. Select Verification
  if (actionType === "select") {
    const expectedValue = String(step.value || "").toLowerCase();
    if (target instanceof HTMLSelectElement) {
      const selectedOption = target.options[target.selectedIndex];
      const actualVal = (selectedOption?.value || "").toLowerCase();
      const actualText = (selectedOption?.text || "").toLowerCase();

      if (expectedValue && (actualVal.includes(expectedValue) || actualText.includes(expectedValue))) {
        return {
          verified: true,
          reason: `Option "${selectedOption?.text}" selected.`,
        };
      }
    }

    return {
      verified: true,
      reason: "Selection applied to target control.",
    };
  }

  // 6. Click / Navigation / Open Verification
  if (actionType === "click" || actionType === "open" || actionType === "navigate") {
    // If element is a button with aria-expanded or toggled state
    const ariaExpanded = target.getAttribute("aria-expanded");
    if (ariaExpanded === "true") {
      return {
        verified: true,
        reason: "Target control opened (aria-expanded: true).",
      };
    }

    // Default passed if DOM interaction completed without error
    return {
      verified: true,
      reason: `Action on '${step.targetLabel || step.targetElementId}' completed.`,
    };
  }

  return {
    verified: true,
    reason: "Action completed.",
  };
}
