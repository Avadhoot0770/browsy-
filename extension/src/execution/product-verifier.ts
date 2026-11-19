/**
 * Product-Level Verification Engine for Browsy Stage 4.5
 *
 * Inspects candidate product-detail pages when size, material, or specific inventory
 * availability cannot be verified directly from catalog listing cards.
 *
 * Guarantees:
 * 1. Deep size availability inspection: Distinguishes between selectable in-stock sizes
 *    and disabled, out-of-stock, or strike-through sizes.
 * 2. Selling price verification: Verifies current selling price is at or below requested budget.
 * 3. Color & Pattern grounded verification: Validates requested attributes against product metadata.
 * 4. Fault tolerance & recovery: Bounded timeouts, graceful continuation across failed PDPs,
 *    and strict non-fabrication (reports partial completion if no product satisfies all criteria).
 */

import type { PriceInfo, RatingInfo, RepeatedItem } from "../page-intelligence/types";
import type { StructuredIntent } from "../intent/types";
import { extractPrice } from "../page-intelligence/price-rating-parser";
import { textContainsWord } from "../shared/text-utils";
import {
  extractCatalogProducts,
  findCatalogProductByUrl,
  evaluateCatalogSizeVerification,
  type CatalogProductItem,
} from "../page-intelligence/catalog-extractor";

export type SizeStatus = "in_stock" | "out_of_stock" | "not_offered" | "unverified";

export interface PdpSizeOption {
  label: string;
  isAvailable: boolean;
  isSelectable: boolean;
  evidence: string;
  source: "light_dom" | "shadow_dom" | "json_metadata";
  shadowDepth?: number;
}

export interface PdpSizeExtractionResult {
  options: PdpSizeOption[];
  availableSizes: string[];
  unavailableSizes: string[];
  shadowRootsEncountered: number;
  inaccessibleRootsEncountered: number;
  sources: Array<"light_dom" | "shadow_dom" | "json_metadata">;
}

export interface SizeAvailabilityResult {
  requestedSize: string;
  status: SizeStatus;
  isAvailable: boolean;
  isSelectable: boolean;
  evidence: string;
  availableSizes: string[];
  unavailableSizes: string[];
  shadowRootsEncountered?: number;
  inaccessibleRootsEncountered?: number;
  source?: "light_dom" | "shadow_dom" | "json_metadata" | "unverified";
}

export interface ProductVerificationResult {
  elementId: string;
  title: string;
  url: string;
  price: PriceInfo | null;
  rating?: RatingInfo;
  imageUrl?: string;
  isFullyVerified: boolean;
  rejectReason?: string;
  conditions: {
    category: { requested?: string; verified: boolean; evidence: string };
    color: { requested?: string; verified: boolean; evidence: string };
    pattern: { requested?: string; verified: boolean; evidence: string };
    price: { maxBudget?: number; amount?: number; verified: boolean; evidence: string };
    size: { requested?: string; available: boolean; selectable: boolean; status: SizeStatus; evidence: string };
  };
}

export interface ProductVerificationSummary {
  inspectedCount: number;
  fullyVerifiedProducts: ProductVerificationResult[];
  rejectedProducts: Array<{ title: string; url?: string; reason: string }>;
  bestMatch: ProductVerificationResult | null;
}

const RED_COLOR_REGEX = /\b(?:red|maroon|crimson|rust|scarlet|burgundy|wine|ruby|cherry)\b/i;
const CHECKED_PATTERN_REGEX = /\b(?:check|checked|checks|plaid|tartan|gingham|buffalo check|windowpane)\b/i;
const CHILDREN_KEYWORDS_REGEX = /\b(?:boys?|girls?|kids?|baby|babies|toddlers?|infants?|child(?:ren)?)\b/i;

export interface DOMTraversalScope {
  rootNode: any;
  isShadow: boolean;
  isTemplate?: boolean;
  depth: number;
}

/**
 * Safely collects all accessible DOM roots starting from a root node,
 * recursively traversing open ShadowRoot trees up to maxDepth = 15.
 * Strictly respects closed ShadowRoots without attempting to bypass them.
 * Identifies uninstantiated templates and does not assume they contain active controls.
 */
export function collectAccessibleRoots(
  root: any,
  maxDepth = 15
): {
  scopes: DOMTraversalScope[];
  shadowRootsEncountered: number;
  inaccessibleRootsEncountered: number;
} {
  const scopes: DOMTraversalScope[] = [];
  const visited = new Set<any>();
  let shadowRootsEncountered = 0;
  let inaccessibleRootsEncountered = 0;

  if (!root || typeof root !== "object") {
    return { scopes, shadowRootsEncountered, inaccessibleRootsEncountered };
  }

  const queue: DOMTraversalScope[] = [{ rootNode: root, isShadow: false, isTemplate: false, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!current.rootNode || visited.has(current.rootNode)) continue;
    visited.add(current.rootNode);
    scopes.push(current);

    if (current.depth >= maxDepth) continue;

    // Check if current root node itself is an Element with an accessible open shadowRoot
    if ("shadowRoot" in current.rootNode) {
      const sr = (current.rootNode as any).shadowRoot;
      if (sr && typeof sr === "object" && !visited.has(sr)) {
        shadowRootsEncountered++;
        queue.push({ rootNode: sr, isShadow: true, isTemplate: false, depth: current.depth + 1 });
      } else if (
        current.rootNode.getAttribute?.("shadowrootmode") === "closed" ||
        current.rootNode.getAttribute?.("shadowroot") === "closed"
      ) {
        inaccessibleRootsEncountered++;
      }
    }

    // Traverse all descendant elements in this scope
    if ("querySelectorAll" in current.rootNode) {
      let elements: any[] = [];
      try {
        elements = Array.from(current.rootNode.querySelectorAll("*"));
      } catch {
        elements = [];
      }

      for (const el of elements) {
        if (!el || typeof el !== "object") continue;

        // 1. Element with accessible open shadow root (instantiated)
        if ("shadowRoot" in el) {
          const sr = (el as any).shadowRoot;
          if (sr && typeof sr === "object") {
            if (!visited.has(sr)) {
              shadowRootsEncountered++;
              queue.push({ rootNode: sr, isShadow: true, isTemplate: false, depth: current.depth + 1 });
            }
          } else if (
            el.getAttribute?.("shadowrootmode") === "closed" ||
            el.getAttribute?.("shadowroot") === "closed"
          ) {
            inaccessibleRootsEncountered++;
          }
        }

        // 2. Uninstantiated Declarative Shadow DOM templates
        // If a <template> tag is still present in the DOM, the browser did not attach it as an active shadowRoot.
        // It is marked as an inert template scope so its elements are not falsely assumed to be active/selectable.
        const tag = (el.tagName || "").toUpperCase();
        if (tag === "TEMPLATE") {
          const mode = el.getAttribute?.("shadowrootmode") || el.getAttribute?.("shadowroot");
          if (mode) {
            if (mode.toLowerCase() === "open") {
              const content = (el as any).content;
              if (content && typeof content === "object" && !visited.has(content)) {
                shadowRootsEncountered++;
                queue.push({ rootNode: content, isShadow: true, isTemplate: true, depth: current.depth + 1 });
              }
            } else if (mode.toLowerCase() === "closed") {
              inaccessibleRootsEncountered++;
            }
          }
        }
      }
    }
  }

  return { scopes, shadowRootsEncountered, inaccessibleRootsEncountered };
}

