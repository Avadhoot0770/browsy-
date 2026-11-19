/**
 * Browsy Phase 5 Launch Readiness Validation Suite
 *
 * Exhaustively validates:
 * 1. Shopping Accuracy: 9 mandatory shopping requests & strict grounding
 * 2. Multi-Turn Reliability: Sequence A (5 turns) & Sequence B (4 turns) with category shift safeguards
 * 3. Cross-Retailer Extraction: Myntra, Amazon India, and Flipkart
 * 4. Error Recovery & Invariants: Zero false completions, abort teardown, impossible budget handling
 * 5. Visual Hierarchy: 4-Tier grounded display presentation
 */

import assert from "node:assert";
import { IntentEngine, HeuristicLocalProvider } from "../src/intent";
import {
  extractCatalogProducts,
  extractAmazonProducts,
  extractFlipkartProducts,
  findCatalogProductByUrl,
  evaluateCatalogSizeVerification,
  type CatalogProductItem,
} from "../src/page-intelligence/catalog-extractor";
import {
  verifyCatalogProductAttributes,
  inspectCandidateProducts,
  type ProductVerificationResult,
} from "../src/execution/product-verifier";
import type { StructuredIntent } from "../src/intent/types";
import type { RepeatedItem } from "../src/page-intelligence/types";

// ======================================================================
// DOM MOCK FOR TESTING EXTRACTIONS & FIXTURES
// ======================================================================

class MockNode {
  public isConnected = true;
  public parentNode: MockNode | null = null;
}

class MockElement extends MockNode {
  public tagName: string;
  public textContent = "";
  public src = "";
  public alt = "";
  public id = "";
  public type = "";
  private attributes: Map<string, string> = new Map();
  public children: MockElement[] = [];

  constructor(tagName: string) {
    super();
    this.tagName = tagName.toUpperCase();
  }

  public setAttribute(name: string, value: string): void {
    this.attributes.set(name.toLowerCase(), value);
  }

  public getAttribute(name: string): string | null {
    return this.attributes.get(name.toLowerCase()) || null;
  }

  public appendChild(child: MockElement): void {
    child.parentNode = this;
    this.children.push(child);
  }

  public querySelector(selector: string): MockElement | null {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  public querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const selectors = selector.split(",").map((s) => s.trim().toLowerCase());

    const traverse = (node: MockElement) => {
      for (const sel of selectors) {
        if (matches(node, sel)) {
          results.push(node);
          break;
        }
      }
      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(this);
    return results;
  }
}

function matches(el: MockElement, sel: string): boolean {
  if (sel === "script") return el.tagName === "SCRIPT";
  if (sel === "img" || sel === "img[alt]") return el.tagName === "IMG";
  if (sel.includes("h2")) return el.tagName === "H2";
  if (sel.includes("[data-component-type='s-search-result']") || sel.includes('[data-component-type="s-search-result"]')) {
    return el.getAttribute("data-component-type") === "s-search-result";
  }
  if (sel.includes("[data-asin]")) return Boolean(el.getAttribute("data-asin"));
  if (sel.includes("[data-id]")) return Boolean(el.getAttribute("data-id"));
  if (sel.includes(".a-price .a-offscreen") || sel.includes(".a-price") || sel.includes(".a-color-price")) {
    return el.getAttribute("class")?.includes("a-price") || el.getAttribute("class")?.includes("a-color-price") || false;
  }
  if (sel.includes("i.a-icon-star")) return el.getAttribute("class")?.includes("a-icon-star") || false;
  if (sel.includes("a.a-link-normal") || sel.includes("a[href*='/dp/']")) return el.tagName === "A";
  if (sel.includes("div.nx9bqj") || sel.includes("div._30jeq3")) return el.getAttribute("class")?.includes("nx9bqj") || el.getAttribute("class")?.includes("_30jeq3") || false;
  if (sel.includes("div.xqddhh") || sel.includes("div._3lwzlk")) return el.getAttribute("class")?.includes("xqddhh") || el.getAttribute("class")?.includes("_3lwzlk") || false;
  if (sel.includes("a.wjceip") || sel.includes("a.irpwta") || sel.includes("div.kzdlhz")) {
    return el.getAttribute("class")?.includes("wjceip") || el.getAttribute("class")?.includes("irpwta") || el.getAttribute("class")?.includes("kzdlhz") || false;
  }
  if (sel.includes("a[title]")) return el.tagName === "A" && Boolean(el.getAttribute("title"));
  return false;
}

class MockDocument extends MockElement {
  constructor() {
    super("#DOCUMENT");
  }
}

// ======================================================================
// TEST HARNESS RUNNER
// ======================================================================

async function runLaunchReadinessTests() {
  console.log("======================================================================");
  console.log("🛡️ BROWSY PHASE 5: LAUNCH READINESS & ACCURACY VALIDATION SUITE");
  console.log("======================================================================");

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    total++;
    console.log(`\n--- TEST ${total}: ${name} ---`);
    try {
      await fn();
      passed++;
      console.log(`✓ Test ${total}: ${name}: PASS`);
    } catch (err) {
      console.error(`✕ Test ${total}: ${name}: FAIL`);
      console.error(err);
      process.exit(1);
    }
  }

