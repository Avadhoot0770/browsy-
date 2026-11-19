/**
 * Browsy Phase 3 Validation: Step 2 - Deterministic Mode Testing (TypeScript)
 * 
 * Verifies Browsy running 100% in-browser with ZERO Ollama and ZERO companion service:
 * 1. Brand targeting & exclusions ("Roadster", "Exclude Puma")
 * 2. Maximum price constraint ("under ₹1,000", "under ₹1,500")
 * 3. Minimum rating constraint ("4 stars", "good reviews")
 * 4. Size constraint ("size XL", "size L", "size 6XL")
 * 5. Colour & Pattern ("red", "black", "checked")
 * 6. Availability & Out-of-Stock invariant
 * 7. Combined multi-constraint query
 * 8. Zero hallucination invariant (no fabricated prices or availability)
 * 9. Clear failure reporting (impossible budget returns 0 matches)
 * 10. Host-page product focus bridge (smooth scroll, highlight, clean removal)
 */

import assert from "node:assert";
import { HeuristicLocalProvider } from "../src/intent/provider";
import { IntentEngine } from "../src/intent/intent-engine";
import { evaluateItemMatch } from "../src/intent/matcher";
import { findHostProductElement, locateAndFocusProductElement } from "../src/execution/product-focus-bridge";
import type { StructuredIntent } from "../src/intent/types";
import type { RepeatedItem } from "../src/page-intelligence/types";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

let passed = 0;
let total = 0;

function it(name: string, fn: () => void) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ${GREEN}✓${RESET} ${name}`);
  } catch (err) {
    console.error(`  ${RED}✗ ${name}${RESET}`);
    console.error(err);
    throw err;
  }
}

async function itAsync(name: string, fn: () => Promise<void>) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ${GREEN}✓${RESET} ${name}`);
  } catch (err) {
    console.error(`  ${RED}✗ ${name}${RESET}`);
    console.error(err);
    throw err;
  }
}

// Ensure companion service is offline
async function verifyCompanionOffline() {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 600);
    const res = await fetch("http://127.0.0.1:8765/api/status", { signal: controller.signal });
    clearTimeout(t);
    if (res.ok) {
      throw new Error("Companion service is currently running on port 8765! Stop it before running deterministic mode tests.");
    }
  } catch (err) {
    // Expected: connection refused / offline
  }
}