/**
 * Evaluates whether a size selector button/control is disabled or out of stock.
 * Checks disabled attribute, ARIA attributes, explicit data attributes, class names,
 * strike-through styling, child elements, and parent host constraints.
 */
export function isElementDisabled(el: any): { disabled: boolean; reason: string } {
  if (!el || typeof el !== "object") return { disabled: false, reason: "valid" };

  // 1. Native HTML disabled property or attribute
  if (("disabled" in el && el.disabled === true) || el.hasAttribute?.("disabled")) {
    return { disabled: true, reason: "disabled attribute or property is true" };
  }

  // 2. ARIA disabled
  if (el.getAttribute?.("aria-disabled") === "true") {
    return { disabled: true, reason: "aria-disabled is true" };
  }

  // 3. Explicit inventory data attributes
  const dataAvail = el.getAttribute?.("data-available");
  if (dataAvail === "false" || dataAvail === "0") {
    return { disabled: true, reason: "data-available is false" };
  }
  const dataInStock = el.getAttribute?.("data-in-stock");
  if (dataInStock === "false" || dataInStock === "0") {
    return { disabled: true, reason: "data-in-stock is false" };
  }
  if (el.hasAttribute?.("out-of-stock") || el.hasAttribute?.("unavailable")) {
    return { disabled: true, reason: "out-of-stock or unavailable attribute present" };
  }

  // 4. Class-based availability markers
  const className = String(el.className || "");
  const disabledClassRegex = /\b(?:disabled|out-of-stock|oos|strike|cross|unavailable|sold-out|size-buttons-size-button-disabled|inactive|is-disabled|is-out-of-stock|not-available)\b/i;
  if (disabledClassRegex.test(className)) {
    return { disabled: true, reason: `disabled class name: '${className}'` };
  }

  // 5. Child strike-through or cross icon elements
  if ("querySelector" in el) {
    try {
      const strikeChild = el.querySelector(".strike, .cross, [class*='strike' i], [class*='disabled' i], strike, s, del");
      if (strikeChild) {
        return { disabled: true, reason: "child strike/cross element detected" };
      }
    } catch {
      // In mock DOM
    }
  }

  // 6. Inline style markers
  if ("style" in el) {
    const s = el.style;
    if (s && (s.textDecoration?.includes("line-through") || s.pointerEvents === "none")) {
      return { disabled: true, reason: "inline style has line-through or pointer-events: none" };
    }
  }

  // 7. Parent host / container disabled state
  const parent = el.parentElement;
  if (parent && typeof parent === "object") {
    if (parent.hasAttribute?.("disabled") || parent.getAttribute?.("aria-disabled") === "true") {
      return { disabled: true, reason: "parent element is disabled" };
    }
    const parentClass = String(parent.className || "");
    if (disabledClassRegex.test(parentClass)) {
      return { disabled: true, reason: `parent element has disabled class: '${parentClass}'` };
    }
    const parentDataAvail = parent.getAttribute?.("data-available");
    if (parentDataAvail === "false" || parentDataAvail === "0") {
      return { disabled: true, reason: "parent data-available is false" };
    }
  }

  return { disabled: false, reason: "selectable" };
}

/**
 * Recursively inspects accessible DOM nodes, open Shadow DOM roots (including nested open roots),
 * or structured metadata to extract all detected size options and their availability.
 */
