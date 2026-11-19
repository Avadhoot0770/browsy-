/**
 * Host-Page Product Focus Bridge for Browsy
 *
 * Locates the corresponding product element on the retailer page when a user
 * clicks a verified product card or the "View results" action button.
 * Dispatches smooth scrolling, applies a temporary non-destructive visual highlight,
 * and truthfully reports whether the element was verified in the live DOM.
 */

import { resolveElement } from "./resolver";
import { highlightTargetElement, clearHighlight } from "./highlighter";

export interface ProductFocusTarget {
  elementId?: string;
  title?: string;
  url?: string;
  productId?: string;
  asin?: string;
}

export type FocusMatchStrategy =
  | "element_id"
  | "data_asin"
  | "data_id"
  | "url_match"
  | "title_match"
  | "none";

export interface ProductFocusResult {
  success: boolean;
  matchedBy: FocusMatchStrategy;
  element: HTMLElement | null;
  scrolled: boolean;
  highlighted: boolean;
  reason?: string;
}

export interface FocusOptions {
  durationMs?: number;
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  customBadge?: string;
}

/**
 * Normalizes title text for resilient DOM substring matching.
 */
function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isHtmlElement(el: any): el is HTMLElement {
  if (!el || typeof el !== "object") return false;
  if (typeof HTMLElement === "undefined") return true;
  return el instanceof HTMLElement || (typeof el.tagName === "string" && typeof el.style === "object");
}

/**
 * Finds the closest product card container for a located title or link element.
 */
function findCardContainer(el: Element): HTMLElement | null {
  if (typeof (el as any).closest === "function") {
    const card = (el as any).closest(
      [
        ".product-base", // Myntra
        "div[data-component-type='s-search-result']", // Amazon
        "div.s-result-item[data-asin]", // Amazon
        "div[data-id]", // Flipkart
        ".product-card", // Generic & test pages
        ".product-item",
        "article",
        "[role='listitem']",
      ].join(", ")
    );
    if (isHtmlElement(card) && card.isConnected) {
      return card as HTMLElement;
    }
  }
  return isHtmlElement(el) ? (el as HTMLElement) : null;
}

/**
 * Locates a product element in the host page DOM using a prioritized fallback waterfall:
 * 1. ElementRegistry ID (`browsy-el-xxx`)
 * 2. Amazon ASIN (`div[data-asin]`)
 * 3. Myntra/Flipkart Product ID (`[data-id]`)
 * 4. URL path segment matching
 * 5. Normalized title matching
 */