  const engine = new IntentEngine(new HeuristicLocalProvider());

  // ====================================================================
  // SUITE 1: PHASE 2 SHOPPING ACCURACY
  // ====================================================================

  await test("Accuracy 1: 'Find a red checked shirt, size XL, under ₹1,000'", async () => {
    engine.resetContext();
    const res = await engine.processRequest("Find a red checked shirt, size XL, under ₹1,000.", null);
    assert.strictEqual(res.intent.entities.category, "shirt");
    assert.strictEqual(res.intent.filters.color, "red");
    assert.strictEqual(res.intent.filters.pattern, "checked");
    assert.strictEqual(res.intent.filters.size, "XL");
    assert.strictEqual(res.intent.constraints.maxPrice, 1000);
    assert.strictEqual(res.requiresClarification, false);
  });

  await test("Accuracy 2: 'Show me only black ones' (Preserves category, pattern, size, budget)", async () => {
    const res = await engine.processRequest("Show me only black ones", null);
    assert.strictEqual(res.intent.filters.color, "black");
    assert.strictEqual(res.intent.filters.pattern, "checked");
    assert.strictEqual(res.intent.entities.category, "shirt");
    assert.strictEqual(res.intent.filters.size, "XL");
    assert.strictEqual(res.intent.constraints.maxPrice, 1000);
    assert(res.summaryMessage.toLowerCase().includes("black"));
  });

  await test("Accuracy 3: 'Increase the budget to ₹1,500' (Preserves color=black, pattern, size)", async () => {
    const res = await engine.processRequest("Increase the budget to ₹1,500", null);
    assert.strictEqual(res.intent.constraints.maxPrice, 1500);
    assert.strictEqual(res.intent.filters.color, "black");
    assert.strictEqual(res.intent.filters.pattern, "checked");
    assert.strictEqual(res.intent.filters.size, "XL");
  });

  await test("Accuracy 4: 'Change the requested size to L' (Updates size, preserves budget & attributes)", async () => {
    const res = await engine.processRequest("Change the requested size to L", null);
    assert.strictEqual(res.intent.filters.size, "L");
    assert.strictEqual(res.intent.constraints.maxPrice, 1500);
    assert.strictEqual(res.intent.filters.color, "black");
    assert.strictEqual(res.intent.filters.pattern, "checked");
  });

  await test("Accuracy 5: 'Sort verified results by lowest price' (Local in-memory sort)", async () => {
    const res = await engine.processRequest("Sort verified results by lowest price", null);
    assert.strictEqual(res.intent.intent, "sort");
    assert.strictEqual(res.intent.sort?.field, "price");
    assert.strictEqual(res.intent.sort?.direction, "asc");
  });

  await test("Accuracy 6: 'Exclude Roadster' (Excludes specific brand)", async () => {
    const res = await engine.processRequest("Exclude Roadster", null);
    assert(res.intent.filters.exclude?.includes("roadster"));
    assert(res.summaryMessage.toLowerCase().includes("roadster"));
  });

