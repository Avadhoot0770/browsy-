/**
 * Generic Interactive Element Detector for Browsy Page Intelligence
 * Identifies search inputs, buttons, links, form controls, and forms without website-specific rules.
 */

import type {
  InteractiveElement,
  InteractiveElementType,
  FormInfo,
  PaginationControl,
  TableInfo,
} from "./types";
import { elementRegistry } from "./element-registry";
import { isBrowsyOwned, isElementVisible, isElementObstructed, getBounds } from "./visibility";
import { isSensitiveField, sanitizeText } from "./privacy";

const MAX_SEARCH_INPUTS = 10;
const MAX_BUTTONS = 60;
const MAX_LINKS = 60;
const MAX_INPUTS = 100;
const MAX_FORMS = 10;
const MAX_PAGINATION = 10;
const MAX_TABLES = 5;

/**
 * Traverses the DOM tree and all accessible open Shadow Roots recursively,
 * querying elements that match the selector while strictly avoiding Browsy-owned nodes.
 */
export function querySelectorAllWithShadow(selector: string, root: ParentNode = document): Element[] {
  const results: Element[] = [];

  function traverse(node: ParentNode) {
    if (!node) return;
    try {
      const elements = node.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (!isBrowsyOwned(el)) {
          results.push(el);
        }
      }
    } catch {
      // In testing environments or invalid selector fallback
    }

    // Shadow DOM traversal: only inspect potential shadow hosts rather than scanning all document nodes
    try {
      const hostCandidates = node.querySelectorAll("*:not(:defined)");
      if (hostCandidates && hostCandidates.length > 0) {
        for (let i = 0; i < hostCandidates.length; i++) {
          const child = hostCandidates[i];
          if (isBrowsyOwned(child)) continue;
          if (child.shadowRoot && !isBrowsyOwned(child.shadowRoot as unknown as Element)) {
            traverse(child.shadowRoot);
          }
        }
      }
    } catch {
      // Non-DOM or unsupported pseudo-class fallback
    }
  }

  traverse(root);
  return results;
}

/**
 * Checks whether an input element represents a search control.
 */
export function isSearchControl(element: Element): boolean {
  if (element instanceof HTMLInputElement) {
    if (element.type.toLowerCase() === "search") return true;
  }

  const role = (element.getAttribute("role") || "").toLowerCase();
  if (role === "searchbox" || role === "search") return true;

  const placeholder = (element.getAttribute("placeholder") || "").toLowerCase();
  const ariaLabel = (element.getAttribute("aria-label") || "").toLowerCase();
  const name = (element.getAttribute("name") || "").toLowerCase();
  const id = (element.getAttribute("id") || "").toLowerCase();
  const classList = (element.getAttribute("class") || "").toLowerCase();

  const signals = `${placeholder} ${ariaLabel} ${name} ${id} ${classList}`;
  return /search|find|lookup|query|explore/i.test(signals);
}

/**
 * Extracts visible label or nearest associated text for an input control.
 */
function findAssociatedLabel(element: Element): string {
  // 1. aria-label or aria-labelledby
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return sanitizeText(ariaLabel, 60);

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl && !isBrowsyOwned(labelEl)) {
      return sanitizeText(labelEl.textContent, 60);
    }
  }

  // 2. <label for="...">
  if (element.id) {
    try {
      const escapeId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(element.id) : element.id;
      const label = document.querySelector(`label[for="${escapeId}"]`);
      if (label && !isBrowsyOwned(label)) {
        return sanitizeText(label.textContent, 60);
      }
    } catch {
      // In testing environments or invalid selector fallback
    }
  }

  // 3. Parent label
  const parentLabel = element.closest("label");
  if (parentLabel && !isBrowsyOwned(parentLabel)) {
    return sanitizeText(parentLabel.textContent, 60);
  }

  // 4. Parent fieldset legend
  const fieldset = element.closest("fieldset");
  if (fieldset) {
    const legend = fieldset.querySelector("legend");
    if (legend && !isBrowsyOwned(legend)) {
      return sanitizeText(legend.textContent, 60);
    }
  }

  // 5. Title attribute
  const title = element.getAttribute("title");
  if (title) return sanitizeText(title, 60);

  // 6. Placeholder attribute
  const placeholder = element.getAttribute("placeholder");
  if (placeholder) return sanitizeText(placeholder, 60);

  return "";
}