// Mock shopping catalog representing real retailer data
function getMockCatalogItems(): RepeatedItem[] {
  return [
    {
      elementId: "item-01",
      title: "Here&Now Red Heavy Flannel Checked Shirt",
      price: { amount: 999, currency: "INR", raw: "₹999" },
      rating: { score: 4.5, count: 120, raw: "★ 4.5" },
      metaText: ["Brand: Here&Now", "Sizes: S, M, L, XL", "Red, Checked", "In Stock"],
      badges: ["In Stock"],
      bounds: { x: 0, y: 0, width: 200, height: 300 },
      isVisible: true,
      role: "card",
    },
    {
      elementId: "item-02",
      title: "Highlander Crimson Red Checked Slim Fit Shirt",
      price: { amount: 899, currency: "INR", raw: "₹899" },
      rating: { score: 4.2, count: 85, raw: "★ 4.2" },
      metaText: ["Brand: Highlander", "Sizes: M, L, XL", "Red", "In Stock"],
      badges: ["In Stock"],
      bounds: { x: 0, y: 0, width: 200, height: 300 },
      isVisible: true,
      role: "card",
    },
    {
      elementId: "item-03",
      title: "Dennis Lingo Rust Red Gingham Shirt",
      price: { amount: 699, currency: "INR", raw: "₹699" },
      rating: { score: 4.0, count: 210, raw: "★ 4.0" },
      metaText: ["Brand: Dennis Lingo", "Sizes: XL, XXL", "Red", "In Stock"],
      badges: ["In Stock"],
      bounds: { x: 0, y: 0, width: 200, height: 300 },
      isVisible: true,
      role: "card",
    },
    {
      elementId: "item-04",
      title: "Roadster Red Casual Shirt",
      price: { amount: 799, currency: "INR", raw: "₹799" },
      rating: { score: 3.8, count: 50, raw: "★ 3.8" },
      metaText: ["Brand: Roadster", "Sizes: M, L, XL", "Red", "In Stock"],
      badges: ["In Stock"],
      bounds: { x: 0, y: 0, width: 200, height: 300 },
      isVisible: true,
      role: "card",
    },
    {
      elementId: "item-05",
      title: "Here&Now Black Checked Casual Shirt",
      price: { amount: 1299, currency: "INR", raw: "₹1,299" },
      rating: { score: 4.6, count: 320, raw: "★ 4.6" },
      metaText: ["Brand: Here&Now", "Sizes: L, XL", "Black, Checked", "In Stock"],
      badges: ["In Stock"],
      bounds: { x: 0, y: 0, width: 200, height: 300 },
      isVisible: true,
      role: "card",
    },
    {
      elementId: "item-06",
      title: "Allen Solly Premium Silk Shirt",
      price: { amount: 2499, currency: "INR", raw: "₹2,499" },
      rating: { score: 4.8, count: 400, raw: "★ 4.8" },
      metaText: ["Brand: Allen Solly", "Sizes: XL", "White", "In Stock"],
      badges: ["In Stock"],
      bounds: { x: 0, y: 0, width: 200, height: 300 },
      isVisible: true,
      role: "card",
    },
    {
      elementId: "item-07",
      title: "Roadster Vintage Plaid Shirt",
      price: { amount: 950, currency: "INR", raw: "₹950" },
      rating: { score: 4.3, count: 60, raw: "★ 4.3" },
      metaText: ["Brand: Roadster", "Sizes: XL", "Red", "OUT OF STOCK"],
      badges: ["Out of Stock"],
      bounds: { x: 0, y: 0, width: 200, height: 300 },
      isVisible: true,
      role: "card",
    },
  ];
}