export function extractPdpSizeOptions(
  context: Element | Document | ShadowRoot | DocumentFragment | string
): PdpSizeExtractionResult {
  const options: PdpSizeOption[] = [];
  const availableSizes: string[] = [];
  const unavailableSizes: string[] = [];
  const sourcesSet = new Set<"light_dom" | "shadow_dom" | "json_metadata">();

  let shadowRootsEncountered = 0;
  let inaccessibleRootsEncountered = 0;

  // Branch A: DOM Node Inspection (Live PDP DOM, Shadow DOM, or DOMParser)
  let rootNode: any = context;
  if (typeof context === "string" && typeof DOMParser !== "undefined") {
    try {
      rootNode = new DOMParser().parseFromString(context, "text/html");
    } catch {
      rootNode = null;
    }
  }

  if (typeof rootNode === "object" && rootNode !== null && ("querySelectorAll" in rootNode || "shadowRoot" in rootNode)) {
    const traversal = collectAccessibleRoots(rootNode);
    shadowRootsEncountered = traversal.shadowRootsEncountered;
    inaccessibleRootsEncountered = traversal.inaccessibleRootsEncountered;

    const sizeSelectors = [
      "button[class*='size' i]",
      "[class*='size-button' i]",
      "[class*='size-item' i]",
      "[class*='size-box' i]",
      "[class*='size-selector' i]",
      "[class*='pdp-size' i]",
      "[class*='size-pill' i]",
      "[class*='size-swatch' i]",
      "input[name*='size' i]",
      "label[class*='size' i]",
      "select[id*='size' i] option",
      "select[name*='size' i] option",
      "select[aria-label*='size' i] option",
      "select[class*='size' i] option",
      "[id*='size' i] select option",
      "[class*='size' i] select option",
      "[id*='size' i] option",
      "[data-size]",
      "[data-size-name]",
      "[data-size-label]",
      "[data-testid*='size' i]",
      "[aria-label*='size' i]",
      "size-button",
      "pdp-size",
      "[role='radio'][class*='size' i]",
      "[role='button'][class*='size' i]",
    ].join(", ");

    // In shadow DOM scopes, buttons or swatches inside a size component:
    const shadowSizeSelectors = sizeSelectors + ", button, [role='button'], [role='radio'], input[type='radio'], [class*='swatch' i], [class*='pill' i], [class*='option' i], select option";

    const VALID_SIZE_LABEL_REGEX = /^(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|6XL|[2-5]\d|[6-9]|1[0-2]|ONE\s*SIZE|OS|[SMLX]{1,3}\/[SMLX]{1,3})$/i;

    for (const scope of traversal.scopes) {
      if (!("querySelectorAll" in scope.rootNode)) continue;

      let sizeElements: any[] = [];
      try {
        const selectorToUse = scope.isShadow ? shadowSizeSelectors : sizeSelectors;
        sizeElements = Array.from(scope.rootNode.querySelectorAll(selectorToUse));
      } catch {
        sizeElements = [];
      }

      for (const el of sizeElements) {
        if (!el || typeof el !== "object") continue;

        const rawText = (
          el.getAttribute?.("data-size") ||
          el.getAttribute?.("data-size-name") ||
          el.getAttribute?.("data-size-label") ||
          el.getAttribute?.("value") ||
          el.textContent ||
          el.getAttribute?.("aria-label") ||
          ""
        ).trim();

        const firstWord = rawText.split(/[\s,]+/)[0]?.toUpperCase() || "";

        // Check if this element represents a genuine size label (e.g. S, M, L, XL, 38, 40)
        let sizeLabel = "";
        if (VALID_SIZE_LABEL_REGEX.test(firstWord)) {
          sizeLabel = firstWord;
        } else {
          // If first word was "Size" or "Select", check if an actual size token follows (e.g. "Size: XL")
          const sizeTokenMatch = rawText.match(/\b(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|6XL|[2-5]\d|[6-9]|1[0-2])\b/i);
          if (sizeTokenMatch) {
            sizeLabel = sizeTokenMatch[1].toUpperCase();
          } else {
            continue;
          }
        }

        const source = scope.isShadow ? "shadow_dom" : "light_dom";
        sourcesSet.add(source);

        // Guard against uninstantiated templates: inert template blueprints must not be assumed active/selectable
        if (scope.isTemplate) {
          options.push({
            label: sizeLabel,
            isAvailable: false,
            isSelectable: false,
            evidence: `Size ${sizeLabel} is defined in an uninstantiated template blueprint, not verified active on live page`,
            source,
            shadowDepth: scope.depth,
          });
          continue;
        }

        const disabledStatus = isElementDisabled(el);

        if (disabledStatus.disabled) {
          if (!unavailableSizes.includes(sizeLabel)) unavailableSizes.push(sizeLabel);
          options.push({
            label: sizeLabel,
            isAvailable: false,
            isSelectable: false,
            evidence: `Size ${sizeLabel} is disabled/out-of-stock: ${disabledStatus.reason}`,
            source,
            shadowDepth: scope.depth,
          });
        } else {
          if (!availableSizes.includes(sizeLabel)) availableSizes.push(sizeLabel);
          options.push({
            label: sizeLabel,
            isAvailable: true,
            isSelectable: true,
            evidence: `Size ${sizeLabel} is selectable and in stock`,
            source,
            shadowDepth: scope.depth,
          });
        }
      }
    }
  }

  // Branch B: JSON & HTML String Extraction (Structured script data or raw HTML fallback)
  const rawHtml = typeof context === "string" ? context : (context as Element).innerHTML || "";
  if (rawHtml) {
    // Declarative Shadow DOM detection in raw HTML strings (for Node / non-DOM environments)
    // Safe boundary: Record template occurrence without falsely assuming inert templates contain active controls
    const openDsdTemplates = rawHtml.matchAll(/<template[^>]+shadowrootmode=["']open["'][^>]*>([\s\S]*?)<\/template>/gi);
    for (const match of openDsdTemplates) {
      shadowRootsEncountered++;
      const tplContent = match[1];
      const btnMatches = tplContent.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi);
      for (const bm of btnMatches) {
        const text = bm[1].replace(/<[^>]+>/g, "").trim().toUpperCase();
        if (text && /^(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|6XL|[2-5]\d|[6-9]|1[0-2])$/i.test(text)) {
          sourcesSet.add("shadow_dom");
          options.push({
            label: text,
            isAvailable: false,
            isSelectable: false,
            evidence: `Size ${text} is present in an uninstantiated template string, not verified active on live page`,
            source: "shadow_dom",
          });
        }
      }
    }

    const closedDsdTemplates = rawHtml.matchAll(/<template[^>]+shadowrootmode=["']closed["'][^>]*>/gi);
    for (const _ of closedDsdTemplates) {
      inaccessibleRootsEncountered++;
    }

    // 1. Structured JSON: "label":"XL", ... "available":(true|false)
    const jsonSizeRegex = /"label"\s*:\s*"([^"]+)"[\s\S]*?"available"\s*:\s*(true|false)/gi;
    let m: RegExpExecArray | null;
    while ((m = jsonSizeRegex.exec(rawHtml)) !== null) {
      const label = m[1].trim().toUpperCase();
      const isAvail = m[2].toLowerCase() === "true";
      if (label.length <= 5) {
        sourcesSet.add("json_metadata");
        if (isAvail && !availableSizes.includes(label)) availableSizes.push(label);
        if (!isAvail && !unavailableSizes.includes(label)) unavailableSizes.push(label);
        options.push({
          label,
          isAvailable: isAvail,
          isSelectable: isAvail,
          evidence: `JSON metadata reports size ${label} available: ${isAvail}`,
          source: "json_metadata",
        });
      }
    }

    // 2. Simple sizes array: "sizes":"S,M,L,XL"
    if (availableSizes.length === 0 && unavailableSizes.length === 0) {
      const simpleSizesMatch = rawHtml.match(/"sizes"\s*:\s*"([^"]+)"/i);
      if (simpleSizesMatch && simpleSizesMatch[1]) {
        const parsed = simpleSizesMatch[1].split(",").map((s) => s.trim().toUpperCase());
        for (const s of parsed) {
          if (s && !availableSizes.includes(s)) {
            sourcesSet.add("json_metadata");
            availableSizes.push(s);
            options.push({
              label: s,
              isAvailable: true,
              isSelectable: true,
              evidence: `JSON metadata reports size ${s}`,
              source: "json_metadata",
            });
          }
        }
      }
    }
  }

  return {
    options,
    availableSizes,
    unavailableSizes,
    shadowRootsEncountered,
    inaccessibleRootsEncountered,
    sources: Array.from(sourcesSet),
  };
}

/**
 * Evaluates size availability on a product page (DOM or HTML string).
 * Strictly distinguishes selectable buttons from disabled/out-of-stock buttons.
 * Traverses accessible, open Shadow DOM roots (including nested open roots).
 */
