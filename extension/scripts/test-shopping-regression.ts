/**
 * Browsy Shopping Assistant Regression Test Suite
 * Dedicated regression suite for the shopping workflow:
 * "Find me a red checked shirt in size XL under ₹1,000."
 *
 * Verifies 11 core capabilities and safety invariants:
 * 1. Multiple filters independent parsing & planning
 * 2. Collapsed filter groups dynamic expansion
 * 3. Navigation & task-state persistence across document reload
 * 4. SPA re-render and condition-based waiting
 * 5. Stale element semantic re-resolution
 * 6. Unavailable filters honest partial reporting
 * 7. Price limit strict rejection (₹1,099 & ₹1,001 rejected from ₹1,000 budget)
 * 8. Missing size information -> partial match labeling
 * 9. Cancellation and timeout prevention
 * 10. Duplicate execution & toggle inversion prevention
 * 11. Non-fabrication & truthful completion claims
 */

import assert from "node:assert";
import { IntentEngine } from "../src/intent";
import { generateActionPlan } from "../src/intent/planner";
import { evaluateItemMatch, matchItemsOnPage } from "../src/intent/matcher";
import { elementRegistry } from "../src/page-intelligence/element-registry";
import { resolveElement } from "../src/execution/resolver";
import {
  ActionExecutor,
  expandAndFindFacetControl,
  isFilterAlreadySatisfied,
} from "../src/execution/executor";
import {
  saveActiveTask,
  loadActiveTask,
  updateActiveTaskStep,
  cancelActiveTask,
  clearActiveTask,
  TASK_EXPIRATION_MS,
  type TaskPersistenceData,
} from "../src/execution/task-persistence";
import { verifyFinalWebsiteState } from "../src/navigation/final-state-verifier";
import { waitForPageUpdate } from "../src/navigation/page-waiter";
import type {
  StructuredPageIntelligence,
  InteractiveElement,
  RepeatedItem,
  RepeatedItemGroup,
} from "../src/page-intelligence/types";
import type { ActionPlan, ActionPlanStep, StructuredIntent } from "../src/intent/types";

// ============================================================
// LIGHTWEIGHT DETERMINISTIC DOM HARNESS
// ============================================================

class MockNode {
  public isConnected = true;
  public parentNode: MockNode | null = null;
  public parentElement: MockElement | null = null;
}

class MockElement extends MockNode {
  public tagName: string;
  public id = "";
  public className = "";
  public textContent = "";
  public innerHTML = "";
  public style: Record<string, string> = {};
  public offsetParent: any = {};
  public attributes: Map<string, string> = new Map();
  public children: MockElement[] = [];
  public listeners: Record<string, Array<(e: any) => void>> = {};

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

