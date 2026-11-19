/**
 * Comprehensive Automated Test Suite for Browsy Stage 3 AI Intent Engine
 * Tests all 10 required intent categories and real page intelligence matching.
 */

import assert from "node:assert";
import {
  intentEngine,
  IntentEngine,
  HeuristicLocalProvider,
  validateStructuredIntent,
  validateActionPlan,
} from "../src/intent";
import type { StructuredPageIntelligence } from "../src/page-intelligence/types";

// Mock Realistic Page Intelligence representing the test store page
const mockPageContext: StructuredPageIntelligence = {
  url: "http://127.0.0.1:8080/",
  hostname: "127.0.0.1",
  pathname: "/",
  title: "Men's Checked Shirts - Browsy Test Store",
  summary: "BROWSY PAGE SUMMARY\nWebsite: 127.0.0.1\nPage: Men's Checked Shirts",
  headings: [
    { level: 1, text: "Men's Checked Shirts" },
    { level: 2, text: "Filters" },
    { level: 3, text: "Featured Collections" },
  ],
  searchInputs: [
    {
      elementId: "browsy-el-001",
      type: "search",
      role: "searchbox",
      tagName: "input",
      text: "",
      placeholder: "Search clothing, brands and more",
      disabled: false,
      bounds: { x: 420, y: 16, width: 440, height: 38 },
    },
  ],
  buttons: [
    {
      elementId: "browsy-el-014",
      type: "button",
      role: "button",
      tagName: "button",
      text: "Apply Filters",
      disabled: false,
      bounds: { x: 260, y: 480, width: 100, height: 36 },
    },
    {
      elementId: "browsy-el-015",
      type: "button",
      role: "button",
      tagName: "button",
      text: "Clear All",
      disabled: false,
      bounds: { x: 370, y: 480, width: 100, height: 36 },
    },
  ],
  inputs: [
    {
      elementId: "browsy-el-008",
      type: "checkbox",
      role: "checkbox",
      tagName: "input",
      inputType: "checkbox",
      text: "XL (Extra Large)",
      nearbyLabel: "XL",
      checked: true,
      disabled: false,
      bounds: { x: 260, y: 220, width: 18, height: 18 },
    },
    {
      elementId: "browsy-el-012",
      type: "radio",
      role: "radio",
      tagName: "input",
      inputType: "radio",
      text: "Under ₹1,000",
      nearbyLabel: "Under ₹1,000",
      checked: true,
      disabled: false,
      bounds: { x: 260, y: 340, width: 18, height: 18 },
    },
  ],
  links: [
    {
      elementId: "browsy-el-030",
      type: "link",
      role: "link",
      tagName: "a",
      text: "Contact",
      href: "http://127.0.0.1:8080/contact",
      disabled: false,
      bounds: { x: 800, y: 20, width: 60, height: 20 },
    },
  ],
  forms: [],
  repeatedGroups: [
    {
      containerSelector: "#catalog-results",
      inferredType: "product-like",
      count: 6,
      items: [
        {
          elementId: "browsy-el-022",
          title: "Roadster Red Buffalo Checked Casual Shirt",
          metaText: ["100% Pure Cotton", "Regular Fit", "Size: XL"],
          price: { raw: "₹799", amount: 799, currency: "INR" },
          rating: { raw: "4.2 ★", score: 4.2, maxScore: 5 },
          bounds: { x: 280, y: 150, width: 220, height: 360 },
        },
        {
          elementId: "browsy-el-023",
          title: "Highlander Crimson Red Checked Slim Fit Shirt",
          metaText: ["Breathable Cotton Blend", "Size: XL"],
          price: { raw: "₹899", amount: 899, currency: "INR" },
          rating: { raw: "4.4 ★", score: 4.4, maxScore: 5 },
          bounds: { x: 520, y: 150, width: 220, height: 360 },
        },
        {
          elementId: "browsy-el-024",
          title: "WROGN Men Deep Maroon Plaid Casual Shirt",
          metaText: ["Premium Twill Fabric", "Size: XL"],
          price: { raw: "₹949", amount: 949, currency: "INR" },
          rating: { raw: "4.1 ★", score: 4.1, maxScore: 5 },
          bounds: { x: 760, y: 150, width: 220, height: 360 },
        },
        {
          elementId: "browsy-el-025",
          title: "Dennis Lingo Rust Red Gingham Shirt",
          metaText: ["Pre-washed Soft Cotton", "Size: XL"],
          price: { raw: "₹699", amount: 699, currency: "INR" },
          rating: { raw: "4.3 ★", score: 4.3, maxScore: 5 },
          bounds: { x: 280, y: 530, width: 220, height: 360 },
        },
        {
          elementId: "browsy-el-026",
          title: "Mast & Harbour Navy & Red Checked Shirt",
          metaText: ["Standard Fit Everyday Wear", "Size: XL"],
          price: { raw: "₹849", amount: 849, currency: "INR" },
          rating: { raw: "4.0 ★", score: 4.0, maxScore: 5 },
          bounds: { x: 520, y: 530, width: 220, height: 360 },
        },
        {
          elementId: "browsy-el-027",
          title: "Here&Now Red Heavy Flannel Checked Shirt",
          metaText: ["Warm Brushed Flannel", "Size: XL"],
          price: { raw: "₹999", amount: 999, currency: "INR" },
          rating: { raw: "4.5 ★", score: 4.5, maxScore: 5 },
          bounds: { x: 760, y: 530, width: 220, height: 360 },
        },
      ],
    },
  ],
  detectedPrices: [{ raw: "₹799", amount: 799, currency: "INR" }],
  detectedRatings: [{ raw: "4.2 ★", score: 4.2, maxScore: 5 }],
  keyImages: [],
  stats: {
    analysisDurationMs: 4,
    totalInteractiveCount: 5,
    buttonCount: 2,
    linkCount: 1,
    inputCount: 2,
    searchCount: 1,
    formCount: 0,
    repeatedItemCount: 6,
    repeatedGroupCount: 1,
    headingCount: 3,
    imageCount: 0,
    priceCount: 1,
    ratingCount: 1,
    timestamp: Date.now(),
  },
  timestamp: Date.now(),
};