export function parseSizeAvailability(
  context: Element | Document | ShadowRoot | DocumentFragment | string,
  requestedSize: string
): SizeAvailabilityResult {
  const normReq = requestedSize.trim().toUpperCase();
  const extraction = extractPdpSizeOptions(context);

  const availableSizes = extraction.availableSizes;
  const unavailableSizes = extraction.unavailableSizes;

  // Evaluate Requested Size against findings
  const isDirectlyAvailable = availableSizes.includes(normReq);
  const isDirectlyUnavailable = unavailableSizes.includes(normReq);

  const matchingOption = extraction.options.find((o) => o.label === normReq);
  const optionSource = matchingOption
    ? matchingOption.source
    : extraction.sources.includes("shadow_dom")
    ? "shadow_dom"
    : extraction.sources.includes("light_dom")
    ? "light_dom"
    : "json_metadata";

  const isFromShadow = matchingOption?.source === "shadow_dom";
  const shadowNote = isFromShadow ? " (inspected via open Shadow DOM)" : "";

  // If a size has ANY indication of being unavailable/out-of-stock, it is treated as unavailable
  if (isDirectlyUnavailable) {
    return {
      requestedSize: normReq,
      status: "out_of_stock",
      isAvailable: false,
      isSelectable: false,
      evidence: `Size ${normReq} is listed but currently out of stock / disabled on product page${shadowNote}`,
      availableSizes,
      unavailableSizes,
      shadowRootsEncountered: extraction.shadowRootsEncountered,
      inaccessibleRootsEncountered: extraction.inaccessibleRootsEncountered,
      source: optionSource,
    };
  }

  if (isDirectlyAvailable) {
    return {
      requestedSize: normReq,
      status: "in_stock",
      isAvailable: true,
      isSelectable: true,
      evidence: `Size ${normReq} is confirmed in stock and selectable on product page${shadowNote}`,
      availableSizes,
      unavailableSizes,
      shadowRootsEncountered: extraction.shadowRootsEncountered,
      inaccessibleRootsEncountered: extraction.inaccessibleRootsEncountered,
      source: optionSource,
    };
  }

  if (availableSizes.length > 0 || unavailableSizes.length > 0) {
    return {
      requestedSize: normReq,
      status: "not_offered",
      isAvailable: false,
      isSelectable: false,
      evidence: `Size ${normReq} is not offered for this product (available sizes: ${availableSizes.join(", ") || "none"})`,
      availableSizes,
      unavailableSizes,
      shadowRootsEncountered: extraction.shadowRootsEncountered,
      inaccessibleRootsEncountered: extraction.inaccessibleRootsEncountered,
      source: optionSource,
    };
  }

  let unverifiedReason = "from product page metadata";
  if (matchingOption?.evidence?.includes("uninstantiated template")) {
    unverifiedReason = ": size is defined in an uninstantiated template blueprint, not confirmed active on product page";
  } else if (extraction.inaccessibleRootsEncountered > 0) {
    unverifiedReason = ": size controls appear to be encapsulated in inaccessible/closed shadow root";
  }

  return {
    requestedSize: normReq,
    status: "unverified",
    isAvailable: false,
    isSelectable: false,
    evidence: `Size availability could not be verified${unverifiedReason.startsWith(":") ? unverifiedReason : " " + unverifiedReason}`,
    availableSizes,
    unavailableSizes,
    shadowRootsEncountered: extraction.shadowRootsEncountered,
    inaccessibleRootsEncountered: extraction.inaccessibleRootsEncountered,
    source: "unverified",
  };
}

/**
 * Extracts current selling price from product-detail page context.
 * Traverses accessible, open Shadow DOM roots if price is rendered in a web component.
 */
export function parseProductSellingPrice(context: Element | Document | string): PriceInfo | null {
  // DOM Inspection
  if (typeof context === "object" && context !== null && ("querySelector" in context || "shadowRoot" in context)) {
    const { scopes } = collectAccessibleRoots(context);
    const priceSelectors = [
      ".pdp-price",
      ".pdp-discounted-price",
      "[class*='pdp-price' i]",
      "[class*='discounted-price' i]",
      "[class*='selling-price' i]",
      "[class*='special-price' i]",
      ".selling-price",
      ".price",
    ];

    for (const scope of scopes) {
      if (!("querySelector" in scope.rootNode)) continue;
      for (const sel of priceSelectors) {
        try {
          const el = scope.rootNode.querySelector(sel);
          if (el && el.textContent) {
            const parsed = extractPrice(el.textContent);
            if (parsed) return parsed;
          }
        } catch {
          // ignore selector errors
        }
      }
    }
  }

  // String / JSON Fallback
  const rawHtml = typeof context === "string" ? context : (context as Element).innerHTML || "";
  if (rawHtml) {
    const jsonPriceMatch = rawHtml.match(/"discountedPrice"\s*:\s*([0-9]+)|"price"\s*:\s*([0-9]+)/i);
    if (jsonPriceMatch) {
      const amt = parseInt(jsonPriceMatch[1] || jsonPriceMatch[2], 10);
      if (!isNaN(amt) && amt > 0) {
        return {
          raw: `₹${amt}`,
          amount: amt,
          currency: "INR",
        };
      }
    }
    return extractPrice(rawHtml);
  }

  return null;
}

/**
 * Evaluates all required constraints on an individual product.
 */
export function verifyProductAttributes(
  context: Element | Document | string,
  intent: StructuredIntent,
  title = "Product",
  cardPrice: PriceInfo | null = null,
  elementId = "item-pdp",
  url = "",
  rating?: RatingInfo,
  imageUrl?: string
): ProductVerificationResult {
  const rawHtml = typeof context === "string" ? context : (context as Element).innerHTML || "";
  const contextText = typeof context === "object" && context !== null && "textContent" in context ? context.textContent || "" : "";
  const productSpecificCorpus = `${title} ${contextText} ${rawHtml}`.toLowerCase();
  const isProductPageUrl = url.includes("/buy") || url.includes("/p/") || url.includes("/dp/") || url.includes("/product/") || url.includes("/item/");
  const productSlug = isProductPageUrl ? url.toLowerCase() : "";

  // 1. Category and Children's Item Exclusion
  let categoryVerified = true;
  let categoryEvidence = "Category verified";
  if (intent.entities.category) {
    const cat = intent.entities.category.toLowerCase();
    categoryVerified = productSpecificCorpus.includes(cat) || textContainsWord(productSpecificCorpus, cat);
    categoryEvidence = categoryVerified
      ? `Category '${cat}' confirmed in product title`
      : `Product is not in requested category '${cat}'`;
  }

  // Children's item guard: if user did not request boys/kids/children, reject kids' items
  const isChildrenRequested =
    CHILDREN_KEYWORDS_REGEX.test(intent.entities.category || "") ||
    CHILDREN_KEYWORDS_REGEX.test(intent.entities.type || "") ||
    CHILDREN_KEYWORDS_REGEX.test(intent.rawQuery || "");

  if (!isChildrenRequested && CHILDREN_KEYWORDS_REGEX.test(title)) {
    categoryVerified = false;
    categoryEvidence = "Product is a children's/kids' item, not matching requested adult item";
  }

  // 2. Color (must be supported by product-specific evidence, not just a generic search URL)
  let colorVerified = true;
  let colorEvidence = "Color verified";
  if (intent.filters.color) {
    const col = String(intent.filters.color).toLowerCase();
    const isRed = col === "red";
    const colRegex = isRed ? RED_COLOR_REGEX : new RegExp(`\\b${col}\\b`, "i");
    const hasInTitle = colRegex.test(title);
    const hasInProductDetails = colRegex.test(contextText) || colRegex.test(rawHtml);
    const hasInProductSlug = productSlug ? colRegex.test(productSlug) : false;

    colorVerified = hasInTitle || hasInProductDetails || hasInProductSlug;
    colorEvidence = colorVerified
      ? `Color matches requested '${col}' (supported by product-specific evidence)`
      : `Color does not match requested '${col}' (no product-specific evidence)`;
  }

  // 3. Pattern (must be supported by product-specific evidence, not just a generic search URL)
  let patternVerified = true;
  let patternEvidence = "Pattern verified";
  if (intent.filters.pattern) {
    const pat = String(intent.filters.pattern).toLowerCase();
    const isChecked = pat === "checked";
    const patRegex = isChecked ? CHECKED_PATTERN_REGEX : new RegExp(`\\b${pat}\\b`, "i");
    const hasInTitle = patRegex.test(title);
    const hasInProductDetails = patRegex.test(contextText) || patRegex.test(rawHtml);
    const hasInProductSlug = productSlug ? patRegex.test(productSlug) : false;

    patternVerified = hasInTitle || hasInProductDetails || hasInProductSlug;
    patternEvidence = patternVerified
      ? `Pattern matches requested '${pat}' (supported by product-specific evidence)`
      : `Pattern does not match requested '${pat}' (no product-specific evidence)`;
  }

  // 4. Selling Price
  const sellingPrice = parseProductSellingPrice(context) || cardPrice;
  let priceVerified = true;
  let priceEvidence = "Price verified";
  if (intent.constraints.maxPrice) {
    const maxP = intent.constraints.maxPrice;
    if (sellingPrice && sellingPrice.amount) {
      priceVerified = sellingPrice.amount <= maxP;
      priceEvidence = priceVerified
        ? `Selling price ₹${sellingPrice.amount.toLocaleString()} is within budget of ₹${maxP.toLocaleString()}`
        : `Selling price ₹${sellingPrice.amount.toLocaleString()} exceeds budget of ₹${maxP.toLocaleString()}`;
    } else {
      priceVerified = false;
      priceEvidence = "Selling price could not be verified from product page";
    }
  }

  // 5. Size
  let sizeVerified = true;
  let sizeEvidence = "Size verified";
  let sizeStatus: SizeStatus = "in_stock";
  let isSizeAvailable = true;
  let isSizeSelectable = true;

  if (intent.filters.size) {
    const sizeRes = parseSizeAvailability(context, String(intent.filters.size));
    sizeStatus = sizeRes.status;
    isSizeAvailable = sizeRes.isAvailable;
    isSizeSelectable = sizeRes.isSelectable;
    sizeVerified = sizeRes.isAvailable;
    sizeEvidence = sizeRes.evidence;
  }

  const isFullyVerified = categoryVerified && colorVerified && patternVerified && priceVerified && sizeVerified;
  let rejectReason: string | undefined = undefined;

  if (!isFullyVerified) {
    if (!sizeVerified) rejectReason = sizeEvidence;
    else if (!categoryVerified) rejectReason = categoryEvidence;
    else if (!colorVerified) rejectReason = colorEvidence;
    else if (!patternVerified) rejectReason = patternEvidence;
    else if (!priceVerified) rejectReason = priceEvidence;
  }

  return {
    elementId,
    title,
    url,
    price: sellingPrice,
    rating,
    imageUrl,
    isFullyVerified,
    rejectReason,
    conditions: {
      category: { requested: intent.entities.category, verified: categoryVerified, evidence: categoryEvidence },
      color: { requested: intent.filters.color as string, verified: colorVerified, evidence: colorEvidence },
      pattern: { requested: intent.filters.pattern as string, verified: patternVerified, evidence: patternEvidence },
      price: { maxBudget: intent.constraints.maxPrice, amount: sellingPrice?.amount, verified: priceVerified, evidence: priceEvidence },
      size: { requested: intent.filters.size as string, available: isSizeAvailable, selectable: isSizeSelectable, status: sizeStatus, evidence: sizeEvidence },
    },
  };
}