  await test("Accuracy 7: 'Find similar products on another supported retailer' (Ambiguity check)", async () => {
    const res = await engine.processRequest("Find similar products on another supported retailer", null);
    assert.strictEqual(res.requiresClarification, true);
    assert(res.clarificationPrompt?.includes("Amazon") || res.clarificationPrompt?.includes("Flipkart"));
  });

  await test("Accuracy 8: 'Find products under ₹50' (Zero false completion invariant)", async () => {
    const res = await engine.processRequest("Find products under ₹50", null);
    assert.strictEqual(res.intent.constraints.maxPrice, 50);

    // Verify against realistic catalog items: none under ₹50
    const candidates: RepeatedItem[] = [
      {
        elementId: "prod-1",
        title: "Casual Shirt",
        price: { raw: "₹499", amount: 499, currency: "INR" },
        link: { href: "https://myntra.com/499", text: "Buy" },
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      },
    ];
    const summary = await inspectCandidateProducts(candidates, res.intent, { maxCandidates: 5, timeoutMs: 500 });
    assert.strictEqual(summary.fullyVerifiedProducts.length, 0, "Must NEVER mark a ₹499 item as verified for ₹50 budget");
    assert.strictEqual(summary.bestMatch, null);
  });

  await test("Accuracy 9: 'Find products in an unavailable size 6XL' (Out-of-stock invariant)", async () => {
    const item: CatalogProductItem = {
      productId: "101",
      title: "Roadster Men Red Checked Shirt",
      brand: "Roadster",
      price: 899,
      currency: "INR",
      url: "https://www.myntra.com/101",
      sizes: ["S", "M", "L", "XL"],
      inventoryInfo: [{ label: "XL", available: true, inventory: 4 }],
      rawSource: "myx_catalog",
    };
    const reqIntent: StructuredIntent = {
      id: "req-6xl",
      intent: "find",
      target: "products",
      entities: { category: "shirt" },
      filters: { size: "6XL" },
      constraints: { maxPrice: 1000 },
      confidence: 1.0,
      scope: "site",
      rawQuery: "Find products in size 6XL",
      requiresClarification: false,
      timestamp: Date.now(),
    };
    const result = verifyCatalogProductAttributes(item, reqIntent);
    assert.strictEqual(result.isFullyVerified, false, "Size 6XL must not be reported as verified");
    assert.notStrictEqual(result.conditions.size.status, "in_stock");
  });

  // ====================================================================
  // SUITE 2: PHASE 3 MULTI-TURN RELIABILITY (SEQUENCES A & B)
  // ====================================================================

  await test("Sequence A: 5-Turn Conversational Shopping Lifecycle", async () => {
    engine.resetContext();

    // Turn 1
    const t1 = await engine.processRequest("Find a red checked shirt in size XL under ₹1,000.", null);
    assert.strictEqual(t1.intent.entities.category, "shirt");
    assert.strictEqual(t1.intent.filters.color, "red");
    assert.strictEqual(t1.intent.filters.pattern, "checked");
    assert.strictEqual(t1.intent.filters.size, "XL");
    assert.strictEqual(t1.intent.constraints.maxPrice, 1000);

    // Turn 2
    const t2 = await engine.processRequest("Show me only black ones", null);
    assert.strictEqual(t2.intent.filters.color, "black");
    assert.strictEqual(t2.intent.filters.pattern, "checked");
    assert.strictEqual(t2.intent.entities.category, "shirt");
    assert.strictEqual(t2.intent.filters.size, "XL");
    assert.strictEqual(t2.intent.constraints.maxPrice, 1000);

    // Turn 3
    const t3 = await engine.processRequest("Increase the budget to ₹1,500", null);
    assert.strictEqual(t3.intent.constraints.maxPrice, 1500);
    assert.strictEqual(t3.intent.filters.color, "black");
    assert.strictEqual(t3.intent.filters.pattern, "checked");
    assert.strictEqual(t3.intent.filters.size, "XL");

    // Turn 4
    const t4 = await engine.processRequest("Change the size to L", null);
    assert.strictEqual(t4.intent.filters.size, "L");
    assert.strictEqual(t4.intent.constraints.maxPrice, 1500);
    assert.strictEqual(t4.intent.filters.color, "black");
    assert.strictEqual(t4.intent.filters.pattern, "checked");

    // Turn 5
    const t5 = await engine.processRequest("Sort by lowest price", null);
    assert.strictEqual(t5.intent.intent, "sort");
    assert.strictEqual(t5.intent.sort?.field, "price");
    assert.strictEqual(t5.intent.sort?.direction, "asc");
  });