export function findHostProductElement(
  target: ProductFocusTarget,
  doc?: Document | null
): { element: HTMLElement | null; strategy: FocusMatchStrategy } {
  const documentObj = doc || (typeof document !== "undefined" ? document : null);
  if (!documentObj) {
    return { element: null, strategy: "none" };
  }

  // 1. Primary: Direct ElementRegistry ID lookup
  if (target.elementId) {
    const resolved = resolveElement(target.elementId);
    if (resolved.success && resolved.element && resolved.element.isConnected) {
      const container = findCardContainer(resolved.element);
      if (container && container.isConnected) {
        return { element: container, strategy: "element_id" };
      }
      if (isHtmlElement(resolved.element)) {
        return { element: resolved.element, strategy: "element_id" };
      }
    }
  }

  // 2. Secondary: Amazon ASIN Match
  let asin = target.asin;
  if (!asin && target.url) {
    const asinMatch = target.url.match(/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (asinMatch) asin = asinMatch[1];
  }
  if (asin && typeof documentObj.querySelector === "function") {
    const asinEl = documentObj.querySelector(`div[data-asin="${asin}"]`);
    if (isHtmlElement(asinEl) && asinEl.isConnected) {
      return { element: asinEl, strategy: "data_asin" };
    }
  }

  // 3. Tertiary: Myntra / Flipkart Product ID
  let pId = target.productId;
  if (!pId && target.url) {
    const myntraMatch = target.url.match(/\/(\d{5,12})(?:\/buy|\?|$)/);
    if (myntraMatch) pId = myntraMatch[1];
    if (!pId) {
      const flipkartMatch = target.url.match(/(?:pid=|itm)([a-zA-Z0-9]+)/i);
      if (flipkartMatch) pId = flipkartMatch[1];
    }
  }
  if (pId && typeof documentObj.querySelector === "function") {
    const pIdEl = documentObj.querySelector(
      `[data-id="${pId}"], [data-id*="${pId}"], [data-product-id="${pId}"], a[href*="${pId}"]`
    );
    if (pIdEl) {
      const container = findCardContainer(pIdEl);
      if (container && container.isConnected) {
        return { element: container, strategy: "data_id" };
      }
      if (isHtmlElement(pIdEl) && pIdEl.isConnected) {
        return { element: pIdEl, strategy: "data_id" };
      }
    }
  }

  // 4. Quaternary: Canonical URL path matching
  if (target.url && typeof documentObj.querySelectorAll === "function") {
    const cleanPath = target.url
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/[?#].*$/, "")
      .trim();
    if (cleanPath.length >= 6) {
      const links = Array.from(documentObj.querySelectorAll("a[href]"));
      for (const link of links) {
        const href = link.getAttribute("href") || "";
        if (href && (href.includes(cleanPath) || cleanPath.includes(href))) {
          const container = findCardContainer(link);
          if (container && container.isConnected) {
            return { element: container, strategy: "url_match" };
          }
          if (isHtmlElement(link) && link.isConnected) {
            return { element: link, strategy: "url_match" };
          }
        }
      }
    }
  }

  // 5. Quinary: Normalized Product Title substring search
  if (target.title && typeof documentObj.querySelectorAll === "function") {
    const targetNorm = normalizeTitle(target.title);
    if (targetNorm.length >= 4) {
      const titleTokens = targetNorm.split(" ").filter((t) => t.length >= 3);
      const candidates = Array.from(
        documentObj.querySelectorAll(
          "h2, h3, h4, .product-title, [class*='title' i], [class*='name' i], a[title], img[alt]"
        )
      );

      for (const cand of candidates) {
        const text = normalizeTitle(
          cand.getAttribute("title") ||
          cand.getAttribute("alt") ||
          cand.textContent ||
          ""
        );
        if (!text) continue;

        // Exact substring match
        if (text.includes(targetNorm) || targetNorm.includes(text)) {
          const container = findCardContainer(cand);
          if (container && container.isConnected) {
            return { element: container, strategy: "title_match" };
          }
          if (isHtmlElement(cand) && cand.isConnected) {
            return { element: cand, strategy: "title_match" };
          }
        }

        // High token overlap (at least 3 meaningful words)
        if (titleTokens.length >= 3) {
          const matchedCount = titleTokens.filter((token) => text.includes(token)).length;
          if (matchedCount >= Math.min(3, titleTokens.length)) {
            const container = findCardContainer(cand);
            if (container && container.isConnected) {
              return { element: container, strategy: "title_match" };
            }
          }
        }
      }
    }
  }

  return { element: null, strategy: "none" };
}

/**
 * Locates the target product element on the host page, smoothly scrolls the viewport,
 * and applies a temporary focus highlight.
 *
 * INVARIANT:
 * Does NOT mark the action as successful unless the element was verified and connected.
 */
export function locateAndFocusProductElement(
  target: ProductFocusTarget,
  options?: FocusOptions,
  doc?: Document | null
): ProductFocusResult {
  const { element, strategy } = findHostProductElement(target, doc);

  if (!element || !element.isConnected) {
    return {
      success: false,
      matchedBy: "none",
      element: null,
      scrolled: false,
      highlighted: false,
      reason: `Product "${target.title || target.elementId || "item"}" could not be located in the current page DOM.`,
    };
  }

  // 1. Smoothly scroll into viewport
  try {
    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({
        behavior: options?.behavior || "smooth",
        block: options?.block || "center",
        inline: "nearest",
      });
    }
  } catch {
    // Non-standard DOM environment fallback
  }

  // 2. Apply temporary visual highlight
  const badgeMessage =
    options?.customBadge ||
    (target.title ? `Verified: ${target.title.slice(0, 32)}` : "Verified Match");
  highlightTargetElement(element, badgeMessage, true);

  // 3. Schedule auto-cleanup
  const durationMs = options?.durationMs ?? 2000;
  if (durationMs > 0 && typeof setTimeout !== "undefined") {
    setTimeout(() => {
      clearHighlight();
    }, durationMs);
  }

  return {
    success: true,
    matchedBy: strategy,
    element,
    scrolled: true,
    highlighted: true,
  };
}