/**
 * Detects all interactive controls in the document adhering to visibility, privacy, and performance budgets.
 */
export function detectInteractiveElements(): {
  searchInputs: InteractiveElement[];
  buttons: InteractiveElement[];
  links: InteractiveElement[];
  inputs: InteractiveElement[];
  forms: FormInfo[];
} {
  const searchInputs: InteractiveElement[] = [];
  const buttons: InteractiveElement[] = [];
  const links: InteractiveElement[] = [];
  const inputs: InteractiveElement[] = [];
  const forms: FormInfo[] = [];

  // 1. Detect Forms
  const formElements = querySelectorAllWithShadow("form, [role='form']");
  for (const formEl of formElements) {
    if (forms.length >= MAX_FORMS) break;
    if (isBrowsyOwned(formEl) || !isElementVisible(formEl)) continue;

    const elementId = elementRegistry.register(formEl);
    const subInputs = formEl.querySelectorAll("input, textarea, select");
    const subButtons = formEl.querySelectorAll("button, input[type='submit'], [role='button']");
    const hasSearchRole =
      formEl.getAttribute("role") === "search" ||
      Boolean(formEl.querySelector("input[type='search'], [role='searchbox']"));

    forms.push({
      elementId,
      name: formEl.getAttribute("name") || undefined,
      action: formEl.getAttribute("action") || undefined,
      method: (formEl.getAttribute("method") || "GET").toUpperCase(),
      inputCount: subInputs.length,
      buttonCount: subButtons.length,
      hasSearchRole,
    });
  }

  // 2. Candidate query for interactive elements across open Shadow DOM
  const candidates = querySelectorAllWithShadow(
    "button, a[href], input, textarea, select, [role='button'], [role='link'], [role='searchbox'], [role='textbox'], [role='checkbox'], [role='radio'], [role='combobox']"
  );

  for (const el of candidates) {
    if (isBrowsyOwned(el)) continue;
    if (!isElementVisible(el)) continue;

    const tagName = el.tagName.toLowerCase();
    const role = (el.getAttribute("role") || "").toLowerCase();
    const isSensitive = isSensitiveField(el);

    // Determine type
    let type: InteractiveElementType = "other";
    if (isSearchControl(el)) {
      type = "search";
    } else if (tagName === "button" || role === "button" || (tagName === "input" && ["button", "submit", "reset"].includes((el as HTMLInputElement).type))) {
      type = "button";
    } else if (tagName === "a" || role === "link") {
      type = "link";
    } else if (tagName === "select" || role === "combobox") {
      type = "select";
    } else if (tagName === "input" && (el as HTMLInputElement).type === "checkbox") {
      type = "checkbox";
    } else if (tagName === "input" && (el as HTMLInputElement).type === "radio") {
      type = "radio";
    } else if (tagName === "textarea" || (tagName === "input" && (el as HTMLInputElement).type === "text")) {
      type = "input";
    } else if (tagName === "input") {
      type = "input";
    }

    const bounds = getBounds(el);
    const elementId = elementRegistry.register(el);
    const text = isSensitive ? "[PROTECTED]" : sanitizeText(el.textContent, 80);
    const placeholder = el.getAttribute("placeholder") ? sanitizeText(el.getAttribute("placeholder"), 60) : undefined;
    const ariaLabel = el.getAttribute("aria-label") ? sanitizeText(el.getAttribute("aria-label"), 60) : undefined;
    const name = el.getAttribute("name") || undefined;
    const href = tagName === "a" ? (el as HTMLAnchorElement).href : undefined;
    const disabled = (el as HTMLButtonElement | HTMLInputElement).disabled || el.getAttribute("aria-disabled") === "true";
    const nearbyLabel = findAssociatedLabel(el) || undefined;

    // Form relationship
    const formEl = (el as HTMLInputElement).form || el.closest("form");
    const formId = formEl?.id || (formEl?.getAttribute("name") ? `form-${formEl.getAttribute("name")}` : undefined);
    const formName = formEl?.getAttribute("name") || undefined;
    const isObstructed = isElementObstructed(el);

    const item: InteractiveElement = {
      elementId,
      type,
      role: role || tagName,
      tagName,
      text,
      ariaLabel,
      placeholder,
      name,
      href,
      disabled,
      bounds,
      nearbyLabel,
      formId,
      formName,
      isObstructed,
    };

    if (tagName === "input") {
      item.inputType = (el as HTMLInputElement).type;
      if (type === "checkbox" || type === "radio") {
        item.checked = (el as HTMLInputElement).checked;
      }
    } else if (tagName === "select") {
      const selectEl = el as HTMLSelectElement;
      item.options = Array.from(selectEl.options)
        .slice(0, 10)
        .map((opt) => sanitizeText(opt.text, 40));
    }

    // Bucket into categories with caps
    if (type === "search" && searchInputs.length < MAX_SEARCH_INPUTS) {
      searchInputs.push(item);
    } else if (type === "button" && buttons.length < MAX_BUTTONS) {
      buttons.push(item);
    } else if (type === "link" && links.length < MAX_LINKS) {
      // Prioritize non-empty links
      if (text || ariaLabel) {
        links.push(item);
      }
    } else if (["input", "textarea", "select", "checkbox", "radio", "other"].includes(type) && inputs.length < MAX_INPUTS) {
      inputs.push(item);
    }
  }

  return {
    searchInputs,
    buttons,
    links,
    inputs,
    forms,
  };
}