  await test("Sequence B: Category Shift & Multi-Retailer Navigation", async () => {
    engine.resetContext();

    // Turn 1: Find shoes under ₹2,000
    const t1 = await engine.processRequest("Find shoes under ₹2,000.", null);
    assert.strictEqual(t1.intent.entities.category, "shoes");
    assert.strictEqual(t1.intent.constraints.maxPrice, 2000);
    // Invariant: Shoes query must NOT inherit shirt size XL or pattern checked
    assert.strictEqual(t1.intent.filters.size, undefined, "Shoes must not inherit shirt size");
    assert.strictEqual(t1.intent.filters.pattern, undefined, "Shoes must not inherit garment pattern");

    // Turn 2: Exclude a specific brand ("Exclude Puma")
    const t2 = await engine.processRequest("Exclude Puma", null);
    assert(t2.intent.filters.exclude?.includes("puma"));
    assert.strictEqual(t2.intent.entities.category, "shoes", "Category 'shoes' preserved");
    assert.strictEqual(t2.intent.constraints.maxPrice, 2000, "Budget ₹2,000 preserved");

    // Turn 3: Search another retailer ("Search Amazon for this")
    const t3 = await engine.processRequest("Search Amazon for this", null);
    assert.strictEqual(t3.intent.intent, "navigate");
    assert(t3.intent.entities.destination?.toLowerCase().includes("amazon"));
    assert.strictEqual(t3.intent.entities.category, "shoes", "Transfers category 'shoes' to Amazon");
    assert.strictEqual(t3.intent.constraints.maxPrice, 2000, "Transfers budget ₹2,000 to Amazon");

    // Turn 4: Preserve remaining constraints
    assert(t3.intent.filters.exclude?.includes("puma"), "Preserves Puma exclusion for Amazon search");
  });

  await test("Category Shift Ambiguity Safeguard", async () => {
    engine.resetContext();
    // Prior context: shopping for shirts under ₹1,000
    await engine.processRequest("Find red checked shirts under ₹1,000.", null);

    // User abruptly switches category without parameters: "Switch to laptops"
    const shiftRes = await engine.processRequest("Switch to laptops", null);
    assert.strictEqual(shiftRes.requiresClarification, true, "Switching to laptops without budget must ask clarification");
    assert(shiftRes.clarificationPrompt?.toLowerCase().includes("laptop"), "Clarification prompt mentions laptop");
    // Invariant: Must not carry forward shirt budget (₹1,000) or red/checked filters to laptops
    assert.strictEqual(shiftRes.intent.constraints.maxPrice, undefined);
    assert.strictEqual(shiftRes.intent.filters.color, undefined);
    assert.strictEqual(shiftRes.intent.filters.pattern, undefined);
  });

  // ====================================================================
  // SUITE 3: PHASE 4 CROSS-RETAILER EXTRACTION (MYNTRA, AMAZON, FLIPKART)
  // ====================================================================

  await test("Cross-Retailer 1: Myntra __myx Catalog Extraction", () => {
    const doc = new MockDocument();
    const scriptEl = new MockElement("script");
    scriptEl.textContent = `window.__myx = {
      "searchData": {
        "results": {
          "products": [
            {
              "productId": 2345678,
              "productName": "Roadster Men Red Check Casual Shirt",
              "brand": "Roadster",
              "price": 799,
              "primaryColour": "Red",
              "landingPageUrl": "shirts/roadster/2345678/buy",
              "sizes": "S,M,L,XL",
              "inventoryInfo": [
                { "label": "M", "available": true, "inventory": 10 },
                { "label": "XL", "available": true, "inventory": 3 }
              ]
            }
          ]
        }
      }
    };`;
    doc.appendChild(scriptEl);

    const products = extractCatalogProducts(doc as any);
    assert.strictEqual(products.length, 1);
    assert.strictEqual(products[0].productId, "2345678");
    assert.strictEqual(products[0].price, 799);
    assert.strictEqual(products[0].currency, "INR");
    assert.strictEqual(products[0].color, "Red");
    assert.strictEqual(products[0].sizes.length, 4);

    // Verify size inventory evidence
    const sizeEval = evaluateCatalogSizeVerification(products[0], "XL");
    assert.strictEqual(sizeEval.status, "in_stock");
    assert.strictEqual(sizeEval.isVerified, true);
  });