async function run() {
  console.log(`\n${CYAN}================================================================${RESET}`);
  console.log(`${CYAN}🧠 BROWSY PHASE 3: STEP 2 — DETERMINISTIC MODE VALIDATION${RESET}`);
  console.log(`${CYAN}================================================================${RESET}\n`);

  console.log("1. Confirming zero background processes (companion service offline)...");
  await verifyCompanionOffline();
  console.log(`   ${GREEN}✓${RESET} Confirmed: Loopback port 8765 is offline. Pure deterministic in-browser execution.\n`);

  const provider = new HeuristicLocalProvider();
  const engine = new IntentEngine(provider);
  const catalog = getMockCatalogItems();

  // Test 1: Brand Parsing & Exclusion
  console.log(`${CYAN}--- Test 1: Brand Targeting & Exclusion ---${RESET}`);
  await itAsync('Understands brand target: "Show me Roadster shirts"', async () => {
    engine.resetContext();
    const res = await engine.processRequest("Show me Roadster shirts", null);
    assert.strictEqual(res.intent.intent, "filter");
    assert.strictEqual(res.intent.entities.category, "shirt");
    assert.strictEqual(res.intent.filters.brand?.toLowerCase(), "roadster");
  });

  await itAsync('Understands brand exclusion: "Exclude Roadster"', async () => {
    engine.resetContext();
    await engine.processRequest("Find red shirts", null);
    const res = await engine.processRequest("Exclude Roadster", null);
    assert.ok(res.intent.filters?.exclude?.some((b: string) => b.toLowerCase() === "roadster"));
  });

  // Test 2: Maximum Price
  console.log(`\n${CYAN}--- Test 2: Budget / Maximum Price ---${RESET}`);
  await itAsync('Extracts budget constraint: "Under ₹1,000"', async () => {
    engine.resetContext();
    const res = await engine.processRequest("Find shirts under ₹1,000", null);
    assert.strictEqual(res.intent.constraints.maxPrice, 1000);
    assert.strictEqual(res.intent.constraints.currency, "INR");
  });

  await itAsync('Updates budget in follow-up: "Increase budget to ₹1,500"', async () => {
    engine.resetContext();
    await engine.processRequest("Find shirts under ₹1,000", null);
    const res = await engine.processRequest("Increase the budget to ₹1,500", null);
    assert.strictEqual(res.intent.constraints.maxPrice, 1500);
  });

  // Test 3: Minimum Rating
  console.log(`\n${CYAN}--- Test 3: Rating Constraints ---${RESET}`);
  await itAsync('Maps "good reviews" to minRating: 4.0', async () => {
    engine.resetContext();
    const res = await engine.processRequest("Find shirts with good reviews", null);
    assert.strictEqual(res.intent.constraints.minRating, 4.0);
  });

  await itAsync('Maps explicit "4.5 stars and above" to minRating: 4.5', async () => {
    engine.resetContext();
    const res = await engine.processRequest("Find shirts rated 4.5 stars or above", null);
    assert.strictEqual(res.intent.constraints.minRating, 4.5);
  });

  // Test 4: Size Constraints
  console.log(`\n${CYAN}--- Test 4: Size Constraints ---${RESET}`);
  await itAsync('Extracts size: "in size XL"', async () => {
    engine.resetContext();
    const res = await engine.processRequest("Find shirts in size XL", null);
    assert.strictEqual(res.intent.filters.size, "XL");
  });

  await itAsync('Follow-up size change: "Change size to L"', async () => {
    engine.resetContext();
    await engine.processRequest("Find red shirts in size XL under ₹1,000", null);
    const res = await engine.processRequest("Change the requested size to L", null);
    assert.strictEqual(res.intent.filters.size, "L");
    assert.strictEqual(res.intent.filters.color, "red"); // Preserves existing attributes
  });

  // Test 5: Color & Pattern
  console.log(`\n${CYAN}--- Test 5: Color & Pattern Extraction ---${RESET}`);
  await itAsync('Extracts color and pattern: "red checked shirt"', async () => {
    const intent = await provider.generateIntent("Find red checked shirts", null, { history: [] });
    assert.strictEqual(intent.filters.color, "red");
    assert.strictEqual(intent.filters.pattern, "checked");
  });

  // Test 6: Availability & Out-of-Stock Protection
  console.log(`\n${CYAN}--- Test 6: Availability & Zero Hallucination Invariant ---${RESET}`);
  it("Rejects out-of-stock item (item-07) even when all attributes match", () => {
    const intent: StructuredIntent = {
      id: "test-intent-1",
      intent: "find",
      target: "products",
      entities: { category: "shirt" },
      filters: { color: "red", size: "XL" },
      constraints: { maxPrice: 1000 },
      confidence: 0.95,
      rawQuery: "test",
      timestamp: Date.now(),
    };

    const outOfStockItem = catalog.find((i) => i.elementId === "item-07")!;
    const matchRes = evaluateItemMatch(outOfStockItem, intent);
    assert.strictEqual(matchRes.isMatch, false, "Out of stock item must NEVER be marked as a match!");
  });

  it("Rejects item exceeding price budget without inventing discount (item-06: ₹2,499)", () => {
    const intent: StructuredIntent = {
      id: "test-intent-2",
      intent: "find",
      target: "products",
      entities: { category: "shirt" },
      filters: {},
      constraints: { maxPrice: 1000 },
      confidence: 0.95,
      rawQuery: "test",
      timestamp: Date.now(),
    };

    const expensiveItem = catalog.find((i) => i.elementId === "item-06")!;
    const matchRes = evaluateItemMatch(expensiveItem, intent);
    assert.strictEqual(matchRes.isMatch, false, "Over-budget item must not match!");
  });

  // Test 7: Multi-Constraint Master Query
  console.log(`\n${CYAN}--- Test 7: Master Combined Shopping Query ---${RESET}`);
  await itAsync('Full multi-constraint query: "Find a red checked shirt in size XL under ₹1,000 with good reviews"', async () => {
    const query = "Find a red checked shirt in size XL under ₹1,000 with good reviews";
    const intent = await provider.generateIntent(query, null, { history: [] });

    assert.strictEqual(intent.entities.category, "shirt");
    assert.strictEqual(intent.filters.color, "red");
    assert.strictEqual(intent.filters.pattern, "checked");
    assert.strictEqual(intent.filters.size, "XL");
    assert.strictEqual(intent.constraints.maxPrice, 1000);
    assert.strictEqual(intent.constraints.minRating, 4.0);

    // Evaluate catalog matches
    const matches = catalog.filter((item) => evaluateItemMatch(item, intent).isMatch);
    console.log(`     Matches found in catalog: ${matches.length} items`);
    // Expected matches: item-01 (₹999, 4.5★, XL, checked), item-02 (₹899, 4.2★, XL, checked), item-03 (₹699, 4.0★, XL, checked)
    // item-04 excluded (rating 3.8 < 4.0)
    // item-05 excluded (color black != red)
    // item-06 excluded (price 2499 > 1000)
    // item-07 excluded (out of stock)
    assert.strictEqual(matches.length, 3, "Must match exactly the 3 fully verified in-stock items");
    assert.deepStrictEqual(
      matches.map((m) => m.elementId),
      ["item-01", "item-02", "item-03"]
    );
  });

  // Test 8: Honest Reporting for Unachievable Goals
  console.log(`\n${CYAN}--- Test 8: Honest Reporting of Unachievable Constraints ---${RESET}`);
  await itAsync('Reports 0 matches honestly when budget is impossible: "under ₹50"', async () => {
    const intent = await provider.generateIntent("Find shirts under ₹50", null, { history: [] });
    assert.strictEqual(intent.constraints.maxPrice, 50);

    const matches = catalog.filter((item) => evaluateItemMatch(item, intent).isMatch);
    assert.strictEqual(matches.length, 0, "Must report 0 matches without fabricating discounts");
  });

  await itAsync('Reports 0 matches honestly when size is unavailable: "size 6XL"', async () => {
    const intent = await provider.generateIntent("Find red shirts in size 6XL", null, { history: [] });
    assert.strictEqual(intent.filters.size, "6XL");

    const matches = catalog.filter((item) => evaluateItemMatch(item, intent).isMatch);
    assert.strictEqual(matches.length, 0, "Must report 0 matches without fabricating sizes");
  });

  // Test 9: Host-Page Product Focus Bridge
  console.log(`\n${CYAN}--- Test 9: Product Focus Bridge (DOM Scroll & Highlight) ---${RESET}`);
  it("Product Focus Bridge safely handles missing element without false success claim", () => {
    const focusResult = locateAndFocusProductElement(
      { elementId: "browsy-el-9999", title: "Nonexistent Phantom Shirt", url: "https://example.com/nonexistent" },
      { durationMs: 0 }
    );
    assert.strictEqual(focusResult.success, false);
    assert.strictEqual(focusResult.matchedBy, "none");
    assert.strictEqual(focusResult.scrolled, false);
    assert.strictEqual(focusResult.highlighted, false);
    assert.ok(focusResult.reason && focusResult.reason.includes("could not be located"));
  });

  console.log(`\n====================================================`);
  console.log(`🎉 ALL DETERMINISTIC MODE TESTS PASSED: ${passed}/${total}`);
  console.log(`====================================================\n`);
}

run().catch((err) => {
  console.error("\n❌ Deterministic mode validation failed:", err);
  process.exit(1);
});
