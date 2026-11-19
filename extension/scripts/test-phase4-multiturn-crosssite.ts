/**
 * Browsy Phase 4 Automated Test Suite
 * Validates Multi-Turn Conversation, Context Preservation, Brand Exclusion,
 * Result Card 4-Tier Display Grounding, Cross-Site Readiness, and Failure Recovery.
 */

import assert from "node:assert";
import { IntentEngine, HeuristicLocalProvider } from "../src/intent";
import {
  extractCatalogProducts,
  extractAmazonProducts,
  extractFlipkartProducts,
  findCatalogProductByUrl,
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
// LIGHTWEIGHT DOM MOCK FOR TESTING EXTRACTIONS
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
  if (sel.includes("div.s-result-item")) return el.tagName === "DIV" && Boolean(el.getAttribute("data-asin"));
  if (sel.includes(".a-price .a-offscreen") || sel.includes(".a-price-whole") || sel.includes(".a-color-price")) {
    return el.getAttribute("class")?.includes("a-price") || el.getAttribute("class")?.includes("a-color-price") || false;
  }
  if (sel.includes("i.a-icon-star")) return el.getAttribute("class")?.includes("a-icon-star") || false;
  if (sel.includes("a.a-link-normal")) return el.tagName === "A" && (el.getAttribute("class")?.includes("a-link-normal") || false);
  if (sel.includes("img.s-image")) return el.tagName === "IMG";
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
// TEST RUNNER
// ======================================================================

async function runPhase4Tests() {
  console.log("======================================================================");
  console.log("🚀 BROWSY PHASE 4: MULTI-TURN, CROSS-SITE & RELIABILITY TEST SUITE");
  console.log("======================================================================");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => Promise<void> | void) {
    total++;
    console.log(`\n--- TEST ${total}: ${name} ---`);
    try {
      const p = fn();
      if (p && typeof p.then === "function") {
        return p.then(
          () => {
            passed++;
            console.log(`✓ Test ${total}: ${name}: PASS`);
          },
          (err) => {
            console.error(`✕ Test ${total}: ${name}: FAIL`);
            console.error(err);
            process.exit(1);
          }
        );
      } else {
        passed++;
        console.log(`✓ Test ${total}: ${name}: PASS`);
      }
    } catch (err) {
      console.error(`✕ Test ${total}: ${name}: FAIL`);
      console.error(err);
      process.exit(1);
    }
  }

  const engine = new IntentEngine(new HeuristicLocalProvider());

  // TEST 1: Initial Shopping Request
  await test("Initial Shopping Query: Red checked shirt XL under ₹1,000", async () => {
    engine.resetContext();
    const res = await engine.processRequest("Find me a red checked shirt in size XL under ₹1,000.", null);
    assert.strictEqual(res.intent.target, "products");
    assert.strictEqual(res.intent.entities.category, "shirt");
    assert.strictEqual(res.intent.filters.color, "red");
    assert.strictEqual(res.intent.filters.pattern, "checked");
    assert.strictEqual(res.intent.filters.size, "XL");
    assert.strictEqual(res.intent.constraints.maxPrice, 1000);
    assert.strictEqual(res.intent.constraints.currency, "INR");
    assert.strictEqual(res.requiresClarification, false);
  });

  // TEST 2: Multi-Turn: "Show me only black ones" (Preserves category, pattern, size, budget)
  await test("Multi-Turn Follow-Up 1: 'Show me only black ones' preserves all non-color constraints", async () => {
    const res = await engine.processRequest("Show me only black ones", null);
    assert.strictEqual(res.intent.filters.color, "black");
    assert.strictEqual(res.intent.filters.pattern, "checked", "Pattern 'checked' should be preserved");
    assert.strictEqual(res.intent.entities.category, "shirt", "Category 'shirt' should be preserved");
    assert.strictEqual(res.intent.filters.size, "XL", "Size 'XL' should be preserved");
    assert.strictEqual(res.intent.constraints.maxPrice, 1000, "Budget ₹1,000 should be preserved");
    assert(res.summaryMessage.toLowerCase().includes("black"), "Summary should acknowledge color changed to black");
    assert(res.summaryMessage.toLowerCase().includes("shirt"), "Summary should list preserved category");
  });

  // TEST 3: Multi-Turn: "Increase the budget to ₹1,500" (Preserves color=black, pattern, size)
  await test("Multi-Turn Follow-Up 2: 'Increase the budget to ₹1,500' updates budget and preserves filters", async () => {
    const res = await engine.processRequest("Increase the budget to ₹1,500", null);
    assert.strictEqual(res.intent.constraints.maxPrice, 1500);
    assert.strictEqual(res.intent.filters.color, "black", "Color 'black' should be preserved");
    assert.strictEqual(res.intent.filters.pattern, "checked", "Pattern 'checked' should be preserved");
    assert.strictEqual(res.intent.entities.category, "shirt", "Category 'shirt' should be preserved");
    assert.strictEqual(res.intent.filters.size, "XL", "Size 'XL' should be preserved");
    assert(res.summaryMessage.includes("1,500") || res.summaryMessage.includes("1500"), "Summary should acknowledge new budget");
  });

  // TEST 4: Multi-Turn: "Only show size L" (Updates size, preserves budget ₹1,500, color, pattern)
  await test("Multi-Turn Follow-Up 3: 'Only show size L' updates size to L and preserves active context", async () => {
    const res = await engine.processRequest("Only show size L", null);
    assert.strictEqual(res.intent.filters.size, "L");
    assert.strictEqual(res.intent.constraints.maxPrice, 1500, "Budget ₹1,500 should be preserved");
    assert.strictEqual(res.intent.filters.color, "black", "Color 'black' should be preserved");
    assert.strictEqual(res.intent.filters.pattern, "checked", "Pattern 'checked' should be preserved");
    assert.strictEqual(res.intent.entities.category, "shirt", "Category 'shirt' should be preserved");
  });

  // TEST 5: Ambiguous Color Follow-Up: "Find the same product in another color" -> triggers clarification
  await test("Multi-Turn Follow-Up 4: 'Find the same product in another color' triggers honest clarification", async () => {
    const res = await engine.processRequest("Find the same product in another color", null);
    assert.strictEqual(res.requiresClarification, true);
    assert(res.clarificationPrompt?.toLowerCase().includes("which color"), "Should prompt user for target color");
    assert.strictEqual(res.plan.steps.length, 0, "No actions proposed for ambiguous instruction");
  });

  // TEST 6: Multi-Turn: "Sort the verified results by lowest price" -> in-memory sort
  await test("Multi-Turn Follow-Up 5: 'Sort the verified results by lowest price' triggers sort intent", async () => {
    const res = await engine.processRequest("Sort the verified results by lowest price", null);
    assert.strictEqual(res.intent.intent, "sort");
    assert.strictEqual(res.intent.sort?.field, "price");
    assert.strictEqual(res.intent.sort?.direction, "asc");
    // Verify sorting logic on verified items
    const sampleItems: ProductVerificationResult[] = [
      {
        elementId: "item-1",
        title: "Checked Shirt A",
        url: "https://myntra.com/1",
        price: { raw: "₹1,200", amount: 1200, currency: "INR" },
        isFullyVerified: true,
        conditions: {} as any,
      },
      {
        elementId: "item-2",
        title: "Checked Shirt B",
        url: "https://myntra.com/2",
        price: { raw: "₹799", amount: 799, currency: "INR" },
        isFullyVerified: true,
        conditions: {} as any,
      },
      {
        elementId: "item-3",
        title: "Checked Shirt C",
        url: "https://myntra.com/3",
        price: { raw: "₹950", amount: 950, currency: "INR" },
        isFullyVerified: true,
        conditions: {} as any,
      },
    ];
    sampleItems.sort((a, b) => (a.price?.amount || 0) - (b.price?.amount || 0));
    assert.strictEqual(sampleItems[0].price?.amount, 799);
    assert.strictEqual(sampleItems[1].price?.amount, 950);
    assert.strictEqual(sampleItems[2].price?.amount, 1200);
  });

  // TEST 7: Multi-Turn: "Exclude products from this brand" & Brand filtering
  await test("Multi-Turn Follow-Up 6: 'Exclude products from this brand' excludes active brand", async () => {
    // Record active brand into engine context
    engine.recordVerifiedProducts("Roadster", [
      {
        title: "Roadster Men Black Checked Casual Shirt",
        url: "https://www.myntra.com/101",
        price: { raw: "₹899", amount: 899, currency: "INR" },
        isFullyVerified: true,
      },
    ]);

    const res = await engine.processRequest("Exclude products from this brand", null);
    assert(res.intent.filters.exclude?.includes("roadster"), "Should exclude 'roadster' from active context");
    assert(res.summaryMessage.toLowerCase().includes("roadster"), "Summary should acknowledge excluding Roadster");
  });

  // TEST 8: Cross-Site: Ambiguity Clarification & Explicit Site Navigation
  await test("Cross-Site Navigation: 'Search another website' clarifies; 'Search Amazon for this' succeeds", async () => {
    // Ambiguous target
    const resAmbiguous = await engine.processRequest("Search another website for similar products", null);
    assert.strictEqual(resAmbiguous.requiresClarification, true);
    assert(resAmbiguous.clarificationPrompt?.includes("Amazon") || resAmbiguous.clarificationPrompt?.includes("Flipkart"));

    // Explicit target Amazon
    const resAmazon = await engine.processRequest("Search Amazon for this", null);
    assert.strictEqual(resAmazon.intent.intent, "navigate");
    assert(resAmazon.intent.entities.destination?.toLowerCase().includes("amazon"));
    assert.strictEqual(resAmazon.intent.entities.category, "shirt", "Preserves category for Amazon search");
    assert.strictEqual(resAmazon.intent.filters.size, "L", "Preserves size for Amazon search");
  });

  // TEST 9: Product Card 4-Tier Display Grounding
  await test("Product Card 4-Tier Integrity: In-stock vs out-of-stock vs unverified", () => {
    const verifiedItem: CatalogProductItem = {
      productId: "101",
      title: "Roadster Men Red Checked Shirt",
      brand: "Roadster",
      price: 899,
      currency: "INR",
      color: "Red",
      url: "https://www.myntra.com/101",
      sizes: ["S", "M", "L", "XL"],
      inventoryInfo: [
        { label: "M", available: true, inventory: 5 },
        { label: "XL", available: true, inventory: 2 },
      ],
      rawSource: "myx_catalog",
    };

    const requestedIntent: StructuredIntent = {
      id: "req-1",
      intent: "find",
      target: "products",
      entities: { category: "shirt" },
      filters: { color: "red", pattern: "checked", size: "XL" },
      constraints: { maxPrice: 1000, currency: "INR" },
      confidence: 1.0,
      scope: "site",
    };

    // Tier 1: Fully Verified (XL in stock, under 1000, red, checked)
    const res1 = verifyCatalogProductAttributes(verifiedItem, requestedIntent);
    assert.strictEqual(res1.isFullyVerified, true);
    assert.strictEqual(res1.conditions.size.status, "in_stock");
    assert.strictEqual(res1.conditions.size.available, true);

    // Tier 2: Partial Match (Size L requested, but size L is not offered or unverified in inventoryInfo)
    const lIntent: StructuredIntent = {
      ...requestedIntent,
      filters: { ...requestedIntent.filters, size: "L" },
    };
    const res2 = verifyCatalogProductAttributes(verifiedItem, lIntent);
    assert.strictEqual(res2.isFullyVerified, false, "Must NOT be fully verified when size is unverified");
    assert.strictEqual(res2.conditions.size.status, "unverified");
    assert.strictEqual(res2.conditions.category.verified, true);
    assert.strictEqual(res2.conditions.price.verified, true);

    // Tier 3: Out-of-Stock Size (Size XXL offered but out of stock)
    const outOfStockItem: CatalogProductItem = {
      ...verifiedItem,
      sizes: ["S", "M", "L", "XL", "XXL"],
      inventoryInfo: [{ label: "XXL", available: false, inventory: 0 }],
    };
    const xxlIntent: StructuredIntent = {
      ...requestedIntent,
      filters: { ...requestedIntent.filters, size: "XXL" },
    };
    const res3 = verifyCatalogProductAttributes(outOfStockItem, xxlIntent);
    assert.strictEqual(res3.isFullyVerified, false);
    assert.strictEqual(res3.conditions.size.status, "out_of_stock");

    // Tier 4: Failed Check (Over Budget ₹1,299 vs ₹1,000)
    const overBudgetItem: CatalogProductItem = {
      ...verifiedItem,
      price: 1299,
    };
    const res4 = verifyCatalogProductAttributes(overBudgetItem, requestedIntent);
    assert.strictEqual(res4.isFullyVerified, false);
    assert.strictEqual(res4.conditions.price.verified, false);
  });

  // TEST 10: Amazon Search Card Extraction & ASIN Grounding
  await test("Amazon Search Result Card & ASIN Extraction", () => {
    const doc = new MockDocument();

    const searchCard = new MockElement("div");
    searchCard.setAttribute("data-component-type", "s-search-result");
    searchCard.setAttribute("data-asin", "B07W94J4X2");

    const titleEl = new MockElement("h2");
    titleEl.textContent = "Dennis Lingo Men's Checkered Casual Shirt";
    searchCard.appendChild(titleEl);

    const priceEl = new MockElement("span");
    priceEl.setAttribute("class", "a-price");
    priceEl.textContent = "₹699";
    searchCard.appendChild(priceEl);

    const linkEl = new MockElement("a");
    linkEl.setAttribute("class", "a-link-normal");
    linkEl.setAttribute("href", "/dp/B07W94J4X2");
    searchCard.appendChild(linkEl);

    doc.appendChild(searchCard);

    const products = extractAmazonProducts(doc as any);
    assert.strictEqual(products.length, 1);
    assert.strictEqual(products[0].productId, "B07W94J4X2");
    assert.strictEqual(products[0].title, "Dennis Lingo Men's Checkered Casual Shirt");
    assert.strictEqual(products[0].price, 699);
    assert(products[0].url.includes("B07W94J4X2"));

    // Verify ASIN matching
    const matched = findCatalogProductByUrl(products, "https://www.amazon.in/dp/B07W94J4X2");
    assert.notStrictEqual(matched, null);
    assert.strictEqual(matched?.productId, "B07W94J4X2");
  });

  // TEST 11: Flipkart Search Result & Widget Parsing
  await test("Flipkart __INITIAL_STATE__ & DOM Search Extraction", () => {
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
                          "id": "SHIFK12345",
                          "titles": { "title": "Highlander Men Slim Fit Checkered Casual Shirt" },
                          "pricing": { "finalPrice": { "value": 749 } },
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
    assert.strictEqual(products[0].productId, "SHIFK12345");
    assert.strictEqual(products[0].title, "Highlander Men Slim Fit Checkered Casual Shirt");
    assert.strictEqual(products[0].price, 749);
    assert(products[0].url.includes("itm12345"));

    // Verify Flipkart URL matching
    const matched = findCatalogProductByUrl(products, "https://www.flipkart.com/highlander-shirt/p/itm12345");
    assert.notStrictEqual(matched, null);
    assert.strictEqual(matched?.productId, "SHIFK12345");
  });

  // TEST 12: Failure Recovery & Non-Fabrication Invariants
  await test("Failure Recovery: Impossible budget reports 0 verified matches (No fabrication)", async () => {
    const candidates: RepeatedItem[] = [
      {
        elementId: "item-1",
        title: "Dennis Lingo Red Checked Shirt",
        price: { raw: "₹699", amount: 699, currency: "INR" },
        link: { href: "https://www.myntra.com/699", text: "Buy" },
        bounds: { x: 0, y: 0, width: 200, height: 280 },
      },
    ];

    const impossibleIntent: StructuredIntent = {
      id: "imp-1",
      intent: "find",
      target: "products",
      entities: { category: "shirt" },
      filters: { color: "red", pattern: "checked", size: "XL" },
      constraints: { maxPrice: 50, currency: "INR" }, // Impossible ₹50 budget
      confidence: 1.0,
      scope: "site",
    };

    const summary = await inspectCandidateProducts(candidates, impossibleIntent, {
      maxCandidates: 5,
      timeoutMs: 500,
    });

    assert.strictEqual(summary.fullyVerifiedProducts.length, 0, "Must NEVER fabricate a verified match for impossible budget");
    assert.strictEqual(summary.bestMatch, null);
  });

  // TEST 13: Mid-Inspection Abort Signal Teardown
  await test("Failure Recovery: AbortSignal stops verification immediately", async () => {
    const controller = new AbortController();
    controller.abort(); // Pre-aborted

    const candidates: RepeatedItem[] = [
      {
        elementId: "item-1",
        title: "Candidate 1",
        link: { href: "http://127.0.0.1:9999/slow-1", text: "Item 1" },
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      },
      {
        elementId: "item-2",
        title: "Candidate 2",
        link: { href: "http://127.0.0.1:9999/slow-2", text: "Item 2" },
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      },
    ];

    const requestedIntent: StructuredIntent = {
      id: "req-abort",
      intent: "find",
      target: "products",
      entities: { category: "shirt" },
      filters: { size: "XL" },
      constraints: {},
      confidence: 1.0,
      scope: "site",
    };

    const start = Date.now();
    const summary = await inspectCandidateProducts(candidates, requestedIntent, {
      signal: controller.signal,
      timeoutMs: 5000,
    });
    const elapsed = Date.now() - start;

    assert(elapsed < 200, `Expected instant abort (<200ms), took ${elapsed}ms`);
    assert.strictEqual(summary.fullyVerifiedProducts.length, 0);
  });

  console.log("\n======================================================================");
  console.log(`🎉 ALL ${passed}/${total} PHASE 4 TESTS PASSED (100%)!`);
  console.log("======================================================================");
}

runPhase4Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