  await test("Cross-Retailer 2: Amazon Search Card Extraction & ASIN Grounding", () => {
    const doc = new MockDocument();
    const searchCard = new MockElement("div");
    searchCard.setAttribute("data-component-type", "s-search-result");
    searchCard.setAttribute("data-asin", "B08W73MNV4");

    const titleEl = new MockElement("h2");
    titleEl.textContent = "Dennis Lingo Men's Checkered Slim Fit Casual Shirt";
    searchCard.appendChild(titleEl);

    const priceEl = new MockElement("span");
    priceEl.setAttribute("class", "a-price");
    priceEl.textContent = "₹649";
    searchCard.appendChild(priceEl);

    const linkEl = new MockElement("a");
    linkEl.setAttribute("class", "a-link-normal");
    linkEl.setAttribute("href", "/dp/B08W73MNV4");
    searchCard.appendChild(linkEl);

    doc.appendChild(searchCard);

    const products = extractAmazonProducts(doc as any);
    assert.strictEqual(products.length, 1);
    assert.strictEqual(products[0].productId, "B08W73MNV4");
    assert.strictEqual(products[0].price, 649);
    assert.strictEqual(products[0].currency, "INR");
    assert(products[0].url.includes("B08W73MNV4"));

    // Deep link matching
    const matched = findCatalogProductByUrl(products, "https://www.amazon.in/dp/B08W73MNV4");
    assert.notStrictEqual(matched, null);
    assert.strictEqual(matched?.productId, "B08W73MNV4");
  });

  await test("Cross-Retailer 3: Flipkart __INITIAL_STATE__ & DOM Extraction", () => {
    const doc = new MockDocument();
    const scriptEl = new MockElement("script");
    scriptEl.textContent = `window.__INITIAL_STATE__ = {
      "pageDataV4": {
        "page": {
          "data": {
            "widgetList": [
              {
                "data": {
                  "products": [
                    {
                      "productInfo": {
                        "value": {
                          "id": "TSHIRT12345",
                          "titles": { "title": "Highlander Men Checkered Slim Fit Cotton Shirt" },
                          "pricing": { "finalPrice": { "value": 849 } },
                          "baseUrl": "/highlander-shirt/p/itm12345"
                        }
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    };`;
    doc.appendChild(scriptEl);

    const products = extractFlipkartProducts(doc as any);
    assert.strictEqual(products.length, 1);
    assert.strictEqual(products[0].productId, "TSHIRT12345");
    assert.strictEqual(products[0].price, 849);
    assert.strictEqual(products[0].currency, "INR");
    assert(products[0].url.includes("itm12345"));
  });

  await test("Cross-Retailer 4: Out-of-Stock Amazon Card Indicators", () => {
    const doc = new MockDocument();
    const searchCard = new MockElement("div");
    searchCard.setAttribute("data-component-type", "s-search-result");
    searchCard.setAttribute("data-asin", "B09OOSITEM");
    searchCard.textContent = "Currently unavailable Dennis Lingo Shirt";

    const titleEl = new MockElement("h2");
    titleEl.textContent = "Dennis Lingo Casual Shirt (Out of Stock)";
    searchCard.appendChild(titleEl);

    const priceEl = new MockElement("span");
    priceEl.setAttribute("class", "a-price");
    priceEl.textContent = "₹799";
    searchCard.appendChild(priceEl);

    doc.appendChild(searchCard);

    const products = extractAmazonProducts(doc as any);
    assert.strictEqual(products.length, 1);
    assert.strictEqual(products[0].inventoryInfo?.[0]?.available, false, "Currently unavailable must be marked not available");
  });

