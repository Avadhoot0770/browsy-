/**
 * Browsy Product Verifier & Size Verification Test Suite
 *
 * Dedicated tests for Phase 3 deep product verification requirements:
 * 1. Product with size XL available -> confirmed as verified match.
 * 2. Product with size XL unavailable / not offered -> rejected.
 * 3. Product with size XL displayed but disabled / out of stock -> rejected.
 * 4. Product with price above ₹1,000 -> rejected.
 * 5. Product with missing or ambiguous price -> rejected.
 * 6. Product detail navigation failure -> graceful fallback / skip to next candidate.
 * 7. User cancels during inspection -> immediate stop without hanging.
 * 8. No product satisfies all constraints -> honest partial completion reported.
 */

import assert from "node:assert";
import {
  parseSizeAvailability,
  parseProductSellingPrice,
  verifyProductAttributes,
  inspectProductDetail,
  inspectCandidateProducts,
  extractPdpSizeOptions,
  collectAccessibleRoots,
} from "../src/execution/product-verifier";
import { verifyFinalWebsiteState } from "../src/navigation/final-state-verifier";
import type { StructuredIntent } from "../intent/types";
import type { RepeatedItem, StructuredPageIntelligence } from "../page-intelligence/types";

// ============================================================
// MOCK DOM & SHADOW ROOT HARNESS FOR PDP SHADOW DOM TESTS
// ============================================================

class MockPdpElement {
  public tagName: string;
  public className = "";
  public textContent = "";
  public attributes = new Map<string, string>();
  public shadowRoot: MockPdpShadowRoot | null = null;
  public children: MockPdpElement[] = [];
  public disabled = false;
  public style: Record<string, string> = {};
  public parentElement: MockPdpElement | null = null;

