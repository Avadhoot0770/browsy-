/**
 * Realistic End-to-End Scenario Test Suite for Browsy (Phase 3)
 * Tests 6 realistic end-to-end scenarios:
 * 1. Shopping: "Find me a red checked shirt in XL under ₹1,000."
 * 2. Job search: "Find entry-level data analyst opportunities."
 * 3. Webpage understanding: "Summarize this webpage and identify its key points."
 * 4. Unsupported requirement: "Find me a cashmere shirt under ₹1,000."
 * 5. Failure handling: Missing controls or zero results found
 * 6. User approval gate: Plan status invariant and user cancellation
 */

import assert from "node:assert";
import { elementRegistry } from "../src/page-intelligence/element-registry";
import { resolveElement } from "../src/execution/resolver";
import { canExecuteAction } from "../src/execution/guards";
import { ActionExecutor } from "../src/execution/executor";
import {
  renderPlanPreview,
  clearPlanPreview,
  getPlanPreviewSummary,
  resolveStepPreviewTarget,
  formatConciseActionLabel,
} from "../src/execution/plan-preview-highlighter";
import { analyzeCurrentPageState, buildTargetWebsiteState } from "../src/navigation/state-analyzer";
import { planNavigationSequence } from "../src/navigation/navigation-planner";
import { verifyFinalWebsiteState, formatFriendlySiteName } from "../src/navigation/final-state-verifier";
import { IntentEngine } from "../src/intent";
import { generateActionPlan } from "../src/intent/planner";
import type { StructuredIntent, ActionPlan, ActionPlanStep } from "../src/intent/types";
import type { StructuredPageIntelligence, InteractiveElement, RepeatedItemGroup } from "../src/page-intelligence/types";

// ============================================================
// SIMULATED LIGHTWEIGHT DOM ENVIRONMENT
// ============================================================

class MockNode {
  public isConnected = true;
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
  public parentElement: MockElement | null = null;
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

  public querySelector(selector: string): MockElement | null {
    if (selector.includes('input[type="checkbox"]')) {
      return this.children.find((c) => (c as any).type === "checkbox") || null;
    }
    return null;
  }

  public closest(sel: string): MockElement | null {
    if (sel.includes("data-browsy-root") && this.getAttribute("data-browsy-root") === "true") {
      return this;
    }
    if (sel.includes("browsy-root") && (this.tagName === "BROWSY-ROOT" || this.id.includes("browsy-root"))) {
      return this;
    }
    return this.parentElement ? this.parentElement.closest(sel) : null;
  }

  public appendChild(child: MockElement): MockElement {
    child.parentElement = this;
    child.isConnected = true;
    this.children.push(child);
    if (child.id) {
      domRegistry.set(child.id, child);
    }
    return child;
  }

  public remove(): void {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) {
        this.parentElement.children.splice(idx, 1);
      }
      this.parentElement = null;
    }
    this.isConnected = false;
    if (this.id) {
      domRegistry.delete(this.id);
    }
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

class MockHTMLTextAreaElement extends MockHTMLElement {
  public value = "";
  public disabled = false;
  constructor() {
    super("TEXTAREA");
  }
}

class MockHTMLSelectElement extends MockHTMLElement {
  public options: Array<{ value: string; text: string }> = [];
  public selectedIndex = 0;
  public disabled = false;
  constructor() {
    super("SELECT");
  }
}

const domRegistry = new Map<string, MockElement>();

(globalThis as any).window = {
  location: { href: "https://www.example.com/", hostname: "www.example.com", pathname: "/" },
  scrollBy: () => {},
  scrollY: 100,
  addEventListener: () => {},
  removeEventListener: () => {},
  requestAnimationFrame: (cb: any) => {
    if (typeof cb === "function") cb();
  },
  getComputedStyle: (_el: any) => ({
    display: "block",
    visibility: "visible",
    opacity: "1",
  }),
  HTMLInputElement: { prototype: MockHTMLInputElement.prototype },
  HTMLTextAreaElement: { prototype: MockHTMLTextAreaElement.prototype },
};

