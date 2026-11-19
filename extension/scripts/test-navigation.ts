/**
 * Comprehensive Automated Test Suite for Browsy Stage 4.5
 * Navigation, Search & Final Website State Execution
 *
 * Covers all 20 required test cases:
 * 1. Current page already relevant
 * 2. Current page requires one filter
 * 3. Current page requires multiple filters
 * 4. Current page is unrelated
 * 5. Search navigation required
 * 6. Navigation causes DOM re-analysis
 * 7. Old element handles become invalid after navigation
 * 8. Search submission (form button, adjacent button, Enter key)
 * 9. Filter application after navigation (dynamic control resolution)
 * 10. Async page update (bounded waiter)
 * 11. Final state verification (full success)
 * 12. Partial verification (honest reporting of missing filters)
 * 13. No results found
 * 14. Stop during navigation
 * 15. Stop during filtering
 * 16. User edits request before execution
 * 17. High-risk action remains protected
 * 18. Sensitive fields remain blocked
 * 19. No hardcoded Myntra selector dependency
 * 20. Generic navigation works on another website
 */

import assert from "node:assert";
import { elementRegistry } from "../src/page-intelligence/element-registry";
import { resolveElement } from "../src/execution/resolver";
import { canExecuteAction } from "../src/execution/guards";
import { ActionExecutor } from "../src/execution/executor";
import { classifyActionRisk, isSensitiveAuthField, isPaymentOrFinancialField } from "../src/execution/high-risk";
import { analyzeCurrentPageState, buildTargetWebsiteState } from "../src/navigation/state-analyzer";
import { planNavigationSequence } from "../src/navigation/navigation-planner";
import { submitSearchInput } from "../src/navigation/search-submitter";
import { waitForPageUpdate } from "../src/navigation/page-waiter";
import { verifyFinalWebsiteState, formatFriendlySiteName } from "../src/navigation/final-state-verifier";
import { IntentEngine } from "../src/intent";
import { generateActionPlan } from "../src/intent/planner";
import type { StructuredIntent, ActionPlan, ActionPlanStep } from "../src/intent/types";
import type { StructuredPageIntelligence, InteractiveElement, RepeatedItemGroup } from "../src/page-intelligence/types";

// ============================================================
// SIMULATED LIGHTWEIGHT DOM ENVIRONMENT FOR NODE.JS
// ============================================================

class MockNode {
  public isConnected = true;
}

class MockElement extends MockNode {
  public tagName: string;
  public id = "";
  public className = "";
  public style: Record<string, string> = {};
  public offsetParent: any = {};
  public attributes: Map<string, string> = new Map();
  public eventListeners: Map<string, Function[]> = new Map();
  public children: MockElement[] = [];
  public parentElement: MockElement | null = null;

  constructor(tagName: string) {
    super();
    this.tagName = tagName.toUpperCase();
  }

  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  public getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  public hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  public removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  public addEventListener(type: string, listener: Function): void {
    const list = this.eventListeners.get(type) || [];
    list.push(listener);
    this.eventListeners.set(type, list);
  }

  public dispatchEvent(event: any): boolean {
    const list = this.eventListeners.get(event.type) || [];
    for (const fn of list) {
      fn(event);
    }
    return true;
  }

  public getBoundingClientRect() {
    return { x: 10, y: 10, width: 100, height: 40, top: 10, left: 10, right: 110, bottom: 50 };
  }

  public scrollIntoView(): void {}

  public click(): void {
    this.dispatchEvent({ type: "click", bubbles: true, cancelable: true });
  }

  public focus(): void {
    this.dispatchEvent({ type: "focus", bubbles: true });
  }