  constructor(tagName: string) {
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

  public attachShadow(init: { mode: "open" | "closed" }): MockPdpShadowRoot {
    const sr = new MockPdpShadowRoot(this, init.mode);
    if (init.mode === "open") {
      this.shadowRoot = sr;
    } else {
      this.shadowRoot = null; // Closed shadow roots are inaccessible
    }
    return sr;
  }

  public appendChild(child: MockPdpElement): void {
    child.parentElement = this;
    this.children.push(child);
  }

  public querySelectorAll(selector: string): MockPdpElement[] {
    const results: MockPdpElement[] = [];
    for (const child of this.children) {
      if (child.matches(selector)) results.push(child);
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }

  public querySelector(selector: string): MockPdpElement | null {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  public matches(selector: string): boolean {
    const s = selector.toLowerCase();
    const tag = this.tagName.toLowerCase();
    const cls = this.className.toLowerCase();

    if (s === "*" || s === tag) return true;
    if (s.startsWith(".") && cls.includes(s.slice(1).toLowerCase())) return true;
    if (s.includes("size") && (cls.includes("size") || tag.includes("size") || this.hasAttribute("data-size"))) return true;
    if (s.includes("button") && (tag === "button" || cls.includes("button") || cls.includes("swatch") || cls.includes("pill"))) return true;
    if (s.includes("swatch") && cls.includes("swatch")) return true;
    if (s.includes("pill") && cls.includes("pill")) return true;
    if (s.includes("option") && (tag === "option" || cls.includes("option"))) return true;
    if (s.includes("price") && (cls.includes("price") || tag.includes("price"))) return true;
    return false;
  }
}

class MockPdpShadowRoot {
  public host: MockPdpElement;
  public mode: "open" | "closed";
  public children: MockPdpElement[] = [];

  constructor(host: MockPdpElement, mode: "open" | "closed") {
    this.host = host;
    this.mode = mode;
  }

  public appendChild(child: MockPdpElement): void {
    this.children.push(child);
  }

  public querySelectorAll(selector: string): MockPdpElement[] {
    const results: MockPdpElement[] = [];
    for (const child of this.children) {
      if (child.matches(selector)) results.push(child);
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }

  public querySelector(selector: string): MockPdpElement | null {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }
}

const baseShoppingIntent: StructuredIntent = {
  intent: "find",
  target: "products",
  entities: {
    category: "shirt",
  },
  filters: {
    color: "red",
    pattern: "checked",
    size: "XL",
  },
  constraints: {
    maxPrice: 1000,
    currency: "INR",
  },
  parameters: {
    sortBy: "rating",
  },
  clarificationNeeded: false,
  confidence: 0.95,
  status: "proposed",
};

async function runProductVerifierSuite() {
  console.log("\n======================================================================");
  console.log("🔍 BROWSY PRODUCT VERIFIER & SIZE AVAILABILITY TEST SUITE");
  console.log("   Verifying 8 specific requirements for product-level inspection");
  console.log("======================================================================\n");

  // ------------------------------------------------------------------
  // TEST 1: Product with size XL available -> confirmed as verified match
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 1: Product with size XL available -> confirmed as verified match ---");

    // Simulates Myntra PDP HTML with structured size inventory and price
    const availablePdpHtml = `
      <html>
        <head><title>Femibazaar Women Red & White Gingham Checked Shirt</title></head>
        <body>
          <h1 class="pdp-title">Femibazaar Women Red & White Gingham Checked Shirt</h1>
          <div class="pdp-price">₹447</div>
          <div class="size-buttons-size-container">
            <button class="size-buttons-size-button size-buttons-size-button-default">S</button>
            <button class="size-buttons-size-button size-buttons-size-button-default">M</button>
            <button class="size-buttons-size-button size-buttons-size-button-default">L</button>
            <button class="size-buttons-size-button size-buttons-size-button-default">XL</button>
          </div>
          <script>
            window.__myx = {
              "sizes": [
                {"label": "S", "available": true},
                {"label": "M", "available": true},
                {"label": "L", "available": true},
                {"label": "XL", "available": true}
              ],
              "discountedPrice": 447
            };
          </script>
        </body>
      </html>
    `;

    const sizeRes = parseSizeAvailability(availablePdpHtml, "XL");
    assert.strictEqual(sizeRes.status, "in_stock", "Size XL must be detected as in_stock");
    assert.strictEqual(sizeRes.isAvailable, true, "Size XL must be available");
    assert.strictEqual(sizeRes.isSelectable, true, "Size XL must be selectable");

    const verification = verifyProductAttributes(
      availablePdpHtml,
      baseShoppingIntent,
      "Femibazaar Women Red & White Gingham Checked Shirt",
      { raw: "₹447", amount: 447, currency: "INR" },
      "item-femibazaar",
      "https://www.myntra.com/shirts/femibazaar/12345"
    );

    assert.strictEqual(verification.isFullyVerified, true, "Product must be fully verified match");
    assert.strictEqual(verification.conditions.category.verified, true, "Category shirt verified");
    assert.strictEqual(verification.conditions.color.verified, true, "Color red verified");
    assert.strictEqual(verification.conditions.pattern.verified, true, "Pattern checked verified");
    assert.strictEqual(verification.conditions.price.verified, true, "Price ₹447 <= ₹1000 verified");
    assert.strictEqual(verification.conditions.size.available, true, "Size XL available");
    assert.strictEqual(verification.conditions.size.selectable, true, "Size XL selectable");
    assert.strictEqual(verification.rejectReason, undefined, "No rejection reason for verified match");

    console.log("✓ Test 1: In-stock and selectable Size XL confirmed as verified match: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 2: Product with size XL unavailable (not offered) -> rejected
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 2: Product with size XL unavailable (not offered) -> rejected ---");

    // Simulates a boys/kids shirt with only ages 3-4Y, 4-5Y, 5-6Y
    const notOfferedHtml = `
      <html>
        <body>
          <h1>Marks & Spencer Boys Red Checked Pure Cotton Casual Shirt</h1>
          <div class="pdp-price">₹899</div>
          <script>
            window.__myx = {
              "sizes": [
                {"label": "3-4Y", "available": true},
                {"label": "4-5Y", "available": false},
                {"label": "5-6Y", "available": true}
              ],
              "discountedPrice": 899
            };
          </script>
        </body>
      </html>
    `;

    const sizeRes = parseSizeAvailability(notOfferedHtml, "XL");
    assert.strictEqual(sizeRes.status, "not_offered", "Size XL must be not_offered");
    assert.strictEqual(sizeRes.isAvailable, false, "Size XL must NOT be available");

    const verification = verifyProductAttributes(
      notOfferedHtml,
      baseShoppingIntent,
      "Marks & Spencer Boys Red Checked Pure Cotton Casual Shirt",
      { raw: "₹899", amount: 899, currency: "INR" }
    );

    assert.strictEqual(verification.isFullyVerified, false, "Product must be rejected");
    assert.strictEqual(verification.conditions.size.available, false);
    assert.ok(verification.rejectReason?.includes("not offered"), "Rejection reason must mention not offered");

    console.log("✓ Test 2: Size XL not offered strictly rejected with honest diagnostic: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 3: Product with size XL displayed but disabled / out of stock -> rejected
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 3: Product with size XL displayed but disabled / out of stock -> rejected ---");

    // Simulates an adult shirt where XL is out of stock (disabled class + available: false)
    const outOfStockHtml = `
      <html>
        <body>
          <h1>Highlander Men Red Checked Casual Shirt</h1>
          <div class="pdp-price">₹699</div>
          <div class="size-buttons-size-container">
            <button class="size-buttons-size-button size-buttons-size-button-default">S</button>
            <button class="size-buttons-size-button size-buttons-size-button-default">M</button>
            <button class="size-buttons-size-button size-buttons-size-button-default">L</button>
            <button class="size-buttons-size-button size-buttons-size-button-disabled" disabled aria-disabled="true">
              XL <span class="strike"></span>
            </button>
          </div>
          <script>
            window.__myx = {
              "sizes": [
                {"label": "S", "available": true},
                {"label": "M", "available": true},
                {"label": "L", "available": true},
                {"label": "XL", "available": false}
              ],
              "discountedPrice": 699
            };
          </script>
        </body>
      </html>
    `;

    const sizeRes = parseSizeAvailability(outOfStockHtml, "XL");
    assert.strictEqual(sizeRes.status, "out_of_stock", "Size XL must be recognized as out_of_stock");
    assert.strictEqual(sizeRes.isAvailable, false, "Size XL must NOT be available");
    assert.strictEqual(sizeRes.isSelectable, false, "Disabled button must NOT be selectable");

    const verification = verifyProductAttributes(
      outOfStockHtml,
      baseShoppingIntent,
      "Highlander Men Red Checked Casual Shirt",
      { raw: "₹699", amount: 699, currency: "INR" }
    );

    assert.strictEqual(verification.isFullyVerified, false, "Out of stock item must be rejected");
    assert.ok(verification.rejectReason?.includes("out of stock"), "Rejection reason must mention out of stock");

    console.log("✓ Test 3: Size XL out of stock / disabled button strictly rejected: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 4: Product with price above ₹1,000 -> rejected
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 4: Product with price above ₹1,000 -> rejected ---");

    const overBudgetHtml = `
      <html>
        <body>
          <h1>Zucchini Men Red Checked Casual Shirt</h1>
          <div class="pdp-price">₹1,219</div>
          <script>
            window.__myx = {
              "sizes": [{"label": "XL", "available": true}],
              "discountedPrice": 1219
            };
          </script>
        </body>
      </html>
    `;

    const price = parseProductSellingPrice(overBudgetHtml);
    assert.strictEqual(price?.amount, 1219, "Price 1219 parsed");

    const verification = verifyProductAttributes(
      overBudgetHtml,
      baseShoppingIntent,
      "Zucchini Men Red Checked Casual Shirt",
      price
    );

    assert.strictEqual(verification.isFullyVerified, false, "Over-budget product must be rejected");
    assert.strictEqual(verification.conditions.price.verified, false, "Price verification must fail");
    assert.ok(verification.rejectReason?.includes("exceeds budget"), "Rejection reason must cite budget violation");

    console.log("✓ Test 4: Product priced at ₹1,219 strictly rejected from ₹1,000 budget: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 5: Product with missing or ambiguous price -> rejected
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 5: Product with missing or ambiguous price -> rejected ---");

    const missingPriceHtml = `
      <html>
        <body>
          <h1>Roadster Red Checked Shirt</h1>
          <p>Price on request / unavailable</p>
          <script>
            window.__myx = {
              "sizes": [{"label": "XL", "available": true}]
            };
          </script>
        </body>
      </html>
    `;

    const price = parseProductSellingPrice(missingPriceHtml);
    assert.strictEqual(price, null, "Price must be null when unparseable");

    const verification = verifyProductAttributes(
      missingPriceHtml,
      baseShoppingIntent,
      "Roadster Red Checked Shirt",
      null
    );

    assert.strictEqual(verification.isFullyVerified, false, "Missing price must be rejected");
    assert.strictEqual(verification.conditions.price.verified, false);
    assert.ok(verification.rejectReason?.includes("Selling price could not be verified"));

    console.log("✓ Test 5: Ambiguous / missing price safely rejected without guessing: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 6: Product detail navigation failure -> graceful fallback / skip to next candidate
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 6: Product detail navigation failure -> graceful fallback / skip to next candidate ---");

    const originalFetch = globalThis.fetch;
    let fetchCount = 0;

    // Candidate 1 fails with 500 server error; Candidate 2 succeeds and matches
    globalThis.fetch = (async (url: string | URL | Request) => {
      fetchCount++;
      const urlStr = String(url);
      if (urlStr.includes("failed-item")) {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => `
          <html>
            <body>
              <h1>Mast & Harbour Red Checked Cotton Casual Shirt</h1>
              <div class="pdp-price">₹799</div>
              <script>
                window.__myx = {
                  "sizes": [{"label": "XL", "available": true}],
                  "discountedPrice": 799
                };
              </script>
            </body>
          </html>
        `,
      } as Response;
    }) as any;

    try {
      const candidates: RepeatedItem[] = [
        {
          elementId: "item-1",
          title: "Broken Product",
          link: { href: "https://example.com/failed-item-pdp" },
          price: { raw: "₹500", amount: 500, currency: "INR" },
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
        {
          elementId: "item-2",
          title: "Mast & Harbour Red Checked Cotton Casual Shirt",
          link: { href: "https://example.com/success-item-pdp" },
          price: { raw: "₹799", amount: 799, currency: "INR" },
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
      ];

      const summary = await inspectCandidateProducts(candidates, baseShoppingIntent);
      assert.strictEqual(fetchCount, 2, "Must inspect candidate 1, encounter error, and continue to candidate 2");
      assert.strictEqual(summary.rejectedProducts.length, 1, "Candidate 1 logged as rejected");
      assert.ok(summary.rejectedProducts[0].reason.includes("500"), "Candidate 1 failed due to HTTP 500");
      assert.strictEqual(summary.fullyVerifiedProducts.length, 1, "Candidate 2 successfully verified");
      assert.strictEqual(summary.bestMatch?.elementId, "item-2", "Candidate 2 selected as best match");
    } finally {
      globalThis.fetch = originalFetch;
    }

    console.log("✓ Test 6: Network / HTTP failure on candidate 1 gracefully skipped to candidate 2: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 7: User cancels during inspection -> immediate stop without hanging
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 7: User cancels during inspection -> immediate stop without hanging ---");

    const originalFetch = globalThis.fetch;
    const controller = new AbortController();

    globalThis.fetch = (async (_url: any, opts: any) => {
      // Simulate waiting or aborting
      if (opts?.signal?.aborted) {
        const err = new Error("AbortError");
        err.name = "AbortError";
        throw err;
      }
      return {
        ok: true,
        status: 200,
        text: async () => "<html><body>Shirt</body></html>",
      } as Response;
    }) as any;

    try {
      const candidates: RepeatedItem[] = [
        {
          elementId: "item-abort",
          title: "Red Checked Shirt",
          link: { href: "https://example.com/item" },
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
      ];

      controller.abort(); // Cancel immediately
      const summary = await inspectCandidateProducts(candidates, baseShoppingIntent, {
        signal: controller.signal,
      });

      assert.strictEqual(summary.fullyVerifiedProducts.length, 0, "No products verified after abort");
      assert.strictEqual(summary.inspectedCount, 0, "Loop terminated immediately upon cancellation");
    } finally {
      globalThis.fetch = originalFetch;
    }

    console.log("✓ Test 7: User abort signal stops candidate inspection loop cleanly: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 8: No product satisfies all constraints -> honest partial completion reported
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 8: No product satisfies all constraints -> honest partial completion reported ---");

    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () => {
      return {
        ok: true,
        status: 200,
        text: async () => `
          <html>
            <body>
              <h1>Red Checked Shirt</h1>
              <div class="pdp-price">₹650</div>
              <script>
                window.__myx = {
                  "sizes": [
                    {"label": "S", "available": true},
                    {"label": "M", "available": true},
                    {"label": "L", "available": true},
                    {"label": "XL", "available": false}
                  ],
                  "discountedPrice": 650
                };
              </script>
            </body>
          </html>
        `,
      } as Response;
    }) as any;

    try {
      const candidates: RepeatedItem[] = [
        {
          elementId: "item-oos-1",
          title: "Brand A Red Checked Shirt",
          link: { href: "https://example.com/item-1" },
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
        {
          elementId: "item-oos-2",
          title: "Brand B Red Checked Shirt",
          link: { href: "https://example.com/item-2" },
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
      ];

      const summary = await inspectCandidateProducts(candidates, baseShoppingIntent);
      assert.strictEqual(summary.inspectedCount, 2, "Both candidates inspected");
      assert.strictEqual(summary.fullyVerifiedProducts.length, 0, "Zero candidates satisfied all constraints");
      assert.strictEqual(summary.bestMatch, null, "No false positive best match returned");
      assert.strictEqual(summary.rejectedProducts.length, 2, "Both rejected with reasons");
    } finally {
      globalThis.fetch = originalFetch;
    }

    console.log("✓ Test 8: All candidates failing constraints results in honest zero-matches (no fabrication): PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 9: Result Card Data Structure Integrity (All Attributes Grounded)
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 9: Result Card Data Structure Integrity (All Attributes Grounded) ---");

    const fullMatchHtml = `
      <html>
        <body>
          <h1 class="pdp-title">Roadster Men Red & Black Checked Casual Shirt</h1>
          <div class="pdp-price">₹749</div>
          <img class="pdp-image" src="https://assets.myntassets.com/roadster-red-shirt.jpg" alt="Roadster Red Checked Shirt" />
          <div class="rating-box">4.3★</div>
          <script>
            window.__myx = {
              "sizes": [
                {"label": "S", "available": true},
                {"label": "M", "available": true},
                {"label": "L", "available": true},
                {"label": "XL", "available": true}
              ],
              "discountedPrice": 749
            };
          </script>
        </body>
      </html>
    `;

    const verification = verifyProductAttributes(
      fullMatchHtml,
      baseShoppingIntent,
      "Roadster Men Red & Black Checked Casual Shirt",
      { raw: "₹749", amount: 749, currency: "INR" },
      "card-roadster",
      "https://www.myntra.com/shirts/roadster/78910"
    );

    assert.strictEqual(verification.isFullyVerified, true, "Product must be fully verified match");
    assert.strictEqual(verification.title, "Roadster Men Red & Black Checked Casual Shirt");
    assert.strictEqual(verification.price?.amount, 749);
    assert.strictEqual(verification.price?.currency, "INR");
    assert.strictEqual(verification.conditions.size.requested, "XL");
    assert.strictEqual(verification.conditions.size.status, "in_stock");
    assert.strictEqual(verification.conditions.size.available, true);
    assert.strictEqual(verification.conditions.color.verified, true);
    assert.strictEqual(verification.conditions.pattern.verified, true);
    assert.strictEqual(verification.conditions.category.verified, true);
    assert.strictEqual(verification.conditions.price.verified, true);
    assert.strictEqual(verification.url, "https://www.myntra.com/shirts/roadster/78910");

    // Verify all 5 constraint checklist items carry factual evidence
    assert.ok(verification.conditions.category.evidence.includes("shirt") || verification.conditions.category.evidence.includes("title"));
    assert.ok(verification.conditions.color.evidence.includes("red"));
    assert.ok(verification.conditions.pattern.evidence.includes("checked"));
    assert.ok(verification.conditions.size.evidence.includes("in stock"));
    assert.ok(verification.conditions.price.evidence.includes("749"));

    console.log("✓ Test 9: Result card data structure carries grounded evidence for all required attributes: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 10: Grounding Color & Pattern in Product-Specific Evidence (Rejecting False Positives from Generic Search URL)
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 10: Grounding Color & Pattern in Product-Specific Evidence ---");

    // Simulates an item on a search page where URL is /red-checked-shirts, but product itself is Solid White
    const solidWhiteHtml = `
      <html>
        <body>
          <h1>Louis Philippe Men Classic Solid White Formal Shirt</h1>
          <div class="pdp-price">₹899</div>
          <script>
            window.__myx = {
              "sizes": [{"label": "XL", "available": true}],
              "discountedPrice": 899
            };
          </script>
        </body>
      </html>
    `;

    const verification = verifyProductAttributes(
      solidWhiteHtml,
      baseShoppingIntent,
      "Louis Philippe Men Classic Solid White Formal Shirt",
      { raw: "₹899", amount: 899, currency: "INR" },
      "card-white-shirt",
      "https://www.myntra.com/shirts/louis-philippe/white-shirt"
    );

    assert.strictEqual(verification.isFullyVerified, false, "Solid white shirt must NOT be verified as red checked match");
    assert.strictEqual(verification.conditions.color.verified, false, "Color verification must fail");
    assert.strictEqual(verification.conditions.pattern.verified, false, "Pattern verification must fail");

    console.log("✓ Test 10: Color & pattern grounded strictly in product evidence, preventing false positive matches: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 11: Children's Item Exclusion Guard
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 11: Children's Item Exclusion Guard ---");

    // Kids shirt that happens to have a size labeled "XL" (e.g. teen/kids XL)
    const kidsShirtHtml = `
      <html>
        <body>
          <h1>Marks & Spencer Boys Red Checked Pure Cotton Casual Shirt</h1>
          <div class="pdp-price">₹699</div>
          <script>
            window.__myx = {
              "sizes": [
                {"label": "L (11-12Y)", "available": true},
                {"label": "XL (13-14Y)", "available": true}
              ],
              "discountedPrice": 699
            };
          </script>
        </body>
      </html>
    `;

    const verification = verifyProductAttributes(
      kidsShirtHtml,
      baseShoppingIntent,
      "Marks & Spencer Boys Red Checked Pure Cotton Casual Shirt",
      { raw: "₹699", amount: 699, currency: "INR" },
      "card-kids-shirt",
      "https://www.myntra.com/shirts/m-and-s/boys-red-checked"
    );

    assert.strictEqual(verification.isFullyVerified, false, "Children's / boys' shirt must be rejected when adult requested");
    assert.strictEqual(verification.conditions.category.verified, false, "Category verification must reject kids item");
    assert.ok(verification.conditions.category.evidence.includes("children") || verification.conditions.category.evidence.includes("kids"));

    console.log("✓ Test 11: Children's / boys' item rejected when adult garment requested: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 12: Strict Concurrency Limit (Never exceeds 2 simultaneous inspections)
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 12: Strict Concurrency Limit (<= 2 simultaneous in-flight) ---");

    const originalFetch = globalThis.fetch;
    let currentInFlight = 0;
    let maxObservedInFlight = 0;

    globalThis.fetch = (async (url: any) => {
      currentInFlight++;
      maxObservedInFlight = Math.max(maxObservedInFlight, currentInFlight);
      await new Promise((r) => setTimeout(r, 40));
      currentInFlight--;

      return {
        ok: true,
        status: 200,
        text: async () => `
          <html><body>
            <h1>Roadster Red Checked Cotton Casual Shirt</h1>
            <div class="pdp-price">₹699</div>
            <script>
              window.__myx = { "sizes": [{"label": "XL", "available": true}], "discountedPrice": 699 };
            </script>
          </body></html>
        `,
      } as Response;
    }) as any;

    try {
      const candidates: RepeatedItem[] = [
        { elementId: "c1", title: "Shirt 1", link: { href: "https://example.com/1" }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
        { elementId: "c2", title: "Shirt 2", link: { href: "https://example.com/2" }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
        { elementId: "c3", title: "Shirt 3", link: { href: "https://example.com/3" }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
        { elementId: "c4", title: "Shirt 4", link: { href: "https://example.com/4" }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
      ];

      const summary = await inspectCandidateProducts(candidates, baseShoppingIntent);
      assert.strictEqual(maxObservedInFlight <= 2, true, `In-flight requests must never exceed 2 (observed: ${maxObservedInFlight})`);
      assert.strictEqual(maxObservedInFlight >= 2, true, "Concurrent mode must utilize 2 workers simultaneously");
      assert.strictEqual(summary.fullyVerifiedProducts.length >= 1, true, "Should verify matches");
    } finally {
      globalThis.fetch = originalFetch;
    }

    console.log(`✓ Test 12: Strict concurrency bound enforced (peak in-flight: ${maxObservedInFlight} <= 2): PASS\n`);
  }

  // ------------------------------------------------------------------
  // TEST 13: Configurable Concurrency (Sequential Mode Fallback)
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 13: Configurable Concurrency (Sequential Mode Fallback) ---");

    const originalFetch = globalThis.fetch;
    let currentInFlight = 0;
    let maxObservedInFlight = 0;

    globalThis.fetch = (async (url: any) => {
      currentInFlight++;
      maxObservedInFlight = Math.max(maxObservedInFlight, currentInFlight);
      await new Promise((r) => setTimeout(r, 20));
      currentInFlight--;

      return {
        ok: true,
        status: 200,
        text: async () => `
          <html><body>
            <h1>Roadster Red Checked Casual Shirt</h1>
            <div class="pdp-price">₹699</div>
            <script>window.__myx = { "sizes": [{"label": "XL", "available": true}], "discountedPrice": 699 };</script>
          </body></html>
        `,
      } as Response;
    }) as any;

    try {
      const candidates: RepeatedItem[] = [
        { elementId: "c1", title: "Shirt 1", link: { href: "https://example.com/1" }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
        { elementId: "c2", title: "Shirt 2", link: { href: "https://example.com/2" }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
      ];

      await inspectCandidateProducts(candidates, baseShoppingIntent, { concurrency: 1 });
      assert.strictEqual(maxObservedInFlight, 1, `Sequential mode must never have more than 1 in flight (observed: ${maxObservedInFlight})`);
    } finally {
      globalThis.fetch = originalFetch;
    }

    console.log("✓ Test 13: Configurable concurrency safely supports sequential fallback (concurrency = 1): PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 14: Timeout Bounded Handling Across Concurrent Workers
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 14: Timeout Bounded Handling Across Concurrent Workers ---");

    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes("stalled-item")) {
        // Stall until aborted by AbortSignal
        return new Promise((resolve, reject) => {
          opts?.signal?.addEventListener("abort", () => {
            const err = new Error("AbortError");
            err.name = "AbortError";
            reject(err);
          });
        });
      }

      return {
        ok: true,
        status: 200,
        text: async () => `
          <html><body>
            <h1>Wrogn Red Checked Cotton Casual Shirt</h1>
            <div class="pdp-price">₹799</div>
            <script>window.__myx = { "sizes": [{"label": "XL", "available": true}], "discountedPrice": 799 };</script>
          </body></html>
        `,
      } as Response;
    }) as any;

    try {
      const candidates: RepeatedItem[] = [
        { elementId: "c-stall", title: "Stalled Shirt", link: { href: "https://example.com/stalled-item" }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
        { elementId: "c-ok", title: "Wrogn Red Checked Cotton Casual Shirt", link: { href: "https://example.com/ok-item" }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
      ];

      const start = Date.now();
      const summary = await inspectCandidateProducts(candidates, baseShoppingIntent, {
        timeoutMs: 80,
      });
      const duration = Date.now() - start;

      assert.strictEqual(summary.rejectedProducts.length, 1, "Stalled item rejected due to timeout");
      assert.ok(summary.rejectedProducts[0].reason.includes("timed out") || summary.rejectedProducts[0].reason.includes("Inspection error"));
      assert.strictEqual(summary.fullyVerifiedProducts.length, 1, "Valid item verified despite sibling timeout");
      assert.strictEqual(summary.bestMatch?.elementId, "c-ok");
      assert.strictEqual(duration < 1500, true, "Batch completed within bounded time");
    } finally {
      globalThis.fetch = originalFetch;
    }

    console.log("✓ Test 14: Bounded timeout rejects stalled candidate without stalling batch: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 15: Cancellation Mid-Batch Invariant
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 15: Cancellation Mid-Batch Invariant ---");

    const originalFetch = globalThis.fetch;
    const controller = new AbortController();
    let fetchedUrls: string[] = [];

    globalThis.fetch = (async (url: any, opts: any) => {
      const urlStr = String(url);
      fetchedUrls.push(urlStr);
      await new Promise((r) => setTimeout(r, 30));

      if (opts?.signal?.aborted) {
        const err = new Error("AbortError");
        err.name = "AbortError";
        throw err;
      }

      // Abort after first item is processed
      controller.abort();

      return {
        ok: true,
        status: 200,
        text: async () => `<html><body><h1>Shirt</h1></body></html>`,
      } as Response;
    }) as any;

    try {
      const candidates: RepeatedItem[] = [
        { elementId: "c1", title: "Shirt 1", link: { href: "https://example.com/item1" }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
        { elementId: "c2", title: "Shirt 2", link: { href: "https://example.com/item2" }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
        { elementId: "c3", title: "Shirt 3", link: { href: "https://example.com/item3" }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
        { elementId: "c4", title: "Shirt 4", link: { href: "https://example.com/item4" }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
      ];

      await inspectCandidateProducts(candidates, baseShoppingIntent, { signal: controller.signal });
      assert.strictEqual(fetchedUrls.length <= 2, true, `Queue processing stopped immediately on abort (fetched: ${fetchedUrls.length})`);
    } finally {
      globalThis.fetch = originalFetch;
    }

    console.log("✓ Test 15: Cancellation signal aborts in-flight and stops queued requests immediately: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 16: Out-of-Order Response Determinism (Preserving Candidate Rank)
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 16: Out-of-Order Response Determinism ---");

    const originalFetch = globalThis.fetch;

    // Item 1 (Rank 1, priced ₹450) takes longer (60ms)
    // Item 2 (Rank 2, priced ₹850) finishes faster (10ms)
    globalThis.fetch = (async (url: any) => {
      const urlStr = String(url);
      const isItem1 = urlStr.includes("item-rank1");
      await new Promise((r) => setTimeout(r, isItem1 ? 60 : 10));

      const price = isItem1 ? 450 : 850;
      return {
        ok: true,
        status: 200,
        text: async () => `
          <html><body>
            <h1>Roadster Red Checked Cotton Casual Shirt</h1>
            <div class="pdp-price">₹${price}</div>
            <script>window.__myx = { "sizes": [{"label": "XL", "available": true}], "discountedPrice": ${price} };</script>
          </body></html>
        `,
      } as Response;
    }) as any;

    try {
      const candidates: RepeatedItem[] = [
        { elementId: "rank-1", title: "Roadster Red Checked Shirt", link: { href: "https://example.com/item-rank1" }, price: { raw: "₹450", amount: 450, currency: "INR" }, rating: { score: 4.5, count: 100 }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
        { elementId: "rank-2", title: "Roadster Red Checked Shirt", link: { href: "https://example.com/item-rank2" }, price: { raw: "₹850", amount: 850, currency: "INR" }, rating: { score: 4.0, count: 50 }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
      ];

      const summary = await inspectCandidateProducts(candidates, baseShoppingIntent);
      assert.strictEqual(summary.fullyVerifiedProducts.length, 2, "Both items should verify");
      assert.strictEqual(summary.bestMatch?.elementId, "rank-1", "Rank 1 item must remain bestMatch despite finishing after Rank 2");
      assert.strictEqual(summary.fullyVerifiedProducts[0].elementId, "rank-1", "Index 0 must be deterministic Rank 1");
      assert.strictEqual(summary.fullyVerifiedProducts[1].elementId, "rank-2", "Index 1 must be Rank 2");
    } finally {
      globalThis.fetch = originalFetch;
    }

    console.log("✓ Test 16: Out-of-order network responses deterministically preserve ranked result priority: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 17: Ordinary DOM Size Selectors (Light DOM)
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 17: Ordinary DOM Size Selectors (Light DOM) ---");

    const page = new MockPdpElement("DIV");
    page.className = "product-detail";

    const sBtn = new MockPdpElement("BUTTON");
    sBtn.className = "size-button";
    sBtn.textContent = "S";

    const mBtn = new MockPdpElement("BUTTON");
    mBtn.className = "size-button";
    mBtn.textContent = "M";

    const xlBtn = new MockPdpElement("BUTTON");
    xlBtn.className = "size-button";
    xlBtn.textContent = "XL";

    page.appendChild(sBtn);
    page.appendChild(mBtn);
    page.appendChild(xlBtn);

    const extraction = extractPdpSizeOptions(page as any);
    assert.strictEqual(extraction.availableSizes.length, 3);
    assert.ok(extraction.availableSizes.includes("XL"));
    assert.strictEqual(extraction.shadowRootsEncountered, 0, "No shadow roots encountered in light DOM");

    const sizeRes = parseSizeAvailability(page as any, "XL");
    assert.strictEqual(sizeRes.status, "in_stock");
    assert.strictEqual(sizeRes.isAvailable, true);
    assert.strictEqual(sizeRes.isSelectable, true);
    assert.strictEqual(sizeRes.source, "light_dom");

    console.log("✓ Test 17: Ordinary DOM size selectors correctly parsed from light DOM: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 18: One Open Shadow DOM Root
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 18: One Open Shadow DOM Root ---");

    const page = new MockPdpElement("DIV");
    const customHost = new MockPdpElement("PDP-SIZE-PICKER");
    page.appendChild(customHost);

    const shadowRoot = customHost.attachShadow({ mode: "open" });
    const sBtn = new MockPdpElement("BUTTON");
    sBtn.className = "size-pill";
    sBtn.textContent = "S";

    const mBtn = new MockPdpElement("BUTTON");
    mBtn.className = "size-pill";
    mBtn.textContent = "M";

    const xlBtn = new MockPdpElement("BUTTON");
    xlBtn.className = "size-pill";
    xlBtn.textContent = "XL";

    shadowRoot.appendChild(sBtn);
    shadowRoot.appendChild(mBtn);
    shadowRoot.appendChild(xlBtn);

    const extraction = extractPdpSizeOptions(page as any);
    assert.strictEqual(extraction.shadowRootsEncountered, 1, "Exactly one shadow root encountered");
    assert.ok(extraction.availableSizes.includes("XL"));
    assert.ok(extraction.sources.includes("shadow_dom"));

    const sizeRes = parseSizeAvailability(page as any, "XL");
    assert.strictEqual(sizeRes.status, "in_stock");
    assert.strictEqual(sizeRes.isAvailable, true);
    assert.strictEqual(sizeRes.isSelectable, true);
    assert.strictEqual(sizeRes.source, "shadow_dom");
    assert.ok(sizeRes.evidence.includes("Shadow DOM"));

    console.log("✓ Test 18: Single open Shadow DOM root traversed and sizes extracted: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 19: Nested Open Shadow DOM Roots
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 19: Nested Open Shadow DOM Roots ---");

    const page = new MockPdpElement("DIV");
    const outerHost = new MockPdpElement("PRODUCT-VARIANTS");
    page.appendChild(outerHost);

    // Root 1: Outer shadow root
    const outerShadow = outerHost.attachShadow({ mode: "open" });
    const innerHost = new MockPdpElement("SIZE-SWATCHES");
    outerShadow.appendChild(innerHost);

    // Root 2: Nested inner shadow root
    const innerShadow = innerHost.attachShadow({ mode: "open" });
    const xlBtn = new MockPdpElement("BUTTON");
    xlBtn.className = "swatch";
    xlBtn.textContent = "XL";
    innerShadow.appendChild(xlBtn);

    const extraction = extractPdpSizeOptions(page as any);
    assert.strictEqual(extraction.shadowRootsEncountered, 2, "Both outer and nested shadow roots encountered");
    assert.ok(extraction.availableSizes.includes("XL"));

    const xlOption = extraction.options.find((o) => o.label === "XL");
    assert.ok(xlOption);
    assert.strictEqual(xlOption?.source, "shadow_dom");
    assert.strictEqual(xlOption?.shadowDepth, 2, "Shadow depth must reflect nested level 2");

    const sizeRes = parseSizeAvailability(page as any, "XL");
    assert.strictEqual(sizeRes.status, "in_stock");
    assert.strictEqual(sizeRes.isAvailable, true);

    console.log("✓ Test 19: Nested open Shadow DOM roots recursively traversed: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 20: Unavailable Sizes Inside Shadow DOM
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 20: Unavailable Sizes Inside Shadow DOM ---");

    // Case A: disabled attribute inside shadow root
    const hostA = new MockPdpElement("CUSTOM-SIZE-SELECTOR");
    const shadowA = hostA.attachShadow({ mode: "open" });
    const xlDisabled = new MockPdpElement("BUTTON");
    xlDisabled.className = "size-btn";
    xlDisabled.textContent = "XL";
    xlDisabled.disabled = true;
    xlDisabled.setAttribute("disabled", "true");
    shadowA.appendChild(xlDisabled);

    const resA = parseSizeAvailability(hostA as any, "XL");
    assert.strictEqual(resA.status, "out_of_stock", "Disabled size button in shadow DOM must be out_of_stock");
    assert.strictEqual(resA.isAvailable, false);
    assert.strictEqual(resA.isSelectable, false);

    // Case B: aria-disabled inside shadow root
    const hostB = new MockPdpElement("CUSTOM-SIZE-SELECTOR");
    const shadowB = hostB.attachShadow({ mode: "open" });
    const xlAria = new MockPdpElement("BUTTON");
    xlAria.className = "size-btn";
    xlAria.textContent = "XL";
    xlAria.setAttribute("aria-disabled", "true");
    shadowB.appendChild(xlAria);

    const resB = parseSizeAvailability(hostB as any, "XL");
    assert.strictEqual(resB.status, "out_of_stock", "aria-disabled='true' must be out_of_stock");
    assert.strictEqual(resB.isAvailable, false);

    // Case C: class="out-of-stock" inside shadow root
    const hostC = new MockPdpElement("CUSTOM-SIZE-SELECTOR");
    const shadowC = hostC.attachShadow({ mode: "open" });
    const xlClass = new MockPdpElement("BUTTON");
    xlClass.className = "size-pill out-of-stock";
    xlClass.textContent = "XL";
    shadowC.appendChild(xlClass);

    const resC = parseSizeAvailability(hostC as any, "XL");
    assert.strictEqual(resC.status, "out_of_stock", "class 'out-of-stock' must be out_of_stock");
    assert.strictEqual(resC.isAvailable, false);

    // Case D: parent wrapper disabled state
    const hostD = new MockPdpElement("CUSTOM-SIZE-SELECTOR");
    const shadowD = hostD.attachShadow({ mode: "open" });
    const wrapper = new MockPdpElement("DIV");
    wrapper.setAttribute("disabled", "true");
    const xlWrapped = new MockPdpElement("BUTTON");
    xlWrapped.textContent = "XL";
    wrapper.appendChild(xlWrapped);
    shadowD.appendChild(wrapper);

    const resD = parseSizeAvailability(hostD as any, "XL");
    assert.strictEqual(resD.status, "out_of_stock", "Parent disabled state must propagate to child size control");
    assert.strictEqual(resD.isAvailable, false);

    console.log("✓ Test 20: Unavailable sizes inside Shadow DOM strictly identified as out_of_stock: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 21: Missing or Inaccessible Size Selectors
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 21: Missing or Inaccessible Size Selectors ---");

    // Subtest A: Empty page without size controls
    const emptyPage = new MockPdpElement("DIV");
    const resA = parseSizeAvailability(emptyPage as any, "XL");
    assert.strictEqual(resA.status, "unverified");
    assert.strictEqual(resA.isAvailable, false);

    // Subtest B: Closed Shadow DOM (Security/Encapsulation Boundary)
    const hostClosed = new MockPdpElement("CLOSED-VARIANTS");
    hostClosed.setAttribute("shadowrootmode", "closed");
    hostClosed.attachShadow({ mode: "closed" }); // hostClosed.shadowRoot is null

    const resB = parseSizeAvailability(hostClosed as any, "XL");
    assert.strictEqual(resB.status, "unverified");
    assert.strictEqual(resB.isAvailable, false);
    assert.ok(resB.inaccessibleRootsEncountered! >= 1, "Closed shadow root must be recorded as inaccessible");
    assert.ok(resB.evidence.includes("inaccessible/closed shadow root"), "Truthfully communicates inaccessible encapsulation");

    console.log("✓ Test 21: Missing and inaccessible/closed size selectors safely reported as unverified: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 22: Mixed Ordinary DOM and Shadow DOM Controls
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 22: Mixed Ordinary DOM and Shadow DOM Controls ---");

    const page = new MockPdpElement("DIV");

    // Light DOM sizes: S and M
    const sBtn = new MockPdpElement("BUTTON");
    sBtn.className = "size-btn";
    sBtn.textContent = "S";
    const mBtn = new MockPdpElement("BUTTON");
    mBtn.className = "size-btn";
    mBtn.textContent = "M";
    page.appendChild(sBtn);
    page.appendChild(mBtn);

    // Shadow DOM sizes: L and XL
    const shadowHost = new MockPdpElement("EXTRA-SIZES");
    page.appendChild(shadowHost);
    const shadowRoot = shadowHost.attachShadow({ mode: "open" });
    const lBtn = new MockPdpElement("BUTTON");
    lBtn.className = "size-btn";
    lBtn.textContent = "L";
    const xlBtn = new MockPdpElement("BUTTON");
    xlBtn.className = "size-btn";
    xlBtn.textContent = "XL";
    shadowRoot.appendChild(lBtn);
    shadowRoot.appendChild(xlBtn);

    const extraction = extractPdpSizeOptions(page as any);
    assert.strictEqual(extraction.availableSizes.length, 4, "All 4 sizes across light and shadow DOM discovered");
    assert.ok(extraction.availableSizes.includes("S"));
    assert.ok(extraction.availableSizes.includes("M"));
    assert.ok(extraction.availableSizes.includes("L"));
    assert.ok(extraction.availableSizes.includes("XL"));
    assert.ok(extraction.sources.includes("light_dom"));
    assert.ok(extraction.sources.includes("shadow_dom"));

    const sRes = parseSizeAvailability(page as any, "S");
    assert.strictEqual(sRes.status, "in_stock");
    assert.strictEqual(sRes.source, "light_dom");

    const xlRes = parseSizeAvailability(page as any, "XL");
    assert.strictEqual(xlRes.status, "in_stock");
    assert.strictEqual(xlRes.source, "shadow_dom");

    console.log("✓ Test 22: Mixed light DOM and Shadow DOM controls seamlessly aggregated: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 23: Malformed Elements and Candidate-Level Failures
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 23: Malformed Elements and Candidate-Level Failures ---");

    // Subtest A: Malformed DOM element does not crash extraction
    const pageWithMalformed = new MockPdpElement("DIV");
    const badEl: any = {
      tagName: "BUTTON",
      className: "size-btn",
      get textContent(): string {
        throw new Error("Simulated DOM access error");
      },
    };
    pageWithMalformed.children.push(badEl);

    const extraction = extractPdpSizeOptions(pageWithMalformed as any);
    assert.ok(Array.isArray(extraction.options), "Must return options array without throwing");

    // Subtest B: Candidate-level HTTP failure isolated; subsequent candidate using Shadow DOM succeeds
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("fail-candidate")) {
        return { ok: false, status: 500 } as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => `
          <html><body>
            <h1 class="pdp-title">Femibazaar Red Checked Shirt</h1>
            <div class="pdp-price">₹650</div>
            <button class="size-button">XL</button>
            <script>window.__myx = { "sizes": [{"label": "XL", "available": true}], "discountedPrice": 650 };</script>
          </body></html>
        `,
      } as Response;
    }) as any;

    try {
      const candidates: RepeatedItem[] = [
        { elementId: "c-1", title: "Roadster Red Checked Shirt", link: { href: "https://example.com/fail-candidate" }, price: { raw: "₹500", amount: 500, currency: "INR" }, rating: { score: 4.5, count: 10 }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
        { elementId: "c-2", title: "Femibazaar Red Checked Shirt", link: { href: "https://example.com/shadow-candidate" }, price: { raw: "₹650", amount: 650, currency: "INR" }, rating: { score: 4.6, count: 20 }, bounds: { x: 0, y: 0, width: 1, height: 1 } },
      ];

      const summary = await inspectCandidateProducts(candidates, baseShoppingIntent);
      assert.strictEqual(summary.rejectedProducts.length, 1, "Candidate 1 error safely isolated in rejectedProducts");
      assert.strictEqual(summary.fullyVerifiedProducts.length, 1, "Candidate 2 verified via Shadow DOM");
      assert.strictEqual(summary.bestMatch?.elementId, "c-2");
    } finally {
      globalThis.fetch = originalFetch;
    }

    console.log("✓ Test 23: Malformed elements and candidate-level network errors safely isolated: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 24: Invariant: COMPLETED Requires Evidence for Every Mandatory Constraint
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 24: Invariant: COMPLETED Requires Evidence for Every Mandatory Constraint ---");

    const mockPageContext: StructuredPageIntelligence = {
      url: "https://www.myntra.com/shirts",
      hostname: "www.myntra.com",
      title: "Red Checked Shirts",
      summary: "Shirts listing",
      headings: [{ level: 1, text: "Red Checked Shirts" }],
      repeatedGroups: [
        {
          containerSelector: ".grid",
          inferredType: "product-like",
          count: 20,
          items: [
            { elementId: "item-1", title: "Roadster Men Red Checked Shirt", price: { raw: "₹699", amount: 699, currency: "INR" }, bounds: { x: 0, y: 0, width: 100, height: 100 } },
          ],
        },
      ],
      interactiveElements: [],
      inputs: [],
      buttons: [],
      links: [],
      tables: [],
    };

    // Subtest A: Candidate has verified size XL inside Shadow DOM -> COMPLETED
    const verifiedProduct = {
      elementId: "item-1",
      title: "Roadster Men Red Checked Shirt",
      price: { raw: "₹699", amount: 699, currency: "INR" },
      rating: { raw: "4.5★", score: 4.5, maxScore: 5 },
      link: { href: "https://www.myntra.com/shirts/1", text: "Roadster Red Checked Shirt" },
      matchClassification: "confirmed" as const,
      score: 10,
      verifiedConditions: [
        "Category shirt confirmed",
        "Color red confirmed",
        "Pattern checked confirmed",
        "Size XL confirmed in stock (inspected via open Shadow DOM)",
        "Price ₹699 <= ₹1,000",
      ],
      unverifiedConditions: [],
      reasons: ["Size XL verified in stock inside Shadow DOM", "Price within budget"],
    };

    const outcomeCompleted = verifyFinalWebsiteState(mockPageContext, baseShoppingIntent, {
      verifiedCandidateProducts: [verifiedProduct],
    });
    assert.strictEqual(outcomeCompleted.status, "COMPLETED", "Task must be COMPLETED when shadow DOM verified size satisfies constraints");

    // Subtest B: Candidate with size XL out of stock inside Shadow DOM -> zero confirmed matches -> PARTIALLY COMPLETED
    const outcomePartial = verifyFinalWebsiteState(mockPageContext, baseShoppingIntent, {
      verifiedCandidateProducts: [],
    });
    assert.strictEqual(outcomePartial.status, "PARTIALLY COMPLETED", "Zero verified candidates must NEVER be marked COMPLETED");
    assert.notStrictEqual(outcomePartial.status, "COMPLETED");

    console.log("✓ Test 24: Invariant strictly upheld: COMPLETED requires verified evidence for every mandatory constraint: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 25: Uninstantiated Declarative Shadow DOM Template Safety Guard
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 25: Uninstantiated Declarative Shadow DOM Template Safety Guard ---");

    const page = new MockPdpElement("DIV");
    const hostWithInertTemplate = new MockPdpElement("CUSTOM-COMPONENT");
    const tpl = new MockPdpElement("TEMPLATE");
    tpl.setAttribute("shadowrootmode", "open");

    const tplContent = new MockPdpElement("DIV");
    const inertXlBtn = new MockPdpElement("BUTTON");
    inertXlBtn.className = "size-pill";
    inertXlBtn.textContent = "XL";
    tplContent.appendChild(inertXlBtn);

    // Attach inert content to template
    (tpl as any).content = tplContent;
    hostWithInertTemplate.appendChild(tpl);
    page.appendChild(hostWithInertTemplate);

    const extraction = extractPdpSizeOptions(page as any);
    assert.strictEqual(
      extraction.availableSizes.includes("XL"),
      false,
      "Uninstantiated template blueprint must NEVER be assumed active or in-stock"
    );

    const sizeRes = parseSizeAvailability(page as any, "XL");
    assert.strictEqual(
      sizeRes.status,
      "unverified",
      "Uninstantiated template must report unverified status"
    );
    assert.strictEqual(sizeRes.isAvailable, false);
    assert.strictEqual(sizeRes.isSelectable, false);
    assert.ok(
      sizeRes.evidence.includes("uninstantiated template"),
      "Evidence must truthfully report uninstantiated template status"
    );

    console.log("✓ Test 25: Uninstantiated template blueprint strictly prevented from reporting active controls: PASS\n");
  }

  // ------------------------------------------------------------------
  // TEST 26: Real-World Web Component Select Dropdown Traversal (Polymer Pattern)
  // ------------------------------------------------------------------
  {
    console.log("--- TEST 26: Real-World Web Component Select Dropdown Traversal (Polymer Pattern) ---");

    const app = new MockPdpElement("SHOP-APP");
    const appShadow = app.attachShadow({ mode: "open" });

    const detail = new MockPdpElement("SHOP-DETAIL");
    const detailShadow = detail.attachShadow({ mode: "open" });
    appShadow.appendChild(detail);

    const select = new MockPdpElement("SELECT");
    select.id = "sizeSelect";

    const optS = new MockPdpElement("OPTION");
    optS.textContent = "S";
    optS.setAttribute("value", "S");

    const optL = new MockPdpElement("OPTION");
    optL.textContent = "L";
    optL.setAttribute("value", "L");
    optL.disabled = true;
    optL.setAttribute("disabled", "true");

    const optXL = new MockPdpElement("OPTION");
    optXL.textContent = "XL";
    optXL.setAttribute("value", "XL");

    select.appendChild(optS);
    select.appendChild(optL);
    select.appendChild(optXL);
    detailShadow.appendChild(select);

    const extraction = extractPdpSizeOptions(app as any);
    assert.ok(extraction.availableSizes.includes("S"));
    assert.ok(extraction.availableSizes.includes("XL"));
    assert.ok(extraction.unavailableSizes.includes("L"), "Disabled <option> must be recognized as out of stock");
    assert.strictEqual(extraction.shadowRootsEncountered, 2, "Both shop-app and shop-detail shadow roots traversed");

    const resXL = parseSizeAvailability(app as any, "XL");
    assert.strictEqual(resXL.status, "in_stock");
    assert.strictEqual(resXL.isAvailable, true);
    assert.strictEqual(resXL.isSelectable, true);
    assert.strictEqual(resXL.source, "shadow_dom");

    const resL = parseSizeAvailability(app as any, "L");
    assert.strictEqual(resL.status, "out_of_stock");
    assert.strictEqual(resL.isAvailable, false);

    console.log("✓ Test 26: Real-world Web Component select dropdown traversed inside nested shadow roots: PASS\n");
  }

  console.log("======================================================================");
  console.log("🎉 ALL 26 PRODUCT VERIFIER & SHADOW DOM TESTS PASSED WITH 100%!");
  console.log("======================================================================\n");
}

runProductVerifierSuite().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