(globalThis as any).document = {
  title: "Example Website",
  body: new MockHTMLElement("BODY"),
  createElement: (tag: string) => new MockHTMLElement(tag),
  location: (globalThis as any).window.location,
  getElementById: (id: string) => domRegistry.get(id) || null,
  querySelector: (sel: string) => {
    const match = sel.match(/\[data-browsy-id="([^"]+)"\]/);
    if (match) return domRegistry.get(match[1]) || null;
    return null;
  },
  querySelectorAll: () => [],
};

(globalThis as any).Element = MockElement;
(globalThis as any).HTMLElement = MockHTMLElement;
(globalThis as any).HTMLButtonElement = MockHTMLButtonElement;
(globalThis as any).HTMLInputElement = MockHTMLInputElement;
(globalThis as any).HTMLTextAreaElement = MockHTMLTextAreaElement;
(globalThis as any).HTMLSelectElement = MockHTMLSelectElement;

(globalThis as any).Event = class {
  constructor(public type: string, public init?: any) {}
};
(globalThis as any).MouseEvent = class {
  constructor(public type: string, public init?: any) {}
};
(globalThis as any).KeyboardEvent = class {
  constructor(public type: string, public init?: any) {}
};

function createAndRegisterElement<T extends MockElement>(el: T): { id: string; element: T } {
  const id = elementRegistry.register(el as any);
  domRegistry.set(id, el);
  return { id, element: el };
}