  public removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  public addEventListener(event: string, handler: (e: any) => void): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  public removeEventListener(event: string, handler: (e: any) => void): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
  }

  public dispatchEvent(event: any): boolean {
    const handlers = this.listeners[event.type] || [];
    for (const h of handlers) h(event);
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

  public closest(tag: string): MockElement | null {
    let cur: MockNode | null = this;
    while (cur) {
      if (cur instanceof MockElement) {
        if (cur.tagName.toLowerCase() === tag.toLowerCase()) return cur;
        if (tag.includes("product") && (cur.className.includes("product-card") || cur.className.includes("product-base"))) {
          return cur;
        }
        if (tag.includes("atsa") && (cur.className.includes("atsa-filters") || cur.className.includes("atsa"))) {
          return cur;
        }
      }
      cur = cur.parentNode || (cur as any).parentElement;
    }
    return null;
  }

  public querySelector(selector: string): MockElement | null {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  public querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    for (const child of this.children) {
      if (child.matches(selector)) results.push(child);
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }

  public matches(selector: string): boolean {
    if (selector.includes('input[type="checkbox"]')) {
      return (this as any).type === "checkbox";
    }
    if (selector.includes('input[type="radio"]')) {
      return (this as any).type === "radio";
    }
    if (selector.includes("button")) {
      return this.tagName === "BUTTON";
    }
    if (selector.includes("label")) {
      return this.tagName === "LABEL";
    }
    return false;
  }

  public appendChild(child: MockElement): MockElement {
    child.parentNode = this;
    child.parentElement = this;
    child.isConnected = true;
    this.children.push(child);
    return child;
  }
}

class MockHTMLElement extends MockElement {}

class MockHTMLButtonElement extends MockHTMLElement {
  public disabled = false;
  constructor() {
    super("BUTTON");
  }
}

class MockHTMLInputElement extends MockHTMLElement {
  public type = "text";
  public value = "";
  public checked = false;
  public disabled = false;
  public name = "";
  public placeholder = "";

  constructor(type = "text") {
    super("INPUT");
    this.type = type;
  }
}

// In-Memory Storage Mock for sessionStorage
class MockStorage {
  private store: Map<string, string> = new Map();
  get length() {
    return this.store.size;
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, val: string): void {
    this.store.set(key, String(val));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

const mockSessionStorage = new MockStorage();

// Attach DOM Globals
(globalThis as any).Element = MockElement;
(globalThis as any).HTMLElement = MockHTMLElement;
(globalThis as any).HTMLButtonElement = MockHTMLButtonElement;
(globalThis as any).HTMLInputElement = MockHTMLInputElement;
(globalThis as any).HTMLSelectElement = MockHTMLElement;
(globalThis as any).HTMLTextAreaElement = MockHTMLElement;
(globalThis as any).SVGElement = MockHTMLElement;

if (typeof (globalThis as any).Event === "undefined") {
  (globalThis as any).Event = class MockEvent {
    constructor(public type: string, public init?: any) {}
  };
}
if (typeof (globalThis as any).MouseEvent === "undefined") {
  (globalThis as any).MouseEvent = class MockMouseEvent {
    constructor(public type: string, public init?: any) {}
  };
}

(globalThis as any).window = {
  location: { href: "https://www.myntra.com/shirts", hostname: "www.myntra.com", pathname: "/shirts" },
  sessionStorage: mockSessionStorage,
  Element: MockElement,
  HTMLElement: MockHTMLElement,
  HTMLInputElement: MockHTMLInputElement,
  HTMLButtonElement: MockHTMLButtonElement,
  HTMLSelectElement: MockHTMLElement,
  HTMLTextAreaElement: MockHTMLElement,
  Event: (globalThis as any).Event,
  MouseEvent: (globalThis as any).MouseEvent,
  getComputedStyle: (el: any) => ({
    display: el.style?.display || "block",
    visibility: el.style?.visibility || "visible",
    opacity: el.style?.opacity || "1",
    position: el.style?.position || "relative",
    pointerEvents: el.style?.pointerEvents || "auto",
  }),
};
(globalThis as any).sessionStorage = mockSessionStorage;

function buildMockIntelligence(overrides: Partial<StructuredPageIntelligence> = {}): StructuredPageIntelligence {
  return {
    url: "https://www.myntra.com/shirts",
    hostname: "www.myntra.com",
    pathname: "/shirts",
    title: "Shirts for Men - Buy Casual & Formal Shirts",
    summary: "Mock shopping page with filter facets and products",
    category: "shopping",
    language: "en",
    headings: [{ level: 1, text: "Shirts for Men" }],
    buttons: [],
    links: [],
    inputs: [],
    searchInputs: [],
    repeatedGroups: [],
    detectedPrices: [],
    detectedRatings: [],
    keyImages: [],
    stats: {
      analysisDurationMs: 4,
      totalInteractiveCount: 0,
      buttonCount: 0,
      linkCount: 0,
      inputCount: 0,
      searchCount: 0,
      formCount: 0,
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
// REGRESSION TEST SUITE EXECUTION
// ============================================================

async function runShoppingRegressionSuite() {
  console.log("\n======================================================================");
  console.log("🛍️  BROWSY SHOPPING AGENT REGRESSION TEST SUITE (11 SCENARIOS)");
  console.log("    Test Prompt: 'Find me a red checked shirt in size XL under ₹1,000.'");
  console.log("======================================================================\n");

  const intentEngine = new IntentEngine();

  // ------------------------------------------------------------------
  // TEST 1: Multiple Filters Independent Parsing & Planning
  // ------------------------------------------------------------------
  console.log("--- TEST 1: Multiple Filters Independent Parsing & Planning ---");
  {
    const prompt = "Find me a red checked shirt in size XL under ₹1,000.";
    const intentResult = await intentEngine.processRequest(prompt, null);
    const intent = intentResult.intent;

    // Invariant 1: All constraints parsed into distinct independent slots
    assert.strictEqual(intent.target, "products", "Target must be 'products'");
    assert.strictEqual(intent.entities.category, "shirt", "Category must be 'shirt'");
    assert.strictEqual(intent.filters.color, "red", "Color filter must be 'red'");
    assert.strictEqual(intent.filters.pattern, "checked", "Pattern filter must be 'checked'");
    assert.strictEqual(intent.filters.size, "XL", "Size filter must be 'XL'");
    assert.strictEqual(intent.constraints.maxPrice, 1000, "Max price must be ₹1,000");

    // Invariant 2: Action planning generates sequential steps (search -> filters)
    const mockContext = buildMockIntelligence({
      inputs: [
        {
          elementId: "search-box",
          type: "search",
          role: "searchbox",
          tagName: "input",
          text: "",
          placeholder: "Search for shirts",
          disabled: false,
          bounds: { x: 0, y: 0, width: 100, height: 30 },
        },
      ],
      searchInputs: [
        {
          elementId: "search-box",
          type: "search",
          role: "searchbox",
          tagName: "input",
          text: "",
          placeholder: "Search for shirts",
          disabled: false,
          bounds: { x: 0, y: 0, width: 100, height: 30 },
        },
      ],
    });

    const plan = generateActionPlan(intent, mockContext);
    assert.strictEqual(plan.status, "proposed", "Plan status must be 'proposed'");
    assert.ok(plan.steps.length >= 1, "Must generate steps");
    assert.strictEqual(plan.steps[0].type, "search", "First step must be search action");
    assert.ok(
      plan.steps[0].value?.toLowerCase().includes("shirt"),
      "Search query must include target category"
    );

    console.log("✓ Test 1: Category, color, pattern, size, and price independently parsed & planned: PASS");
  }

  // ------------------------------------------------------------------
  // TEST 2: Collapsed Filter Groups Dynamic Expansion
  // ------------------------------------------------------------------
  console.log("\n--- TEST 2: Collapsed Filter Groups Dynamic Expansion ---");
  {
    // Live DOM has a "+ more" expander and a "Size" accordion toggle
    let moreClicked = false;
    const moreBtn = new MockHTMLButtonElement();
    moreBtn.className = "atsa-more-btn";
    moreBtn.textContent = "+ 5 more";
    moreBtn.addEventListener("click", () => {
      moreClicked = true;
    });

    let sizeExpanded = false;
    const sizeAccordionToggle = new MockHTMLButtonElement();
    sizeAccordionToggle.className = "atsa-facet-header";
    sizeAccordionToggle.textContent = "Size";
    sizeAccordionToggle.addEventListener("click", () => {
      sizeExpanded = true;
    });

    const xlInput = new MockHTMLInputElement("checkbox");
    xlInput.value = "XL";
    xlInput.checked = false;

    const xlLabel = new MockHTMLElement("LABEL");
    xlLabel.className = "atsa-facet-label";
    xlLabel.textContent = "XL";
    xlLabel.appendChild(xlInput);

    // Product card buttons must NEVER be clicked during facet expansion
    let cardButtonClicked = false;
    const cardBuyBtn = new MockHTMLButtonElement();
    cardBuyBtn.className = "product-card-btn";
    cardBuyBtn.textContent = "Size XL";
    cardBuyBtn.addEventListener("click", () => {
      cardButtonClicked = true;
    });
    const productCard = new MockHTMLElement("DIV");
    productCard.className = "product-card product-base";
    productCard.appendChild(cardBuyBtn);

    // Document mock
    (globalThis as any).document = {
      querySelectorAll: (sel: string) => {
        if (sel.includes("atsa") || sel.includes("facet") || sel.includes("more") || sel.includes("button") || sel.includes("label") || sel.includes("input")) {
          const list: MockElement[] = [moreBtn, sizeAccordionToggle];
          if (sizeExpanded || moreClicked) {
            list.push(xlLabel, xlInput);
          }
          list.push(cardBuyBtn);
          return list;
        }
        return [];
      },
      querySelector: (_sel: string) => null,
    };

    const step: ActionPlanStep = {
      id: "step-filter-size-xl",
      type: "check",
      targetLabel: "Size XL",
      value: "XL",
      description: "Apply Size XL filter",
    };

    const resolvedElementId = await expandAndFindFacetControl(step, null);

    // Invariant 1: Dynamic expansion triggered accordion / more toggle
    assert.ok(sizeExpanded || moreClicked, "Accordion toggle or '+ more' must be clicked");

    // Invariant 2: XL facet control registered and ID returned
    assert.ok(resolvedElementId, "Must successfully resolve and return an element ID");
    const resolved = resolveElement(resolvedElementId!);
    assert.strictEqual(resolved.success, true, "Registered element must resolve");

    // Invariant 3: Product card buttons were NOT clicked
    assert.strictEqual(cardButtonClicked, false, "Product card buttons must never be clicked during facet expansion");

    console.log("✓ Test 2: Collapsed accordion expanded dynamically and XL control resolved: PASS");
  }

  // ------------------------------------------------------------------
  // TEST 3: Navigation & Task-State Persistence Across Document Reload
  // ------------------------------------------------------------------
  console.log("\n--- TEST 3: Navigation & Task-State Persistence Across Document Reload ---");
  {
    mockSessionStorage.clear();

    const plan: ActionPlan = {
      id: "plan-shopping-persist",
      status: "proposed",
      steps: [
        { id: "step-1", type: "search", value: "red checked shirt", description: "Search for shirts" },
        { id: "step-2", type: "check", targetLabel: "Color Red", value: "Red", description: "Filter by Red" },
        { id: "step-3", type: "check", targetLabel: "Size XL", value: "XL", description: "Filter by Size XL" },
      ],
      matchedItems: [],
      explanation: "Find red checked shirt in size XL under ₹1,000",
      confidence: 0.95,
      timestamp: Date.now(),
    };

    const taskData: TaskPersistenceData = {
      taskId: "task-shopping-42",
      plan,
      originalQuery: "Find me a red checked shirt in size XL under ₹1,000.",
      currentStepIndex: 1, // Step 1 completed, Steps 2 and 3 pending
      completedRecords: [
        {
          stepId: "step-1",
          type: "search",
          elementId: "search-input",
          success: true,
          timestamp: Date.now(),
          durationMs: 120,
        },
      ],
      isApproved: true,
      executionState: "executing",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Save task before simulated page navigation
    saveActiveTask(taskData);

    // Simulate page reload: load from sessionStorage
    const restored = loadActiveTask();
    assert.ok(restored, "Task must be successfully restored from sessionStorage");
    assert.strictEqual(restored.taskId, "task-shopping-42", "Task ID must match");
    assert.strictEqual(restored.currentStepIndex, 1, "Current step index must be preserved");
    assert.strictEqual(restored.completedRecords.length, 1, "Completed step record must be preserved");
    assert.strictEqual(restored.pendingActions?.length, 2, "Pending actions (step-2 & step-3) must be preserved");
    assert.strictEqual(restored.pendingActions?.[0].id, "step-2", "Next pending action must be step-2");

    // Advance step: updateActiveTaskStep
    updateActiveTaskStep(2, [
      ...restored.completedRecords,
      {
        stepId: "step-2",
        type: "check",
        elementId: "red-checkbox",
        success: true,
        timestamp: Date.now(),
        durationMs: 80,
      },
    ]);

    const afterUpdate = loadActiveTask();
    assert.strictEqual(afterUpdate?.currentStepIndex, 2, "Current step index advanced to 2");
    assert.strictEqual(afterUpdate?.completedRecords.length, 2, "2 completed records tracked");
    assert.strictEqual(afterUpdate?.pendingActions?.length, 1, "1 pending action remaining (step-3)");

    // Cleanup
    clearActiveTask();
    assert.strictEqual(loadActiveTask(), null, "Cleared task must return null");

    console.log("✓ Test 3: Task-state, pending actions, and completed steps survive reload: PASS");
  }

  // ------------------------------------------------------------------
  // TEST 4: SPA Re-Render & Condition-Based Waiting
  // ------------------------------------------------------------------
  console.log("\n--- TEST 4: SPA Re-Render & Condition-Based Waiting ---");
  {
    // Simulate an SPA where clicking a filter triggers an asynchronous DOM update after 50ms
    let domMutated = false;
    let productCount = 40;
    const currentUrl = (globalThis as any).window.location.href;

    const timer = setTimeout(() => {
      domMutated = true;
      productCount = 12;
    }, 50);

    const startTime = Date.now();
    const waitResult = await waitForPageUpdate(currentUrl, {
      timeoutMs: 1000,
      checkIntervalMs: 20,
      condition: () => domMutated && productCount === 12,
    });
    const duration = Date.now() - startTime;
    clearTimeout(timer);

    assert.strictEqual(waitResult.conditionMet, true, "Wait condition must be satisfied upon SPA mutation");
    assert.ok(duration < 800, `Wait must complete promptly (${duration}ms) instead of hanging`);

    console.log(`✓ Test 4: Condition-based wait resolved in ${duration}ms upon SPA DOM mutation: PASS`);
  }

  // ------------------------------------------------------------------
  // TEST 5: Stale Element Semantic Re-Resolution
  // ------------------------------------------------------------------
  console.log("\n--- TEST 5: Stale Element Semantic Re-Resolution ---");
  {
    // Create an old element that gets disconnected
    const oldRedInput = new MockHTMLInputElement("checkbox");
    oldRedInput.value = "Red";
    const oldId = elementRegistry.register(oldRedInput as any);
    oldRedInput.isConnected = false; // Disconnected by SPA re-render!

    // Verify initial resolver detects disconnect
    const initialResolve = resolveElement(oldId);
    assert.strictEqual(initialResolve.isStale, true, "Disconnected element must be marked stale");

    // Live DOM has a newly mounted Red checkbox
    const newRedInput = new MockHTMLInputElement("checkbox");
    newRedInput.value = "Red";
    newRedInput.checked = false;
    const newRedLabel = new MockHTMLElement("LABEL");
    newRedLabel.textContent = "Red (12)";
    newRedLabel.appendChild(newRedInput);

    (globalThis as any).document = {
      querySelectorAll: (sel: string) => {
        if (sel.includes("input") || sel.includes("label") || sel.includes("checkbox")) {
          return [newRedLabel, newRedInput];
        }
        return [];
      },
      querySelector: (_sel: string) => null,
    };

    // Semantic recovery step targeting Red filter
    const step: ActionPlanStep = {
      id: "step-stale-recovery",
      type: "check",
      targetElementId: oldId,
      targetLabel: "Color Red",
      value: "Red",
      description: "Apply Color Red filter",
    };

    const newResolvedId = await expandAndFindFacetControl(step, null);
    assert.ok(newResolvedId, "Semantic recovery must find replacement element");
    const recovered = resolveElement(newResolvedId!);
    assert.strictEqual(recovered.success, true, "Replacement element must resolve successfully");
    assert.strictEqual(recovered.isStale, false, "Replacement element must not be stale");

    console.log("✓ Test 5: Stale element recovered via semantic re-resolution in live DOM: PASS");
  }

  // ------------------------------------------------------------------
  // TEST 6: Unavailable Filters Honest Partial Reporting
  // ------------------------------------------------------------------
  console.log("\n--- TEST 6: Unavailable Filters Honest Partial Reporting ---");
  {
    // User requested an unavailable material/fabric: "cashmere"
    const intent: StructuredIntent = {
      id: "intent-cashmere",
      intent: "filter",
      target: "products",
      confidence: 0.95,
      entities: { category: "shirt", fabric: "cashmere" },
      filters: { fabric: "cashmere" },
      constraints: { maxPrice: 1000 },
      isConversational: false,
      timestamp: Date.now(),
    };

    // Page only has cotton and polyester shirts; no cashmere facet exists
    const pageContext = buildMockIntelligence({
      url: "https://www.myntra.com/shirts",
      title: "Shirts for Men",
      headings: [{ level: 1, text: "Shirts for Men" }],
      repeatedGroups: [
        {
          containerSelector: ".results",
          inferredType: "product-like",
          count: 5,
          items: [
            {
              elementId: "item-1",
              title: "Cotton Casual Shirt",
              price: { raw: "₹899", amount: 899, currency: "INR" },
              metaText: ["100% Cotton"],
              bounds: { x: 0, y: 0, width: 100, height: 100 },
            },
          ],
        },
      ],
    });

    const verify = verifyFinalWebsiteState(pageContext, intent);

    // Invariant 1: Status must NOT be COMPLETED
    assert.notStrictEqual(verify.status, "COMPLETED", "Must not declare COMPLETED for unavailable filters");
    assert.strictEqual(verify.status, "PARTIALLY COMPLETED", "Must declare PARTIALLY COMPLETED");

    // Invariant 2: Unverified filters must list the missing constraint
    assert.ok(
      verify.unverifiedFilters.some((f) => f.toLowerCase().includes("cashmere")),
      "unverifiedFilters must explicitly mention cashmere"
    );

    console.log("✓ Test 6: Unavailable requirement truthfully reported as PARTIALLY COMPLETED: PASS");
  }

  // ------------------------------------------------------------------
  // TEST 7: Price Limit Strict Rejection
  // ------------------------------------------------------------------
  console.log("\n--- TEST 7: Price Limit Strict Rejection (₹1,099 & ₹1,001 Rejected from ₹1,000 Budget) ---");
  {
    const intent: StructuredIntent = {
      id: "intent-price-test",
      intent: "filter",
      target: "products",
      confidence: 0.95,
      entities: { category: "shirt" },
      filters: { color: "red", pattern: "checked", size: "XL" },
      constraints: { maxPrice: 1000 },
      isConversational: false,
      timestamp: Date.now(),
    };

    const itemUnderBudget: RepeatedItem = {
      elementId: "p-899",
      title: "Roadster Red Checked Casual Shirt",
      price: { raw: "₹899", amount: 899, currency: "INR" },
      metaText: ["Size: XL"],
      bounds: { x: 0, y: 0, width: 10, height: 10 },
    };

    const itemAtBudget: RepeatedItem = {
      elementId: "p-1000",
      title: "Highlander Red Plaid Casual Shirt",
      price: { raw: "₹1,000", amount: 1000, currency: "INR" },
      metaText: ["Size: XL"],
      bounds: { x: 0, y: 0, width: 10, height: 10 },
    };

    const itemOverByOne: RepeatedItem = {
      elementId: "p-1001",
      title: "WROGN Red Checked Casual Shirt",
      price: { raw: "₹1,001", amount: 1001, currency: "INR" },
      metaText: ["Size: XL"],
      bounds: { x: 0, y: 0, width: 10, height: 10 },
    };

    const itemOverBudget: RepeatedItem = {
      elementId: "p-1099",
      title: "Levis Red Checked Classic Shirt",
      price: { raw: "₹1,099", amount: 1099, currency: "INR" },
      metaText: ["Size: XL"],
      bounds: { x: 0, y: 0, width: 10, height: 10 },
    };

    const evalUnder = evaluateItemMatch(itemUnderBudget, intent);
    assert.strictEqual(evalUnder.isMatch, true, "₹899 must be accepted (<= ₹1,000)");
    assert.strictEqual(evalUnder.matchClassification, "confirmed");

    const evalAt = evaluateItemMatch(itemAtBudget, intent);
    assert.strictEqual(evalAt.isMatch, true, "₹1,000 must be accepted (<= ₹1,000)");
    assert.strictEqual(evalAt.matchClassification, "confirmed");

    const evalOverOne = evaluateItemMatch(itemOverByOne, intent);
    assert.strictEqual(evalOverOne.isMatch, false, "₹1,001 must be strictly rejected (> ₹1,000)");
    assert.strictEqual(evalOverOne.matchClassification, "rejected");
    assert.strictEqual(
      evalOverOne.evaluations.find((e) => e.name === "maxPrice")?.status,
      "violated",
      "Price evaluation must be marked violated"
    );

    const evalOver = evaluateItemMatch(itemOverBudget, intent);
    assert.strictEqual(evalOver.isMatch, false, "₹1,099 must be strictly rejected (> ₹1,000)");
    assert.strictEqual(evalOver.matchClassification, "rejected");
    assert.strictEqual(
      evalOver.evaluations.find((e) => e.name === "maxPrice")?.status,
      "violated",
      "Price evaluation must be marked violated"
    );

    console.log("✓ Test 7: Items exceeding budget strictly marked violated and rejected: PASS");
  }

  // ------------------------------------------------------------------
  // TEST 8: Missing Size Information -> Partial Match Labeling
  // ------------------------------------------------------------------
  console.log("\n--- TEST 8: Missing Size Information -> Partial Match Labeling ---");
  {
    const intent: StructuredIntent = {
      id: "intent-size-test",
      intent: "filter",
      target: "products",
      confidence: 0.95,
      entities: { category: "shirt" },
      filters: { color: "red", pattern: "checked", size: "XL" },
      constraints: { maxPrice: 1000 },
      isConversational: false,
      timestamp: Date.now(),
    };

    // Real catalog cards typically display title and price, but NOT sizes on the listing card
    const cardMissingSize: RepeatedItem = {
      elementId: "card-no-size",
      title: "Roadster Men Red Checked Casual Shirt",
      price: { raw: "₹799", amount: 799, currency: "INR" },
      metaText: ["100% Cotton", "4.2 ★"], // No size info!
      bounds: { x: 0, y: 0, width: 10, height: 10 },
    };

    const evalRes = evaluateItemMatch(cardMissingSize, intent);

    // Invariant 1: Must NOT be confirmed match
    assert.strictEqual(evalRes.matchClassification, "partial", "Must be classified as partial match");
    assert.notStrictEqual(evalRes.matchClassification, "confirmed", "Item without size evidence cannot be confirmed match");

    // Invariant 2: Size condition must be marked unverified
    const sizeEval = evalRes.evaluations.find((e) => e.name === "size");
    assert.strictEqual(sizeEval?.status, "unverified", "Size status must be unverified");
    assert.ok(
      evalRes.unverifiedConditions.some((c) => c.toLowerCase().includes("size xl")),
      "unverifiedConditions must include Size XL"
    );

    // Invariant 3: Final state verifier treats this as partial match
    const pageWithMissingSize = buildMockIntelligence({
      url: "https://www.myntra.com/shirts?f=Color%3Ared%3A%3APattern%3Achecked",
      headings: [{ level: 1, text: "Shirts for Men" }],
      repeatedGroups: [
        {
          containerSelector: ".grid",
          inferredType: "product-like",
          count: 1,
          items: [cardMissingSize],
        },
      ],
    });

    const verify = verifyFinalWebsiteState(pageWithMissingSize, intent);
    assert.strictEqual(verify.status, "PARTIALLY COMPLETED");
    assert.strictEqual(verify.partialMatches?.length, 1, "Must register 1 partial match");
    assert.strictEqual(verify.confirmedMatches?.length, 0, "Must have 0 confirmed matches");
    assert.ok(
      verify.userFacingSummary.toLowerCase().includes("partial"),
      "Summary must explicitly state partial match"
    );

    console.log("✓ Test 8: Item missing size evidence truthfully categorized as partial match: PASS");
  }

  // ------------------------------------------------------------------
  // TEST 9: Cancellation and Timeout Prevention
  // ------------------------------------------------------------------
  console.log("\n--- TEST 9: Cancellation and Timeout Prevention ---");
  {
    mockSessionStorage.clear();

    const task: TaskPersistenceData = {
      taskId: "task-cancel-test",
      plan: {
        id: "plan-cancel",
        status: "approved",
        steps: [{ id: "step-1", type: "click", description: "Test step" }],
        matchedItems: [],
        explanation: "Cancel test",
        confidence: 0.9,
        timestamp: Date.now(),
      },
      originalQuery: "Cancel test query",
      currentStepIndex: 0,
      completedRecords: [],
      isApproved: true,
      executionState: "executing",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveActiveTask(task);
    assert.ok(loadActiveTask(), "Active task must be loadable initially");

    // Invariant 1: cancelActiveTask stops active execution immediately
    cancelActiveTask();
    assert.strictEqual(loadActiveTask(), null, "loadActiveTask must return null for cancelled task");

    // Invariant 2: Expired task (> TASK_EXPIRATION_MS) is rejected
    const expiredTask: TaskPersistenceData = {
      ...task,
      taskId: "task-expired",
      createdAt: Date.now() - (TASK_EXPIRATION_MS + 10000),
      updatedAt: Date.now() - (TASK_EXPIRATION_MS + 10000),
    };
    mockSessionStorage.setItem("browsy_active_task", JSON.stringify(expiredTask));
    assert.strictEqual(loadActiveTask(), null, "Expired task must return null and be cleared");

    // Invariant 3: Unapproved task cannot be loaded
    const unapprovedTask: TaskPersistenceData = {
      ...task,
      taskId: "task-unapproved",
      isApproved: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveActiveTask(unapprovedTask);
    assert.strictEqual(loadActiveTask(), null, "Unapproved task must return null");

    console.log("✓ Test 9: Cancellation, expiration, and unapproved state guards strictly enforced: PASS");
  }

  // ------------------------------------------------------------------
  // TEST 10: Duplicate Execution & Toggle Inversion Prevention
  // ------------------------------------------------------------------
  console.log("\n--- TEST 10: Duplicate Execution & Toggle Inversion Prevention ---");
  {
    // Case A: Checkbox is currently unchecked
    const uncheckedBox = new MockHTMLInputElement("checkbox");
    uncheckedBox.checked = false;
    const uId = elementRegistry.register(uncheckedBox as any);
    const stepA: ActionPlanStep = {
      id: "step-check-a",
      type: "check",
      targetElementId: uId,
      value: "Red",
      description: "Apply Red filter",
    };
    assert.strictEqual(
      isFilterAlreadySatisfied(stepA),
      false,
      "Unchecked checkbox must NOT be considered already satisfied"
    );

    // Case B: Checkbox is already checked
    const checkedBox = new MockHTMLInputElement("checkbox");
    checkedBox.checked = true;
    const cId = elementRegistry.register(checkedBox as any);
    const stepB: ActionPlanStep = {
      id: "step-check-b",
      type: "check",
      targetElementId: cId,
      value: "Red",
      description: "Apply Red filter",
    };
    assert.strictEqual(
      isFilterAlreadySatisfied(stepB),
      true,
      "Checked checkbox MUST be considered already satisfied to prevent toggle inversion"
    );

    // Case C: URL already has facet parameter
    (globalThis as any).window.location.href = "https://www.myntra.com/shirts?f=Color%3Ared";
    const stepC: ActionPlanStep = {
      id: "step-check-c",
      type: "check",
      value: "red",
      description: "Apply Red filter",
    };
    assert.strictEqual(
      isFilterAlreadySatisfied(stepC),
      true,
      "Filter already present in URL must be considered satisfied"
    );

    // Case D: Active filter chip is in DOM
    (globalThis as any).window.location.href = "https://www.myntra.com/shirts";
    const activeChip = new MockHTMLElement("SPAN");
    activeChip.className = "filter-summary-selectedFilter";
    activeChip.textContent = "Checked";
    (globalThis as any).document = {
      querySelectorAll: (sel: string) => {
        if (sel.includes("selected") || sel.includes("filter")) return [activeChip];
        return [];
      },
      querySelector: (_sel: string) => null,
    };
    const stepD: ActionPlanStep = {
      id: "step-check-d",
      type: "check",
      value: "checked",
      description: "Apply Checked filter",
    };
    assert.strictEqual(
      isFilterAlreadySatisfied(stepD),
      true,
      "Filter present in active filter summary chip must be considered satisfied"
    );

    console.log("✓ Test 10: Toggle inversion prevented when filter is already checked, in URL, or in chip: PASS");
  }

  // ------------------------------------------------------------------
  // TEST 11: Non-Fabrication & Truthful Completion Claims
  // ------------------------------------------------------------------
  console.log("\n--- TEST 11: Non-Fabrication & Truthful Completion Claims ---");
  {
    const intent: StructuredIntent = {
      id: "intent-truthful",
      intent: "filter",
      target: "products",
      confidence: 0.95,
      entities: { category: "shirt" },
      filters: { color: "red", pattern: "checked", size: "XL" },
      constraints: { maxPrice: 1000 },
      isConversational: false,
      timestamp: Date.now(),
    };

    // Sub-case 1: Zero results
    const zeroResultsContext = buildMockIntelligence({
      headings: [{ level: 1, text: "Shirts for Men" }],
      repeatedGroups: [],
    });
    const verifyZero = verifyFinalWebsiteState(zeroResultsContext, intent);
    assert.strictEqual(verifyZero.status, "FAILED", "0 results must be reported as FAILED, never COMPLETED");
    assert.ok(
      verifyZero.userFacingSummary.toLowerCase().includes("no matching"),
      "Summary must truthfully state no results found"
    );

    // Sub-case 2: Unverified Size Filter (partial completion)
    const partialContext = buildMockIntelligence({
      url: "https://www.myntra.com/shirts?f=Color%3Ared%3A%3APattern%3Achecked",
      headings: [{ level: 1, text: "Shirts for Men" }],
      inputs: [
        {
          elementId: "in-red",
          type: "checkbox",
          role: "checkbox",
          tagName: "input",
          text: "Red",
          checked: true,
          disabled: false,
          bounds: { x: 0, y: 0, width: 10, height: 10 },
        },
      ],
      repeatedGroups: [
        {
          containerSelector: ".grid",
          inferredType: "product-like",
          count: 2,
          items: [
            {
              elementId: "item-p1",
              title: "Red Checked Shirt",
              price: { raw: "₹899", amount: 899, currency: "INR" },
              bounds: { x: 0, y: 0, width: 10, height: 10 },
            },
          ],
        },
      ],
    });
    const verifyPartial = verifyFinalWebsiteState(partialContext, intent);
    assert.notStrictEqual(verifyPartial.status, "COMPLETED", "Must NOT declare COMPLETED when Size XL unverified");
    assert.strictEqual(verifyPartial.status, "PARTIALLY COMPLETED", "Must declare PARTIALLY COMPLETED");
    assert.ok(
      verifyPartial.unverifiedFilters.includes("Size XL"),
      "unverifiedFilters must explicitly contain 'Size XL'"
    );

    // Sub-case 3: Fully verified match
    const fullContext = buildMockIntelligence({
      url: "https://www.myntra.com/shirts?f=Color%3Ared%3A%3APattern%3Achecked%3A%3ASize%3AXL",
      headings: [{ level: 1, text: "Shirts for Men" }],
      inputs: [
        {
          elementId: "in-red-2",
          type: "checkbox",
          role: "checkbox",
          tagName: "input",
          text: "Red",
          checked: true,
          disabled: false,
          bounds: { x: 0, y: 0, width: 10, height: 10 },
        },
        {
          elementId: "in-size-xl",
          type: "checkbox",
          role: "checkbox",
          tagName: "input",
          text: "XL",
          checked: true,
          disabled: false,
          bounds: { x: 0, y: 0, width: 10, height: 10 },
        },
      ],
      repeatedGroups: [
        {
          containerSelector: ".grid",
          inferredType: "product-like",
          count: 1,
          items: [
            {
              elementId: "item-perfect",
              title: "Roadster Men Red Checked Casual Shirt",
              price: { raw: "₹799", amount: 799, currency: "INR" },
              metaText: ["Sizes: XL, XXL"],
              bounds: { x: 0, y: 0, width: 10, height: 10 },
            },
          ],
        },
      ],
    });
    const verifyFull = verifyFinalWebsiteState(fullContext, intent);
    assert.strictEqual(verifyFull.status, "COMPLETED", "Fully verified state must declare COMPLETED");
    assert.strictEqual(verifyFull.confirmedMatches?.length, 1, "Must have 1 confirmed match");
    assert.strictEqual(verifyFull.unverifiedFilters.length, 0, "Must have 0 unverified filters");

    console.log("✓ Test 11: Non-fabrication enforced: FAILED for 0 items, PARTIAL for unverified, COMPLETED only when verified: PASS");
  }

  // =========================================================================
  // TEST 12: Complex Shopping Query with Reviews & Comparison (Master Audit Query)
  // "Find me a stylish red checked shirt in size XL under ₹1,000, with good reviews. Compare the best options and show me the top five."
  // =========================================================================
  {
    console.log("\n--- TEST 12: Complex Shopping Query with Reviews & Comparison (Master Audit Query) ---");
    const complexPrompt = "Find me a stylish red checked shirt in size XL under ₹1,000, with good reviews. Compare the best options and show me the top five.";
    const intentRes = await intentEngine.processRequest(complexPrompt, null);
    const intent = intentRes.intent;

    assert.ok(intent.intent === "find" || intent.intent === "filter", "Primary intent should be find or filter");
    assert.strictEqual(intent.entities.category, "shirt", "Category must be shirt");
    assert.strictEqual(intent.filters.color, "red", "Color must be red");
    assert.strictEqual(intent.filters.pattern, "checked", "Pattern must be checked");
    assert.strictEqual(intent.filters.size, "XL", "Size must be XL");
    assert.strictEqual(intent.constraints.maxPrice, 1000, "Max price must be ₹1,000");
    assert.strictEqual(intent.constraints.minRating, 4, "Min rating must be 4★ from 'good reviews'");
    assert.strictEqual(intent.relativeRef?.count, 5, "Relative limit must be top 5");

    const mockCandidates: RepeatedItem[] = [
      {
        elementId: "item-highlander",
        title: "Highlander Red Checked Casual Shirt",
        price: { raw: "₹699", amount: 699, currency: "INR" },
        rating: { raw: "4.6★", score: 4.6, maxScore: 5 },
        metaText: ["Size: XL, XXL"],
        bounds: { x: 0, y: 0, width: 200, height: 300 },
      },
      {
        elementId: "item-roadster",
        title: "Roadster Men Red & Black Checked Shirt",
        price: { raw: "₹799", amount: 799, currency: "INR" },
        rating: { raw: "4.4★", score: 4.4, maxScore: 5 },
        metaText: ["Size: XL"],
        bounds: { x: 0, y: 0, width: 200, height: 300 },
      },
      {
        elementId: "item-mast",
        title: "Mast & Harbour Red Checked Cotton Shirt",
        price: { raw: "₹949", amount: 949, currency: "INR" },
        rating: { raw: "4.2★", score: 4.2, maxScore: 5 },
        metaText: ["Size: XL"],
        bounds: { x: 0, y: 0, width: 200, height: 300 },
      },
      {
        elementId: "item-overprice",
        title: "WROGN Red Checked Casual Shirt",
        price: { raw: "₹1,299", amount: 1299, currency: "INR" },
        rating: { raw: "4.5★", score: 4.5, maxScore: 5 },
        metaText: ["Size: XL"],
        bounds: { x: 0, y: 0, width: 200, height: 300 },
      },
      {
        elementId: "item-lowrating",
        title: "Brand X Red Checked Shirt",
        price: { raw: "₹850", amount: 850, currency: "INR" },
        rating: { raw: "3.2★", score: 3.2, maxScore: 5 },
        metaText: ["Size: XL"],
        bounds: { x: 0, y: 0, width: 200, height: 300 },
      },
      {
        elementId: "item-wrongpattern",
        title: "Roadster Solid Red Shirt",
        price: { raw: "₹649", amount: 649, currency: "INR" },
        rating: { raw: "4.3★", score: 4.3, maxScore: 5 },
        metaText: ["Size: XL"],
        bounds: { x: 0, y: 0, width: 200, height: 300 },
      },
    ];

    const resultsPageContext = buildMockIntelligence({
      repeatedGroups: [
        {
          containerSelector: ".product-grid",
          inferredType: "product-like",
          count: mockCandidates.length,
          items: mockCandidates,
        },
      ],
    });

    const matches = matchItemsOnPage(intent, resultsPageContext);

    // Strict non-fabrication: only 3 verified products exist, so exactly 3 must be returned!
    assert.strictEqual(matches.length, 3, "Only 3 products satisfy all constraints; exactly 3 must be returned (no invented products)");
    assert.strictEqual(matches[0].elementId, "item-highlander", "Top ranked must be highest rating (4.6★)");
    assert.strictEqual(matches[1].elementId, "item-roadster", "Second ranked must be 4.4★");
    assert.strictEqual(matches[2].elementId, "item-mast", "Third ranked must be 4.2★");

    // Verify rejection reasons
    const overpriceEval = evaluateItemMatch(mockCandidates[3], intent);
    assert.strictEqual(overpriceEval.matchClassification, "rejected");

    const lowratingEval = evaluateItemMatch(mockCandidates[4], intent);
    assert.strictEqual(lowratingEval.matchClassification, "rejected");

    const wrongpatternEval = evaluateItemMatch(mockCandidates[5], intent);
    assert.strictEqual(wrongpatternEval.matchClassification, "rejected");

    console.log("✓ Test 12: Master audit query independently verifies category, color, pattern, size, budget, rating, and returns only 3 verified matches: PASS");
  }

  // =========================================================================
  // TEST 13: Task Completion Integrity & Consequential Action Guard Rules
  // =========================================================================
  {
    console.log("\n--- TEST 13: Task Completion Integrity & Consequential Action Guard Rules ---");

    const shoppingQuery = "Find me a red checked shirt in size XL under ₹1,000.";
    const intentRes = await intentEngine.processRequest(shoppingQuery, null);
    const intent = intentRes.intent;

    // Rule 1: Search results page reached with items, but Size XL unverified -> PARTIALLY COMPLETED (never COMPLETED)
    const searchResultsPage = buildMockIntelligence({
      url: "https://www.myntra.com/shirts?f=Color%3Ared%3A%3APattern%3Achecked",
      headings: [{ level: 1, text: "Shirts for Men" }],
      repeatedGroups: [
        {
          containerSelector: ".product-grid",
          inferredType: "product-like",
          count: 50,
          items: [
            {
              elementId: "item-catalog-1",
              title: "Roadster Men Red Checked Shirt",
              price: { raw: "₹699", amount: 699, currency: "INR" },
              bounds: { x: 0, y: 0, width: 200, height: 300 },
            },
          ],
        },
      ],
    });

    const verifySearchPage = verifyFinalWebsiteState(searchResultsPage, intent);
    assert.strictEqual(
      verifySearchPage.status,
      "PARTIALLY COMPLETED",
      "Search results page without verified size must NOT be marked COMPLETED"
    );
    assert.notStrictEqual(
      verifySearchPage.status,
      "COMPLETED",
      "Must never equate opening a search results page with task completion"
    );

    // Rule 2: Deep inspection finds product satisfying all mandatory constraints -> COMPLETED
    const verifiedProduct = {
      elementId: "item-catalog-1",
      title: "Roadster Men Red Checked Shirt",
      price: { raw: "₹699", amount: 699, currency: "INR" },
      rating: { raw: "4.4★", score: 4.4, maxScore: 5 },
      link: { href: "https://www.myntra.com/shirts/roadster/123", text: "Roadster Red Checked Shirt" },
      imageUrl: "https://assets.myntassets.com/roadster.jpg",
      matchClassification: "confirmed" as const,
      score: 10,
      verifiedConditions: [
        "Category shirt confirmed",
        "Color red confirmed",
        "Pattern checked confirmed",
        "Size XL in stock",
        "Price ₹699 <= ₹1,000",
      ],
      unverifiedConditions: [],
      reasons: ["Size XL verified in stock", "Price within budget"],
    };

    const verifyWithConfirmedProduct = verifyFinalWebsiteState(searchResultsPage, intent, {
      verifiedCandidateProducts: [verifiedProduct],
    });
    assert.strictEqual(
      verifyWithConfirmedProduct.status,
      "COMPLETED",
      "Status must be COMPLETED when a confirmed product satisfies all mandatory constraints"
    );
    assert.strictEqual(verifyWithConfirmedProduct.confirmedMatches?.length, 1);

    // Rule 3: Zero results page -> FAILED
    const zeroResultsPage = buildMockIntelligence({
      url: "https://www.myntra.com/shirts",
      headings: [{ level: 1, text: "0 Results Found" }],
      repeatedGroups: [],
    });
    const verifyZero = verifyFinalWebsiteState(zeroResultsPage, intent);
    assert.strictEqual(verifyZero.status, "FAILED", "Zero results must declare FAILED");

    // Rule 4: Consequential actions (purchases, payments, messages) cannot be auto-executed
    const purchaseStep: ActionPlanStep = {
      id: "step-buy",
      type: "click",
      targetLabel: "Place Order & Pay ₹699",
      description: "Place order and charge payment method",
      confidence: 0.9,
    };
    const buyPlan: ActionPlan = {
      id: "plan-purchase-test",
      status: "proposed",
      steps: [purchaseStep],
      matchedItems: [],
      explanation: "Purchase product",
    };

    const { isEligibleForAutoExecution } = await import("../src/execution/high-risk");
    const autoEligible = isEligibleForAutoExecution(buyPlan);
    assert.strictEqual(
      autoEligible,
      false,
      "Consequential action (order/payment) must NEVER be automatically executed without user confirmation"
    );

    console.log("✓ Test 13: Task completion state integrity rules (COMPLETED / PARTIAL / FAILED / Consequential Guards) strictly enforced: PASS");
  }

  console.log("\n======================================================================");
  console.log("🎉 ALL 13 SHOPPING REGRESSION TESTS PASSED WITH 100% SUCCESS!");
  console.log("======================================================================\n");
}

runShoppingRegressionSuite().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
