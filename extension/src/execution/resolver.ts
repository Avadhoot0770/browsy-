/**
 * Element Resolver for Browsy Stage 4 Execution Engine
 * Resolves Stage 2 runtime element IDs (browsy-el-xxx) against the live DOM,
 * with comprehensive staleness, connection, and visibility validation.
 */

import { elementRegistry } from "../page-intelligence/element-registry";

export interface ResolvedElement {
  success: boolean;
  element: Element | null;
  isStale: boolean;
  isVisible: boolean;
  isEnabled: boolean;
  tagName: string;
  isRecovered?: boolean;
  reason?: string;
}

export interface ElementFallbackHint {
  tagName?: string;
  role?: string;
  text?: string;
  targetLabel?: string;
  nearbyLabel?: string;
  name?: string;
  placeholder?: string;
  type?: string;
}

/**
 * Checks whether an element is visible in the browser viewport layout.
 */
export function isElementVisible(el: Element): boolean {
  const isHtml = typeof HTMLElement !== "undefined" && el instanceof HTMLElement;
  const isSvg = typeof SVGElement !== "undefined" && el instanceof SVGElement;
  if (typeof HTMLElement !== "undefined" && !isHtml && !isSvg) {
    return false;
  }

  // If this is an input wrapped inside a visible label (common in custom styled checkboxes/radios)
  const isCustomInput = el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio");
  const parentLabel =
    isCustomInput && typeof (el as any).closest === "function"
      ? ((el as any).closest("label") as Element | null)
      : null;

  // Check offsetParent (null for display:none elements, except fixed or body)
  if (el instanceof HTMLElement && el.offsetParent === null && el.style.position !== "fixed") {
    // Body and document elements may have null offsetParent
    if (el !== document.body && el !== document.documentElement) {
      if (parentLabel && parentLabel !== el && isElementVisible(parentLabel)) {
        return true;
      }
      return false;
    }
  }

  // Check computed style
  try {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) {
      if (parentLabel && parentLabel !== el && isElementVisible(parentLabel)) {
        return true;
      }
      return false;
    }
  } catch {
    // Fallback if computedStyle fails (e.g. detached node)
    return false;
  }

  // Check bounding box
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    if (parentLabel && parentLabel !== el && isElementVisible(parentLabel)) {
      return true;
    }
    return false;
  }
  return true;
}

/**
 * Checks whether an element is enabled for interaction.
 */
function isElementEnabled(el: Element): boolean {
  if (
    el instanceof HTMLButtonElement ||
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ) {
    if (el.disabled) return false;
  }

  if (el.getAttribute("aria-disabled") === "true") {
    return false;
  }

  return true;
}

/**
 * Resolves a `browsy-el-xxx` handle to a live, verified DOM element.
 * Supports semantic re-resolution if the node disconnected during a dynamic SPA re-render.
 */
export function resolveElement(elementId: string, fallbackHint?: ElementFallbackHint): ResolvedElement {
  if (!elementId || typeof elementId !== "string") {
    return {
      success: false,
      element: null,
      isStale: true,
      isVisible: false,
      isEnabled: false,
      tagName: "",
      reason: "Invalid or empty element reference ID.",
    };
  }

  // 1. Primary: Lookup in in-memory ElementRegistry
  let target = elementRegistry.get(elementId);
  let isRecovered = false;

  // 2. Secondary Fallback: Query DOM by data-browsy-id attribute (e.g. if re-rendered by SPA)
  if (!target || !target.isConnected) {
    try {
      const queried = document.querySelector(`[data-browsy-id="${elementId}"]`);
      if (queried && queried.isConnected) {
        target = queried;
        isRecovered = true;
      }
    } catch {
      // In non-DOM testing environments
    }
  }

  // 3. Tertiary Semantic Fallback: Re-locate matching element in live DOM
  if ((!target || !target.isConnected) && fallbackHint && typeof document !== "undefined") {
    try {
      const selector = fallbackHint.tagName || "button, a, input, select, textarea, [role='button'], [role='checkbox']";
      const candidates = document.querySelectorAll(selector);
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (!candidate.isConnected) continue;
        const cText = (candidate.textContent || "").trim().toLowerCase();
        const cAria = (candidate.getAttribute("aria-label") || "").toLowerCase();
        const cName = (candidate.getAttribute("name") || "").toLowerCase();
        const cPlaceholder = (candidate.getAttribute("placeholder") || "").toLowerCase();

        const matchText = (fallbackHint.text || fallbackHint.targetLabel || "").trim().toLowerCase();
        const matchName = (fallbackHint.name || "").toLowerCase();
        const matchPlaceholder = (fallbackHint.placeholder || "").toLowerCase();

        let isMatch = false;
        if (matchName && cName === matchName) isMatch = true;
        else if (matchPlaceholder && cPlaceholder === matchPlaceholder) isMatch = true;
        else if (matchText && matchText.length > 1 && (cText.includes(matchText) || cAria.includes(matchText))) isMatch = true;

        if (isMatch) {
          target = candidate;
          elementRegistry.register(candidate);
          isRecovered = true;
          break;
        }
      }
    } catch {
      // In mock DOM / non-DOM environments
    }
  }

  if (!target) {
    return {
      success: false,
      element: null,
      isStale: true,
      isVisible: false,
      isEnabled: false,
      tagName: "",
      reason: `Element '${elementId}' was not found in the current page DOM.`,
    };
  }

  // 4. Verify Document Connection
  if (!target.isConnected) {
    return {
      success: false,
      element: null,
      isStale: true,
      isVisible: false,
      isEnabled: false,
      tagName: target.tagName.toLowerCase(),
      reason: `Element '${elementId}' has disconnected from the page document.`,
    };
  }

  // 5. Verify Visibility and Enablement
  const visible = isElementVisible(target);
  const enabled = isElementEnabled(target);

  return {
    success: true,
    element: target,
    isStale: false,
    isVisible: visible,
    isEnabled: enabled,
    isRecovered,
    tagName: target.tagName.toLowerCase(),
  };
}