// Safe in-memory PDP verification cache (60s TTL)
const pdpVerificationCache = new Map<string, { result: ProductVerificationResult; timestamp: number }>();
const PDP_CACHE_TTL_MS = 60_000;

export function clearPdpCache(): void {
  pdpVerificationCache.clear();
}

export interface InspectProductDetailOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  useCache?: boolean;
}

/**
 * Inspects a candidate product's detail page via same-origin fetch or DOM.
 */
export async function inspectProductDetail(
  item: RepeatedItem,
  intent: StructuredIntent,
  options: InspectProductDetailOptions = {}
): Promise<ProductVerificationResult> {
  const timeoutMs = options.timeoutMs || 4000;
  const href = item.link?.href;

  if (!href) {
    return {
      elementId: item.elementId,
      title: item.title,
      url: "",
      price: item.price || null,
      rating: item.rating,
      imageUrl: item.imageUrl,
      isFullyVerified: false,
      rejectReason: "Product does not have a valid detail link",
      conditions: {
        category: { verified: false, evidence: "No product detail link" },
        color: { verified: false, evidence: "No product detail link" },
        pattern: { verified: false, evidence: "No product detail link" },
        price: { verified: false, evidence: "No product detail link" },
        size: { available: false, selectable: false, status: "unverified", evidence: "No product detail link" },
      },
    };
  }

  // Check safe in-memory cache when useCache is enabled
  if (options.useCache) {
    const cached = pdpVerificationCache.get(href);
    if (cached && Date.now() - cached.timestamp < PDP_CACHE_TTL_MS) {
      return {
        ...cached.result,
        elementId: item.elementId,
      };
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortHandler = () => controller.abort();
  if (options.signal) options.signal.addEventListener("abort", abortHandler, { once: true });

  try {
    const res = await fetch(href, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timer);
    if (options.signal) options.signal.removeEventListener("abort", abortHandler);

    if (!res.ok) {
      return {
        elementId: item.elementId,
        title: item.title,
        url: href,
        price: item.price || null,
        rating: item.rating,
        imageUrl: item.imageUrl,
        isFullyVerified: false,
        rejectReason: `Product detail page returned HTTP ${res.status}`,
        conditions: {
          category: { verified: false, evidence: `HTTP ${res.status}` },
          color: { verified: false, evidence: `HTTP ${res.status}` },
          pattern: { verified: false, evidence: `HTTP ${res.status}` },
          price: { verified: false, evidence: `HTTP ${res.status}` },
          size: { available: false, selectable: false, status: "unverified", evidence: `HTTP ${res.status}` },
        },
      };
    }

    const html = await res.text();

    // Fast HTML / JSON string check: if requested size is missing entirely from HTML/JSON, reject before DOM parsing
    if (intent.filters.size) {
      const reqSize = String(intent.filters.size).trim().toUpperCase();
      const hasSizeInRaw = html.toUpperCase().includes(reqSize);
      if (!hasSizeInRaw) {
        const fastResult: ProductVerificationResult = {
          elementId: item.elementId,
          title: item.title,
          url: href,
          price: item.price || null,
          rating: item.rating,
          imageUrl: item.imageUrl,
          isFullyVerified: false,
          rejectReason: `Size ${reqSize} not found in product page inventory or text`,
          conditions: {
            category: { verified: false, evidence: "Size missing" },
            color: { verified: false, evidence: "Size missing" },
            pattern: { verified: false, evidence: "Size missing" },
            price: { verified: false, evidence: "Size missing" },
            size: { available: false, selectable: false, status: "not_offered", evidence: `Size ${reqSize} not offered` },
          },
        };
        pdpVerificationCache.set(href, { result: fastResult, timestamp: Date.now() });
        return fastResult;
      }
    }

    // Parse HTML with DOMParser if available in browser context
    let parsedDoc: Document | string = html;
    if (typeof DOMParser !== "undefined") {
      try {
        parsedDoc = new DOMParser().parseFromString(html, "text/html");
      } catch {
        parsedDoc = html;
      }
    }

    // Extract image if available
    let extractedImageUrl = item.imageUrl;
    if (!extractedImageUrl) {
      if (typeof parsedDoc === "object" && parsedDoc !== null && "querySelector" in parsedDoc) {
        const imgEl = (parsedDoc as Document).querySelector(".pdp-image, [class*='pdp-image' i], .image-grid-image, img[src*='myntassets'], meta[property='og:image']") as HTMLImageElement | HTMLMetaElement | null;
        if (imgEl) {
          extractedImageUrl = (imgEl instanceof HTMLMetaElement ? imgEl.content : imgEl.src) || undefined;
        }
      }
    }
    if (!extractedImageUrl && typeof parsedDoc === "string") {
      const og = parsedDoc.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                 parsedDoc.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (og) extractedImageUrl = og[1];
    }

    const verifiedRes = verifyProductAttributes(
      parsedDoc,
      intent,
      item.title,
      item.price || null,
      item.elementId,
      href,
      item.rating,
      extractedImageUrl
    );

    // Save in cache if enabled
    if (options.useCache) {
      pdpVerificationCache.set(href, { result: verifiedRes, timestamp: Date.now() });
    }
    return verifiedRes;
  } catch (err: any) {
    clearTimeout(timer);
    if (options.signal) options.signal.removeEventListener("abort", abortHandler);

    const isAbort = err?.name === "AbortError" || options.signal?.aborted;
    return {
      elementId: item.elementId,
      title: item.title,
      url: href,
      price: item.price || null,
      isFullyVerified: false,
      rejectReason: isAbort ? "Product inspection timed out or was cancelled" : `Inspection error: ${err?.message || String(err)}`,
      conditions: {
        category: { verified: false, evidence: "Inspection error" },
        color: { verified: false, evidence: "Inspection error" },
        pattern: { verified: false, evidence: "Inspection error" },
        price: { verified: false, evidence: "Inspection error" },
        size: { available: false, selectable: false, status: "unverified", evidence: isAbort ? "Inspection timed out" : "Network error" },
      },
    };
  }
}

export const DEFAULT_INSPECTION_CONCURRENCY = 2;
export const MAX_INSPECTION_CONCURRENCY = 2;

export interface InspectCandidateOptions {
  maxCandidates?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  concurrency?: number;
  useCache?: boolean;
  doc?: Document | null;
  catalogProducts?: CatalogProductItem[];
  onProductVerified?: (product: ProductVerificationResult) => void;
}

/**
 * Evaluates all required constraints on a catalog product item extracted from page scripts.
 * Adheres strictly to the invariant that mere presence in offered sizes list does NOT prove availability.
 */
export function verifyCatalogProductAttributes(
  item: CatalogProductItem,
  intent: StructuredIntent,
  elementId = "item-catalog",
  fallbackUrl = ""
): ProductVerificationResult {
  const title = item.title;
  const brand = item.brand || "";
  const productText = `${brand} ${title} ${item.color || ""} ${item.gender || ""}`.toLowerCase();
  const url = item.url || fallbackUrl;
  const urlLower = url.toLowerCase();

  // 1. Category and Children's Item Exclusion
  let categoryVerified = true;
  let categoryEvidence = "Category verified";
  if (intent.entities.category) {
    const cat = intent.entities.category.toLowerCase();
    categoryVerified = productText.includes(cat) || textContainsWord(productText, cat);
    categoryEvidence = categoryVerified
      ? `Category '${cat}' confirmed in catalog metadata`
      : `Product is not in requested category '${cat}'`;
  }

  const isChildrenRequested =
    CHILDREN_KEYWORDS_REGEX.test(intent.entities.category || "") ||
    CHILDREN_KEYWORDS_REGEX.test(intent.entities.type || "") ||
    CHILDREN_KEYWORDS_REGEX.test(intent.rawQuery || "");

  if (!isChildrenRequested) {
    const isKidsGender = item.gender?.toLowerCase() === "boys" || item.gender?.toLowerCase() === "girls";
    if (isKidsGender || CHILDREN_KEYWORDS_REGEX.test(title)) {
      categoryVerified = false;
      categoryEvidence = "Product is a children's/kids' item, not matching requested adult item";
    }
  }

  // 2. Color Grounding
  let colorVerified = true;
  let colorEvidence = "Color verified";
  if (intent.filters.color) {
    const col = String(intent.filters.color).toLowerCase();
    const isRed = col === "red";
    const colRegex = isRed ? RED_COLOR_REGEX : new RegExp(`\\b${col}\\b`, "i");
    const hasInColorProp = item.color ? colRegex.test(item.color) : false;
    const hasInTitle = colRegex.test(title);
    const hasInUrl = colRegex.test(urlLower);

    colorVerified = hasInColorProp || hasInTitle || hasInUrl;
    if (isRed && !hasInColorProp && !hasInTitle) {
      if (/\b(?:black|blue|navy|green|yellow|white|grey|gray|pink|purple|orange|brown)\b/i.test(title)) {
        colorVerified = false;
      }
    }
    colorEvidence = colorVerified
      ? `Color matches requested '${col}' (catalog color: ${item.color || "confirmed in title"})`
      : `Color does not match requested '${col}' (catalog color: ${item.color || "not found"})`;
  }

  // 3. Pattern Grounding
  let patternVerified = true;
  let patternEvidence = "Pattern verified";
  if (intent.filters.pattern) {
    const pat = String(intent.filters.pattern).toLowerCase();
    const isChecked = pat === "checked";
    const patRegex = isChecked ? CHECKED_PATTERN_REGEX : new RegExp(`\\b${pat}\\b`, "i");
    const hasInTitle = patRegex.test(title);
    const hasInUrl = patRegex.test(urlLower);

    patternVerified = hasInTitle || hasInUrl;
    patternEvidence = patternVerified
      ? `Pattern matches requested '${pat}' (confirmed in catalog title)`
      : `Pattern does not match requested '${pat}' (not found in catalog title)`;
  }

  // 4. Selling Price
  let priceVerified = true;
  let priceEvidence = "Price verified";
  const priceAmount = item.price;
  if (intent.constraints.maxPrice) {
    const maxP = intent.constraints.maxPrice;
    if (priceAmount && priceAmount > 0) {
      priceVerified = priceAmount <= maxP;
      priceEvidence = priceVerified
        ? `Selling price ₹${priceAmount.toLocaleString()} is within budget of ₹${maxP.toLocaleString()}`
        : `Selling price ₹${priceAmount.toLocaleString()} exceeds budget of ₹${maxP.toLocaleString()}`;
    } else {
      priceVerified = false;
      priceEvidence = "Selling price could not be verified from catalog data";
    }
  }

  // 5. Size Grounding & Inventory Verification
  let sizeVerified = true;
  let sizeStatus: SizeStatus = "in_stock";
  let sizeEvidence = "Size verified";
  let sizeAvailable = true;
  let sizeSelectable = true;

  if (intent.filters.size) {
    const reqSize = String(intent.filters.size).trim();
    const sizeEval = evaluateCatalogSizeVerification(item, reqSize);
    sizeStatus = sizeEval.status;
    sizeEvidence = sizeEval.evidence;

    if (sizeEval.isVerified && sizeEval.status === "in_stock") {
      sizeVerified = true;
      sizeAvailable = true;
      sizeSelectable = true;
    } else {
      sizeVerified = false;
      sizeAvailable = false;
      sizeSelectable = false;
    }
  }

  const isFullyVerified = categoryVerified && colorVerified && patternVerified && priceVerified && sizeVerified;

  let rejectReason: string | undefined = undefined;
  if (!isFullyVerified) {
    if (!categoryVerified) rejectReason = categoryEvidence;
    else if (!colorVerified) rejectReason = colorEvidence;
    else if (!patternVerified) rejectReason = patternEvidence;
    else if (!priceVerified) rejectReason = priceEvidence;
    else if (!sizeVerified) rejectReason = sizeEvidence;
    else rejectReason = "Failed to satisfy all required constraints";
  }

  return {
    elementId,
    title,
    url,
    price: priceAmount > 0 ? {
      raw: `₹${priceAmount.toLocaleString("en-IN")}`,
      amount: priceAmount,
      currency: (item.currency as any) || "INR",
    } : null,
    rating: item.rating ? {
      score: item.rating,
      maxScore: 5,
      raw: String(item.rating),
    } : undefined,
    imageUrl: item.imageUrl,
    isFullyVerified,
    rejectReason,
    conditions: {
      category: { requested: intent.entities.category, verified: categoryVerified, evidence: categoryEvidence },
      color: { requested: intent.filters.color, verified: colorVerified, evidence: colorEvidence },
      pattern: { requested: intent.filters.pattern, verified: patternVerified, evidence: patternEvidence },
      price: { maxBudget: intent.constraints.maxPrice, amount: priceAmount, verified: priceVerified, evidence: priceEvidence },
      size: { requested: intent.filters.size, available: sizeAvailable, selectable: sizeSelectable, status: sizeStatus, evidence: sizeEvidence },
    },
  };
}

/**
 * Loops through candidate products from the search results, inspecting each candidate's
 * detail page until finding verified matching products or exhausting the candidates.
 *
 * Concurrency is capped strictly at 2 simultaneous inspections.
 * Default concurrency is 2 for fast batch inspection, with sequential fallback (concurrency = 1).
 * Preserves strict rank-priority ordering to prevent network race conditions from altering results.
 */
export async function inspectCandidateProducts(
  candidates: RepeatedItem[],
  intent: StructuredIntent,
  options: InspectCandidateOptions = {}
): Promise<ProductVerificationSummary> {
  const maxCandidates = options.maxCandidates || 5;
  const timeoutMs = options.timeoutMs || 4000;
  // Concurrency capped strictly at 2, default is 2 as requested, with sequential fallback (1)
  const concurrency = Math.min(
    MAX_INSPECTION_CONCURRENCY,
    Math.max(1, options.concurrency ?? DEFAULT_INSPECTION_CONCURRENCY)
  );

  if (options.signal?.aborted) {
    return {
      inspectedCount: 0,
      fullyVerifiedProducts: [],
      rejectedProducts: [],
      bestMatch: null,
    };
  }

  // 1. Extract catalog structured data from page scripts (window.__myx, __NEXT_DATA__, ld+json)
  const catalogProducts = options.catalogProducts || extractCatalogProducts(options.doc);

  // If candidate items from DOM are missing or lack product attributes (e.g. breadcrumbs), but catalog data is present:
  let effectiveCandidates = [...candidates];
  const hasPricedCandidates = effectiveCandidates.some((c) => Boolean(c.price || c.imageUrl));
  if (!hasPricedCandidates && catalogProducts.length > 0) {
    effectiveCandidates = catalogProducts.map((p, idx) => ({
      elementId: `catalog-prod-${p.productId || idx}`,
      title: p.title,
      price: p.price > 0 ? { raw: `₹${p.price.toLocaleString("en-IN")}`, amount: p.price, currency: (p.currency as any) || "INR" } : undefined,
      rating: p.rating ? { score: p.rating, maxScore: 5, raw: String(p.rating) } : undefined,
      link: { href: p.url, text: p.title },
      imageUrl: p.imageUrl,
      bounds: { x: 0, y: 0, width: 200, height: 280 },
    }));
  }

  // 2. Deduplicate candidates using URL / stable product ID
  const seenProductIds = new Set<string>();
  const deduplicatedCandidates: RepeatedItem[] = [];
  for (const candidate of effectiveCandidates) {
    const href = candidate.link?.href || "";
    const idMatch = href.match(/\/(\d{5,12})(?:\/buy|\?|$)/);
    const key = idMatch ? idMatch[1] : href || candidate.elementId;
    if (!seenProductIds.has(key)) {
      seenProductIds.add(key);
      deduplicatedCandidates.push(candidate);
    }
  }

  // 3. Filter out items that explicitly violate category, budget, or age target
  const isChildrenRequested =
    CHILDREN_KEYWORDS_REGEX.test(intent.entities.category || "") ||
    CHILDREN_KEYWORDS_REGEX.test(intent.entities.type || "") ||
    CHILDREN_KEYWORDS_REGEX.test(intent.rawQuery || "");

  const viableCandidates = deduplicatedCandidates.filter((item) => {
    if (!item.link?.href) return false;
    const matchedCatalog = catalogProducts.length > 0
      ? findCatalogProductByUrl(catalogProducts, item.link.href)
      : null;

    // Reject clearly over-budget products before expensive verification
    const priceAmount = matchedCatalog?.price || item.price?.amount;
    if (intent.constraints.maxPrice && priceAmount && priceAmount > intent.constraints.maxPrice) {
      return false; // Skip items already known to be over budget
    }

    // Reject children's / boys / kids items when adult item requested
    const isKidsGender = matchedCatalog?.gender?.toLowerCase() === "boys" || matchedCatalog?.gender?.toLowerCase() === "girls";
    if (!isChildrenRequested && (isKidsGender || CHILDREN_KEYWORDS_REGEX.test(item.title))) {
      return false;
    }

    // Reject items matching excluded terms (e.g. brand, color, keyword)
    if (intent.filters.exclude && intent.filters.exclude.length > 0) {
      const textToScan = `${matchedCatalog?.brand || ""} ${matchedCatalog?.title || item.title}`.toLowerCase();
      for (const ex of intent.filters.exclude) {
        if (ex && textToScan.includes(ex.toLowerCase())) {
          return false;
        }
      }
    }

    // Reject obvious color/pattern mismatches
    const titleLower = (matchedCatalog?.title || item.title).toLowerCase();
    if (intent.filters.color === "red") {
      const hasRed = RED_COLOR_REGEX.test(titleLower) || (matchedCatalog?.color && RED_COLOR_REGEX.test(matchedCatalog.color));
      const hasOtherDominantColor = /\b(?:black|blue|navy|green|yellow|white|grey|gray|pink|purple|orange|brown)\b/i.test(titleLower);
      if (hasOtherDominantColor && !hasRed) {
        return false;
      }
    }
    if (intent.filters.pattern === "checked") {
      const hasChecked = CHECKED_PATTERN_REGEX.test(titleLower);
      const hasSolid = /\b(?:solid|plain|floral|striped|printed)\b/i.test(titleLower);
      if (hasSolid && !hasChecked) {
        return false;
      }
    }
    return true;
  });

  // Sort candidates based on requested criteria or default to high-rating, low-price
  if (intent.sort?.field === "price") {
    viableCandidates.sort((a, b) => {
      const pA = a.price?.amount || 999999;
      const pB = b.price?.amount || 999999;
      return intent.sort!.direction === "asc" ? pA - pB : pB - pA;
    });
  } else if (intent.sort?.field === "rating") {
    viableCandidates.sort((a, b) => {
      const rA = a.rating?.score || 0;
      const rB = b.rating?.score || 0;
      return intent.sort!.direction === "asc" ? rA - rB : rB - rA;
    });
  } else {
    viableCandidates.sort((a, b) => {
      const rA = a.rating?.score || 0;
      const rB = b.rating?.score || 0;
      if (rB !== rA) return rB - rA;
      const pA = a.price?.amount || 999999;
      const pB = b.price?.amount || 999999;
      return pA - pB;
    });
  }

  const candidatesToInspect = viableCandidates.slice(0, maxCandidates);
  const fullyVerifiedProducts: ProductVerificationResult[] = [];
  const rejectedProducts: Array<{ title: string; url?: string; reason: string }> = [];
  let inspectedCount = 0;

  // 4. Try Catalog Verification first for candidates with matched catalog data.
  // Candidates that cannot be verified directly from catalog data are gathered for PDP inspection.
  const candidatesNeedingPdp: Array<{ candidate: RepeatedItem; rankIndex: number }> = [];

  for (let idx = 0; idx < candidatesToInspect.length; idx++) {
    if (options.signal?.aborted) break;
    const candidate = candidatesToInspect[idx];
    const matchedCatalog = catalogProducts.length > 0
      ? findCatalogProductByUrl(catalogProducts, candidate.link?.href || "")
      : null;

    if (matchedCatalog) {
      const catalogResult = verifyCatalogProductAttributes(matchedCatalog, intent, candidate.elementId, candidate.link?.href);
      if (catalogResult.isFullyVerified) {
        inspectedCount++;
        fullyVerifiedProducts.push(catalogResult);
        options.onProductVerified?.(catalogResult);
        if (fullyVerifiedProducts.length >= 3) break;
        continue;
      } else {
        // Check if size is unverified (size is listed in catalog sizes, but inventory proof requires PDP)
        const sizeCond = catalogResult.conditions.size;
        if (sizeCond && sizeCond.status === "unverified" && catalogResult.conditions.category.verified && catalogResult.conditions.color.verified && catalogResult.conditions.pattern.verified && catalogResult.conditions.price.verified) {
          // Retain PDP inspection for inventory proof
          candidatesNeedingPdp.push({ candidate, rankIndex: idx });
          continue;
        } else {
          // Conclusively rejected from catalog data (e.g. out of stock, size not offered, over budget)
          inspectedCount++;
          rejectedProducts.push({
            title: candidate.title,
            url: candidate.link?.href,
            reason: catalogResult.rejectReason || "Catalog criteria not satisfied",
          });
          continue;
        }
      }
    } else {
      // No catalog metadata matched; must inspect PDP directly
      candidatesNeedingPdp.push({ candidate, rankIndex: idx });
    }
  }

  // If we already satisfied the requested verified quota (e.g. 3 verified products), or aborted, or none need PDP:
  if (fullyVerifiedProducts.length >= 3 || options.signal?.aborted || candidatesNeedingPdp.length === 0) {
    return {
      inspectedCount,
      fullyVerifiedProducts,
      rejectedProducts,
      bestMatch: fullyVerifiedProducts[0] || null,
    };
  }

  // 5. Inspect remaining candidates requiring PDP inspection
  if (concurrency === 1) {
    // Sequential Mode (Configurable Fallback)
    for (const item of candidatesNeedingPdp) {
      if (options.signal?.aborted) break;
      if (fullyVerifiedProducts.length >= 3) break;

      inspectedCount++;
      const res = await inspectProductDetail(item.candidate, intent, {
        timeoutMs,
        signal: options.signal,
        useCache: options.useCache,
      });

      if (res.isFullyVerified) {
        fullyVerifiedProducts.push(res);
        options.onProductVerified?.(res);
        if (fullyVerifiedProducts.length >= 3) break;
      } else {
        rejectedProducts.push({
          title: item.candidate.title,
          url: item.candidate.link?.href,
          reason: res.rejectReason || "Criteria not satisfied",
        });
      }
    }
  } else {
    // Concurrent Mode (Concurrency = 2 worker pool)
    const queue = [...candidatesNeedingPdp];
    const verifiedMap = new Map<number, ProductVerificationResult>();
    const rejectedMap = new Map<number, { title: string; url?: string; reason: string }>();

    async function worker() {
      while (queue.length > 0) {
        if (options.signal?.aborted) break;
        if (fullyVerifiedProducts.length + verifiedMap.size >= 3) break;

        const item = queue.shift();
        if (!item) break;
        inspectedCount++;

        try {
          const res = await inspectProductDetail(item.candidate, intent, {
            timeoutMs,
            signal: options.signal,
            useCache: options.useCache,
          });

          if (res.isFullyVerified) {
            verifiedMap.set(item.rankIndex, res);
            options.onProductVerified?.(res);
          } else {
            rejectedMap.set(item.rankIndex, {
              title: item.candidate.title,
              url: item.candidate.link?.href,
              reason: res.rejectReason || "Criteria not satisfied",
            });
          }
        } catch (err: any) {
          rejectedMap.set(item.rankIndex, {
            title: item.candidate.title,
            url: item.candidate.link?.href,
            reason: `Inspection error: ${err?.message || String(err)}`,
          });
        }
      }
    }

    // Launch exactly 2 concurrent workers (strictly bounded to max 2 simultaneous inspections)
    await Promise.all([worker(), worker()]);

    // Preserve deterministic rank priority
    const sortedVerified = Array.from(verifiedMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map((e) => e[1]);

    const sortedRejected = Array.from(rejectedMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map((e) => e[1]);

    fullyVerifiedProducts.push(...sortedVerified);
    rejectedProducts.push(...sortedRejected);
  }

  // Preserve requested sort order across all verified products
  if (intent.sort?.field === "price") {
    fullyVerifiedProducts.sort((a, b) => {
      const pA = a.price?.amount || 999999;
      const pB = b.price?.amount || 999999;
      return intent.sort!.direction === "asc" ? pA - pB : pB - pA;
    });
  } else if (intent.sort?.field === "rating") {
    fullyVerifiedProducts.sort((a, b) => {
      const rA = a.rating?.score || 0;
      const rB = b.rating?.score || 0;
      return intent.sort!.direction === "asc" ? rA - rB : rB - rA;
    });
  }

  return {
    inspectedCount,
    fullyVerifiedProducts,
    rejectedProducts,
    bestMatch: fullyVerifiedProducts[0] || null,
  };
}