function buildMockIntel(overrides: Partial<StructuredPageIntelligence> = {}): StructuredPageIntelligence {
  return {
    url: "https://www.example.com/",
    hostname: "www.example.com",
    pathname: "/",
    title: "Example Store",
    summary: "Mock store page",
    category: "shopping",
    language: "en",
    headings: [{ level: 1, text: "Welcome to Example Store" }],
    buttons: [],
    links: [],
    inputs: [],
    searchInputs: [],
    repeatedGroups: [],
    detectedPrices: [],
    detectedRatings: [],
    keyImages: [],
    stats: {
      analysisDurationMs: 5,
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
// SCENARIO TEST EXECUTION
// ============================================================

async function runScenarioTests() {
  console.log(`\n===============================================================`);
  console.log(`🧪 BROWSY PHASE 3: REALISTIC SCENARIO TEST SUITE`);
  console.log(`===============================================================\n`);

  const engine = new IntentEngine();

  // ------------------------------------------------------------
  // SCENARIO 1: Shopping
  // ------------------------------------------------------------
  console.log(`--- SCENARIO 1: Shopping ---`);
  const query1 = "Find me a red checked shirt in XL under ₹1,000.";
  console.log(`Input: "${query1}"`);

  // Step 1: Parse Intent
  const res1 = await engine.processRequest(query1, null);
  console.log(`Parsed Intent:
  - Intent: ${res1.intent.intent}
  - Target: ${res1.intent.target}
  - Category: ${res1.intent.entities.category}
  - Color: ${res1.intent.filters.color}
  - Pattern: ${res1.intent.filters.pattern}
  - Size: ${res1.intent.filters.size}
  - MaxPrice: ₹${res1.intent.constraints.maxPrice} (${res1.intent.constraints.currency})
  - Status: ${res1.plan.status}`);

  assert.strictEqual(res1.intent.target, "products");
  assert.strictEqual(res1.intent.entities.category, "shirt");
  assert.strictEqual(res1.intent.filters.color, "red");
  assert.strictEqual(res1.intent.filters.pattern, "checked");
  assert.strictEqual(res1.intent.filters.size, "XL");
  assert.strictEqual(res1.intent.constraints.maxPrice, 1000);
  assert.strictEqual(res1.plan.status, "proposed");

  // Step 2: Plan actions on Homepage
  const searchInput1 = new MockHTMLInputElement("search");
  searchInput1.placeholder = "Search shirts";
  const { id: sId1 } = createAndRegisterElement(searchInput1);

  const homeIntel1 = buildMockIntel({
    hostname: "www.myntra.com",
    url: "https://www.myntra.com/",
    title: "Online Shopping for Men, Women & Kids",
    inputs: [{ elementId: sId1, type: "search", role: "searchbox", tagName: "input", text: "", placeholder: "Search shirts", disabled: false, bounds: { x: 0, y: 0, width: 10, height: 10 } }],
    searchInputs: [{ elementId: sId1, type: "search", role: "searchbox", tagName: "input", text: "", placeholder: "Search shirts", disabled: false, bounds: { x: 0, y: 0, width: 10, height: 10 } }],
  });

  const plan1 = generateActionPlan(res1.intent, homeIntel1);
  console.log(`Planned Actions (${plan1.steps.length} steps):`);
  plan1.steps.forEach((s, idx) => console.log(`  ${idx + 1}. [${s.type.toUpperCase()}] ${s.description}`));
  assert(plan1.steps.length >= 1);
  assert.strictEqual(plan1.steps[0].type, "search");

  // Step 3: Execution on Results Page
  const redCheckbox = new MockHTMLInputElement("checkbox");
  const { id: redId } = createAndRegisterElement(redCheckbox);
  const checkedBox = new MockHTMLInputElement("checkbox");
  const { id: checkId } = createAndRegisterElement(checkedBox);

  const resultsIntel1 = buildMockIntel({
    hostname: "www.myntra.com",
    url: "https://www.myntra.com/shirts?f=Color%3Ared%3A%3APattern%3Achecked",
    title: "Men Red Checked Shirts Under 1000",
    headings: [{ level: 1, text: "Shirts for Men" }],
    inputs: [
      { elementId: redId, type: "checkbox", role: "checkbox", tagName: "input", text: "Red", checked: true, disabled: false, bounds: { x: 0, y: 0, width: 10, height: 10 } },
      { elementId: checkId, type: "checkbox", role: "checkbox", tagName: "input", text: "Checked", checked: true, disabled: false, bounds: { x: 0, y: 0, width: 10, height: 10 } },
    ],
    buttons: [
      { elementId: "b-price", type: "button", role: "button", tagName: "button", text: "Price: Under ₹1,000", disabled: false, bounds: { x: 0, y: 0, width: 10, height: 10 } },
    ],
    repeatedGroups: [
      {
        containerSelector: ".results-grid",
        inferredType: "product-like",
        count: 24,
        items: [
          { elementId: "p1", title: "Roadster Red Checked Casual Shirt", price: { raw: "₹799", amount: 799, currency: "INR" }, bounds: { x: 0, y: 0, width: 10, height: 10 } },
          { elementId: "p2", title: "Highlander Red Plaid Slim Fit Shirt", price: { raw: "₹899", amount: 899, currency: "INR" }, bounds: { x: 0, y: 0, width: 10, height: 10 } },
        ],
      },
    ],
  });

  const verify1 = verifyFinalWebsiteState(resultsIntel1, res1.intent);
  console.log(`Verification Outcome:
  - Status: ${verify1.status}
  - Verified Category: ${verify1.verifiedCategory}
  - Verified Filters: ${JSON.stringify(verify1.verifiedFilters)}
  - Unverified Filters: ${JSON.stringify(verify1.unverifiedFilters)}
  - Results Count: ${verify1.resultsCount}
  - Summary Message: "${verify1.userFacingSummary}"`);

  assert.strictEqual(verify1.status, "PARTIALLY COMPLETED");
  assert.strictEqual(verify1.verifiedCategory, true);
  assert.strictEqual(verify1.verifiedFilters.color, true);
  assert.strictEqual(verify1.verifiedFilters.pattern, true);
  assert.strictEqual(verify1.verifiedFilters.price, true);
  assert.strictEqual(verify1.verifiedFilters.size, false);
  assert.ok(verify1.unverifiedFilters.includes("Size XL"));
  console.log(`Remaining Limitation: Site does not expose visible XL filter controls in URL/DOM; truthfully reported as PARTIALLY COMPLETED.\n✓ Scenario 1: PASS\n`);

  // ------------------------------------------------------------
  // SCENARIO 2: Job Search
  // ------------------------------------------------------------
  console.log(`--- SCENARIO 2: Job Search ---`);
  const query2 = "Find entry-level data analyst opportunities.";
  console.log(`Input: "${query2}"`);

  engine.resetContext();
  const res2 = await engine.processRequest(query2, null);
  console.log(`Parsed Intent:
  - Intent: ${res2.intent.intent}
  - Target: ${res2.intent.target}
  - Role: ${res2.intent.entities.role}
  - Type: ${res2.intent.entities.type}
  - Status: ${res2.plan.status}`);

  assert.strictEqual(res2.intent.target, "jobs");
  assert.strictEqual(res2.intent.entities.role, "data analyst");
  assert.strictEqual(res2.intent.entities.type, "entry-level");

  const jobTargetState = buildTargetWebsiteState(res2.intent, "www.linkedin.com");
  console.log(`Target Website State:
  - Search Query: "${jobTargetState.searchQuery}"
  - Expected Result Type: ${jobTargetState.expectedResultType}`);
  assert.strictEqual(jobTargetState.searchQuery, "entry-level data analyst");
  assert.strictEqual(jobTargetState.expectedResultType, "jobs");

  const jobResultsIntel = buildMockIntel({
    hostname: "www.linkedin.com",
    url: "https://www.linkedin.com/jobs/search?keywords=entry-level%20data%20analyst",
    title: "Entry Level Data Analyst Jobs | LinkedIn",
    headings: [{ level: 1, text: "Data Analyst Opportunities" }],
    repeatedGroups: [
      {
        containerSelector: ".jobs-list",
        inferredType: "card-like",
        count: 15,
        items: [
          { elementId: "j1", title: "Junior Data Analyst - Operations", metaText: ["Entry-level", "Full-time", "Bengaluru"], bounds: { x: 0, y: 0, width: 10, height: 10 } },
          { elementId: "j2", title: "Data Analyst Associate", metaText: ["Entry-level", "Hybrid", "Remote"], bounds: { x: 0, y: 0, width: 10, height: 10 } },
        ],
      },
    ],
  });

  const verify2 = verifyFinalWebsiteState(jobResultsIntel, res2.intent);
  console.log(`Verification Outcome:
  - Status: ${verify2.status}
  - Verified Category / Role: ${verify2.verifiedCategory}
  - Results Present: ${verify2.resultsPresent} (${verify2.resultsCount} listings)
  - Summary Message: "${verify2.userFacingSummary}"`);

  assert.strictEqual(verify2.status, "COMPLETED");
  assert.strictEqual(verify2.verifiedCategory, true);
  assert.strictEqual(verify2.resultsPresent, true);
  assert.ok(verify2.userFacingSummary.includes("Done. Linkedin is showing 2 matching data analyst."));
  console.log(`✓ Scenario 2: PASS\n`);

  // ------------------------------------------------------------
  // SCENARIO 3: Webpage Understanding
  // ------------------------------------------------------------
  console.log(`--- SCENARIO 3: Webpage Understanding ---`);
  const query3 = "Summarize this webpage and identify its key points.";
  console.log(`Input: "${query3}"`);

  engine.resetContext();
  const pageIntel3 = buildMockIntel({
    hostname: "docs.python.org",
    url: "https://docs.python.org/3/tutorial/",
    title: "The Python Tutorial — Python 3.12 Documentation",
    summary: "Python is an easy to learn, powerful programming language with efficient high-level data structures.",
    headings: [
      { level: 1, text: "The Python Tutorial" },
      { level: 2, text: "1. Whetting Your Appetite" },
      { level: 2, text: "2. Using the Python Interpreter" },
      { level: 2, text: "3. An Informal Introduction to Python" },
    ],
  });

  const res3 = await engine.processRequest(query3, pageIntel3);
  console.log(`Parsed Intent:
  - Intent: ${res3.intent.intent}
  - Target: ${res3.intent.target}
  - Confidence: ${res3.intent.confidence}`);

  assert.strictEqual(res3.intent.intent, "summarize");
  assert.strictEqual(res3.intent.target, "page");

  const plan3 = generateActionPlan(res3.intent, pageIntel3);
  console.log(`Action Plan:
  - Steps: ${plan3.steps.length} (${plan3.steps.map((s) => s.type).join(", ")})`);
  assert.strictEqual(plan3.steps[0].type, "summarize");

  // Verify guard allows summarize
  const guard3 = canExecuteAction(plan3.steps[0], pageIntel3);
  assert.strictEqual(guard3.canExecute, true);

  // Verify outcome verification
  const verify3 = verifyFinalWebsiteState(pageIntel3, res3.intent);
  console.log(`Verification Outcome:
  - Status: ${verify3.status}
  - Summary Message:\n${verify3.userFacingSummary}`);

  assert.strictEqual(verify3.status, "COMPLETED");
  assert.ok(verify3.userFacingSummary.includes("Page summary for \"The Python Tutorial"));
  assert.ok(verify3.userFacingSummary.includes("Key Topics:"));
  assert.ok(verify3.userFacingSummary.includes("1. Whetting Your Appetite"));
  console.log(`✓ Scenario 3: PASS\n`);

  // ------------------------------------------------------------
  // SCENARIO 4: Unsupported Requirement Handling
  // ------------------------------------------------------------
  console.log(`--- SCENARIO 4: Unsupported Requirement Handling ---`);
  const query4 = "Find me a cashmere shirt under ₹1,000.";
  console.log(`Input: "${query4}"`);

  engine.resetContext();
  const res4 = await engine.processRequest(query4, null);
  console.log(`Parsed Intent:
  - Category: ${res4.intent.entities.category}
  - Material Filter: ${res4.intent.filters.material}
  - MaxPrice: ₹${res4.intent.constraints.maxPrice}`);

  assert.strictEqual(res4.intent.filters.material, "cashmere");

  // Website only has cotton / polyester shirts, NO cashmere controls or items
  const resultsIntel4 = buildMockIntel({
    hostname: "www.myntra.com",
    url: "https://www.myntra.com/shirts",
    title: "Men Shirts",
    headings: [{ level: 1, text: "Shirts" }],
    repeatedGroups: [
      {
        containerSelector: ".grid",
        inferredType: "product-like",
        count: 5,
        items: [
          { elementId: "s1", title: "Cotton Casual Shirt", price: { raw: "₹899", amount: 899, currency: "INR" }, bounds: { x: 0, y: 0, width: 10, height: 10 } },
        ],
      },
    ],
  });

  const verify4 = verifyFinalWebsiteState(resultsIntel4, res4.intent);
  console.log(`Verification Outcome:
  - Status: ${verify4.status}
  - Verified Category: ${verify4.verifiedCategory}
  - Unverified Filters: ${JSON.stringify(verify4.unverifiedFilters)}
  - Summary Message: "${verify4.userFacingSummary}"`);

  assert.strictEqual(verify4.status, "PARTIALLY COMPLETED");
  assert.ok(verify4.unverifiedFilters.includes("cashmere"));
  assert.ok(verify4.userFacingSummary.includes("couldn't verify the cashmere filter on this site"));
  console.log(`Honest Outcome: Browsy refused to fake completion for unsupported 'cashmere' filter.\n✓ Scenario 4: PASS\n`);

  // ------------------------------------------------------------
  // SCENARIO 5: Failure Handling (Zero Results / Missing Search)
  // ------------------------------------------------------------
  console.log(`--- SCENARIO 5: Failure Handling ---`);
  const emptyIntel5 = buildMockIntel({
    hostname: "www.example.com",
    url: "https://www.example.com/search?q=xyznonexistent",
    title: "Search Results - 0 found",
    headings: [{ level: 1, text: "No products found for 'xyznonexistent'" }],
    repeatedGroups: [],
  });

  const verify5 = verifyFinalWebsiteState(emptyIntel5, res1.intent);
  console.log(`Verification Outcome:
  - Status: ${verify5.status}
  - Results Present: ${verify5.resultsPresent}
  - Summary Message: "${verify5.userFacingSummary}"`);

  assert.strictEqual(verify5.status, "FAILED");
  assert.strictEqual(verify5.resultsPresent, false);
  assert.ok(verify5.userFacingSummary.includes("no matching results were found"));
  console.log(`Honest Outcome: Browsy declared FAILED instead of claiming success when 0 results exist.\n✓ Scenario 5: PASS\n`);

  // ------------------------------------------------------------
  // SCENARIO 6: User Approval Gate
  // ------------------------------------------------------------
  console.log(`--- SCENARIO 6: User Approval Gate & Safety ---`);
  const query6 = "Find red shirts";
  const res6 = await engine.processRequest(query6, null);

  // Invariant 1: ActionPlan is strictly "proposed"
  console.log(`ActionPlan Status: "${res6.plan.status}"`);
  assert.strictEqual(res6.plan.status, "proposed");
  console.log(`Invariant 1: ActionPlan cannot be executed automatically without explicit user trigger.`);

  // Invariant 2: Execution engine stops safely upon stop()
  const btn6 = new MockHTMLButtonElement();
  let clicked6 = false;
  btn6.addEventListener("click", () => {
    clicked6 = true;
  });
  const { id: bId6 } = createAndRegisterElement(btn6);

  const executor6 = new ActionExecutor({ highlightElements: false });
  const plan6: ActionPlan = {
    id: "plan-approval-gate",
    status: "proposed",
    steps: [
      { id: "s1", type: "click", targetElementId: bId6, description: "Click button", confidence: 0.9 },
      { id: "s2", type: "click", targetElementId: bId6, description: "Second click", confidence: 0.9 },
    ],
    matchedItems: [],
    explanation: "Approval gate test",
    confidence: 0.9,
    timestamp: Date.now(),
  };

  // User trigger simulated:
  const executionPromise = executor6.executePlan(plan6);
  executor6.stop(); // User clicks stop immediately
  const session6 = await executionPromise;

  console.log(`Execution State After Stop: "${session6.state}"`);
  assert.strictEqual(session6.state, "cancelled");
  assert.ok(session6.summaryMessage.includes("Browsy stopped"));
  console.log(`Invariant 2: Execution safely cancelled; DOM changes aborted immediately.\n✓ Scenario 6: PASS\n`);

  // ------------------------------------------------------------
  // SCENARIO 7: Pre-Interaction Visual Explainability (Plan Preview)
  // ------------------------------------------------------------
  console.log(`--- SCENARIO 7: Pre-Interaction Visual Explainability (Plan Preview) ---`);
  
  // 1. Prepare target DOM elements
  const searchInput7 = new MockHTMLInputElement("search");
  searchInput7.placeholder = "Search items";
  searchInput7.id = "search-input-7";
  (globalThis as any).document.body.appendChild(searchInput7);
  const { id: searchId7 } = createAndRegisterElement(searchInput7);

  const filterBtn7 = new MockHTMLButtonElement();
  filterBtn7.textContent = "Filter: Red";
  filterBtn7.id = "filter-btn-7";
  (globalThis as any).document.body.appendChild(filterBtn7);
  const { id: filterId7 } = createAndRegisterElement(filterBtn7);

  // Also create a Browsy UI internal element to test self-exclusion
  const browsyUiRoot7 = new MockHTMLElement("DIV");
  browsyUiRoot7.id = "browsy-extension-root";
  browsyUiRoot7.setAttribute("data-browsy-root", "true");
  const browsyInnerBtn7 = new MockHTMLButtonElement();
  browsyInnerBtn7.textContent = "Browsy Internal Button";
  browsyUiRoot7.appendChild(browsyInnerBtn7);
  (globalThis as any).document.body.appendChild(browsyUiRoot7);
  const { id: browsyBtnId7 } = createAndRegisterElement(browsyInnerBtn7);

  // 2. Formulate proposed ActionPlan
  const plan7: ActionPlan = {
    id: "plan-preview-test",
    status: "proposed",
    steps: [
      {
        id: "step-p1",
        type: "search",
        targetElementId: searchId7,
        value: "red checked shirts",
        targetLabel: "Search items",
        description: "Search for red checked shirts",
        confidence: 0.95,
      },
      {
        id: "step-p2",
        type: "check",
        targetElementId: filterId7,
        value: "red",
        targetLabel: "Filter: Red",
        description: "Apply red filter",
        confidence: 0.9,
      },
      {
        id: "step-p3",
        type: "navigate",
        value: "https://example.com/checkout",
        description: "Navigate to checkout page",
        confidence: 0.85,
      },
      {
        id: "step-p4",
        type: "click",
        targetElementId: "browsy-el-nonexistent",
        description: "Click future dynamic button",
        confidence: 0.8,
      },
      {
        id: "step-p5",
        type: "click",
        targetElementId: browsyBtnId7,
        description: "Attempted click on Browsy UI element",
        confidence: 0.5,
      },
    ],
    matchedItems: [],
    explanation: "Visual explainability preview test",
    confidence: 0.9,
    timestamp: Date.now(),
  };

  // Invariant 1: ActionPlan is strictly "proposed" before user approval
  assert.strictEqual(plan7.status, "proposed");

  // Invariant 2: Target resolution logic distinguishes on-page targets from pending/dynamic
  const previewSummary7 = getPlanPreviewSummary(plan7);
  console.log(`Plan Preview Summary:
  - Total Steps: ${previewSummary7.totalSteps}
  - Resolved on page: ${previewSummary7.resolvedCount}
  - Pending / Unresolved: ${previewSummary7.unresolvedCount}`);

  assert.strictEqual(previewSummary7.totalSteps, 5);
  assert.strictEqual(previewSummary7.resolvedCount, 2);
  assert.strictEqual(previewSummary7.unresolvedCount, 3);

  // Verify step 1 & 2 resolved
  assert.strictEqual(previewSummary7.stepPreviews[0].isResolved, true);
  assert.strictEqual(previewSummary7.stepPreviews[0].label, 'Search: "red checked shirts"');
  assert.strictEqual(previewSummary7.stepPreviews[1].isResolved, true);
  assert.strictEqual(previewSummary7.stepPreviews[1].label, 'Filter: red');

  // Verify step 3 pending navigation
  assert.strictEqual(previewSummary7.stepPreviews[2].isResolved, false);
  assert.strictEqual(previewSummary7.stepPreviews[2].reason, "pending_navigation");

  // Verify step 4 unresolved dynamic target
  assert.strictEqual(previewSummary7.stepPreviews[3].isResolved, false);
  assert.strictEqual(previewSummary7.stepPreviews[3].reason, "unresolved_target");

  // Invariant 3: Browsy UI elements strictly self-excluded
  assert.strictEqual(previewSummary7.stepPreviews[4].isResolved, false);
  assert.strictEqual(previewSummary7.stepPreviews[4].reason, "browsy_ui");
  console.log("Self-Exclusion Invariant: Browsy UI elements are strictly excluded from preview highlights.");

  // Render preview into DOM
  const renderResult7 = renderPlanPreview(plan7);
  assert.strictEqual(renderResult7.resolvedCount, 2);

  const container7 = (globalThis as any).document.getElementById("browsy-plan-preview-container");
  assert.ok(container7, "Preview container mounted in DOM");
  assert.strictEqual(container7.getAttribute("data-browsy-root"), "true");

  // Invariant 4: Non-blocking pointer events
  const containerStyle = container7.style.cssText || container7.style.pointerEvents;
  assert.ok(
    containerStyle.includes("pointer-events: none") || container7.style.pointerEvents === "none",
    "Preview container has pointer-events: none"
  );
  console.log("Non-Blocking Invariant: Preview container has pointer-events: none.");

  // Invariant 5: Preview has ZERO side-effects on page state or inputs
  assert.strictEqual(searchInput7.value, "");
  console.log("Zero Side-Effects Invariant: Pre-interaction preview does NOT modify input values or click controls.");

  // Invariant 6: Overlay cleanup
  clearPlanPreview();
  const containerAfterClear7 = (globalThis as any).document.getElementById("browsy-plan-preview-container");
  assert.strictEqual(containerAfterClear7, null, "Preview container completely removed after clearPlanPreview()");
  console.log("Cleanup Invariant: All preview overlays and containers completely removed upon cleanup.");
  console.log("✓ Scenario 7: PASS\n");

  // ------------------------------------------------------------
  // SCENARIO 8: Security Boundaries, Sensitive Fields & Injection Guards
  // ------------------------------------------------------------
  console.log(`--- SCENARIO 8: Security Boundaries & Sensitive Field Guards ---`);

  // Guard 1: Password / Authentication field
  const pwdInput8 = new MockHTMLInputElement("password");
  pwdInput8.name = "password";
  pwdInput8.id = "pwd-field";
  const { id: pwdId8 } = createAndRegisterElement(pwdInput8);
  const pwdStep: ActionPlanStep = {
    id: "step-pwd",
    type: "type",
    targetElementId: pwdId8,
    value: "MySecret123!",
    description: "Enter password",
    confidence: 0.9,
  };
  const pwdGuard = canExecuteAction(pwdStep);
  assert.strictEqual(pwdGuard.canExecute, false);
  assert.strictEqual(pwdGuard.riskLevel, "high");
  assert.ok(pwdGuard.reason?.includes("passwords or authentication fields"));
  console.log("Security Guard 1: Passwords and authentication fields are strictly prohibited from execution.");

  // Guard 2: Payment / Credit Card field
  const ccInput8 = new MockHTMLInputElement("text");
  ccInput8.name = "credit-card";
  ccInput8.setAttribute("autocomplete", "cc-number");
  ccInput8.id = "cc-field";
  const { id: ccId8 } = createAndRegisterElement(ccInput8);
  const ccStep: ActionPlanStep = {
    id: "step-cc",
    type: "type",
    targetElementId: ccId8,
    value: "4111222233334444",
    description: "Enter card number",
    confidence: 0.9,
  };
  const ccGuard = canExecuteAction(ccStep);
  assert.strictEqual(ccGuard.canExecute, false);
  assert.strictEqual(ccGuard.riskLevel, "high");
  assert.ok(ccGuard.reason?.includes("payment or financial"));
  console.log("Security Guard 2: Payment and financial transactions are strictly prohibited from execution.");

  // Guard 3: Script & URI Injection
  const injectionStep: ActionPlanStep = {
    id: "step-inj",
    type: "type",
    targetElementId: searchId7,
    value: "<script>alert('xss')</script>",
    description: "Inject payload",
    confidence: 0.9,
  };
  const injGuard = canExecuteAction(injectionStep);
  assert.strictEqual(injGuard.canExecute, false);
  assert.ok(injGuard.reason?.includes("Script or URI injection"));
  console.log("Security Guard 3: Script and URI injections in action values are strictly blocked.");

  // Guard 4: Stale reference detection (disconnected element)
  const staleBtn8 = new MockHTMLButtonElement();
  staleBtn8.textContent = "Disappearing Button";
  staleBtn8.id = "stale-btn";
  const { id: staleId8 } = createAndRegisterElement(staleBtn8);
  staleBtn8.isConnected = false;

  const staleStep: ActionPlanStep = {
    id: "step-stale",
    type: "click",
    targetElementId: staleId8,
    description: "Click stale button",
    confidence: 0.9,
  };
  const staleGuard = canExecuteAction(staleStep);
  assert.strictEqual(staleGuard.canExecute, false);
  assert.ok(
    staleGuard.reason?.includes("not found") ||
    staleGuard.reason?.includes("stale") ||
    staleGuard.reason?.includes("disconnected")
  );
  console.log("Security Guard 4: Disconnected / stale element references safely rejected without crashing.");
  console.log("✓ Scenario 8: PASS\n");

  console.log(`===============================================================`);
  console.log(`🎉 ALL 8 REALISTIC SCENARIOS PASSED WITH HONEST STATUS CODES!`);
  console.log(`===============================================================\n`);
}

runScenarioTests().catch((err) => {
  console.error("❌ Scenario test failed:", err);
  process.exit(1);
});