async function runAllIntentTests() {
  console.log(`\n==================================================`);
  console.log(`🧠 BROWSY STAGE 3 INTENT ENGINE TEST SUITE`);
  console.log(`==================================================\n`);

  const engine = new IntentEngine(new HeuristicLocalProvider());

  // TEST 1: Shopping intent
  console.log("Test 1: Shopping Intent");
  {
    const res = await engine.processRequest("Find me a red checked shirt in XL under ₹1,000.", mockPageContext);
    assert.strictEqual(res.intent.intent, "filter");
    assert.strictEqual(res.intent.target, "products");
    assert.strictEqual(res.intent.entities.category, "shirt");
    assert.strictEqual(res.intent.filters.color, "red");
    assert.strictEqual(res.intent.filters.pattern, "checked");
    assert.strictEqual(res.intent.filters.size, "XL");
    assert.strictEqual(res.intent.constraints.maxPrice, 1000);
    assert.strictEqual(res.intent.constraints.currency, "INR");
    assert.strictEqual(res.plan.status, "proposed");
    assert(res.matchedItems.length >= 3, `Expected at least 3 matching items, got ${res.matchedItems.length}`);
    console.log(`✓ Shopping Intent parsed and matched ${res.matchedItems.length} candidate items: PASS`);
  }

  // TEST 2: Job intent
  console.log("\nTest 2: Job Intent");
  {
    engine.resetContext();
    const res = await engine.processRequest("Find software engineering internships in Hyderabad.", null);
    assert.strictEqual(res.intent.target, "jobs");
    assert(res.intent.entities.role?.includes("software engineer"));
    assert.strictEqual(res.intent.entities.type, "internship");
    assert.strictEqual(res.intent.constraints.location?.toLowerCase(), "hyderabad");
    assert.strictEqual(res.plan.status, "proposed");
    console.log("✓ Job Intent parsed correctly: PASS");
  }

  // TEST 3: Travel intent
  console.log("\nTest 3: Travel Intent");
  {
    engine.resetContext();
    const res = await engine.processRequest("Find hotels in Bangalore under ₹3,000 with breakfast.", null);
    assert.strictEqual(res.intent.target, "travel");
    assert.strictEqual(res.intent.constraints.location?.toLowerCase(), "bangalore");
    assert.deepStrictEqual(res.intent.filters.amenities, ["breakfast"]);
    assert.strictEqual(res.plan.status, "proposed");
    console.log("✓ Travel Intent parsed correctly: PASS");
  }

  // TEST 4: Navigation intent
  console.log("\nTest 4: Navigation Intent");
  {
    engine.resetContext();
    const res = await engine.processRequest("Open the contact page.", mockPageContext);
    assert.strictEqual(res.intent.intent, "navigate");
    assert.strictEqual(res.intent.entities.destination?.toLowerCase(), "contact page");
    assert(res.plan.steps.some((s) => s.type === "navigate" && s.targetElementId === "browsy-el-030"));
    assert.strictEqual(res.plan.status, "proposed");
    console.log("✓ Navigation Intent parsed and mapped to link browsy-el-030: PASS");
  }

  // TEST 5: Comparison intent
  console.log("\nTest 5: Comparison Intent");
  {
    engine.resetContext();
    const res = await engine.processRequest("Compare the first three products.", mockPageContext);
    assert.strictEqual(res.intent.intent, "compare");
    assert.strictEqual(res.intent.relativeRef?.type, "first");
    assert.strictEqual(res.intent.relativeRef?.count, 3);
    assert.strictEqual(res.plan.status, "proposed");
    console.log("✓ Comparison Intent parsed correctly: PASS");
  }

  // TEST 6: Ambiguous request & Clarification
  console.log("\nTest 6: Ambiguous Request");
  {
    engine.resetContext();
    const res = await engine.processRequest("Find me something good.", null);
    assert.strictEqual(res.requiresClarification, true);
    assert(res.clarificationPrompt && res.clarificationPrompt.length > 5);
    assert.strictEqual(res.plan.steps.length, 0); // No actions proposed for ambiguous request
    console.log("✓ Ambiguous Request triggered clarification: PASS");
  }

  // TEST 7: Follow-up conversation context
  console.log("\nTest 7: Follow-up Conversation Context");
  {
    engine.resetContext();
    // Turn 1
    const res1 = await engine.processRequest("Find red shirts.", mockPageContext);
    assert.strictEqual(res1.intent.filters.color, "red");
    assert.strictEqual(res1.intent.entities.category, "shirt");

    // Turn 2: Follow-up modifying previous request
    const res2 = await engine.processRequest("Only XL.", mockPageContext);
    assert.strictEqual(res2.intent.filters.color, "red"); // Preserved from Turn 1
    assert.strictEqual(res2.intent.entities.category, "shirt"); // Preserved from Turn 1
    assert.strictEqual(res2.intent.filters.size, "XL"); // Added in Turn 2
    console.log("✓ Follow-up Request merged context successfully (red + shirt + XL): PASS");
  }

  // TEST 8: Relative reference ("cheapest one")
  console.log("\nTest 8: Relative Reference (Cheapest One)");
  {
    engine.resetContext();
    const res = await engine.processRequest("Show me the cheapest one.", mockPageContext);
    assert.strictEqual(res.intent.relativeRef?.type, "cheapest");
    assert.strictEqual(res.matchedItems.length, 1);
    assert.strictEqual(res.matchedItems[0].elementId, "browsy-el-025"); // ₹699 Dennis Lingo is cheapest
    assert.strictEqual(res.matchedItems[0].price?.amount, 699);
    console.log("✓ Relative Reference correctly identified lowest priced item (₹699): PASS");
  }

  // TEST 9: Current-page reference ("the red ones")
  console.log("\nTest 9: Current-Page Reference");
  {
    engine.resetContext();
    const res = await engine.processRequest("Show me the red ones.", mockPageContext);
    assert.strictEqual(res.intent.filters.color, "red");
    assert.strictEqual(res.intent.scope, "current_page");
    assert(res.matchedItems.length > 0);
    console.log(`✓ Current-Page Reference matched ${res.matchedItems.length} red items: PASS`);
  }

  // TEST 10: Unknown request (Graceful handling)
  console.log("\nTest 10: Unknown Request");
  {
    engine.resetContext();
    const res = await engine.processRequest("asdfghjkl", mockPageContext);
    assert.strictEqual(res.intent.intent, "unknown");
    assert(res.intent.confidence <= 0.2);
    assert(res.summaryMessage.includes("didn't quite catch that") || res.summaryMessage.includes("couldn't understand"));
    console.log("✓ Unknown Request handled gracefully without crashing: PASS");
  }

  // TEST 11: Schema Validators & Safety Invariant
  console.log("\nTest 11: Schema Validation & Safety Invariant");
  {
    const validIntent = {
      id: "intent-test",
      intent: "find",
      target: "products",
      entities: {},
      filters: {},
      constraints: {},
      scope: "current_page",
      confidence: 0.95,
      requiresClarification: false,
      rawQuery: "test",
      timestamp: Date.now(),
    };
    validateStructuredIntent(validIntent);

    const validPlan = {
      id: "plan-test",
      status: "proposed",
      steps: [
        {
          id: "step-1",
          type: "check",
          targetElementId: "browsy-el-008",
          description: "Select filter",
          confidence: 0.9,
        },
      ],
      matchedItems: [],
      explanation: "Test plan",
      confidence: 0.95,
      timestamp: Date.now(),
    };
    validateActionPlan(validPlan, mockPageContext);

    // Verify rejection if status is not 'proposed'
    assert.throws(
      () => {
        validateActionPlan({ ...validPlan, status: "executed" as any }, mockPageContext);
      },
      /Safety violation/
    );
    console.log("✓ Safety Invariant enforced (rejection of non-proposed status): PASS");
  }

  console.log(`\n==================================================`);
  console.log(`🎉 ALL 11 STAGE 3 INTENT TESTS PASSED 100%!`);
  console.log(`==================================================\n`);
}

runAllIntentTests().catch((err) => {
  console.error("\n❌ Stage 3 Intent Test Failed:", err);
  process.exit(1);
});
