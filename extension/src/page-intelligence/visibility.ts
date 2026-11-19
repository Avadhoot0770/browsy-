/**
 * Visibility and DOM Sanitization Filters for Browsy Page Intelligence
 * Ensures only rendered, meaningful, user-visible elements are inspected.
 * Strictly excludes Browsy's internal Shadow DOM root and hidden tracking elements.
 */

import type { BoundingBox } from "./types";
import { SHADOW_HOST_ID } from "../shared/constants";

const EXCLUDED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "LINK",
  "META",
  "HEAD",
  "PARAM",
  "SOURCE",
  "TRACK",
  "SVG",
  "PATH",
]);

/**
 * Checks whether an element belongs to Browsy's own UI.
 * Mandatory check to prevent Browsy from inspecting its own panel/launcher.
 */
export function isBrowsyOwned(element: Element | null): boolean {
  if (!element) return false;

  // 1. Direct host tag or id or data attribute check
  const tag = (element.tagName || "").toLowerCase();
  if (
    tag === "browsy-root" ||
    element.id === SHADOW_HOST_ID ||
    element.getAttribute?.("data-browsy-root") === "true"
  ) {
    return true;
  }

  // 2. High-speed ShadowRoot root node check
  if (typeof element.getRootNode === "function") {
    try {
      const rootNode = element.getRootNode();
      if (rootNode instanceof ShadowRoot) {
        const host = rootNode.host;
        if (
          host &&
          (host.id === SHADOW_HOST_ID ||
            host.getAttribute?.("data-browsy-root") === "true" ||
            (host.tagName || "").toLowerCase() === "browsy-root")
        ) {
          return true;
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Fast native closest() check for light DOM children
  if (typeof element.closest === "function") {
    try {
      if (element.closest(`#${SHADOW_HOST_ID}, [data-browsy-root], browsy-root`)) {
        return true;
      }
    } catch {
      // ignore
    }
  }

  // 4. Safe fallback traversal upwards across shadow boundaries (for mock DOMs)
  let current: Element | null = element;
  while (current) {
    const cTag = (current.tagName || "").toLowerCase();
    if (
      cTag === "browsy-root" ||
      current.id === SHADOW_HOST_ID ||
      current.getAttribute?.("data-browsy-root") === "true"
    ) {
      return true;
    }
    const parentNode: Node | null = current.parentNode;
    if (parentNode && typeof ShadowRoot !== "undefined" && parentNode instanceof ShadowRoot) {
      if (
        parentNode.host?.id === SHADOW_HOST_ID ||
        parentNode.host?.getAttribute?.("data-browsy-root") === "true"
      ) {
        return true;
      }
      current = parentNode.host;
    } else if (parentNode instanceof Element) {
      current = parentNode;
    } else {
      current = null;
    }
  }

  return false;
}

/**
 * Determines if a DOM element is visually rendered and non-zero dimensioned.
 */
export function isElementVisible(element: Element): boolean {
  if (isBrowsyOwned(element)) {
    return false;
  }

  const tagName = element.tagName.toUpperCase();
  if (EXCLUDED_TAGS.has(tagName)) {
    return false;
  }

  // Quick check: offsetParent is null for display:none elements (unless body/fixed)
  const htmlElement = element as HTMLElement;
  if (
    htmlElement.offsetParent === null &&
    element.tagName !== "BODY" &&
    element.tagName !== "HTML"
  ) {
    // Might be position:fixed, check computed style before discarding
    const style = window.getComputedStyle(element);
    if (style.position !== "fixed") {
      return false;
    }
  }

  const rect = element.getBoundingClientRect();
  // Filter out zero-dimensioned elements or 1x1 tracking pixels
  if (rect.width <= 1 && rect.height <= 1) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === "none") return false;
  if (style.visibility === "hidden" || style.visibility === "collapse") return false;
  if (parseFloat(style.opacity || "1") <= 0.05) return false;

  return true;
}

/**
 * Checks whether an element is interactable or obstructed by styling (e.g. pointer-events: none).
 */
export function isElementObstructed(element: Element): boolean {
  try {
    const style = window.getComputedStyle(element);
    if (style.pointerEvents === "none") return true;
  } catch {
    // Non-DOM environment
  }
  return false;
}

/**
 * Extracts approximate integer bounding box for an element relative to the viewport.
 */
export function getBounds(element: Element): BoundingBox {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}