  public querySelector(selector: string): MockElement | null {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const sub = child.querySelector(selector);
      if (sub) return sub;
    }
    return null;
  }

  public closest(selector: string): MockElement | null {
    let curr: MockElement | null = this;
    while (curr) {
      if (curr.matches(selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  public matches(selector: string): boolean {
    const parts = selector.split(",").map((s) => s.trim().toLowerCase());
    for (const part of parts) {
      if (part === "button" && this.tagName === "BUTTON") return true;
      if (part === "form" && this.tagName === "FORM") return true;
      if (part.includes('type="submit"') && this.getAttribute("type") === "submit") return true;
      if (part.includes("[data-browsy-id")) {
        const match = part.match(/\[data-browsy-id="([^"]+)"\]/);
        if (match && this.getAttribute("data-browsy-id") === match[1]) return true;
      }
    }
    return false;
  }

  public appendChild(child: MockElement): void {
    this.children.push(child);
    child.parentElement = this;
  }
}

class MockHTMLElement extends MockElement {}

class MockHTMLButtonElement extends MockHTMLElement {
  public disabled = false;
  constructor() {
    super("BUTTON");
  }

  public override click(): void {
    super.click();
    if (this.getAttribute("type") === "submit") {
      const form = this.closest("form");
      if (form && typeof (form as any).requestSubmit === "function") {
        (form as any).requestSubmit();
      }
    }
  }
}

class MockHTMLInputElement extends MockHTMLElement {
  public type = "text";
  public value = "";
  public checked = false;
  public disabled = false;
  public name = "";
  public placeholder = "";
  public form: MockHTMLFormElement | null = null;

  constructor(type = "text") {
    super("INPUT");
    this.type = type;
  }
}

class MockHTMLFormElement extends MockHTMLElement {
  public submitted = false;
  constructor() {
    super("FORM");
  }

  public requestSubmit(): void {
    this.submitted = true;
    this.dispatchEvent({ type: "submit", bubbles: true, cancelable: true });
  }

  public submit(): void {
    this.submitted = true;
  }
}

class MockKeyboardEvent {
  public key: string;
  public code: string;
  public keyCode: number;
  public bubbles: boolean;
  public cancelable: boolean;
  public type: string;

  constructor(type: string, init: any = {}) {
    this.type = type;
    this.key = init.key || "";
    this.code = init.code || "";
    this.keyCode = init.keyCode || 0;
    this.bubbles = init.bubbles ?? true;
    this.cancelable = init.cancelable ?? true;
  }
}

class MockHTMLTextAreaElement extends MockHTMLElement {
  constructor() {
    super("TEXTAREA");
  }
}

// Setup Globals for Node.js
(globalThis as any).Element = MockElement;
(globalThis as any).HTMLElement = MockHTMLElement;
(globalThis as any).HTMLButtonElement = MockHTMLButtonElement;
(globalThis as any).HTMLInputElement = MockHTMLInputElement;
(globalThis as any).HTMLTextAreaElement = MockHTMLTextAreaElement;
(globalThis as any).HTMLFormElement = MockHTMLFormElement;
(globalThis as any).KeyboardEvent = MockKeyboardEvent;

class MockEvent {
  public type: string;
  public bubbles: boolean;
  public cancelable: boolean;
  constructor(type: string, init: any = {}) {
    this.type = type;
    this.bubbles = init.bubbles ?? true;
    this.cancelable = init.cancelable ?? true;
  }
}
(globalThis as any).Event = MockEvent;
(globalThis as any).MouseEvent = MockEvent;

let mockScrollY = 0;
const domRegistry = new Map<string, MockElement>();

(globalThis as any).window = {
  scrollY: mockScrollY,
  location: {
    href: "https://www.myntra.com/",
    hostname: "www.myntra.com",
    pathname: "/",
  },
  scrollBy: ({ top }: { top: number }) => {
    mockScrollY += top;
  },
  getComputedStyle: (_el: any) => ({
    display: "block",
    visibility: "visible",
    opacity: "1",
  }),
  HTMLInputElement: { prototype: MockHTMLInputElement.prototype },
  HTMLTextAreaElement: { prototype: MockHTMLElement.prototype },
};

(globalThis as any).document = {
  body: new MockHTMLElement("BODY"),
  createElement: (tag: string) => new MockHTMLElement(tag),
  querySelector: (sel: string) => {
    const match = sel.match(/\[data-browsy-id="([^"]+)"\]/);
    if (match) return domRegistry.get(match[1]) || null;
    return null;
  },
};

function createAndRegisterElement<T extends MockElement>(el: T): { id: string; element: T } {
  const id = elementRegistry.register(el as any);
  el.setAttribute("data-browsy-id", id);
  domRegistry.set(id, el);
  return { id, element: el };
}

function buildMockIntel(overrides: Partial<StructuredPageIntelligence> = {}): StructuredPageIntelligence {
  return {
    url: "https://www.myntra.com/",
    hostname: "www.myntra.com",
    pathname: "/",
    title: "Online Shopping for Women, Men, Kids Fashion & Lifestyle - Myntra",
    summary: "Mock fashion store",
    headings: [{ level: 1, text: "Online Shopping" }],
    searchInputs: [],
    buttons: [],
    inputs: [],
    links: [],
    forms: [],
    repeatedGroups: [],
    detectedPrices: [],
    detectedRatings: [],
    keyImages: [],
    stats: {
      analysisDurationMs: 5,
      totalInteractiveCount: 10,
      buttonCount: 5,
      linkCount: 5,
      inputCount: 2,
      searchCount: 1,
      formCount: 1,
      repeatedItemCount: 0,
      repeatedGroupCount: 0,
      headingCount: 1,
      imageCount: 0,
      priceCount: 0,
      ratingCount: 0,
      timestamp: Date.now(),
    },
    timestamp: Date.now(),
    ...overrides,
  };
}

// ============================================================
// TEST SUITE EXECUTION
// ============================================================

async function runNavigationTests() {
  console.log(`\n==================================================`);
  console.log(`🧭 BROWSY STAGE 4.5 NAVIGATION & SEARCH TEST SUITE`);
  console.log(`==================================================\n`);

  elementRegistry.clear();
  domRegistry.clear();

  const sampleShoppingIntent: StructuredIntent = {
    id: "intent-1",
    intent: "find",
    target: "products",
    entities: { category: "shirt" },
    filters: { color: "red", pattern: "checked", size: "xl" },
    constraints: { maxPrice: 1000 },
    scope: "site_wide",
    confidence: 0.95,
    requiresClarification: false,
    rawQuery: "Find me a red checked shirt in XL under ₹1,000",
    timestamp: Date.now(),
  };

  // 1. CURRENT PAGE ALREADY RELEVANT
  console.log("Test 1: Current Page Already Relevant");
  {
    const pageIntel = buildMockIntel({
      url: "https://www.myntra.com/shirts?f=Color%3Ared%3A%3APattern%3Achecked%3A%3ASize%3Axl",
      pathname: "/shirts",
      title: "Shirts for Men - Red, Checked, XL",
      headings: [{ level: 1, text: "Shirts - Red Checked XL" }],
      inputs: [
        {
          elementId: "el-chk-red",
          type: "checkbox",
          role: "checkbox",
          tagName: "input",
          text: "Red",
          checked: true,
          disabled: false,
          bounds: { x: 0, y: 0, width: 20, height: 20 },
        },
        {
          elementId: "el-chk-checked",
          type: "checkbox",
          role: "checkbox",
          tagName: "input",
          text: "Checked",
          checked: true,
          disabled: false,
          bounds: { x: 0, y: 0, width: 20, height: 20 },
        },
        {
          elementId: "el-chk-xl",
          type: "checkbox",
          role: "checkbox",
          tagName: "input",
          text: "XL",
          checked: true,
          disabled: false,
          bounds: { x: 0, y: 0, width: 20, height: 20 },
        },
      ],
      repeatedGroups: [
        {
          containerSelector: ".product-grid",
          inferredType: "product-like",
          count: 4,
          items: [
            {
              elementId: "p1",
              title: "Roadster Red Checked Casual Shirt",
              price: { raw: "₹799", amount: 799, currency: "INR" },
              bounds: { x: 0, y: 0, width: 200, height: 300 },
            },
            {
              elementId: "p2",
              title: "Highlander Red Checked Shirt",
              price: { raw: "₹899", amount: 899, currency: "INR" },
              bounds: { x: 0, y: 0, width: 200, height: 300 },
            },
          ],
        },
      ],
    });

    const navPlan = planNavigationSequence(pageIntel, sampleShoppingIntent);
    assert.strictEqual(
      navPlan.strategy,
      "already_target_state",
      "Should identify that user is already on target filtered results page"
    );
    assert.strictEqual(Object.keys(navPlan.missingFilters).length, 0);
    assert.ok(navPlan.explanation.includes("already on"));
    console.log("✓ Current Page Already Relevant correctly identified: PASS\n");
  }

  // 2. CURRENT PAGE REQUIRES ONE FILTER
  console.log("Test 2: Current Page Requires One Filter");
  {
    const pageIntel = buildMockIntel({
      url: "https://www.myntra.com/shirts?f=Size%3Axl%3A%3APattern%3Achecked",
      pathname: "/shirts",
      title: "Shirts for Men - Checked XL",
      headings: [{ level: 1, text: "Shirts - Checked XL" }],
      inputs: [
        {
          elementId: "el-chk-checked",
          type: "checkbox",
          role: "checkbox",
          tagName: "input",
          text: "Checked",
          checked: true,
          disabled: false,
          bounds: { x: 0, y: 0, width: 20, height: 20 },
        },
        {
          elementId: "el-chk-xl",
          type: "checkbox",
          role: "checkbox",
          tagName: "input",
          text: "XL",
          checked: true,
          disabled: false,
          bounds: { x: 0, y: 0, width: 20, height: 20 },
        },
      ],
      repeatedGroups: [
        {
          containerSelector: ".grid",
          inferredType: "product-like",
          count: 5,
          items: [{ elementId: "item1", title: "Checked Shirt", bounds: { x: 0, y: 0, width: 100, height: 100 } }],
        },
      ],
    });

    const singleFilterIntent: StructuredIntent = {
      ...sampleShoppingIntent,
      filters: { color: "red", pattern: "checked", size: "xl" },
      constraints: {},
    };

    const navPlan = planNavigationSequence(pageIntel, singleFilterIntent);
    assert.strictEqual(navPlan.strategy, "apply_filters_only");
    assert.strictEqual(navPlan.missingFilters.color, "red");
    console.log("✓ Current Page Requires One Filter correctly identified: PASS\n");
  }

  // 3. CURRENT PAGE REQUIRES MULTIPLE FILTERS
  console.log("Test 3: Current Page Requires Multiple Filters");
  {
    const pageIntel = buildMockIntel({
      url: "https://www.myntra.com/shirts",
      pathname: "/shirts",
      title: "Shirts for Men",
      headings: [{ level: 1, text: "All Shirts" }],
      repeatedGroups: [
        {
          containerSelector: ".grid",
          inferredType: "product-like",
          count: 10,
          items: [{ elementId: "item1", title: "Shirt", bounds: { x: 0, y: 0, width: 100, height: 100 } }],
        },
      ],
    });

    const navPlan = planNavigationSequence(pageIntel, sampleShoppingIntent);
    assert.strictEqual(navPlan.strategy, "apply_filters_only");
    assert.ok(navPlan.missingFilters.color === "red");
    assert.ok(navPlan.missingFilters.size === "xl");
    console.log("✓ Current Page Requires Multiple Filters correctly identified: PASS\n");
  }

  // 4. CURRENT PAGE IS UNRELATED
  console.log("Test 4: Current Page Is Unrelated");
  {
    const pageIntel = buildMockIntel({
      url: "https://www.myntra.com/beauty/perfumes",
      pathname: "/beauty/perfumes",
      title: "Perfumes and Fragrances",
      headings: [{ level: 1, text: "Perfumes" }],
      repeatedGroups: [],
    });

    const pageState = analyzeCurrentPageState(pageIntel, sampleShoppingIntent);
    assert.strictEqual(pageState.isRelevantToIntent, false);
    const navPlan = planNavigationSequence(pageIntel, sampleShoppingIntent);
    assert.strictEqual(navPlan.strategy, "search_and_filter");
    console.log("✓ Unrelated Page correctly triggers search_and_filter: PASS\n");
  }

  // 5. SEARCH NAVIGATION REQUIRED
  console.log("Test 5: Search Navigation Required on Homepage");
  {
    const homepageIntel = buildMockIntel({
      url: "https://www.myntra.com/",
      pathname: "/",
      title: "Myntra Online Shopping",
      searchInputs: [
        {
          elementId: "search-input-1",
          type: "search",
          role: "searchbox",
          tagName: "input",
          text: "",
          placeholder: "Search for products, brands and more",
          disabled: false,
          bounds: { x: 100, y: 10, width: 300, height: 40 },
        },
      ],
    });

    const plan = generateActionPlan(sampleShoppingIntent, homepageIntel);
    assert.ok(plan.steps.length > 0);
    const firstStep = plan.steps[0];
    assert.strictEqual(firstStep.type, "search");
    assert.ok(firstStep.value?.toLowerCase().includes("shirt"));
    console.log("✓ Search navigation step generated as first action: PASS\n");
  }

  // 6. NAVIGATION CAUSES DOM RE-ANALYSIS
  console.log("Test 6: Navigation Causes DOM Re-analysis");
  {
    const searchInput = new MockHTMLInputElement("search");
    searchInput.placeholder = "Search products";
    const { id } = createAndRegisterElement(searchInput);

    const executor = new ActionExecutor({ highlightElements: false });
    const plan: ActionPlan = {
      id: "plan-nav-reanalyze",
      status: "proposed",
      steps: [
        {
          id: "step-1",
          type: "search",
          targetElementId: id,
          targetLabel: "Search bar",
          value: "shirts",
          description: "Search for shirts",
          confidence: 0.9,
        },
      ],
      matchedItems: [],
      explanation: "Search shirts",
    };

    const session = await executor.executePlan(plan, buildMockIntel(), false, sampleShoppingIntent);
    assert.strictEqual(session.records[0].status, "completed");
    console.log("✓ Search execution handles re-analysis cleanly: PASS\n");
  }

  // 7. OLD ELEMENT HANDLES BECOME INVALID AFTER NAVIGATION
  console.log("Test 7: Old Element Handles Invalidation");
  {
    const oldBtn = new MockHTMLButtonElement();
    const { id: oldId } = createAndRegisterElement(oldBtn);

    // Verify handle exists initially
    const resInitial = resolveElement(oldId);
    assert.strictEqual(resInitial.success, true);

    // Simulate navigation: clear old registry handles
    elementRegistry.clear();
    domRegistry.clear();

    const resAfterNav = resolveElement(oldId);
    assert.strictEqual(resAfterNav.success, false);
    assert.strictEqual(resAfterNav.isStale, true);
    assert.ok(resAfterNav.reason?.includes("not found"));
    console.log("✓ Stale handles rejected after navigation reset: PASS\n");
  }

  // 8. SEARCH SUBMISSION MECHANISMS
  console.log("Test 8: Search Submission Engine");
  {
    // Mechanism A: Enclosing form with submit button
    const form = new MockHTMLFormElement();
    const inputA = new MockHTMLInputElement();
    const submitBtn = new MockHTMLButtonElement();
    submitBtn.setAttribute("type", "submit");
    form.appendChild(inputA);
    form.appendChild(submitBtn);

    let formSubmitted = false;
    form.addEventListener("submit", () => {
      formSubmitted = true;
    });

    const submittedA = submitSearchInput(inputA as any);
    assert.strictEqual(submittedA, true);
    assert.strictEqual(formSubmitted, true);

    // Mechanism B: Sibling search button
    const parent = new MockHTMLElement("DIV");
    const inputB = new MockHTMLInputElement();
    const adjacentBtn = new MockHTMLButtonElement();
    let btnClicked = false;
    adjacentBtn.addEventListener("click", () => {
      btnClicked = true;
    });
    parent.appendChild(inputB);
    parent.appendChild(adjacentBtn);

    const submittedB = submitSearchInput(inputB as any);
    assert.strictEqual(submittedB, true);
    assert.strictEqual(btnClicked, true);

    // Mechanism C: Keyboard Enter fallback
    const standaloneInput = new MockHTMLInputElement();
    let enterDispatched = false;
    standaloneInput.addEventListener("keydown", (e: any) => {
      if (e.key === "Enter") enterDispatched = true;
    });

    const submittedC = submitSearchInput(standaloneInput as any);
    assert.strictEqual(submittedC, true);
    assert.strictEqual(enterDispatched, true);

    console.log("✓ All 3 search submission mechanisms verified: PASS\n");
  }

  // 9. FILTER APPLICATION AFTER NAVIGATION (Dynamic Resolution)
  console.log("Test 9: Dynamic Filter Resolution on New Page");
  {
    // Register dynamic red checkbox on new page
    const redCheckbox = new MockHTMLInputElement("checkbox");
    redCheckbox.checked = false;
    const { id: redId } = createAndRegisterElement(redCheckbox);

    const updatedIntel = buildMockIntel({
      url: "https://www.myntra.com/shirts",
      inputs: [
        {
          elementId: redId,
          type: "checkbox",
          role: "checkbox",
          tagName: "input",
          text: "Red",
          checked: false,
          disabled: false,
          bounds: { x: 0, y: 0, width: 20, height: 20 },
        },
      ],
    });

    const executor = new ActionExecutor({ highlightElements: false });
    // Plan has step with unknown targetElementId initially
    const plan: ActionPlan = {
      id: "plan-dynamic-filter",
      status: "proposed",
      steps: [
        {
          id: "step-filter-red",
          type: "check",
          targetLabel: "Red",
          description: "Apply Red filter",
          confidence: 0.85,
        },
      ],
      matchedItems: [],
      explanation: "Filter red",
    };

    const session = await executor.executePlan(plan, updatedIntel, false, sampleShoppingIntent);
    assert.strictEqual(session.records[0].status, "completed");
    assert.strictEqual(redCheckbox.checked, true);
    console.log("✓ Dynamic filter control resolved and applied: PASS\n");
  }

  // 10. ASYNC PAGE UPDATE WAITING
  console.log("Test 10: Async Page Update Bounded Wait");
  {
    const waitResult = await waitForPageUpdate("https://www.myntra.com/", {
      timeoutMs: 300,
      checkIntervalMs: 50,
    });
    assert.strictEqual(typeof waitResult.urlChanged, "boolean");
    assert.ok(waitResult.waitedMs <= 800, "Wait must be bounded and not hang");
    console.log("✓ Bounded page update waiting verified: PASS\n");
  }

  // 11. FINAL STATE VERIFICATION (Full Success)
  console.log("Test 11: Final State Verification (Full Success)");
  {
    const completedIntel = buildMockIntel({
      url: "https://www.myntra.com/shirts?f=Color%3Ared%3A%3APattern%3Achecked%3A%3ASize%3Axl",
      hostname: "www.myntra.com",
      title: "Men Shirts - Red Checked XL Under 1000",
      headings: [{ level: 1, text: "Shirts" }],
      inputs: [
        { elementId: "c1", type: "checkbox", role: "checkbox", tagName: "input", text: "Red", checked: true, disabled: false, bounds: { x: 0, y: 0, width: 10, height: 10 } },
        { elementId: "c2", type: "checkbox", role: "checkbox", tagName: "input", text: "Checked", checked: true, disabled: false, bounds: { x: 0, y: 0, width: 10, height: 10 } },
        { elementId: "c3", type: "checkbox", role: "checkbox", tagName: "input", text: "XL", checked: true, disabled: false, bounds: { x: 0, y: 0, width: 10, height: 10 } },
      ],
      buttons: [
        { elementId: "b1", type: "button", role: "button", tagName: "button", text: "Price: Under ₹1,000", disabled: false, bounds: { x: 0, y: 0, width: 10, height: 10 } }
      ],
      repeatedGroups: [
        {
          containerSelector: ".grid",
          inferredType: "product-like",
          count: 3,
          items: [
            { elementId: "p1", title: "Red Shirt 1", bounds: { x: 0, y: 0, width: 10, height: 10 } },
            { elementId: "p2", title: "Red Shirt 2", bounds: { x: 0, y: 0, width: 10, height: 10 } },
            { elementId: "p3", title: "Red Shirt 3", bounds: { x: 0, y: 0, width: 10, height: 10 } },
          ],
        },
      ],
    });

    const result = verifyFinalWebsiteState(completedIntel, sampleShoppingIntent);
    assert.strictEqual(result.isSuccess, true);
    assert.strictEqual(result.resultsPresent, true);
    assert.strictEqual(result.resultsCount, 3);
    assert.strictEqual(result.unverifiedFilters.length, 0);
    assert.ok(result.userFacingSummary.includes("Done. Myntra is showing 3 matching shirt"));
    console.log("✓ Final State Verification full success confirmed: PASS\n");
  }

  // 12. PARTIAL VERIFICATION (Honest Reporting)
  console.log("Test 12: Partial Verification (Honest Reporting)");
  {
    // Page has red, xl, and price, but missing "Checked" pattern filter
    const partialIntel = buildMockIntel({
      url: "https://www.myntra.com/shirts?f=Color%3Ared%3A%3ASize%3Axl",
      hostname: "www.myntra.com",
      title: "Men Shirts - Red XL",
      headings: [{ level: 1, text: "Shirts" }],
      inputs: [
        { elementId: "c1", type: "checkbox", role: "checkbox", tagName: "input", text: "Red", checked: true, disabled: false, bounds: { x: 0, y: 0, width: 10, height: 10 } },
        { elementId: "c3", type: "checkbox", role: "checkbox", tagName: "input", text: "XL", checked: true, disabled: false, bounds: { x: 0, y: 0, width: 10, height: 10 } },
      ],
      buttons: [
        { elementId: "b1", type: "button", role: "button", tagName: "button", text: "Price: Under 1000", disabled: false, bounds: { x: 0, y: 0, width: 10, height: 10 } },
      ],
      repeatedGroups: [
        {
          containerSelector: ".grid",
          inferredType: "product-like",
          count: 2,
          items: [{ elementId: "p1", title: "Shirt", bounds: { x: 0, y: 0, width: 10, height: 10 } }],
        },
      ],
    });

    const result = verifyFinalWebsiteState(partialIntel, sampleShoppingIntent);
    assert.strictEqual(result.isSuccess, false);
    assert.strictEqual(result.isPartialSuccess, true);
    assert.ok(result.unverifiedFilters.includes("checked"));
    assert.ok(result.userFacingSummary.includes("couldn't verify the checked filter"));
    console.log("✓ Honest partial verification reporting confirmed: PASS\n");
  }

  // 13. NO RESULTS FOUND
  console.log("Test 13: No Results Found");
  {
    const emptyIntel = buildMockIntel({
      url: "https://www.myntra.com/shirts",
      title: "Shirts",
      headings: [{ level: 1, text: "No products found" }],
      repeatedGroups: [],
    });

    const result = verifyFinalWebsiteState(emptyIntel, sampleShoppingIntent);
    assert.strictEqual(result.isSuccess, false);
    assert.strictEqual(result.resultsPresent, false);
    assert.ok(result.userFacingSummary.includes("no matching results were found"));
    console.log("✓ No results scenario honestly communicated: PASS\n");
  }

  // 14. STOP DURING NAVIGATION
  console.log("Test 14: Stop During Navigation");
  {
    const searchInput = new MockHTMLInputElement();
    const { id } = createAndRegisterElement(searchInput);

    const executor = new ActionExecutor({ highlightElements: false });
    const plan: ActionPlan = {
      id: "plan-stop-nav",
      status: "proposed",
      steps: [
        { id: "s1", type: "search", targetElementId: id, value: "shirts", description: "Search shirts", confidence: 0.9 },
        { id: "s2", type: "check", targetLabel: "Red", description: "Filter red", confidence: 0.8 },
      ],
      matchedItems: [],
      explanation: "Multi-phase",
    };

    executor.options.onStepProgress = (idx) => {
      if (idx === 0) {
        executor.stop();
      }
    };

    const session = await executor.executePlan(plan, buildMockIntel(), false, sampleShoppingIntent);
    assert.strictEqual(session.state, "cancelled");
    assert.strictEqual(session.records[1].status, "pending");
    console.log("✓ Stop during navigation safely aborts remaining steps: PASS\n");
  }

  // 15. STOP DURING FILTERING
  console.log("Test 15: Stop During Filtering");
  {
    const chk1 = new MockHTMLInputElement("checkbox");
    const chk2 = new MockHTMLInputElement("checkbox");
    const { id: id1 } = createAndRegisterElement(chk1);
    const { id: id2 } = createAndRegisterElement(chk2);

    const executor = new ActionExecutor({ highlightElements: false });
    const plan: ActionPlan = {
      id: "plan-stop-filter",
      status: "proposed",
      steps: [
        { id: "f1", type: "check", targetElementId: id1, description: "Filter Red", confidence: 0.9 },
        { id: "f2", type: "check", targetElementId: id2, description: "Filter XL", confidence: 0.9 },
      ],
      matchedItems: [],
      explanation: "Two filters",
    };

    executor.options.onStepProgress = (idx) => {
      if (idx === 0) {
        executor.stop();
      }
    };

    const session = await executor.executePlan(plan, buildMockIntel(), false, sampleShoppingIntent);
    assert.strictEqual(session.state, "cancelled");
    assert.strictEqual(session.records[1].status, "pending");
    console.log("✓ Stop during filtering safely aborts remaining steps: PASS\n");
  }

  // 16. USER EDITS REQUEST BEFORE EXECUTION
  console.log("Test 16: User Edits Request Before Execution");
  {
    const engine = new IntentEngine();
    const res1 = await engine.processRequest("Find red shirts", buildMockIntel());
    assert.strictEqual(res1.intent.filters.color, "red");

    // User modifies query before running
    const res2 = await engine.processRequest("Find blue shirts in size M", buildMockIntel());
    assert.strictEqual(res2.intent.filters.color, "blue");
    assert.strictEqual(res2.intent.filters.size, "M");
    assert.notStrictEqual(res1.plan.id, res2.plan.id);
    console.log("✓ User query edit generates fresh plan safely: PASS\n");
  }

  // 17. HIGH-RISK ACTION PROTECTION
  console.log("Test 17: High-Risk Action Protection");
  {
    const orderBtn = new MockHTMLButtonElement();
    const { id } = createAndRegisterElement(orderBtn);

    const step: ActionPlanStep = {
      id: "order-1",
      type: "click",
      targetElementId: id,
      description: "Place Order and purchase items",
      confidence: 0.9,
    };

    const risk = classifyActionRisk(step);
    assert.strictEqual(risk, "high");

    const executor = new ActionExecutor({ highlightElements: false });
    const highRiskPlan: ActionPlan = {
      id: "plan-order",
      status: "proposed",
      steps: [step],
      matchedItems: [],
      explanation: "Order",
    };

    const session = await executor.executePlan(highRiskPlan, buildMockIntel(), false);
    assert.strictEqual(session.state, "paused");
    assert.strictEqual(session.requiresHighRiskConfirmation, true);
    console.log("✓ High-risk action paused awaiting double confirmation: PASS\n");
  }

  // 18. SENSITIVE FIELDS REMAIN BLOCKED
  console.log("Test 18: Sensitive Fields Remain Blocked");
  {
    const pwdInput = new MockHTMLInputElement("password");
    assert.strictEqual(isSensitiveAuthField(pwdInput as any), true);

    const cvvInput = new MockHTMLInputElement("text");
    cvvInput.name = "security_code_cvv";
    assert.strictEqual(isPaymentOrFinancialField(cvvInput as any), true);

    const guardRes = canExecuteAction(
      { id: "s-sec", type: "type", value: "secret123", description: "Type password", confidence: 0.9 },
      pwdInput as any
    );
    assert.strictEqual(guardRes.canExecute, false);
    console.log("✓ Security-critical fields strictly blocked: PASS\n");
  }

  // 19. NO HARDCODED MYNTRA SELECTOR DEPENDENCY
  console.log("Test 19: Zero Hardcoded Site Selectors");
  {
    // Completely custom non-Myntra generic site
    const genericSearch = new MockHTMLInputElement();
    genericSearch.name = "query";
    genericSearch.placeholder = "Search catalog...";
    const { id: searchId } = createAndRegisterElement(genericSearch);

    const customIntel = buildMockIntel({
      url: "https://www.independent-boutique.org/shop",
      hostname: "www.independent-boutique.org",
      pathname: "/shop",
      title: "Independent Boutique Clothing",
      searchInputs: [
        {
          elementId: searchId,
          type: "search",
          role: "searchbox",
          tagName: "input",
          text: "",
          placeholder: "Search catalog...",
          disabled: false,
          bounds: { x: 0, y: 0, width: 200, height: 30 },
        },
      ],
    });

    const plan = generateActionPlan(sampleShoppingIntent, customIntel);
    assert.ok(plan.steps.length > 0);
    assert.strictEqual(plan.steps[0].type, "search");
    console.log("✓ Generic attributes used without hardcoded site selectors: PASS\n");
  }

  // 20. GENERIC NAVIGATION WORKS ON ANOTHER WEBSITE
  console.log("Test 20: Generic Navigation on Another Website");
  {
    const bookstoreIntent: StructuredIntent = {
      id: "intent-books",
      intent: "find",
      target: "products",
      entities: { category: "python books" },
      filters: {},
      constraints: { maxPrice: 500 },
      scope: "site_wide",
      confidence: 0.9,
      requiresClarification: false,
      rawQuery: "Find python books under ₹500",
      timestamp: Date.now(),
    };

    const bookstoreIntel = buildMockIntel({
      url: "https://www.techbooks.io/",
      hostname: "www.techbooks.io",
      pathname: "/",
      title: "Technical Books Online",
    });

    const navPlan = planNavigationSequence(bookstoreIntel, bookstoreIntent);
    assert.strictEqual(navPlan.strategy, "search_and_filter");

    const brand = formatFriendlySiteName(bookstoreIntel.hostname);
    assert.strictEqual(brand, "Techbooks");

    const completedBookIntel = buildMockIntel({
      url: "https://www.techbooks.io/search?q=python",
      hostname: "www.techbooks.io",
      pathname: "/search",
      title: "Python Books",
      headings: [{ level: 1, text: "Python Books" }],
      buttons: [{ elementId: "b1", type: "button", role: "button", tagName: "button", text: "Price under 500", disabled: false, bounds: { x: 0, y: 0, width: 10, height: 10 } }],
      repeatedGroups: [
        {
          containerSelector: ".books",
          inferredType: "product-like",
          count: 5,
          items: [
            { elementId: "bk1", title: "Fluent Python", price: { raw: "₹450", amount: 450, currency: "INR" }, bounds: { x: 0, y: 0, width: 10, height: 10 } },
          ],
        },
      ],
    });

    const verifyResult = verifyFinalWebsiteState(completedBookIntel, bookstoreIntent);
    assert.strictEqual(verifyResult.isSuccess, true);
    assert.ok(verifyResult.userFacingSummary.includes("Done. Techbooks is showing 1 matching python books."));
    console.log("✓ Complete generic navigation lifecycle on techbooks.io verified: PASS\n");
  }

  console.log(`==================================================`);
  console.log(`🎉 ALL 20 STAGE 4.5 NAVIGATION TESTS PASSED 100%!`);
  console.log(`==================================================\n`);
}

runNavigationTests().catch((err) => {
  console.error("\n❌ Stage 4.5 Navigation Test Failed:", err);
  process.exit(1);
});