/**
 * Detects pagination controls and structured data tables across the page and open Shadow DOM.
 */
export function detectPaginationAndTables(): {
  pagination: PaginationControl[];
  tables: TableInfo[];
} {
  const pagination: PaginationControl[] = [];
  const tables: TableInfo[] = [];

  // 1. Pagination Controls
  const paginationNodes = querySelectorAllWithShadow(
    "nav[aria-label*='pagination' i] a, nav[aria-label*='pagination' i] button, [role='navigation'] a, [role='navigation'] button, .pagination a, .pagination button, [aria-label*='next' i], [aria-label*='prev' i], a[rel='next'], a[rel='prev']"
  );

  for (const node of paginationNodes) {
    if (pagination.length >= MAX_PAGINATION) break;
    if (isBrowsyOwned(node) || !isElementVisible(node)) continue;

    const text = sanitizeText(node.textContent, 30);
    const ariaLabel = (node.getAttribute("aria-label") || "").toLowerCase();
    const rel = (node.getAttribute("rel") || "").toLowerCase();

    let pageType: "next" | "prev" | "page" = "page";
    let pageNum: number | undefined;

    if (rel === "next" || ariaLabel.includes("next") || /^(?:next|>|»)/i.test(text)) {
      pageType = "next";
    } else if (rel === "prev" || ariaLabel.includes("prev") || /^(?:prev|previous|<|«)/i.test(text)) {
      pageType = "prev";
    } else {
      const numMatch = text.match(/\b\d+\b/);
      if (numMatch) {
        pageNum = parseInt(numMatch[0], 10);
      }
    }

    const elementId = elementRegistry.register(node);
    pagination.push({
      elementId,
      type: pageType,
      pageNumber: pageNum,
      text: text || ariaLabel || pageType,
    });
  }

  // 2. Data Tables
  const tableNodes = querySelectorAllWithShadow("table, [role='table'], [role='grid']");
  for (const tbl of tableNodes) {
    if (tables.length >= MAX_TABLES) break;
    if (isBrowsyOwned(tbl) || !isElementVisible(tbl)) continue;

    const rows = tbl.querySelectorAll("tr, [role='row']");
    const headerCells = tbl.querySelectorAll("th, [role='columnheader']");
    const headers = Array.from(headerCells)
      .slice(0, 10)
      .map((h) => sanitizeText(h.textContent, 40))
      .filter(Boolean);

    const firstRowCells = rows[0]?.querySelectorAll("td, th, [role='cell'], [role='columnheader']");
    const colCount = headers.length > 0 ? headers.length : (firstRowCells?.length || 0);

    const elementId = elementRegistry.register(tbl);
    tables.push({
      elementId,
      rowCount: rows.length,
      columnCount: colCount,
      headers,
    });
  }

  return { pagination, tables };
}
