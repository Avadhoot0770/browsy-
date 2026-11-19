/**
 * Visual Explainability: Pre-Interaction Plan Preview Highlighter for Browsy
 * Renders non-blocking (pointer-events: none) visual indicators and numbered badges
 * directly on host DOM elements targeted by an action plan BEFORE the user approves execution.
 *
 * Invariants:
 * 1. Non-destructive: Does NOT alter DOM layout or trigger any events.
 * 2. Non-blocking: All preview elements strictly use `pointer-events: none`.
 * 3. Self-Excluding: Never highlights elements inside Browsy's own UI (`data-browsy-root="true"`).
 * 4. Honest: Steps that cannot be resolved to a live visible DOM node are marked as pending/unresolved
 *    without drawing bogus or misplaced highlights.
 * 5. Lifecycle Managed: Automatically cleans up on approval execution, plan replacement, cancellation,
 *    or panel minimize/close.
 */

import type { ActionPlan, ActionPlanStep } from "../intent/types";
import { resolveElement } from "./resolver";

export interface StepPreviewInfo {
  stepId: string;
  stepNumber: number;
  type: string;
  label: string;
  targetElementId?: string;
  isResolved: boolean;
  statusText: string;
  reason: "resolved" | "pending_navigation" | "unresolved_target" | "hidden" | "browsy_ui";
}

export interface PlanPreviewResult {
  planId: string;
  totalSteps: number;
  resolvedCount: number;
  unresolvedCount: number;
  stepPreviews: StepPreviewInfo[];
}

const PREVIEW_CONTAINER_ID = "browsy-plan-preview-container";

interface TrackedPreviewItem {
  stepNumber: number;
  conciseLabel: string;
  element: Element;
  boxEl: HTMLElement;
  badgeEl: HTMLElement;
}

let activeItems: TrackedPreviewItem[] = [];
let updateScheduled = false;
let listenersAttached = false;
let currentPreviewResult: PlanPreviewResult | null = null;

/**
 * Formats a concise, legible action label for the badge overlay.
 */
export function formatConciseActionLabel(step: ActionPlanStep): string {
  const cleanVal = typeof step.value === "string" ? step.value.trim() : "";
  const cleanLabel = (step.targetLabel || "").trim();

  switch (step.type) {
    case "search":
      return `Search: ${cleanVal ? `"${cleanVal}"` : cleanLabel || "keyword"}`;
    case "check":
    case "uncheck":
      return `Filter: ${cleanVal || cleanLabel || step.description}`;
    case "click":
      return `Click: ${cleanLabel || step.description}`;
    case "type":
      return `Type: ${cleanVal ? `"${cleanVal}"` : cleanLabel}`;
    case "select":
      return `Select: ${cleanVal || cleanLabel}`;
    case "navigate":
      return `Navigate: ${cleanVal || cleanLabel || "page"}`;
    case "summarize":
      return "Summarize page";
    default:
      return step.description.length > 35
        ? `${step.description.slice(0, 32)}...`
        : step.description;
  }
}

/**
 * Checks whether an element is visible in the viewport.
 */