  // ====================================================================
  // SUITE 4: PHASE 5 VISUAL & INTERACTION TIER INTEGRITY
  // ====================================================================

  await test("Visual 1: 4 Distinct Display Tiers (Fully Verified, Partial, Candidate, Failed)", () => {
    const baseItem: CatalogProductItem = {
      productId: "1",
      title: "Roadster Men Red Checked Shirt",
      price: 899,
      currency: "INR",
      color: "Red",
      sizes: ["S", "M", "L", "XL"],
      inventoryInfo: [{ label: "XL", available: true, inventory: 5 }],
      url: "https://myntra.com/1",
      rawSource: "myx_catalog",
    };

    const targetIntent: StructuredIntent = {
      id: "int-1",
      intent: "find",
      target: "products",
      entities: { category: "shirt" },
      filters: { color: "red", pattern: "checked", size: "XL" },
      constraints: { maxPrice: 1000 },
      confidence: 1.0,
      scope: "site",
      rawQuery: "red checked shirt XL under 1000",
      requiresClarification: false,
      timestamp: Date.now(),
    };

    // Tier 1: Fully Verified Match
    const t1Res = verifyCatalogProductAttributes(baseItem, targetIntent);
    assert.strictEqual(t1Res.isFullyVerified, true);
    assert.strictEqual(t1Res.conditions.size.status, "in_stock");

    // Tier 2: Partial Match (Size L requested, but L is unverified)
    const t2Res = verifyCatalogProductAttributes(baseItem, {
      ...targetIntent,
      filters: { ...targetIntent.filters, size: "L" },
    });
    assert.strictEqual(t2Res.isFullyVerified, false);
    assert.strictEqual(t2Res.conditions.size.status, "unverified");
    assert.strictEqual(t2Res.conditions.category.verified, true);

    // Tier 3: Out-of-Stock Size
    const oosItem: CatalogProductItem = {
      ...baseItem,
      inventoryInfo: [{ label: "XL", available: false, inventory: 0 }],
    };
    const t3Res = verifyCatalogProductAttributes(oosItem, targetIntent);
    assert.strictEqual(t3Res.isFullyVerified, false);
    assert.strictEqual(t3Res.conditions.size.status, "out_of_stock");

    // Tier 4: Failed Inspection (Over Budget ₹1,299 vs ₹1,000)
    const overBudgetItem: CatalogProductItem = {
      ...baseItem,
      price: 1299,
    };
    const t4Res = verifyCatalogProductAttributes(overBudgetItem, targetIntent);
    assert.strictEqual(t4Res.isFullyVerified, false);
    assert.strictEqual(t4Res.conditions.price.verified, false);
  });

  await test("Visual 2: Instant AbortSignal Teardown (< 200 ms)", async () => {
    const controller = new AbortController();
    controller.abort(); // Pre-aborted signal

    const dummyCandidates: RepeatedItem[] = [
      {
        elementId: "slow-item-1",
        title: "Slow Item",
        link: { href: "http://127.0.0.1:9999/slow", text: "Slow" },
        bounds: { x: 0, y: 0, width: 50, height: 50 },
      },
    ];

    const start = Date.now();
    const summary = await inspectCandidateProducts(dummyCandidates, {
      id: "abort-test",
      intent: "find",
      target: "products",
      entities: {},
      filters: {},
      constraints: {},
      confidence: 1.0,
      scope: "site",
      rawQuery: "test",
      requiresClarification: false,
      timestamp: Date.now(),
    }, { signal: controller.signal, timeoutMs: 5000 });
    const elapsed = Date.now() - start;

    assert(elapsed < 200, `AbortSignal must tear down in <200ms, took ${elapsed}ms`);
    assert.strictEqual(summary.fullyVerifiedProducts.length, 0);
  });

  console.log("\n======================================================================");
  console.log(`🎉 ALL ${passed}/${total} PHASE 5 LAUNCH READINESS TESTS PASSED (100%)!`);
  console.log("======================================================================");
}

runLaunchReadinessTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