function isElementVisibleInViewport(el: Element): boolean {
  if (typeof window === "undefined" || !el.isConnected) return false;
  try {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      parseFloat(style.opacity) === 0
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if an element belongs to Browsy's internal UI.
 */
function isBrowsyElement(el: Element): boolean {
  try {
    if (el.closest?.('[data-browsy-root="true"]') || el.closest?.("browsy-root")) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Attempts to resolve a plan step to a live, visible DOM element for preview.
 */
export function resolveStepPreviewTarget(step: ActionPlanStep): {
  element: Element | null;
  reason: "resolved" | "pending_navigation" | "unresolved_target" | "hidden" | "browsy_ui";
} {
  if (typeof document === "undefined") {
    return { element: null, reason: "unresolved_target" };
  }

  // Navigation steps that target an external or full page navigation cannot be previewed as DOM controls
  if (step.type === "navigate") {
    return { element: null, reason: "pending_navigation" };
  }

  let el: Element | null = null;

  // 1. Resolve via stable handle if available
  if (step.targetElementId) {
    const res = resolveElement(step.targetElementId, {
      targetLabel: step.targetLabel,
      text: typeof step.value === "string" ? step.value : undefined,
    });
    if (res.success && res.element) {
      el = res.element;
    }
  }

  // 2. Generic fallback resolution for search/filter inputs if targetElementId is unset
  if (!el && step.type === "search") {
    el =
      document.querySelector('input[type="search"]') ||
      document.querySelector('input[name*="search" i]') ||
      document.querySelector('input[placeholder*="search" i]') ||
      document.querySelector('input[aria-label*="search" i]');
  }

  if (!el) {
    // If it's a search step with a URL destination, classify as pending navigation
    if (step.type === "search") {
      return { element: null, reason: "pending_navigation" };
    }
    return { element: null, reason: "unresolved_target" };
  }

  if (isBrowsyElement(el)) {
    return { element: null, reason: "browsy_ui" };
  }

  if (!isElementVisibleInViewport(el)) {
    return { element: null, reason: "hidden" };
  }

  return { element: el, reason: "resolved" };
}

/**
 * Updates positions of all active preview overlays (called on scroll/resize).
 */
function updateOverlayPositions(): void {
  updateScheduled = false;
  for (const item of activeItems) {
    if (!item.element.isConnected) {
      item.boxEl.style.display = "none";
      item.badgeEl.style.display = "none";
      continue;
    }
    const rect = item.element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      item.boxEl.style.display = "none";
      item.badgeEl.style.display = "none";
      continue;
    }

    item.boxEl.style.display = "block";
    item.boxEl.style.left = `${Math.round(rect.left)}px`;
    item.boxEl.style.top = `${Math.round(rect.top)}px`;
    item.boxEl.style.width = `${Math.round(rect.width)}px`;
    item.boxEl.style.height = `${Math.round(rect.height)}px`;

    item.badgeEl.style.display = "flex";
    const badgeTop = Math.max(8, rect.top - 26);
    const badgeLeft = Math.max(8, rect.left);
    item.badgeEl.style.top = `${Math.round(badgeTop)}px`;
    item.badgeEl.style.left = `${Math.round(badgeLeft)}px`;
  }
}

function handleViewportEvent(): void {
  if (!updateScheduled) {
    updateScheduled = true;
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(updateOverlayPositions);
    } else {
      updateOverlayPositions();
    }
  }
}

/**
 * Gets or creates the global overlay container for plan previews.
 */
function getOrCreateContainer(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let container = document.getElementById(PREVIEW_CONTAINER_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = PREVIEW_CONTAINER_ID;
    container.setAttribute("data-browsy-root", "true");
    container.style.cssText =
      "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; " +
      "pointer-events: none !important; z-index: 2147483645; overflow: hidden;";
    document.body?.appendChild(container);
  }
  return container;
}

/**
 * Analyzes a plan and renders preview highlights on all resolved target DOM elements.
 * Returns structured preview results including unresolved and pending navigation steps.
 */
export function renderPlanPreview(plan: ActionPlan): PlanPreviewResult {
  // Always clean up previous preview first
  clearPlanPreview();

  const stepPreviews: StepPreviewInfo[] = [];
  let resolvedCount = 0;
  let unresolvedCount = 0;

  if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
    const emptyResult: PlanPreviewResult = {
      planId: plan?.id || "",
      totalSteps: 0,
      resolvedCount: 0,
      unresolvedCount: 0,
      stepPreviews: [],
    };
    currentPreviewResult = emptyResult;
    return emptyResult;
  }

  const container = getOrCreateContainer();

  plan.steps.forEach((step, idx) => {
    const stepNumber = idx + 1;
    const label = formatConciseActionLabel(step);
    const { element, reason } = resolveStepPreviewTarget(step);

    let statusText = "Ready on page";
    if (reason === "pending_navigation") {
      statusText = "Pending navigation";
    } else if (reason === "unresolved_target") {
      statusText = "Dynamic target (resolves after search)";
    } else if (reason === "hidden") {
      statusText = "Hidden control";
    } else if (reason === "browsy_ui") {
      statusText = "Internal control";
    }

    const isResolved = reason === "resolved" && Boolean(element);

    if (isResolved && element && container) {
      resolvedCount += 1;
      const rect = element.getBoundingClientRect();

      // 1. Highlight bounding box
      const boxEl = document.createElement("div");
      boxEl.className = "browsy-preview-box";
      boxEl.setAttribute("data-browsy-root", "true");
      boxEl.style.cssText =
        "position: fixed; " +
        `left: ${Math.round(rect.left)}px; ` +
        `top: ${Math.round(rect.top)}px; ` +
        `width: ${Math.round(rect.width)}px; ` +
        `height: ${Math.round(rect.height)}px; ` +
        "border: 2px dashed #6366f1; " +
        "border-radius: 6px; " +
        "background-color: rgba(99, 102, 241, 0.08); " +
        "box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25); " +
        "pointer-events: none !important; " +
        "transition: opacity 0.15s ease; " +
        "z-index: 2147483645;";

      // 2. Step number pill badge
      const badgeEl = document.createElement("div");
      badgeEl.className = "browsy-preview-badge";
      badgeEl.setAttribute("data-browsy-root", "true");
      const badgeTop = Math.max(8, rect.top - 26);
      const badgeLeft = Math.max(8, rect.left);

      badgeEl.style.cssText =
        "position: fixed; " +
        `top: ${Math.round(badgeTop)}px; ` +
        `left: ${Math.round(badgeLeft)}px; ` +
        "z-index: 2147483646; " +
        "background: #1e1b4b; " +
        "color: #ffffff; " +
        "font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; " +
        "font-size: 11px; " +
        "font-weight: 600; " +
        "line-height: 1; " +
        "padding: 4px 8px; " +
        "border-radius: 12px; " +
        "box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35); " +
        "border: 1px solid rgba(129, 140, 248, 0.5); " +
        "pointer-events: none !important; " +
        "display: flex; " +
        "align-items: center; " +
        "gap: 5px; " +
        "white-space: nowrap;";

      badgeEl.innerHTML = `
        <span style="background: #4f46e5; color: #ffffff; border-radius: 8px; padding: 2px 6px; font-size: 10px; font-weight: 700;">${stepNumber}</span>
        <span style="color: #e0e7ff; max-width: 220px; overflow: hidden; text-overflow: ellipsis;">${label}</span>
      `;

      container.appendChild(boxEl);
      container.appendChild(badgeEl);

      activeItems.push({
        stepNumber,
        conciseLabel: label,
        element,
        boxEl,
        badgeEl,
      });
    } else {
      unresolvedCount += 1;
    }

    stepPreviews.push({
      stepId: step.id,
      stepNumber,
      type: step.type,
      label,
      targetElementId: step.targetElementId,
      isResolved,
      statusText,
      reason,
    });
  });

  // Attach dynamic scroll/resize listeners to keep overlays pinned
  if (activeItems.length > 0 && !listenersAttached && typeof window !== "undefined") {
    window.addEventListener("scroll", handleViewportEvent, { passive: true, capture: true });
    window.addEventListener("resize", handleViewportEvent, { passive: true });
    listenersAttached = true;
  }

  const result: PlanPreviewResult = {
    planId: plan.id,
    totalSteps: plan.steps.length,
    resolvedCount,
    unresolvedCount,
    stepPreviews,
  };

  currentPreviewResult = result;
  return result;
}

/**
 * Removes all plan preview overlays and detaches event listeners.
 */
export function clearPlanPreview(): void {
  activeItems = [];
  currentPreviewResult = null;

  if (typeof document !== "undefined") {
    try {
      const container = document.getElementById(PREVIEW_CONTAINER_ID);
      if (container) {
        container.remove();
      }
    } catch {
      // ignore
    }
  }

  if (listenersAttached && typeof window !== "undefined") {
    try {
      window.removeEventListener("scroll", handleViewportEvent, true);
      window.removeEventListener("resize", handleViewportEvent);
    } catch {
      // ignore
    }
    listenersAttached = false;
  }
}

/**
 * Returns current preview calculation without mutating DOM, useful for UI state or tests.
 */
export function getPlanPreviewSummary(plan: ActionPlan): PlanPreviewResult {
  const stepPreviews: StepPreviewInfo[] = [];
  let resolvedCount = 0;
  let unresolvedCount = 0;

  if (!plan || !Array.isArray(plan.steps)) {
    return {
      planId: plan?.id || "",
      totalSteps: 0,
      resolvedCount: 0,
      unresolvedCount: 0,
      stepPreviews: [],
    };
  }

  plan.steps.forEach((step, idx) => {
    const stepNumber = idx + 1;
    const label = formatConciseActionLabel(step);
    const { element, reason } = resolveStepPreviewTarget(step);
    const isResolved = reason === "resolved" && Boolean(element);

    if (isResolved) {
      resolvedCount += 1;
    } else {
      unresolvedCount += 1;
    }

    let statusText = "Ready on page";
    if (reason === "pending_navigation") {
      statusText = "Pending navigation";
    } else if (reason === "unresolved_target") {
      statusText = "Dynamic target";
    } else if (reason === "hidden") {
      statusText = "Hidden control";
    } else if (reason === "browsy_ui") {
      statusText = "Internal control";
    }

    stepPreviews.push({
      stepId: step.id,
      stepNumber,
      type: step.type,
      label,
      targetElementId: step.targetElementId,
      isResolved,
      statusText,
      reason,
    });
  });

  return {
    planId: plan.id,
    totalSteps: plan.steps.length,
    resolvedCount,
    unresolvedCount,
    stepPreviews,
  };
}

/**
 * Returns the currently active preview result, or null if no preview is active.
 */
export function getCurrentPlanPreview(): PlanPreviewResult | null {
  return currentPreviewResult;
}
